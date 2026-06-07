'use client';

import { useState } from 'react';
import { useChat } from '@/lib/store';

const NAV = ['Departments', 'Brands', 'Symptoms', 'Blog', 'Repair Help', 'Water Filter Finder'];

export function TopNav() {
  const cart = useChat((s) => s.cart);
  const setCartOpen = useChat((s) => s.setCartOpen);
  const openWidget = useChat((s) => s.openWidget);
  const send = useChat((s) => s.send);
  const [q, setQ] = useState('');
  const count = cart?.items.reduce((n, l) => n + l.qty, 0) ?? 0;

  return (
    <header className="border-b border-gray-200">
      {/* Row 1 — white utility bar */}
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <a href="/" className="flex flex-col leading-none">
          <span className="flex items-center gap-1 text-2xl font-extrabold tracking-tight">
            <span className="grid h-6 w-6 place-items-center bg-brand-yellow text-sm text-brand-ink">⌂</span>
            <span className="text-brand-teal">Part</span>
            <span className="text-brand-ink">Select</span>
          </span>
          <span className="ml-7 text-[11px] font-medium text-brand-teal">Here to help since 1999</span>
        </a>

        <nav className="ml-auto flex items-center gap-5 text-sm font-medium text-brand-ink">
          <button onClick={openWidget} className="flex items-center gap-1.5 hover:text-brand-teal" aria-label="Start chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
            </svg>
            <span className="hidden sm:inline">Start Chat</span>
          </button>
          <span className="hidden items-center gap-1.5 md:flex">Order Status</span>
          <span className="hidden items-center gap-1.5 md:flex">Your Account</span>
          <button onClick={() => setCartOpen(true)} className="relative hover:text-brand-teal" aria-label={`Cart, ${count} items`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
            </svg>
            {count > 0 && (
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center bg-brand-yellow px-1 text-[10px] font-bold text-brand-ink">{count}</span>
            )}
          </button>
        </nav>
      </div>

      {/* Row 2 — teal category nav + search */}
      <div className="bg-brand-teal text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-4">
          <ul className="flex flex-1 items-center gap-1 overflow-x-auto py-2.5 text-sm font-medium">
            {NAV.map((n) => (
              <li key={n} className="whitespace-nowrap px-2.5 py-0.5 hover:text-brand-yellow">{n}</li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) {
                void send(q);
                setQ('');
              }
            }}
            className="my-1.5 hidden items-center bg-white sm:flex"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search model or part number"
              className="w-56 px-3 py-1.5 text-sm text-brand-ink outline-none placeholder:text-brand-teal/50"
              aria-label="Search the catalog"
            />
            <button type="submit" className="bg-brand-yellow px-3 py-1.5 text-brand-ink" aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
