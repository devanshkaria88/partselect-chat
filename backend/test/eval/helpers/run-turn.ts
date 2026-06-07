import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { UIBlock } from '@partselect/types';
import { AppModule } from '../../../src/app.module';
import { AgentService } from '../../../src/agent/agent.service';

let ctx: INestApplicationContext | null = null;

export async function getAgent(): Promise<AgentService> {
  if (!ctx) ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
  return ctx.get(AgentService);
}

export async function closeAgent(): Promise<void> {
  if (ctx) {
    await ctx.close();
    ctx = null;
  }
}

export interface TurnResult {
  text: string;
  blocks: UIBlock[];
  tools: string[];
  sessionId: string | undefined;
}

/** Drives one agent turn and collects the streamed events for assertions. */
export async function runTurn(sessionId: string | undefined, message: string): Promise<TurnResult> {
  const agent = await getAgent();
  let text = '';
  const blocks: UIBlock[] = [];
  const tools: string[] = [];
  let sid = sessionId;
  for await (const ev of agent.run(sessionId, message)) {
    if (ev.type === 'token') text += ev.text;
    else if (ev.type === 'ui') blocks.push(...ev.blocks);
    else if (ev.type === 'tool' && ev.status === 'running') tools.push(ev.name);
    else if (ev.type === 'meta' && ev.session_id) sid = ev.session_id;
  }
  return { text, blocks, tools, sessionId: sid };
}

/** Flatten every grounded token (PS#, MPN, price, model#) present in the rendered blocks —
 *  the set the assistant's prose is allowed to reference. */
export function groundedTokens(blocks: UIBlock[]): Set<string> {
  const tokens = new Set<string>();
  const addPrice = (p: number | null | undefined) => {
    if (p != null) {
      tokens.add(p.toFixed(2));
      tokens.add(String(Math.round(p)));
    }
  };
  const walkCard = (c: { ps_number?: string; mpn?: string | null; price?: number | null }) => {
    if (c.ps_number) tokens.add(c.ps_number.toUpperCase());
    if (c.mpn) tokens.add(c.mpn.toUpperCase());
    addPrice(c.price);
  };
  for (const b of blocks) {
    switch (b.kind) {
      case 'product_card':
        walkCard(b);
        break;
      case 'compat_result':
        tokens.add(b.ps_number.toUpperCase());
        tokens.add(b.model_number.toUpperCase());
        if (b.suggested_part) walkCard(b.suggested_part);
        break;
      case 'install_guide':
        tokens.add(b.ps_number.toUpperCase());
        break;
      case 'troubleshoot':
        b.parts.forEach(walkCard);
        break;
      case 'cart':
        b.items.forEach((l) => {
          tokens.add(l.ps_number.toUpperCase());
          addPrice(l.unit_price);
        });
        break;
      case 'order_status':
        tokens.add(b.order_number.toUpperCase());
        break;
    }
  }
  return tokens;
}
