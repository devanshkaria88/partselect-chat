import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig, CONFIG } from '../config';

/** Embeds the user's query with the SAME model/space as the stored product vectors
 *  (Voyage voyage-3.5, input_type="query"). One interface, swappable provider. */
@Injectable()
export class EmbeddingsService {
  private readonly log = new Logger(EmbeddingsService.name);
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  get enabled(): boolean {
    return Boolean(this.cfg.voyageApiKey);
  }

  /** Returns a pgvector literal string ('[0.1,0.2,...]') for use in $1::vector, or null
   *  if embeddings are unavailable (caller falls back to trigram search). */
  async embedQuery(text: string): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfg.voyageApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [text],
          model: this.cfg.embedModel,
          input_type: 'query',
          output_dimension: this.cfg.embedDim,
        }),
      });
      if (!res.ok) {
        this.log.warn(`Voyage embed failed (${res.status}); falling back to keyword search`);
        return null;
      }
      const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
      const vec = json.data?.[0]?.embedding;
      return vec ? `[${vec.join(',')}]` : null;
    } catch (e) {
      this.log.warn(`Voyage embed error: ${(e as Error).message}`);
      return null;
    }
  }
}
