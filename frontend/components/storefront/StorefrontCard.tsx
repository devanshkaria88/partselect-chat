'use client';

import type { ProductCard } from '@partselect/types';
import { useChat } from '@/lib/store';
import { availabilityStyle, price } from '@/lib/format';

export function StorefrontCard({ p }: { p: ProductCard }) {
  const send = useChat((s) => s.send);
  const addToCart = useChat((s) => s.addToCart);
  const avail = availabilityStyle(p.availability);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-brand-tealTint bg-white shadow-card transition hover:shadow-float">
      <div className="relative aspect-square bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.image ? (
          <img src={p.image} alt={p.name ?? p.ps_number} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-brand-teal/40">No image</div>
        )}
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${avail.cls}`}>
          {avail.label}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand-teal/70">{p.brand}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-brand-ink">{p.name}</h3>
        <p className="mt-0.5 text-xs text-brand-teal/60">{p.ps_number}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-brand-ink">{price(p.price, p.currency)}</span>
          {p.rating != null && (
            <span className="flex items-center gap-1 text-xs text-brand-teal/70">
              <span className="text-brand-yellow">★</span>
              {p.rating.toFixed(1)}
              {p.review_count ? <span className="text-brand-teal/40">({p.review_count})</span> : null}
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void send(`Tell me about part ${p.ps_number}`)}
            className="flex-1 rounded-md bg-brand-teal px-2 py-2 text-xs font-semibold text-white transition hover:bg-brand-tealDark"
          >
            Ask the assistant
          </button>
          {p.price != null && (
            <button
              onClick={() => void addToCart(p.ps_number)}
              className="border border-brand-yellowDark bg-brand-yellow px-2 py-2 text-xs font-semibold text-brand-ink transition hover:bg-brand-yellowDark"
              aria-label="Add to cart"
            >
              + Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
