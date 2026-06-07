import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { SessionService } from '../session/session.service';
import { TracesService } from '../traces/traces.service';

/** Catalog (storefront grid), session, health, and the trace-inspection endpoint. */
@Controller()
export class ApiController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly session: SessionService,
    private readonly traces: TracesService,
  ) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('catalog/products')
  async products(
    @Query('appliance') appliance?: string,
    @Query('brand') brand?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    const items = await this.catalog.listForStorefront({
      appliance,
      brand,
      offset: offset ? Number(offset) : 0,
      limit: limit ? Number(limit) : 24,
    });
    return { items };
  }

  @Get('catalog/facets')
  facets() {
    return this.catalog.facets();
  }

  @Post('session/clear')
  async clearSession(@Body('session_id') sessionId: string) {
    if (sessionId) await this.session.clear(sessionId);
    return { ok: true };
  }

  @Get('debug/trace/:turnId')
  async trace(@Param('turnId') turnId: string) {
    const row = await this.traces.get(turnId);
    if (!row) throw new NotFoundException('trace not found');
    return row;
  }
}
