import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';

export type ScopeCategory = 'in_scope' | 'troubleshoot' | 'out_of_scope';
export interface ScopeResult {
  inScope: boolean;
  category: ScopeCategory;
  verdict: string; // for the trace
  redirect?: string;
}

// Other appliance types / clearly off-topic. Word-boundary matched.
const OUT = [
  'washing machine', 'washer', 'dryer', 'oven', 'stove', 'cooktop range', 'microwave',
  'air condition', 'hvac', 'furnace', 'water heater', 'television', ' tv ', 'laptop',
  'phone', 'car ', 'vehicle', 'weather', 'recipe', 'stock price', 'who are you',
  'tell me a joke', 'president', 'capital of',
];
// In-scope signals: our two appliances + part/repair + transaction vocabulary.
const IN = [
  'refrigerator', 'fridge', 'dishwasher', 'freezer', 'ice maker', 'ice-maker', 'icemaker',
  'water filter', 'door bin', 'shelf', 'spray arm', 'dishrack', 'crisper', 'compatible',
  'part number', 'model number', 'install', 'replacement part',
  // transaction / continuation phrases (the user is mid-flow in our service)
  'cart', 'checkout', 'check out', 'add to', 'order', 'buy', 'purchase', 'place order',
  'this part', 'this one', 'add it', 'yes please', 'how much', 'in stock', 'price',
];
const PS_RE = /\bps\d{5,}\b/i;
// Symptom language → route to the deeper (Opus) troubleshoot tier.
const SYMPTOM = [
  'not working', 'stopped working', "won't", 'wont ', "doesn't", 'not cooling', 'not cold',
  'not making ice', 'not draining', 'leaking', 'leak', 'noise', 'broken', 'not dispensing',
  'too warm', 'error', 'how do i fix', 'how to fix', 'troubleshoot', 'not cleaning',
];

@Injectable()
export class ScopeGuard {
  private readonly log = new Logger(ScopeGuard.name);
  constructor(private readonly llm: LlmService) {}

  private hits(text: string, words: string[]): boolean {
    return words.some((w) => text.includes(w));
  }

  async check(message: string): Promise<ScopeResult> {
    const t = ` ${message.toLowerCase()} `;
    const inSignal = PS_RE.test(message) || this.hits(t, IN);
    const symptom = this.hits(t, SYMPTOM);

    if (inSignal) {
      return {
        inScope: true,
        category: symptom ? 'troubleshoot' : 'in_scope',
        verdict: 'in_scope:keyword',
      };
    }
    if (this.hits(t, OUT)) {
      return { inScope: false, category: 'out_of_scope', verdict: 'out_of_scope:keyword', redirect: this.redirect() };
    }

    // Ambiguous (greetings, vague asks). Classify cheaply with Haiku when available.
    const verdict = await this.classify(message);
    if (verdict === 'OUT') {
      return { inScope: false, category: 'out_of_scope', verdict: 'out_of_scope:haiku', redirect: this.redirect() };
    }
    return {
      inScope: true,
      category: verdict === 'TROUBLESHOOT' ? 'troubleshoot' : 'in_scope',
      verdict: `in_scope:${verdict === 'TROUBLESHOOT' ? 'haiku-symptom' : 'haiku'}`,
    };
  }

  private async classify(message: string): Promise<'IN' | 'OUT' | 'TROUBLESHOOT'> {
    try {
      const sys =
        'You are a scope classifier for a PartSelect appliance-parts assistant that ONLY ' +
        'handles Refrigerator and Dishwasher parts (finding parts, compatibility, installation, ' +
        'symptom troubleshooting, orders/cart). Reply with exactly ONE token:\n' +
        'IN = a refrigerator/dishwasher parts request or a greeting/clarification within that service,\n' +
        'TROUBLESHOOT = describing a refrigerator/dishwasher problem to diagnose,\n' +
        'OUT = anything else (other appliances, general knowledge, chit-chat unrelated to the service).';
      const out = (await this.llm.complete('fast', sys, message, 8)).trim().toUpperCase();
      if (out.startsWith('OUT')) return 'OUT';
      if (out.startsWith('TROUBLE')) return 'TROUBLESHOOT';
      return 'IN';
    } catch (e) {
      this.log.warn(`scope classify failed, defaulting IN: ${(e as Error).message}`);
      return 'IN'; // fail open — the system-prompt contract still guards in-loop
    }
  }

  private redirect(): string {
    return (
      "I'm PartSelect's parts assistant, focused on **refrigerator and dishwasher** parts — " +
      'finding the right part, checking compatibility with your model, installation help, and ' +
      'troubleshooting. I can\'t help with that one, but if your fridge or dishwasher needs a part ' +
      'or a fix, I\'m all yours. What can I help you find?'
    );
  }
}
