import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { LlmModule } from './llm/llm.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { SessionModule } from './session/session.module';
import { TracesModule } from './traces/traces.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    DbModule, // @Global — DbService + CONFIG
    LlmModule, // @Global
    EmbeddingsModule, // @Global
    SessionModule, // @Global
    TracesModule, // @Global
    ChatModule, // controllers + agent + tools
  ],
})
export class AppModule {}
