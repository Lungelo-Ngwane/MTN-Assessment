import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService, ReadinessService],
})
export class HealthModule {}
