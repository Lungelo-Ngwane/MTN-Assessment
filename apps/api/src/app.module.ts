import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolve(__dirname, '../../../.env'),
      skipProcessEnv: true,
      validate: validateEnvironment,
    }),
    HealthModule,
  ],
})
export class AppModule {}
