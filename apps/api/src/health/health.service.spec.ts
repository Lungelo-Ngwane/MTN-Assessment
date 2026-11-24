import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports that the process is live', () => {
    expect(new HealthService().getHealth()).toEqual({ status: 'ok' });
  });
});
