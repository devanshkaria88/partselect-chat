import { Injectable } from '@nestjs/common';
import { ProductCard, TroubleshootBlock, TroubleshootCause, UnavailableBlock } from '@partselect/types';
import { ProductRow, toCard } from '../catalog/catalog.service';
import { DbService } from '../db/db.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

interface SymptomRow {
  id: number;
  appliance: string;
  symptom: string;
  recommended_parts: string[];
}

export interface TroubleshootResult {
  block: TroubleshootBlock | UnavailableBlock;
  /** Grounding for the agent to compose ranked causes + repair steps. */
  data: unknown;
}

function safetyNote(appliance: string): string {
  return appliance.toLowerCase().includes('dishwash')
    ? 'Safety first: turn off the dishwasher at the breaker and shut off its water supply before any repair.'
    : 'Safety first: unplug the refrigerator (or switch off its breaker) before servicing any component.';
}

@Injectable()
export class TroubleshootService {
  constructor(
    private readonly db: DbService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async find(appliance: string, symptom: string, brand?: string): Promise<TroubleshootResult> {
    const appl = appliance || 'Refrigerator';
    const best = await this.matchSymptom(appl, symptom);

    if (!best) {
      const block: UnavailableBlock = {
        kind: 'unavailable',
        capability: 'troubleshoot',
        message: `I don't have a diagnosed match for that ${appl.toLowerCase()} symptom yet. Tell me a bit more about what it's doing (and the brand/model) and I'll find the likely parts.`,
      };
      return { block, data: { found: false } };
    }

    const parts = await this.fetchParts(best.recommended_parts, brand);
    const cards = parts.map(toCard);
    const causes: TroubleshootCause[] = cards.slice(0, 5).map((c, i) => ({
      rank: i + 1,
      cause: `${c.part_type ?? 'Component'} may be worn or failed`,
      recommended_ps: c.ps_number,
    }));

    const block: TroubleshootBlock = {
      kind: 'troubleshoot',
      appliance: appl,
      brand: brand ?? null,
      symptom: best.symptom,
      causes,
      parts: cards,
      repair_steps: [],
      safety_note: safetyNote(appl),
    };
    return {
      block,
      data: {
        found: true,
        symptom: best.symptom,
        appliance: appl,
        recommended: cards.map((c: ProductCard) => ({
          ps_number: c.ps_number,
          name: c.name,
          part_type: c.part_type,
          brand: c.brand,
          price: c.price,
          availability: c.availability,
        })),
      },
    };
  }

  private async matchSymptom(appliance: string, symptom: string): Promise<SymptomRow | null> {
    const vec = await this.embeddings.embedQuery(`${appliance} ${symptom}`);
    if (vec) {
      const row = await this.db.one<SymptomRow>(
        `SELECT s.id, s.appliance, s.symptom, s.recommended_parts
         FROM symptoms s JOIN symptom_embeddings e ON e.symptom_id = s.id
         WHERE s.appliance ILIKE $1
         ORDER BY e.embedding <=> $2::vector ASC LIMIT 1`,
        [appliance, vec],
      );
      if (row) return row; // else fall through to trigram (e.g. embeddings not loaded)
    }
    // Trigram / keyword fallback.
    return this.db.one<SymptomRow>(
      `SELECT id, appliance, symptom, recommended_parts FROM symptoms
       WHERE appliance ILIKE $1 AND (symptom % $2 OR symptom ILIKE $3)
       ORDER BY similarity(symptom, $2) DESC NULLS LAST LIMIT 1`,
      [appliance, symptom, `%${symptom}%`],
    );
  }

  private async fetchParts(psNumbers: string[], brand?: string): Promise<ProductRow[]> {
    if (!psNumbers?.length) return [];
    const params: unknown[] = [psNumbers];
    const brandOrder = brand ? `(brand ILIKE $2) DESC NULLS LAST,` : '';
    if (brand) params.push(`%${brand}%`);
    return this.db.query<ProductRow>(
      `SELECT ps_number, mpn, name, brand, price, currency, availability, rating, review_count,
              image, appliance, part_type, url
       FROM products WHERE ps_number = ANY($1) AND in_scope
       ORDER BY ${brandOrder} rating DESC NULLS LAST LIMIT 6`,
      params,
    );
  }
}
