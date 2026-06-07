import { Module } from '@nestjs/common';
import { ScopeModule } from '../scope/scope.module';
import { ToolsModule } from '../tools/tools.module';
import { AgentService } from './agent.service';

@Module({
  imports: [ToolsModule, ScopeModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
