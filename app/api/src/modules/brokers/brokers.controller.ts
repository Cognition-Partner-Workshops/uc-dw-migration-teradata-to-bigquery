import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission, SfObjectAccess } from '../../auth/decorators';
import { ApiErrorDto } from '../../common/errors/api-error.dto';
import { BrokersService } from './brokers.service';
import { BrokerDto, CreateBrokerDto, UpdateBrokerDto } from './dto/broker.dto';

/**
 * Explicit CRUD for `Broker__c` — what Lightning Data Service and the Broker record page
 * did implicitly (policy.brokers.crud in docs/migration/mapping.yaml).
 */
@ApiTags('brokers')
@Controller('brokers')
@SfObjectAccess('Broker__c')
export class BrokersController {
  constructor(private readonly brokers: BrokersService) {}

  @Get()
  @RequirePermission('brokers.read')
  @ApiOperation({
    summary: 'List brokers',
    description: 'Broker__c tab (list view), ordered by name.',
  })
  @ApiOkResponse({ type: BrokerDto, isArray: true })
  findAll(): Promise<BrokerDto[]> {
    return this.brokers.findAll();
  }

  @Get(':id')
  @RequirePermission('brokers.read')
  @ApiOperation({
    summary: 'Get a broker',
    description: 'LDS `getRecord` as used by the brokerCard LWC / Broker_Record_Page.',
  })
  @ApiOkResponse({ type: BrokerDto })
  @ApiNotFoundResponse({ description: 'No broker with this id' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BrokerDto> {
    return this.brokers.findOne(id);
  }

  @Post()
  @RequirePermission('brokers.create')
  @ApiOperation({ summary: 'Create a broker', description: 'LDS `createRecord(Broker__c)`.' })
  @ApiCreatedResponse({ type: BrokerDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Field errors (output.fieldErrors)' })
  create(@Body() body: CreateBrokerDto): Promise<BrokerDto> {
    return this.brokers.create(body);
  }

  @Patch(':id')
  @RequirePermission('brokers.edit')
  @ApiOperation({ summary: 'Update a broker', description: 'LDS `updateRecord(Broker__c)`.' })
  @ApiOkResponse({ type: BrokerDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Field errors (output.fieldErrors)' })
  @ApiNotFoundResponse({ description: 'No broker with this id' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBrokerDto,
  ): Promise<BrokerDto> {
    return this.brokers.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('brokers.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a broker',
    description: 'LDS `deleteRecord(Broker__c)`; properties keep existing with brokerId cleared.',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'No broker with this id' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.brokers.remove(id);
  }
}
