'use client';

import { useChat } from '@/lib/store';
import { price } from '@/lib/format';

function QtyButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid h-6 w-6 place-items-center border border-brand-tealTint text-brand-teal transition hover:bg-brand-tealTint disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setCartQty, checkoutCart, lastOrder, clearLastOrder, openWidget } = useChat();
  if (!cartOpen) return null;

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-brand-ink/30" onClick={() => setCartOpen(false)} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-float" role="dialog" aria-label="Cart">
        <div className="flex items-center justify-between bg-brand-teal px-4 py-3 text-white">
          <p className="font-bold">Your Cart</p>
          <button onClick={() => setCartOpen(false)} className="p-1.5 hover:bg-white/10" aria-label="Close cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="ps-scroll flex-1 overflow-y-auto p-4">
          {/* Order confirmation after a manual checkout */}
          {lastOrder && (
            <div className="mb-4 border border-ok/30 bg-ok-bg p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-brand-ink">Order placed 🎉</p>
                <span className="bg-white px-2 py-0.5 text-xs font-semibold capitalize text-ok">{lastOrder.status}</span>
              </div>
              <p className="mt-0.5 text-sm text-brand-ink/80">{lastOrder.order_number}{lastOrder.eta ? ` · ${lastOrder.eta}` : ''}</p>
              <ul className="mt-1 text-sm text-brand-ink/75">
                {lastOrder.items.map((i, idx) => (
                  <li key={idx}>• {i}</li>
                ))}
              </ul>
              {lastOrder.total != null && <p className="mt-1 text-sm font-semibold">Total: {price(lastOrder.total)}</p>}
              <button onClick={clearLastOrder} className="mt-2 w-full border border-brand-teal/30 px-3 py-1.5 text-sm font-medium text-brand-teal hover:bg-brand-tealTint">
                Continue shopping
              </button>
            </div>
          )}

          {items.length === 0 ? (
            !lastOrder && (
              <div className="mt-10 text-center text-sm text-brand-teal/70">
                <p className="text-base font-semibold text-brand-ink">Your cart is empty</p>
                <p className="mt-1">Add parts from the storefront, or ask the assistant to find one.</p>
                <button
                  onClick={() => {
                    setCartOpen(false);
                    openWidget();
                  }}
                  className="mt-4 bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-tealDark"
                >
                  Ask the assistant
                </button>
              </div>
            )
          ) : (
            <ul className="divide-y divide-brand-tealTint">
              {items.map((l) => (
                <li key={l.ps_number} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-ink">{l.name ?? l.ps_number}</p>
                    <p className="text-xs text-brand-teal/60">{l.ps_number} · {price(l.unit_price)} ea</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <QtyButton label="−" onClick={() => void setCartQty(l.ps_number, l.qty - 1)} />
                      <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                      <QtyButton label="+" onClick={() => void setCartQty(l.ps_number, l.qty + 1)} />
                      <button onClick={() => void setCartQty(l.ps_number, 0)} className="ml-2 text-xs text-bad hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold text-brand-ink">{price((l.unit_price ?? 0) * l.qty)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-brand-tealTint p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">Subtotal</span>
              <span className="text-lg font-bold">{price(subtotal)}</span>
            </div>
            <button onClick={() => void checkoutCart()} className="w-full bg-brand-yellow px-4 py-2.5 font-bold text-brand-ink hover:bg-brand-yellowDark">
              Checkout
            </button>
            <p className="mt-2 text-center text-[11px] text-brand-teal/50">Simulated checkout for this demo</p>
          </div>
        )}
      </aside>
    </div>
  );
}
