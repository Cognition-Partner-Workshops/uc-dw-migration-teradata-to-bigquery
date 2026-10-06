import { Module } from '@nestjs/common';
import { SampleDataController } from './sample-data.controller';
import { SampleDataService } from './sample-data.service';

/** Apex `SampleDataController` + `sample_data_*` static resources. */
@Module({
  controllers: [SampleDataController],
  providers: [SampleDataService],
})
export class SampleDataModule {}
