import { Module } from '@nestjs/common';
import { InstallService } from './install.service';

@Module({ providers: [InstallService], exports: [InstallService] })
export class InstallModule {}
