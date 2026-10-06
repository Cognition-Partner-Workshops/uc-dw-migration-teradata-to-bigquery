import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ example: 'dreamhouse-api' })
  service: string;

  @ApiProperty({ example: '0.1.0' })
  version: string;

  @ApiProperty({ example: 12.3 })
  uptimeSeconds: number;

  @ApiProperty({ example: '2026-10-06T07:00:00.000Z' })
  timestamp: string;
}

export class ReadinessDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiProperty({
    example: { database: 'up' },
    description: 'Per-dependency state; `down` entries carry the error message in `errors`.',
  })
  checks: Record<string, 'up' | 'down'>;

  @ApiProperty({ required: false, example: { database: 'connection refused' } })
  errors?: Record<string, string>;
}
