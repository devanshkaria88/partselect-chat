import { Inject, Injectable } from '@nestjs/common';
import { CartLine } from '@partselect/types';
import { AppConfig, CONFIG } from '../config';
import { DbService } from '../db/db.service';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionState {
  id: string;
  model_number: string | null;
  last_part_ps: string | null;
  cart: CartLine[];
  messages: ChatTurn[];
  context: Record<string, unknown>;
}

interface SessionRow {
  id: string;
  model_number: string | null;
  last_part_ps: string | null;
  cart: CartLine[];
  messages: ChatTurn[];
  context: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS = 'id, model_number, last_part_ps, cart, messages, context';

@Injectable()
export class SessionService {
  constructor(
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly db: DbService,
  ) {}

  /** Sliding window of the most recent turns to replay to the model. Trimmed to begin on a
   *  user message (the Messages API requires messages[0].role === 'user'). Durable facts —
   *  model number, "this part" referent, cart — live in their own columns and survive beyond
   *  the window, so entity memory isn't lost when old turns slide out. */
  window(messages: ChatTurn[]): ChatTurn[] {
    let w = messages.slice(-this.cfg.sessionWindowMessages);
    while (w.length && w[0].role !== 'user') w = w.slice(1);
    return w;
  }

  private map(r: SessionRow): SessionState {
    return {
      id: r.id,
      model_number: r.model_number,
      last_part_ps: r.last_part_ps,
      cart: r.cart ?? [],
      messages: r.messages ?? [],
      context: r.context ?? {},
    };
  }

  async getOrCreate(id?: string): Promise<SessionState> {
    if (id && UUID_RE.test(id)) {
      const row = await this.db.one<SessionRow>(`SELECT ${COLS} FROM sessions WHERE id = $1`, [id]);
      if (row) return this.map(row);
      const created = await this.db.one<SessionRow>(
        `INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING ${COLS}`,
        [id],
      );
      if (created) return this.map(created);
      // race: row appeared between select and insert
      const again = await this.db.one<SessionRow>(`SELECT ${COLS} FROM sessions WHERE id = $1`, [id]);
      if (again) return this.map(again);
    }
    const fresh = await this.db.one<SessionRow>(`INSERT INTO sessions DEFAULT VALUES RETURNING ${COLS}`);
    return this.map(fresh as SessionRow);
  }

  async persist(s: SessionState): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET model_number = $2, last_part_ps = $3, cart = $4::jsonb,
         messages = $5::jsonb, context = $6::jsonb, updated_at = now()
       WHERE id = $1`,
      [
        s.id,
        s.model_number,
        s.last_part_ps,
        JSON.stringify(s.cart),
        JSON.stringify(s.messages.slice(-this.cfg.sessionWindowMessages)), // sliding window
        JSON.stringify(s.context),
      ],
    );
  }

  async clear(id: string): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET cart = '[]'::jsonb, messages = '[]'::jsonb, context = '{}'::jsonb,
         model_number = NULL, last_part_ps = NULL, updated_at = now() WHERE id = $1`,
      [id],
    );
  }
}
