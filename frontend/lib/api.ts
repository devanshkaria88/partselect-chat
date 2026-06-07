import type { ProductCard } from '@partselect/types';

/** Server-to-server base URL for the NestJS API (never exposed to the browser). */
export const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';

export interface Facets {
  brands: Array<{ brand: string; n: number }>;
  appliances: Array<{ appliance: string; n: number }>;
}

export async function fetchProducts(params: { appliance?: string; brand?: string; limit?: number } = {}): Promise<ProductCard[]> {
  const q = new URLSearchParams();
  if (params.appliance) q.set('appliance', params.appliance);
  if (params.brand) q.set('brand', params.brand);
  q.set('limit', String(params.limit ?? 24));
  try {
    const res = await fetch(`${INTERNAL_API_URL}/catalog/products?${q}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { items: ProductCard[] };
    return json.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchFacets(): Promise<Facets> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/catalog/facets`, { cache: 'no-store' });
    if (!res.ok) return { brands: [], appliances: [] };
    return (await res.json()) as Facets;
  } catch {
    return { brands: [], appliances: [] };
  }
}
