import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { DocumentOperation } from '../openapi/api-operation';
import { HealthService } from './health.service';
import { ReadinessService } from './readiness.service';

@Controller({ path: 'health', version: '1' })
@ApiTags('Health')
@Public()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly readinessService: ReadinessService,
  ) {}

  @Get()
  @DocumentOperation({
    summary: 'Check API liveness',
    description: 'Checks whether the HTTP application is responding.',
    status: 200,
    response: 'HealthOk',
    public: true,
  })
  getHealth(): { status: 'ok' } {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @DocumentOperation({
    summary: 'Check database readiness',
    description: 'Returns whether the application can query PostgreSQL.',
    status: 200,
    response: 'HealthOk',
    public: true,
    readiness: true,
  })
  async getReadiness(): Promise<{ status: 'ok' }> {
    if (!(await this.readinessService.isReady())) {
      throw new ServiceUnavailableException({ status: 'unavailable' });
    }
    return { status: 'ok' };
  }
}
