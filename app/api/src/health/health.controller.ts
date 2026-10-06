import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { HealthDto, ReadinessDto } from './health.dto';
import { packageInfo } from '../common/package-info';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: the process is up (no dependency checks)' })
  @ApiOkResponse({ type: HealthDto })
  liveness(): HealthDto {
    return {
      status: 'ok',
      service: packageInfo.name,
      version: packageInfo.version,
      uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: PostgreSQL reachable through Prisma' })
  @ApiOkResponse({ type: ReadinessDto })
  @ApiServiceUnavailableResponse({ type: ReadinessDto })
  async readiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessDto> {
    try {
      await this.prisma.ping();
      return { status: 'ok', checks: { database: 'up' } };
    } catch (error) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'error',
        checks: { database: 'down' },
        errors: { database: error instanceof Error ? error.message : String(error) },
      };
    }
  }
}
