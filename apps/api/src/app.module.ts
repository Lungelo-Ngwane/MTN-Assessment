import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { ContractsModule } from './contracts/contracts.module';
import { HealthModule } from './health/health.module';
import { RepaymentModule } from './repayment/repayment.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolve(__dirname, '../../../.env'),
      skipProcessEnv: true,
      validate: validateEnvironment,
    }),
    HealthModule,
    UsersModule,
    ContractsModule,
    AuthModule,
    RepaymentModule,
  ],
})
export class AppModule {}
