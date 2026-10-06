import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SampleDataImportResultDto } from './dto/sample-data.dto';
import { SampleDataImportGuard } from './sample-data.guard';
import { SampleDataService } from './sample-data.service';

@ApiTags('sample-data')
@Controller('sample-data')
export class SampleDataController {
  constructor(private readonly sampleData: SampleDataService) {}

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SampleDataImportGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reset and reload the sample data set (admin only)',
    description:
      'Port of `@AuraEnabled SampleDataController.importSampleData` (Settings tab, sampleDataImporter LWC): deletes every ' +
      'property, broker and contact, then inserts the `sample_data_*` static resources, all in one transaction. ' +
      'Requires the `dreamhouse-admin` group and is refused unless the deployment allows it (SAMPLE_DATA_IMPORT_ENABLED).',
  })
  @ApiOkResponse({ type: SampleDataImportResultDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Import disabled on this deployment, or caller is not a dreamhouse-admin',
  })
  importSampleData(): Promise<SampleDataImportResultDto> {
    return this.sampleData.importSampleData();
  }
}
