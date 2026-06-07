import { fetchProducts } from '@/lib/api';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { HeroAsk } from '@/components/storefront/HeroAsk';

export default async function Home() {
  const [fridge, dish] = await Promise.all([
    fetchProducts({ appliance: 'Refrigerator', limit: 8 }),
    fetchProducts({ appliance: 'Dishwasher', limit: 8 }),
  ]);

  return (
    <div>
      <HeroAsk />
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <ProductGrid title="Popular Refrigerator Parts" subtitle="Genuine OEM replacements, ready to ship" products={fridge} />
        <ProductGrid title="Popular Dishwasher Parts" subtitle="Spray arms, racks, filters and more" products={dish} />
        {fridge.length === 0 && dish.length === 0 && (
          <p className="bg-warn-bg p-4 text-sm text-warn">
            The catalog API isn’t reachable yet. Start the backend (and seed Postgres) to see products.
          </p>
        )}
      </div>
    </div>
  );
}
