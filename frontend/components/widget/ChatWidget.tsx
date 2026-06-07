'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat, type ChatMessage, type Segment } from '@/lib/store';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { miniMarkdown } from '@/lib/format';

const GREETING_CHIPS = [
  'How do I install part PS11752778?',
  'Is this part compatible with my WDT780SAEM1?',
  'My Whirlpool fridge ice maker isn’t working',
  'Door shelf bin for a Frigidaire fridge under $30',
];

function ToolPill({ seg }: { seg: Extract<Segment, { type: 'tool' }> }) {
  return (
    <div className="flex">
      <span className="flex items-center gap-1.5 bg-brand-tealTint px-2.5 py-1 text-[11px] font-medium text-brand-teal">
        {seg.status === 'running' ? (
          <span className="h-2.5 w-2.5 animate-spin rounded-full border border-brand-teal border-t-transparent" />
        ) : (
          <span className="text-ok">✓</span>
        )}
        {seg.label}
      </span>
    </div>
  );
}

function Typing() {
  return (
    <div className="w-fit bg-brand-tealTint px-3.5 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 animate-blink rounded-full bg-brand-teal/50" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  );
}

function Message({ m }: { m: ChatMessage }) {
  if (m.role === 'user') {
    const text = m.segments.map((s) => (s.type === 'text' ? s.text : '')).join('');
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-brand-teal px-3.5 py-2 text-sm text-white">{text}</div>
      </div>
    );
  }
  const hasContent = m.segments.some(
    (s) => (s.type === 'text' && s.text.trim()) || s.type === 'block' || s.type === 'tool',
  );
  return (
    <div className="animate-fade-up space-y-2">
      {m.segments.map((s, i) => {
        if (s.type === 'text') {
          return s.text.trim() ? (
            <div
              key={i}
              className="ps-prose max-w-[94%] bg-brand-tealTint px-3.5 py-2 text-sm text-brand-ink"
              dangerouslySetInnerHTML={{ __html: miniMarkdown(s.text) }}
            />
          ) : null;
        }
        if (s.type === 'tool') return <ToolPill key={i} seg={s} />;
        return <BlockRenderer key={i} block={s.block} />;
      })}
      {m.streaming && !hasContent && <Typing />}
    </div>
  );
}

export function ChatWidget() {
  const { open, toggleOpen, messages, sending, send, reset, modelNumber, hydrate } = useChat();
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  if (!mounted) return null;

  const submit = () => {
    if (!input.trim()) return;
    const t = input;
    setInput('');
    void send(t);
  };

  return (
    <>
      {!open && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-teal px-5 py-3.5 font-semibold text-white shadow-float transition hover:bg-brand-tealDark"
          aria-label="Open the PartSelect assistant"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
          Need a part?
        </button>
      )}

      {open && (
        <div className="fixed inset-x-2 bottom-2 z-40 flex h-[80vh] flex-col overflow-hidden rounded-2xl border border-brand-tealTint bg-white shadow-float sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[640px] sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-brand-teal px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold leading-tight">PartSelect Assistant</p>
              <p className="text-[11px] text-white/75">Fridge & dishwasher parts · since 1999</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => void reset()} className="rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10" title="Clear chat">Clear</button>
              <button onClick={toggleOpen} className="rounded-md p-1.5 hover:bg-white/10" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {modelNumber && (
            <div className="flex items-center gap-2 border-b border-brand-tealTint bg-brand-tealTint/50 px-4 py-1.5 text-xs text-brand-teal">
              <span className="rounded-full bg-white px-2 py-0.5 font-semibold">Model: {modelNumber}</span>
              <span className="text-brand-teal/70">remembered for compatibility checks</span>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="ps-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="ps-prose rounded-2xl rounded-bl-sm bg-brand-tealTint px-3.5 py-2 text-sm text-brand-ink">
                  Hi! I’m here to help with <strong>refrigerator and dishwasher</strong> parts. Tell me a
                  part number, your model number, or what’s going wrong.
                </div>
                <div className="flex flex-wrap gap-2">
                  {GREETING_CHIPS.map((c) => (
                    <button key={c} onClick={() => void send(c)} className="rounded-full border border-brand-teal/25 bg-white px-3 py-1 text-xs text-brand-teal hover:bg-brand-tealTint">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => <Message key={m.id} m={m} />)
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-brand-tealTint bg-white p-3">
            <div className="flex items-end gap-2 rounded-xl border border-brand-tealTint bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-brand-teal/40">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="Ask about a part, model, or problem…"
                className="max-h-28 flex-1 resize-none bg-transparent py-1 text-sm outline-none"
                aria-label="Message"
              />
              <button
                onClick={submit}
                disabled={sending || !input.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-teal text-white transition enabled:hover:bg-brand-tealDark disabled:opacity-40"
                aria-label="Send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-brand-teal/50">Grounded in PartSelect’s catalog · refrigerator & dishwasher only</p>
          </div>
        </div>
      )}
    </>
  );
}
