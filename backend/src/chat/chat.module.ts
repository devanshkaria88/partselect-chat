import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ApiController } from './api.controller';
import { ChatController } from './chat.controller';

@Module({
  imports: [AgentModule, CatalogModule],
  controllers: [ChatController, ApiController],
})
export class ChatModule {}
