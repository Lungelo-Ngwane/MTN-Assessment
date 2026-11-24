import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';
import { ReadinessService } from './readiness.service';

@Controller({ path: 'health', version: '1' })
@Public()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly readinessService: ReadinessService,
  ) {}

  @Get()
  getHealth(): { status: 'ok' } {
    return this.healthService.getHealth();
  }

  @Get('ready')
  async getReadiness(): Promise<{ status: 'ok' }> {
    if (!(await this.readinessService.isReady())) {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
    return { status: 'ok' };
  }
}
