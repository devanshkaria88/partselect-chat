import { Injectable } from '@nestjs/common';
import { TroubleshootService } from '../../troubleshoot/troubleshoot.service';
import { AgentTool, ToolContext, ToolResult } from '../tool.types';

@Injectable()
export class TroubleshootSymptomTool implements AgentTool {
  name = 'troubleshoot_symptom';
  description =
    'Diagnose a refrigerator or dishwasher symptom (e.g. "ice maker not making ice", "not draining"). ' +
    'Returns the most relevant symptom match plus the real replacement parts that fix it. Using the ' +
    'returned parts, present the most likely cause first, then the recommended part(s), concise repair ' +
    'steps, and a brief safety note. Only recommend the parts returned here.';
  inputSchema = {
    type: 'object',
    properties: {
      appliance: { type: 'string', enum: ['Refrigerator', 'Dishwasher'] },
      symptom: { type: 'string', description: 'The problem in the user\'s words' },
      brand: { type: 'string', description: 'Appliance brand if known (e.g. Whirlpool)' },
    },
    required: ['appliance', 'symptom'],
  };

  constructor(private readonly troubleshoot: TroubleshootService) {}

  label(): string {
    return 'Diagnosing the symptom…';
  }

  async run(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const appliance = (input.appliance as string) || 'Refrigerator';
    const symptom = (input.symptom as string) || '';
    const brand = input.brand as string | undefined;
    const r = await this.troubleshoot.find(appliance, symptom, brand);
    return { data: r.data, ui: [r.block], summary: `troubleshoot_symptom(${appliance},"${symptom}")` };
  }
}
