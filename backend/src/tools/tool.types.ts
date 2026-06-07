import { UIBlock } from '@partselect/types';
import { SessionState } from '../session/session.service';

export interface ToolContext {
  /** Mutable within a single turn; persisted by the agent after the turn. */
  session: SessionState;
}

export interface ToolResult {
  /** JSON returned to the model as the tool_result (what it reasons over). */
  data: unknown;
  /** Typed blocks streamed to the UI and rendered from real data. */
  ui: UIBlock[];
  /** One-line summary for the agent trace. */
  summary: string;
}

/** A capability. New capability = one class implementing this + one line in the registry. */
export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Human status pill shown while the tool runs ("Searching catalog…"). */
  label(input: Record<string, unknown>): string;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export const AGENT_TOOLS = Symbol('AGENT_TOOLS');
