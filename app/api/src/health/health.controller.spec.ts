import { describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports liveness with package metadata', () => {
    const controller = new HealthController({} as PrismaService);
    const health = controller.liveness();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('dreamhouse-api');
    expect(health.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
