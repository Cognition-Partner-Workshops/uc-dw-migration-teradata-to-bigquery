import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfigService } from '../config/app-config.service';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma Client as a Nest provider. Connects lazily on first query, so the service
 * boots (and /health answers) even when the database is unreachable; /health/ready
 * reports the real database state.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL') }),
      log: config.isProduction ? ['warn', 'error'] : ['warn', 'error', 'info'],
    });
  }

  async ping(timeoutMs = 2000): Promise<boolean> {
    const probe = this.$queryRaw`SELECT 1`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`database ping timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );
    await Promise.race([probe, timeout]);
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
