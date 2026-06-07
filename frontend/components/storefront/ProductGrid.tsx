import type { ProductCard } from '@partselect/types';
import { StorefrontCard } from './StorefrontCard';

export function ProductGrid({
  title,
  subtitle,
  products,
}: {
  title: string;
  subtitle?: string;
  products: ProductCard[];
}) {
  if (!products.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-brand-ink">{title}</h2>
          {subtitle && <p className="text-sm text-brand-teal/70">{subtitle}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <StorefrontCard key={p.ps_number} p={p} />
        ))}
      </div>
    </section>
  );
}
