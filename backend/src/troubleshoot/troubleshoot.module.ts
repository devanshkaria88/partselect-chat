import { Module } from '@nestjs/common';
import { TroubleshootService } from './troubleshoot.service';

@Module({ providers: [TroubleshootService], exports: [TroubleshootService] })
export class TroubleshootModule {}
