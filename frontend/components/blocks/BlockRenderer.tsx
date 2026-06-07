'use client';

import type {
  CartBlock,
  CompatResult,
  InstallGuide,
  OrderStatusBlock,
  ProductCard,
  SuggestedPrompts,
  TroubleshootBlock,
  UIBlock,
  UnavailableBlock,
} from '@partselect/types';
import { useChat } from '@/lib/store';
import { availabilityStyle, price } from '@/lib/format';

function youtubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) || url.match(/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function SourceLink({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline">
      View on PartSelect
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
    </a>
  );
}

export function ChatProductCard({ p, compact = false }: { p: ProductCard; compact?: boolean }) {
  const addToCart = useChat((s) => s.addToCart);
  const avail = availabilityStyle(p.availability);
  return (
    <div className="flex gap-3 rounded-lg border border-brand-tealTint bg-white p-2.5 shadow-card">
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.image ? <img src={p.image} alt={p.name ?? ''} className="h-full w-full object-contain" loading="lazy" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-brand-teal/70">{p.brand} · {p.ps_number}</p>
        <h4 className="truncate text-sm font-semibold text-brand-ink">{p.name}</h4>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-base font-bold text-brand-ink">{price(p.price, p.currency)}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${avail.cls}`}>{avail.label}</span>
        </div>
        {!compact && (
          <div className="mt-2 flex gap-2">
            {p.actions.includes('add_to_cart') && (
              <button onClick={() => void addToCart(p.ps_number)} className="bg-brand-yellow px-2.5 py-1 text-xs font-bold text-brand-ink hover:bg-brand-yellowDark">
                Add to cart
              </button>
            )}
            <SourceLink url={p.source_url} />
          </div>
        )}
      </div>
    </div>
  );
}

function CompatView({ b }: { b: CompatResult }) {
  const map = {
    COMPATIBLE: { icon: '✓', cls: 'bg-ok-bg text-ok border-ok/30', label: 'Compatible' },
    INCOMPATIBLE: { icon: '✕', cls: 'bg-bad-bg text-bad border-bad/30', label: 'Not compatible' },
    UNKNOWN: { icon: '?', cls: 'bg-warn-bg text-warn border-warn/30', label: 'Can’t confirm' },
  }[b.verdict];
  return (
    <div className={`rounded-lg border p-3 ${map.cls}`}>
      <div className="flex items-center gap-2 font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/70 text-sm font-bold">{map.icon}</span>
        {map.label} with {b.model_number}
      </div>
      <p className="mt-1 text-sm text-brand-ink/80">{b.reason}</p>
      {b.suggested_part && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-semibold text-brand-ink/70">Try this instead:</p>
          <ChatProductCard p={b.suggested_part} />
        </div>
      )}
      <div className="mt-2"><SourceLink url={b.source_url} /></div>
    </div>
  );
}

