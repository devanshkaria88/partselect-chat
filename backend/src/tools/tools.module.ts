import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CompatibilityModule } from '../compatibility/compatibility.module';
import { InstallModule } from '../install/install.module';
import { TroubleshootModule } from '../troubleshoot/troubleshoot.module';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';
import { SearchPartsTool } from './impl/search-parts.tool';
import { GetPartDetailsTool } from './impl/get-part-details.tool';
import { CheckCompatibilityTool } from './impl/check-compatibility.tool';
import { GetInstallGuideTool } from './impl/get-install-guide.tool';
import { TroubleshootSymptomTool } from './impl/troubleshoot-symptom.tool';
import { AddToCartTool, ViewCartTool, CheckoutTool, GetOrderStatusTool } from './impl/cart.tools';
import { ToolRegistry } from './tool.registry';
import { AGENT_TOOLS } from './tool.types';

// The tool roster. Add a capability: implement AgentTool, then add the class here.
const TOOLS = [
  GetPartDetailsTool,
  SearchPartsTool,
  CheckCompatibilityTool,
  GetInstallGuideTool,
  TroubleshootSymptomTool,
  AddToCartTool,
  ViewCartTool,
  CheckoutTool,
  GetOrderStatusTool,
];

@Module({
  imports: [CatalogModule, CompatibilityModule, InstallModule, TroubleshootModule, CartModule, OrdersModule],
  providers: [
    ...TOOLS,
    { provide: AGENT_TOOLS, useFactory: (...tools) => tools, inject: TOOLS },
    ToolRegistry,
  ],
  exports: [ToolRegistry],
})
export class ToolsModule {}
