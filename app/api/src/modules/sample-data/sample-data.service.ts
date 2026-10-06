import { Injectable } from '@nestjs/common';
import { NotPortedException } from '../../common/not-ported.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { SampleDataImportResultDto } from './dto/sample-data.dto';

/**
 * Home of Apex `SampleDataController` (+ `TestSampleDataController`).
 * The static resources `sample_data_*` become JSON fixtures; the delete+insert DML
 * becomes a single Prisma interactive transaction.
 */
@Injectable()
export class SampleDataService {
  constructor(private readonly prisma: PrismaService) {}

  async importSampleData(): Promise<SampleDataImportResultDto> {
    throw new NotPortedException('SampleDataController.importSampleData', 'UNT3-18');
  }
}
