/**
 * Shared contract between the NestJS agent and the Next.js UI.
 *
 * The agent NEVER renders prices, part numbers, or compatibility verdicts as prose —
 * it emits these typed `UIBlock`s, built server-side from real DB rows, and the frontend
 * renders them. That's the grounding mechanism made structural: the model composes
 * explanation text, the data comes from blocks.
 */

export type Availability = 'InStock' | 'OnOrder' | 'SpecialOrder' | 'Unknown';
export type CompatVerdict = 'COMPATIBLE' | 'INCOMPATIBLE' | 'UNKNOWN';
export type Appliance = 'Refrigerator' | 'Dishwasher';

/** Scope the agent is locked to. New categories = add here + a crawl seed. */
export const ENABLED_APPLIANCES: Appliance[] = ['Refrigerator', 'Dishwasher'];

export interface ProductCard {
  kind: 'product_card';
  ps_number: string;
  mpn: string | null;
  name: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  availability: Availability;
  rating: number | null;
  review_count: number | null;
  image: string | null;
  part_type: string | null;
  appliance: string | null;
  source_url: string | null;
  actions: Array<'view' | 'add_to_cart'>;
}

export interface CompatResult {
  kind: 'compat_result';
  ps_number: string;
  part_name: string | null;
  model_number: string;
  verdict: CompatVerdict;
  reason: string;
  suggested_part?: ProductCard | null;
  source_url?: string | null;
}

export interface InstallStep {
  n: number;
  text: string;
}

export interface InstallGuide {
  kind: 'install_guide';
  ps_number: string;
  part_name: string | null;
  available: boolean;
  difficulty?: string | null;
  time_estimate?: string | null;
  tools?: string[];
  steps?: InstallStep[];
  video_url?: string | null;
  source_url?: string | null;
}

export interface TroubleshootCause {
  rank: number;
  cause: string;
  recommended_ps?: string | null;
}

export interface TroubleshootBlock {
  kind: 'troubleshoot';
  appliance: string;
  brand?: string | null;
  symptom: string;
  causes: TroubleshootCause[];
  parts: ProductCard[];
  repair_steps?: InstallStep[];
  safety_note: string;
}

export interface CartLine {
  ps_number: string;
  name: string | null;
  qty: number;
  unit_price: number | null;
}

export interface CartBlock {
  kind: 'cart';
  items: CartLine[];
  subtotal: number;
  currency: string;
  note?: string | null;
}

export interface OrderStatusBlock {
  kind: 'order_status';
  order_number: string;
  status: string;
  eta?: string | null;
  items: string[];
  total?: number | null;
}

export interface SuggestedPrompts {
  kind: 'suggested_prompts';
  chips: string[];
}

/** Honest "I don't have verified X yet" fallback — keeps the agent from inventing. */
export interface UnavailableBlock {
  kind: 'unavailable';
  capability: string;
  message: string;
  source_url?: string | null;
}

export type UIBlock =
  | ProductCard
  | CompatResult
  | InstallGuide
  | TroubleshootBlock
  | CartBlock
  | OrderStatusBlock
  | SuggestedPrompts
  | UnavailableBlock;

/* ── SSE frames: NestJS → (Next proxy) → browser ─────────────────────────────── */

/** A streamed token of assistant prose. */
export interface TokenEvent {
  type: 'token';
  text: string;
}
/** Tool execution status pill ("Searching catalog…"). */
export interface ToolEvent {
  type: 'tool';
  name: string;
  label: string;
  status: 'running' | 'done' | 'error';
}
/** Typed UI blocks to render in-thread. */
export interface UIEvent {
  type: 'ui';
  blocks: UIBlock[];
}
/** Session/meta info (e.g. captured model number, session id). */
export interface MetaEvent {
  type: 'meta';
  session_id?: string;
  model_number?: string | null;
  turn_id?: string;
}
/** Terminal frame. */
export interface DoneEvent {
  type: 'done';
}
export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type ChatEvent = TokenEvent | ToolEvent | UIEvent | MetaEvent | DoneEvent | ErrorEvent;

/** Request body for POST /agent/chat (and the Next.js proxy). */
export interface ChatRequest {
  message: string;
  session_id?: string;
}
