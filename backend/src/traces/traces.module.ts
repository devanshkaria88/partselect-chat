import { Global, Module } from '@nestjs/common';
import { TracesService } from './traces.service';

@Global()
@Module({ providers: [TracesService], exports: [TracesService] })
export class TracesModule {}
