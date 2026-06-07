import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ChatEvent } from '@partselect/types';
import { AppConfig, CONFIG } from '../config';
import { LlmService } from '../llm/llm.service';
import { Tier } from '../llm/llm.types';
import { ScopeGuard } from '../scope/scope.service';
import { SessionService, SessionState } from '../session/session.service';
import { ToolRegistry } from '../tools/tool.registry';
import { TraceStep, TracesService } from '../traces/traces.service';
import { buildSystemPrompt, SUGGESTED_CHIPS } from './system-prompt';

// Appliance model numbers (e.g. WDT780SAEM1) — alphanumeric, has a digit, not a PS#.
const MODEL_RE = /\b(?!PS\d)(?=[A-Z0-9-]*\d)[A-Z][A-Z0-9-]{4,13}\b/i;

@Injectable()
export class AgentService {
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly llm: LlmService,
    private readonly registry: ToolRegistry,
    private readonly scope: ScopeGuard,
    private readonly session: SessionService,
    private readonly traces: TracesService,
  ) {}

  private captureModelNumber(text: string, sess: SessionState): void {
    if (/\bmodel\b/i.test(text) || !sess.model_number) {
      const m = text.match(MODEL_RE);
      if (m && /model|fit|compat/i.test(text)) sess.model_number = m[0].toUpperCase();
    }
  }

  async *run(sessionId: string | undefined, userText: string): AsyncGenerator<ChatEvent> {
    const t0 = Date.now();
    const turnId = randomUUID();
    const sess = await this.session.getOrCreate(sessionId);
    this.captureModelNumber(userText, sess);
    yield { type: 'meta', session_id: sess.id, turn_id: turnId, model_number: sess.model_number };

    const scope = await this.scope.check(userText);
    if (!scope.inScope) {
      const redirect = scope.redirect ?? "I can only help with refrigerator and dishwasher parts.";
      yield { type: 'token', text: redirect };
      yield { type: 'ui', blocks: [{ kind: 'suggested_prompts', chips: SUGGESTED_CHIPS }] };
      sess.messages.push({ role: 'user', content: userText }, { role: 'assistant', content: redirect });
      await this.session.persist(sess);
      await this.traces.record({
        turn_id: turnId, session_id: sess.id, user_message: userText,
        model_tier: '-', scope_verdict: scope.verdict, steps: [], total_ms: Date.now() - t0,
      });
      yield { type: 'done' };
      return;
    }

    const tier: Tier = scope.category === 'troubleshoot' ? 'deep' : 'default';
    const system = buildSystemPrompt(sess);
    const tools = this.registry.definitions();
    // Replay a sliding window of recent turns; durable entities live in session fields.
    const messages: Anthropic.MessageParam[] = [
      ...this.session
        .window(sess.messages)
        .map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
      { role: 'user', content: userText },
    ];

    const steps: TraceStep[] = [];
    let assistantText = '';
    let ttft: number | undefined;
    let inTok = 0;
    let outTok = 0;
    let cacheTok = 0;

    for (let iter = 0; iter < this.cfg.maxIters; iter++) {
      const stream = this.llm.stream({ tier, system, tools, messages });
      for await (const ev of stream as AsyncIterable<Anthropic.MessageStreamEvent>) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          if (ttft === undefined) ttft = Date.now() - t0;
          assistantText += ev.delta.text;
          yield { type: 'token', text: ev.delta.text };
        }
      }
      const final = await stream.finalMessage();
      inTok += final.usage?.input_tokens ?? 0;
      outTok += final.usage?.output_tokens ?? 0;
      cacheTok += (final.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0;

      messages.push({ role: 'assistant', content: final.content });
      const toolUses = final.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (toolUses.length === 0) break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        yield { type: 'tool', name: tu.name, label: this.registry.label(tu.name, input), status: 'running' };
        const ts = Date.now();
        const result = await this.registry.execute(tu.name, input, { session: sess });
        steps.push({ tool: tu.name, args: input, result_summary: result.summary, ms: Date.now() - ts });
        yield { type: 'tool', name: tu.name, label: this.registry.label(tu.name, input), status: 'done' };
        if (result.ui.length) yield { type: 'ui', blocks: result.ui };
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result.data),
        });
      }
      messages.push({ role: 'user', content: toolResults });
    }

    sess.messages.push({ role: 'user', content: userText });
    if (assistantText.trim()) sess.messages.push({ role: 'assistant', content: assistantText.trim() });
    await this.session.persist(sess);

    yield { type: 'meta', session_id: sess.id, model_number: sess.model_number, turn_id: turnId };
    await this.traces.record({
      turn_id: turnId, session_id: sess.id, user_message: userText, model_tier: tier,
      scope_verdict: scope.verdict, steps, ttft_ms: ttft, total_ms: Date.now() - t0,
      input_tokens: inTok, output_tokens: outTok, cache_read_tokens: cacheTok,
    });
    yield { type: 'done' };
  }
}
