import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { CONFIG, loadConfig } from '../config';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: loadConfig }, DbService],
  exports: [DbService, CONFIG],
})
export class DbModule {}
