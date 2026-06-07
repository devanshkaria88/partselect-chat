import { Module } from '@nestjs/common';
import { ScopeGuard } from './scope.service';

@Module({ providers: [ScopeGuard], exports: [ScopeGuard] })
export class ScopeModule {}
