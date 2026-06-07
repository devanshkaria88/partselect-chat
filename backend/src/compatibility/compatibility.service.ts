import { Injectable } from '@nestjs/common';
import { CompatResult, CompatVerdict, ProductCard } from '@partselect/types';
import { CatalogService, toCard } from '../catalog/catalog.service';
import { DbService } from '../db/db.service';

@Injectable()
export class CompatibilityService {
  constructor(
    private readonly db: DbService,
    private readonly catalog: CatalogService,
  ) {}

  /** Deterministic table lookup. Distinguishes a true INCOMPATIBLE (we have the model's data,
   *  this part isn't on it) from UNKNOWN (we have no data for that model — never guess). */
  async check(psNumber: string, modelNumber: string): Promise<CompatResult> {
    const ps = psNumber.trim().toUpperCase();
    const model = modelNumber.trim().toUpperCase();
    const part = await this.catalog.getByPsOrMpn(ps);
    const partName = part?.name ?? null;
    const sourceUrl = part?.url ?? null;

    const direct = await this.db.one<{ x: number }>(
      `SELECT 1 AS x FROM compatibility
       WHERE upper(part_ps_number) = $1 AND upper(model_number) = $2 LIMIT 1`,
      [ps, model],
    );
    if (direct) {
      return {
        kind: 'compat_result',
        ps_number: ps,
        part_name: partName,
        model_number: model,
        verdict: 'COMPATIBLE',
        reason: `${partName ?? ps} is confirmed to fit model ${model}.`,
        source_url: sourceUrl,
      };
    }

    // Do we have ANY compatibility data for this model (from other parts)?
    const modelKnown = await this.db.one<{ x: number }>(
      `SELECT 1 AS x FROM compatibility WHERE upper(model_number) = $1 LIMIT 1`,
      [model],
    );

    if (modelKnown) {
      const suggested = await this.suggestForModel(model, part?.part_type ?? null, part?.appliance ?? null);
      const verdict: CompatVerdict = 'INCOMPATIBLE';
      return {
        kind: 'compat_result',
        ps_number: ps,
        part_name: partName,
        model_number: model,
        verdict,
        reason: suggested
          ? `${partName ?? ps} is not listed as compatible with model ${model}. Here's a part of the same type that is.`
          : `${partName ?? ps} is not listed as compatible with model ${model}.`,
        suggested_part: suggested,
        source_url: sourceUrl,
      };
    }

    return {
      kind: 'compat_result',
      ps_number: ps,
      part_name: partName,
      model_number: model,
      verdict: 'UNKNOWN',
      reason: `I don't have verified compatibility data for model ${model} yet, so I can't confirm the fit. You can check the model's parts on the PartSelect page.`,
      source_url: sourceUrl,
    };
  }

  /** A same-type part that IS compatible with the model — the "did you mean" suggestion. */
  private async suggestForModel(
    model: string,
    partType: string | null,
    appliance: string | null,
  ): Promise<ProductCard | null> {
    const params: unknown[] = [model];
    let typeFilter = '';
    if (partType) {
      params.push(partType);
      typeFilter = ` AND p.part_type = $${params.length}`;
    } else if (appliance) {
      params.push(appliance);
      typeFilter = ` AND p.appliance = $${params.length}`;
    }
    const row = await this.db.one(
      `SELECT p.ps_number, p.mpn, p.name, p.brand, p.price, p.currency, p.availability,
              p.rating, p.review_count, p.image, p.appliance, p.part_type, p.url
       FROM compatibility c JOIN products p ON p.ps_number = c.part_ps_number
       WHERE upper(c.model_number) = $1 AND p.in_scope${typeFilter}
       ORDER BY p.rating DESC NULLS LAST LIMIT 1`,
      params,
    );
    return row ? toCard(row as never) : null;
  }
}