function InstallView({ b }: { b: InstallGuide }) {
  if (!b.available) {
    return (
      <div className="rounded-lg border border-brand-tealTint bg-brand-tealTint/40 p-3 text-sm">
        <p className="font-semibold text-brand-ink">Installation guide for {b.part_name ?? b.ps_number}</p>
        <p className="mt-1 text-brand-ink/70">I don’t have a verified step-by-step guide for this part yet — the product page has the manufacturer instructions.</p>
        <div className="mt-2"><SourceLink url={b.source_url} /></div>
      </div>
    );
  }
  const vid = youtubeId(b.video_url);
  return (
    <div className="rounded-lg border border-brand-tealTint bg-white p-3 shadow-card">
      <p className="font-semibold text-brand-ink">How to install {b.part_name ?? b.ps_number}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {b.difficulty && <span className="rounded-full bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok">{b.difficulty}</span>}
        {b.time_estimate && <span className="rounded-full bg-brand-tealTint px-2 py-0.5 text-xs font-semibold text-brand-teal">⏱ {b.time_estimate}</span>}
        {(b.tools ?? []).map((t) => (
          <span key={t} className="rounded-full bg-brand-tealTint px-2 py-0.5 text-xs text-brand-teal">{t}</span>
        ))}
      </div>
      {vid && (
        <div className="mt-3 aspect-video w-full overflow-hidden rounded-md bg-black">
          <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${vid}`} title="How-to video" loading="lazy" allowFullScreen />
        </div>
      )}
      {b.steps && b.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-brand-ink/85">
          {b.steps.map((s) => (
            <li key={s.n}>{s.text}</li>
          ))}
        </ol>
      )}
      <div className="mt-2"><SourceLink url={b.source_url} /></div>
    </div>
  );
}

function TroubleshootView({ b }: { b: TroubleshootBlock }) {
  return (
    <div className="rounded-lg border border-brand-tealTint bg-white p-3 shadow-card">
      <p className="font-semibold text-brand-ink">Likely fix: {b.symptom}</p>
      {b.causes.length > 0 && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-brand-ink/80">
          {b.causes.map((c) => (
            <li key={c.rank}>{c.cause}</li>
          ))}
        </ol>
      )}
      {b.parts.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal/70">Recommended parts</p>
          {b.parts.map((p) => (
            <ChatProductCard key={p.ps_number} p={p} />
          ))}
        </div>
      )}
      <p className="mt-3 rounded-md bg-warn-bg px-2.5 py-1.5 text-xs text-warn">⚠ {b.safety_note}</p>
    </div>
  );
}

function CartView({ b }: { b: CartBlock }) {
  const checkoutCart = useChat((s) => s.checkoutCart);
  return (
    <div className="rounded-lg border border-brand-tealTint bg-white p-3 shadow-card">
      <p className="font-semibold text-brand-ink">Your cart</p>
      {b.items.length === 0 ? (
        <p className="mt-1 text-sm text-brand-ink/60">{b.note ?? 'Empty.'}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-brand-tealTint text-sm">
            {b.items.map((l) => (
              <li key={l.ps_number} className="flex items-center justify-between py-1.5">
                <span className="min-w-0 truncate text-brand-ink/85">{l.qty}× {l.name ?? l.ps_number}</span>
                <span className="font-semibold">{price((l.unit_price ?? 0) * l.qty, b.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-brand-tealTint pt-2">
            <span className="text-sm font-semibold">Subtotal</span>
            <span className="text-base font-bold">{price(b.subtotal, b.currency)}</span>
          </div>
          <button onClick={() => void checkoutCart()} className="mt-2 w-full bg-brand-yellow px-3 py-2 text-sm font-bold text-brand-ink hover:bg-brand-yellowDark">
            Checkout
          </button>
        </>
      )}
      {b.items.length > 0 && b.note && <p className="mt-1 text-xs text-brand-teal/70">{b.note}</p>}
    </div>
  );
}

function OrderView({ b }: { b: OrderStatusBlock }) {
  return (
    <div className="rounded-lg border border-ok/30 bg-ok-bg p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-brand-ink">Order {b.order_number}</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold capitalize text-ok">{b.status}</span>
      </div>
      {b.eta && <p className="mt-0.5 text-sm text-brand-ink/75">{b.eta}</p>}
      <ul className="mt-1 text-sm text-brand-ink/75">
        {b.items.map((i, idx) => (
          <li key={idx}>• {i}</li>
        ))}
      </ul>
      {b.total != null && <p className="mt-1 text-sm font-semibold">Total: {price(b.total)}</p>}
    </div>
  );
}

function SuggestedChips({ b }: { b: SuggestedPrompts }) {
  const send = useChat((s) => s.send);
  return (
    <div className="flex flex-wrap gap-2">
      {b.chips.map((c) => (
        <button key={c} onClick={() => void send(c)} className="rounded-full border border-brand-teal/30 bg-brand-tealTint px-3 py-1 text-xs font-medium text-brand-teal hover:bg-brand-teal hover:text-white">
          {c}
        </button>
      ))}
    </div>
  );
}

function UnavailableView({ b }: { b: UnavailableBlock }) {
  return (
    <div className="rounded-lg border border-brand-tealTint bg-brand-tealTint/40 p-3 text-sm text-brand-ink/80">
      {b.message}
      {b.source_url ? <div className="mt-1"><SourceLink url={b.source_url} /></div> : null}
    </div>
  );
}

export function BlockRenderer({ block }: { block: UIBlock }) {
  switch (block.kind) {
    case 'product_card':
      return <ChatProductCard p={block} />;
    case 'compat_result':
      return <CompatView b={block} />;
    case 'install_guide':
      return <InstallView b={block} />;
    case 'troubleshoot':
      return <TroubleshootView b={block} />;
    case 'cart':
      return <CartView b={block} />;
    case 'order_status':
      return <OrderView b={block} />;
    case 'suggested_prompts':
      return <SuggestedChips b={block} />;
    case 'unavailable':
      return <UnavailableView b={block} />;
    default:
      return null;
  }
}
