import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { FacetsDto, ProductListDto } from '../http/dto';

/** Storefront catalog reads (product grid + facets). Agent-free; powers the Next.js home page. */
@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @ApiOperation({
    summary: 'List in-scope storefront products',
    description: 'Paged, rating-sorted product cards for the storefront grid.',
  })
  @ApiQuery({ name: 'appliance', required: false, enum: ['Refrigerator', 'Dishwasher'] })
  @ApiQuery({ name: 'brand', required: false, example: 'Whirlpool' })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({ name: 'limit', required: false, example: 24, description: 'Capped at 60' })
  @ApiOkResponse({ type: ProductListDto })
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

  @Get('facets')
  @ApiOperation({ summary: 'Brand and appliance facet counts', description: 'In-scope product counts grouped by brand and appliance.' })
  @ApiOkResponse({ type: FacetsDto })
  facets() {
    return this.catalog.facets();
  }
}
