import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';

export interface TraceStep {
  tool: string;
  args: unknown;
  result_summary: string;
  ms: number;
}

export interface TraceData {
  turn_id: string;
  session_id: string;
  user_message: string;
  model_tier: string;
  scope_verdict: string;
  steps: TraceStep[];
  ttft_ms?: number;
  total_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
}

@Injectable()
export class TracesService {
  private readonly log = new Logger(TracesService.name);
  constructor(private readonly db: DbService) {}

  async record(t: TraceData): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO agent_traces
          (turn_id, session_id, user_message, model_tier, scope_verdict, steps_json,
           ttft_ms, total_ms, input_tokens, output_tokens, cache_read_tokens)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
        [
          t.turn_id,
          t.session_id,
          t.user_message,
          t.model_tier,
          t.scope_verdict,
          JSON.stringify(t.steps),
          t.ttft_ms ?? null,
          t.total_ms ?? null,
          t.input_tokens ?? null,
          t.output_tokens ?? null,
          t.cache_read_tokens ?? null,
        ],
      );
      this.log.log(
        `turn ${t.turn_id.slice(0, 8)} tier=${t.model_tier} scope=${t.scope_verdict} ` +
          `tools=[${t.steps.map((s) => s.tool).join(',')}] ttft=${t.ttft_ms ?? '-'}ms total=${t.total_ms ?? '-'}ms`,
      );
    } catch (e) {
      this.log.warn(`trace write failed: ${(e as Error).message}`);
    }
  }

  async get(turnId: string) {
    return this.db.one(`SELECT * FROM agent_traces WHERE turn_id = $1`, [turnId]);
  }
}
