/** Central env config. Boot fails loud if a required secret is missing in non-test runs. */
export interface AppConfig {
  databaseUrl: string;
  anthropicApiKey: string;
  voyageApiKey: string;
  port: number;
  // Model tiers (owner-chosen routing): Sonnet default, Opus on troubleshoot, Haiku for scope.
  models: { fast: string; default: string; deep: string };
  embedModel: string;
  embedDim: number;
  maxIters: number;
  /** Sliding-window size (messages) of chat history replayed to the model each turn. */
  sessionWindowMessages: number;
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgresql://partselect:partselect@localhost:5432/partselect',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    voyageApiKey: process.env.VOYAGE_API_KEY ?? '',
    port: Number(process.env.BACKEND_PORT ?? 3001),
    models: {
      fast: process.env.MODEL_FAST ?? 'claude-haiku-4-5',
      default: process.env.MODEL_DEFAULT ?? 'claude-sonnet-4-6',
      deep: process.env.MODEL_DEEP ?? 'claude-opus-4-8',
    },
    embedModel: process.env.VOYAGE_MODEL ?? 'voyage-3.5',
    embedDim: Number(process.env.EMBED_DIM ?? 1024),
    maxIters: Number(process.env.AGENT_MAX_ITERS ?? 6),
    sessionWindowMessages: Number(process.env.SESSION_WINDOW_MESSAGES ?? 20),
  };
}

export const CONFIG = 'APP_CONFIG';
