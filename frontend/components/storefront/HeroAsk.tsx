'use client';

import { useState } from 'react';
import { useChat } from '@/lib/store';

const CHIPS = [
  'How do I install part PS11752778?',
  'Is this part compatible with my WDT780SAEM1?',
  'My Whirlpool fridge ice maker isn’t working',
];

const PROMISES = ['Genuine OEM parts guaranteed to fit', 'Free manuals and guides', 'Repair instructions and videos'];

export function HeroAsk() {
  const send = useChat((s) => s.send);
  const [v, setV] = useState('');

  const submit = (text: string) => {
    if (!text.trim()) return;
    setV('');
    void send(text);
  };

  return (
    <section className="bg-brand-yellow">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-ink sm:text-3xl">Find Your Part</h1>
          <p className="mt-1 text-sm text-brand-ink/80">
            Tell our assistant your model number, part number, or what’s going wrong — grounded answers, real prices, step-by-step help.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(v);
            }}
            className="mt-3 flex max-w-xl border border-brand-ink/15 bg-white shadow-card"
          >
            <input
              value={v}
              onChange={(e) => setV(e.target.value)}
              placeholder="Search model # or part # — or describe the problem"
              className="w-full px-4 py-3 text-brand-ink outline-none placeholder:text-brand-teal/50"
              aria-label="Ask the assistant"
            />
            <button type="submit" className="shrink-0 bg-brand-teal px-6 py-3 font-bold uppercase tracking-wide text-white transition hover:bg-brand-tealDark">
              Search
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => submit(c)}
                className="border border-brand-ink/15 bg-white/70 px-3 py-1 text-xs font-medium text-brand-ink transition hover:bg-white"
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <ul className="space-y-1.5 text-sm text-brand-ink">
          <li className="mb-1 font-semibold">Search your model number to find:</li>
          {PROMISES.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#347778" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
