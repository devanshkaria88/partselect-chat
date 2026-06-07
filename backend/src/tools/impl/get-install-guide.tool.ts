import { Injectable } from '@nestjs/common';
import { InstallService } from '../../install/install.service';
import { AgentTool, ToolContext, ToolResult } from '../tool.types';

@Injectable()
export class GetInstallGuideTool implements AgentTool {
  name = 'get_install_guide';
  description =
    'Get installation guidance for a part by PS# (resolves "this part" from context). Returns the ' +
    'how-to video, difficulty, and customer repair narratives. Compose clear numbered steps from the ' +
    'returned `repair_stories` and `description` — do not invent steps beyond that grounded material. ' +
    "If unavailable, say so and link the product page.";
  inputSchema = {
    type: 'object',
    properties: { ps_number: { type: 'string', description: 'Part PS# (omit to use the part in context)' } },
  };

  constructor(private readonly install: InstallService) {}

  label(): string {
    return 'Pulling up the installation guide…';
  }

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const ps = (input.ps_number as string) || ctx.session.last_part_ps || '';
    if (!ps) {
      return { data: { error: 'no_part', message: 'Ask which part to install (need a PS#).' }, ui: [], summary: 'get_install_guide:no_part' };
    }
    ctx.session.last_part_ps = ps.toUpperCase();
    const r = await this.install.get(ps);
    return {
      data: {
        available: r.block.available,
        part_name: r.block.part_name,
        difficulty: r.block.kind === 'install_guide' ? r.block.difficulty : null,
        time_estimate: r.block.kind === 'install_guide' ? r.block.time_estimate : null,
        video_url: r.block.kind === 'install_guide' ? r.block.video_url : null,
        repair_stories: r.repair_stories,
        description: r.description,
        source_url: r.block.source_url,
      },
      ui: [r.block],
      summary: `get_install_guide(${ps}) → available=${r.block.available}`,
    };
  }
}
