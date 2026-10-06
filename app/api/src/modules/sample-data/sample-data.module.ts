import { Module } from '@nestjs/common';
import { SampleDataController } from './sample-data.controller';
import { SampleDataImportGuard } from './sample-data.guard';
import { SampleDataPolicy } from './sample-data.policy';
import { SampleDataService } from './sample-data.service';

/** Apex `SampleDataController` + `sample_data_*` static resources (bundled under ./fixtures). */
@Module({
  controllers: [SampleDataController],
  providers: [SampleDataPolicy, SampleDataImportGuard, SampleDataService],
})
export class SampleDataModule {}
