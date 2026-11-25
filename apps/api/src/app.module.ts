import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { resolve } from 'node:path';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment, type Environment } from './config/environment';
import { ContractsModule } from './contracts/contracts.module';
import { HealthModule } from './health/health.module';
import { GlobalExceptionFilter } from './http/global-exception.filter';
import { loggingOptions } from './http/logging-options';
import { HttpMetrics } from './monitoring/http-metrics';
import { RepaymentModule } from './repayment/repayment.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolve(__dirname, '../../../.env'),
      skipProcessEnv: true,
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        forRoutes: [],
        pinoHttp: [
          loggingOptions(config.get('LOG_LEVEL', { infer: true })),
          process.stdout,
        ],
      }),
    }),
    HealthModule,
    UsersModule,
    ContractsModule,
    AuthModule,
    RepaymentModule,
  ],
  providers: [
    HttpMetrics,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
