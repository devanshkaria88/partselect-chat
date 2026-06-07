import { create } from 'zustand';
import type { CartBlock, ChatEvent, OrderStatusBlock, UIBlock } from '@partselect/types';

/** An assistant message is an ordered list of segments rendered in stream order, so a
 *  tool's card appears inline exactly where it occurred — not dumped at the bottom. */
export type Segment =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; label: string; status: 'running' | 'done' | 'error' }
  | { type: 'block'; block: UIBlock };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  segments: Segment[];
  streaming: boolean;
}

interface State {
  sessionId: string | null;
  modelNumber: string | null;
  messages: ChatMessage[];
  cart: CartBlock | null;
  lastOrder: OrderStatusBlock | null;
  open: boolean;
  cartOpen: boolean;
  sending: boolean;
  toggleOpen: () => void;
  openWidget: () => void;
  setCartOpen: (v: boolean) => void;
  clearLastOrder: () => void;
  hydrate: () => void;
  reset: () => Promise<void>;
  send: (text: string) => Promise<void>;
  // Direct (agent-free) cart operations.
  addToCart: (psNumber: string, quantity?: number) => Promise<void>;
  setCartQty: (psNumber: string, quantity: number) => Promise<void>;
  checkoutCart: () => Promise<void>;
}

const LS_KEY = 'ps_chat_v2';
const uuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function persist(s: Pick<State, 'sessionId' | 'modelNumber' | 'messages' | 'cart'>) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ sessionId: s.sessionId, modelNumber: s.modelNumber, messages: s.messages.slice(-30), cart: s.cart }),
    );
  } catch {
    /* ignore quota */
  }
}

export const useChat = create<State>((set, get) => ({
  sessionId: null,
  modelNumber: null,
  messages: [],
  cart: null,
  lastOrder: null,
  open: false,
  cartOpen: false,
  sending: false,

  toggleOpen: () => set((s) => ({ open: !s.open })),
  openWidget: () => set({ open: true }),
  setCartOpen: (v) => set({ cartOpen: v }),
  clearLastOrder: () => set({ lastOrder: null }),

  addToCart: async (psNumber, quantity = 1) => {
    let sessionId = get().sessionId;
    if (!sessionId) {
      sessionId = uuid();
      set({ sessionId });
    }
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, ps_number: psNumber, quantity }),
      });
      const d = await res.json();
      if (d.cart) set({ cart: d.cart, cartOpen: true, lastOrder: null });
    } catch {
      /* ignore */
    }
    const s = get();
    persist({ sessionId: s.sessionId, modelNumber: s.modelNumber, messages: s.messages, cart: s.cart });
  },

  setCartQty: async (psNumber, quantity) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    try {
      const res = await fetch('/api/cart/set-qty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, ps_number: psNumber, quantity }),
      });
      const d = await res.json();
      if (d.cart) set({ cart: d.cart });
    } catch {
      /* ignore */
    }
    const s = get();
    persist({ sessionId: s.sessionId, modelNumber: s.modelNumber, messages: s.messages, cart: s.cart });
  },

  checkoutCart: async () => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const d = await res.json();
      const r = d.result;
      if (r?.kind === 'order_status') {
        set({ lastOrder: r, cart: { kind: 'cart', items: [], subtotal: 0, currency: 'USD', note: null } });
      } else if (r?.kind === 'cart') {
        set({ cart: r });
      }
    } catch {
      /* ignore */
    }
    const s = get();
    persist({ sessionId: s.sessionId, modelNumber: s.modelNumber, messages: s.messages, cart: s.cart });
  },

  hydrate: () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        set({ sessionId: d.sessionId ?? null, modelNumber: d.modelNumber ?? null, messages: d.messages ?? [], cart: d.cart ?? null });
      }
    } catch {
      /* ignore */
    }
  },

  reset: async () => {
    const id = get().sessionId;
    set({ messages: [], cart: null, modelNumber: null });
    persist({ sessionId: id, modelNumber: null, messages: [], cart: null });
    if (id) {
      try {
        await fetch('/api/session/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: id }),
        });
      } catch {
        /* ignore */
      }
    }
  },

  send: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().sending) return;
    let sessionId = get().sessionId ?? uuid();

    const userMsg: ChatMessage = { id: uuid(), role: 'user', segments: [{ type: 'text', text: trimmed }], streaming: false };
    const botId = uuid();
    const botMsg: ChatMessage = { id: botId, role: 'assistant', segments: [], streaming: true };
    set((s) => ({ sessionId, sending: true, open: true, messages: [...s.messages, userMsg, botMsg] }));

    const patchBot = (fn: (segs: Segment[]) => void) =>
      set((s) => ({
        messages: s.messages.map((m) => {
          if (m.id !== botId) return m;
          fn(m.segments);
          return { ...m, segments: [...m.segments] };
        }),
      }));

    const applyEvent = (evt: ChatEvent) => {
      switch (evt.type) {
        case 'token':
          patchBot((segs) => {
            const last = segs[segs.length - 1];
            if (last && last.type === 'text') last.text += evt.text;
            else segs.push({ type: 'text', text: evt.text });
          });
          break;
        case 'tool':
          patchBot((segs) => {
            if (evt.status === 'running') {
              segs.push({ type: 'tool', name: evt.name, label: evt.label, status: 'running' });
            } else {
              for (let i = segs.length - 1; i >= 0; i--) {
                const s = segs[i];
                if (s.type === 'tool' && s.name === evt.name && s.status === 'running') {
                  s.status = evt.status;
                  break;
                }
              }
            }
          });
          break;
        case 'ui':
          patchBot((segs) => {
            for (const block of evt.blocks) segs.push({ type: 'block', block });
          });
          for (const b of evt.blocks) if (b.kind === 'cart') set({ cart: b as CartBlock });
          break;
        case 'meta':
          if (evt.session_id) {
            sessionId = evt.session_id;
            set({ sessionId: evt.session_id });
          }
          if (evt.model_number !== undefined) set({ modelNumber: evt.model_number ?? null });
          break;
        case 'error':
          patchBot((segs) => segs.push({ type: 'text', text: `\n_${evt.message}_` }));
          break;
        case 'done':
          break;
      }
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });
      if (!res.body) throw new Error('no response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            applyEvent(JSON.parse(line.slice(5).trim()) as ChatEvent);
          } catch {
            /* skip malformed frame */
          }
        }
      }
    } catch (e) {
      patchBot((segs) => segs.push({ type: 'text', text: `\n_(Connection issue: ${(e as Error).message})_` }));
    } finally {
      patchBot(() => {});
      set((s) => ({
        sending: false,
        messages: s.messages.map((m) => (m.id === botId ? { ...m, streaming: false } : m)),
      }));
      const s = get();
      persist({ sessionId: s.sessionId, modelNumber: s.modelNumber, messages: s.messages, cart: s.cart });
    }
  },
}));
