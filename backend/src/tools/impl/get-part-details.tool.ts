import { Injectable } from '@nestjs/common';
import { UnavailableBlock } from '@partselect/types';
import { CatalogService, toCard } from '../../catalog/catalog.service';
import { AgentTool, ToolContext, ToolResult } from '../tool.types';

@Injectable()
export class GetPartDetailsTool implements AgentTool {
  name = 'get_part_details';
  description =
    'Look up one exact part by its PartSelect number (PS#) or manufacturer part number (MPN). ' +
    'Returns authoritative fields: name, brand, price, availability, rating, image, source link. ' +
    'Use this whenever the user names a specific PS# or MPN.';
  inputSchema = {
    type: 'object',
    properties: {
      ps_or_mpn: { type: 'string', description: 'A PS number (e.g. PS11752778) or MPN' },
    },
    required: ['ps_or_mpn'],
  };

  constructor(private readonly catalog: CatalogService) {}

  label(): string {
    return 'Looking up the part…';
  }

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const id = String(input.ps_or_mpn ?? '').trim();
    const row = await this.catalog.getByPsOrMpn(id);
    if (!row) {
      const block: UnavailableBlock = {
        kind: 'unavailable',
        capability: 'part_lookup',
        message: `I couldn't find a part matching "${id}" in the refrigerator/dishwasher catalog.`,
      };
      return { data: { found: false }, ui: [block], summary: `get_part_details(${id}) → not found` };
    }
    // Remember the referent so "this part" / "is it compatible" resolve next turn.
    ctx.session.last_part_ps = row.ps_number;
    const card = toCard(row);
    return {
      data: {
        found: true,
        ps_number: row.ps_number,
        mpn: row.mpn,
        name: row.name,
        brand: row.brand,
        price: row.price,
        currency: row.currency,
        availability: row.availability,
        rating: row.rating,
        review_count: row.review_count,
        appliance: row.appliance,
        part_type: row.part_type,
        description: row.description,
        source_url: row.url,
      },
      ui: [card],
      summary: `get_part_details(${row.ps_number})`,
    };
  }
}
