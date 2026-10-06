import { Controller, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotImplementedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators';
import { SampleDataImportResultDto } from './dto/sample-data.dto';
import { SampleDataService } from './sample-data.service';

@ApiTags('sample-data')
@Controller('sample-data')
export class SampleDataController {
  constructor(private readonly sampleData: SampleDataService) {}

  @Post('import')
  @RequirePermission(
    'sampleData.invoke',
    'properties.delete',
    'brokers.delete',
    'contacts.delete',
    'properties.create',
    'brokers.create',
    'contacts.create',
  )
  @ApiOperation({
    summary: 'Reset and reload the sample data set',
    description:
      'Port of `@AuraEnabled SampleDataController.importSampleData` (Settings tab, sampleDataImporter LWC).',
  })
  @ApiCreatedResponse({ type: SampleDataImportResultDto })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-18)' })
  importSampleData(): Promise<SampleDataImportResultDto> {
    return this.sampleData.importSampleData();
  }
}
