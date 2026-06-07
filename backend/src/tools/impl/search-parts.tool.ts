import { Injectable } from '@nestjs/common';
import { CatalogService, toCard } from '../../catalog/catalog.service';
import { AgentTool, ToolContext, ToolResult } from '../tool.types';

@Injectable()
export class SearchPartsTool implements AgentTool {
  name = 'search_parts';
  description =
    'Search the refrigerator/dishwasher parts catalog. Use for discovery and natural-language ' +
    'queries ("door bin for a Frigidaire fridge under $30", "ice maker tray"). Supports semantic ' +
    'search plus structured filters. Returns product cards with real price/availability. ' +
    'Use get_part_details instead when the user gives an exact PS# or MPN.';
  inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language description of the part needed' },
      appliance: { type: 'string', enum: ['Refrigerator', 'Dishwasher'] },
      brand: { type: 'string', description: 'e.g. Whirlpool, Frigidaire, GE, Bosch' },
      part_type: { type: 'string', description: 'e.g. Filter, Spray Arm, Tray or Shelf' },
      max_price: { type: 'number' },
      in_stock_only: { type: 'boolean' },
      limit: { type: 'number', description: 'max results (default 6)' },
    },
  };

  constructor(private readonly catalog: CatalogService) {}

  label(): string {
    return 'Searching the catalog…';
  }

  async run(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const rows = await this.catalog.search({
      query: input.query as string | undefined,
      appliance: input.appliance as string | undefined,
      brand: input.brand as string | undefined,
      part_type: input.part_type as string | undefined,
      max_price: input.max_price as number | undefined,
      in_stock_only: input.in_stock_only as boolean | undefined,
      limit: input.limit as number | undefined,
    });
    const cards = rows.map(toCard);
    const data = {
      count: cards.length,
      results: cards.map((c) => ({
        ps_number: c.ps_number,
        name: c.name,
        brand: c.brand,
        price: c.price,
        availability: c.availability,
        part_type: c.part_type,
      })),
    };
    return {
      data,
      ui: cards,
      summary: `search_parts → ${cards.length} results`,
    };
  }
}
