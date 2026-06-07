import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config';
import { Tier, ToolDef } from './llm.types';

interface StreamOpts {
  tier: Tier;
  system: string;
  tools: ToolDef[];
  messages: Anthropic.MessageParam[];
}

/** The one boundary to Claude. Tier → model + thinking/effort is centralized here so a
 *  provider/model swap touches only this file. */
@Injectable()
export class LlmService {
  private readonly log = new Logger(LlmService.name);
  private readonly client: Anthropic;

  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {
    // Fallback placeholder lets the app boot without a key (health/catalog work);
    // actual LLM calls 401 until ANTHROPIC_API_KEY is set.
    this.client = new Anthropic({ apiKey: cfg.anthropicApiKey || 'sk-ant-not-configured' });
  }

  private modelFor(tier: Tier): string {
    return tier === 'fast' ? this.cfg.models.fast : tier === 'deep' ? this.cfg.models.deep : this.cfg.models.default;
  }

  /** Build a request with prompt caching on the tools+system prefix, plus per-tier thinking. */
  private buildParams(opts: StreamOpts): Record<string, unknown> {
    const tools = opts.tools.map((t, i) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
      // Cache the (stable) tool list + system prompt prefix — render order is tools→system.
      ...(i === opts.tools.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
    }));
    const system = [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }];

    const base: Record<string, unknown> = {
      model: this.modelFor(opts.tier),
      max_tokens: opts.tier === 'deep' ? 8000 : 4000,
      system,
      tools,
      messages: opts.messages,
    };
    // Opus troubleshoot turn gets adaptive thinking at high effort; the chat tiers stay snappy.
    if (opts.tier === 'deep') {
      base.thinking = { type: 'adaptive' };
      base.output_config = { effort: 'high' };
    }
    return base;
  }

  /** Returns the streaming Message stream for one agent iteration. */
  stream(opts: StreamOpts) {
    return this.client.messages.stream(this.buildParams(opts) as never);
  }

  /** One-shot non-streaming call, used by the scope classifier (Haiku). Returns text. */
  async complete(tier: Tier, system: string, user: string, maxTokens = 256): Promise<string> {
    const res = await this.client.messages.create({
      model: this.modelFor(tier),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    } as never);
    const block = (res.content as Anthropic.ContentBlock[]).find((b) => b.type === 'text');
    return block && block.type === 'text' ? block.text : '';
  }
}
