import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { AppConfig, CONFIG } from '../config';

/** Thin Postgres access layer. Retrieval (vector + trgm) and reads are raw SQL by design —
 *  the data path stays transparent and debuggable. */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DbService.name);
  private pool!: Pool;

  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  async onModuleInit() {
    this.pool = new Pool({ connectionString: this.cfg.databaseUrl, max: 10 });
    // pg returns NUMERIC as string to avoid precision loss; for this catalog (prices,
    // ratings) JS numbers are fine and far easier downstream — parse them to floats.
    // 1700 = NUMERIC oid.
    const { types } = await import('pg');
    types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const res = await this.pool.query<T>(text, params as never[]);
    return res.rows;
  }

  async one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }
}
