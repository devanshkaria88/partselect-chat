import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CompatibilityService } from './compatibility.service';

@Module({
  imports: [CatalogModule],
  providers: [CompatibilityService],
  exports: [CompatibilityService],
})
export class CompatibilityModule {}
