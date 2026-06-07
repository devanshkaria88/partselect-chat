import { Injectable } from '@nestjs/common';
import { Availability, ProductCard } from '@partselect/types';
import { DbService } from '../db/db.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

export interface ProductRow {
  ps_number: string;
  mpn: string | null;
  name: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  availability: string | null;
  rating: number | null;
  review_count: number | null;
  description: string | null;
  image: string | null;
  appliance: string | null;
  part_type: string | null;
  url: string | null;
}

export interface SearchParams {
  query?: string;
  appliance?: string;
  brand?: string;
  part_type?: string;
  max_price?: number;
  in_stock_only?: boolean;
  limit?: number;
}

const SELECT_COLS = `ps_number, mpn, name, brand, price, currency, availability,
  rating, review_count, description, image, appliance, part_type, url`;

function normAvailability(a: string | null): Availability {
  if (a === 'InStock' || a === 'OnOrder' || a === 'SpecialOrder') return a;
  return 'Unknown';
}

export function toCard(r: ProductRow): ProductCard {
  const purchasable = r.price != null && r.availability !== 'SpecialOrder';
  return {
    kind: 'product_card',
    ps_number: r.ps_number,
    mpn: r.mpn,
    name: r.name,
    brand: r.brand,
    price: r.price,
    currency: r.currency,
    availability: normAvailability(r.availability),
    rating: r.rating,
    review_count: r.review_count,
    image: r.image,
    part_type: r.part_type,
    appliance: r.appliance,
    source_url: r.url,
    actions: purchasable ? ['view', 'add_to_cart'] : ['view'],
  };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: DbService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async getByPsOrMpn(idOrMpn: string): Promise<ProductRow | null> {
    const key = idOrMpn.trim().toUpperCase();
    return this.db.one<ProductRow>(
      `SELECT ${SELECT_COLS} FROM products
       WHERE upper(ps_number) = $1 OR upper(mpn) = $1 LIMIT 1`,
      [key],
    );
  }

  /** Hybrid retrieval: structured filters always apply; ranking is vector-semantic when a
   *  query + embeddings are available, trigram-fuzzy otherwise, else rating-sorted. */
  async search(p: SearchParams): Promise<ProductRow[]> {
    const where: string[] = ['p.in_scope = true'];
    const params: unknown[] = [];
    const add = (clause: string, val: unknown) => {
      params.push(val);
      where.push(clause.replace('$?', `$${params.length}`));
    };

    if (p.appliance) add('p.appliance ILIKE $?', p.appliance);
    if (p.brand) add('p.brand ILIKE $?', `%${p.brand}%`);
    if (p.part_type) add('p.part_type ILIKE $?', `%${p.part_type}%`);
    if (p.max_price != null) add('(p.price IS NOT NULL AND p.price <= $?)', p.max_price);
    if (p.in_stock_only) where.push(`p.availability = 'InStock'`);

    const limit = Math.min(p.limit ?? 6, 24);
    const whereSql = where.join(' AND ');
    const cols = SELECT_COLS.replace(/(\w+)/g, 'p.$1');

    if (p.query) {
      // Semantic first (when embeddings exist), then trigram fuzzy — fall through if the
      // vector path yields nothing (e.g. embeddings not loaded), so search never dead-ends.
      const vec = await this.embeddings.embedQuery(p.query);
      if (vec) {
        const vparams = [...params, vec, limit];
        const rows = await this.db.query<ProductRow>(
          `SELECT ${cols} FROM products p
           JOIN product_embeddings e ON e.ps_number = p.ps_number
           WHERE ${whereSql}
           ORDER BY e.embedding <=> $${vparams.length - 1}::vector ASC
           LIMIT $${vparams.length}`,
          vparams,
        );
        if (rows.length) return rows;
      }
      const tparams = [...params, p.query, `%${p.query}%`, limit];
      const qIdx = tparams.length - 2;
      const likeIdx = tparams.length - 1;
      return this.db.query<ProductRow>(
        `SELECT ${cols}, similarity(p.name, $${qIdx}) AS sim FROM products p
         WHERE ${whereSql} AND (p.name % $${qIdx} OR p.name ILIKE $${likeIdx} OR p.description ILIKE $${likeIdx})
         ORDER BY sim DESC NULLS LAST, p.review_count DESC NULLS LAST
         LIMIT $${tparams.length}`,
        tparams,
      );
    }

    const sparams = [...params, limit];
    return this.db.query<ProductRow>(
      `SELECT ${cols} FROM products p WHERE ${whereSql}
       ORDER BY p.rating DESC NULLS LAST, p.review_count DESC NULLS LAST
       LIMIT $${sparams.length}`,
      sparams,
    );
  }

  /** Storefront grid (Phase 5): in-scope products with simple paging. */
  async listForStorefront(opts: { appliance?: string; brand?: string; offset?: number; limit?: number }) {
    const where: string[] = ['in_scope = true'];
    const params: unknown[] = [];
    if (opts.appliance) {
      params.push(opts.appliance);
      where.push(`appliance = $${params.length}`);
    }
    if (opts.brand) {
      params.push(`%${opts.brand}%`);
      where.push(`brand ILIKE $${params.length}`);
    }
    params.push(Math.min(opts.limit ?? 24, 60), opts.offset ?? 0);
    const rows = await this.db.query<ProductRow>(
      `SELECT ${SELECT_COLS} FROM products WHERE ${where.join(' AND ')}
       ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows.map(toCard);
  }

  async facets() {
    const brands = await this.db.query<{ brand: string; n: number }>(
      `SELECT brand, count(*)::int AS n FROM products WHERE in_scope GROUP BY brand ORDER BY n DESC`,
    );
    const appliances = await this.db.query<{ appliance: string; n: number }>(
      `SELECT appliance, count(*)::int AS n FROM products WHERE in_scope GROUP BY appliance ORDER BY n DESC`,
    );
    return { brands, appliances };
  }
}
