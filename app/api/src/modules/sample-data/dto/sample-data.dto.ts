import { ApiProperty } from '@nestjs/swagger';

export class SampleDataImportResultDto {
  @ApiProperty({ example: { brokers: 8, properties: 12, contacts: 10 } })
  inserted: Record<string, number>;
}
