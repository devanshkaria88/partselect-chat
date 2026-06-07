import { Inject, Injectable } from '@nestjs/common';
import { ToolDef } from '../llm/llm.types';
import { AGENT_TOOLS, AgentTool, ToolContext, ToolResult } from './tool.types';

@Injectable()
export class ToolRegistry {
  private readonly byName = new Map<string, AgentTool>();

  constructor(@Inject(AGENT_TOOLS) tools: AgentTool[]) {
    for (const t of tools) this.byName.set(t.name, t);
  }

  /** Tool schemas handed to Claude (stable order → cache-friendly). */
  definitions(): ToolDef[] {
    return [...this.byName.values()].map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  label(name: string, input: Record<string, unknown>): string {
    return this.byName.get(name)?.label(input) ?? 'Working…';
  }

  async execute(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.byName.get(name);
    if (!tool) {
      return { data: { error: `unknown tool: ${name}` }, ui: [], summary: `unknown:${name}` };
    }
    try {
      return await tool.run(input, ctx);
    } catch (e) {
      return {
        data: { error: `tool ${name} failed: ${(e as Error).message}` },
        ui: [],
        summary: `${name}:error`,
      };
    }
  }
}
