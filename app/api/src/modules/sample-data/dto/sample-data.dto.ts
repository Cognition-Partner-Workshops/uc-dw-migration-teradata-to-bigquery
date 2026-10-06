import { ApiProperty } from '@nestjs/swagger';

export class SampleDataCountsDto {
  @ApiProperty({ example: 8 })
  brokers: number;

  @ApiProperty({ example: 12 })
  properties: number;

  @ApiProperty({ example: 5 })
  contacts: number;
}

export class SampleDataImportResultDto {
  @ApiProperty({ type: SampleDataCountsDto, description: 'Rows deleted before the reload' })
  deleted: SampleDataCountsDto;

  @ApiProperty({
    type: SampleDataCountsDto,
    description: 'Rows inserted from the sample data JSON',
  })
  inserted: SampleDataCountsDto;
}
