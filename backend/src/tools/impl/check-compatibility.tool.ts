import { Injectable } from '@nestjs/common';
import { CompatibilityService } from '../../compatibility/compatibility.service';
import { AgentTool, ToolContext, ToolResult } from '../tool.types';

@Injectable()
export class CheckCompatibilityTool implements AgentTool {
  name = 'check_compatibility';
  description =
    'Check whether a specific part fits a specific appliance MODEL number (e.g. WDT780SAEM1). ' +
    'Resolves "this part" from context if no PS# is given. If the model number is unknown, ' +
    "ask the user for it — never guess. Returns a ✅/❌/unknown verdict from real compatibility data.";
  inputSchema = {
    type: 'object',
    properties: {
      ps_number: { type: 'string', description: 'Part PS# (omit to use the part in context)' },
      model_number: { type: 'string', description: "The appliance model number, e.g. WDT780SAEM1" },
    },
  };

  constructor(private readonly compat: CompatibilityService) {}

  label(): string {
    return 'Checking compatibility…';
  }

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const ps = (input.ps_number as string) || ctx.session.last_part_ps || '';
    const model = (input.model_number as string) || ctx.session.model_number || '';
    if (!ps) {
      return { data: { error: 'no_part', message: 'Ask which part to check (need a PS# or prior context).' }, ui: [], summary: 'check_compatibility:no_part' };
    }
    if (!model) {
      return { data: { error: 'no_model', message: 'Ask the user for their appliance model number.' }, ui: [], summary: 'check_compatibility:no_model' };
    }
    ctx.session.model_number = model.toUpperCase();
    ctx.session.last_part_ps = ps.toUpperCase();
    const result = await this.compat.check(ps, model);
    return {
      data: { verdict: result.verdict, reason: result.reason, model_number: result.model_number, has_suggestion: !!result.suggested_part },
      ui: [result],
      summary: `check_compatibility(${ps},${model}) → ${result.verdict}`,
    };
  }
}
