import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotImplementedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrokersService } from './brokers.service';
import { BrokerDto } from './dto/broker.dto';

@ApiTags('brokers')
@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokers: BrokersService) {}

  @Get()
  @ApiOperation({ summary: 'List brokers', description: 'Replaces the Broker__c list view / tab.' })
  @ApiOkResponse({ type: BrokerDto, isArray: true })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-19)' })
  findAll(): Promise<BrokerDto[]> {
    return this.brokers.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a broker',
    description: 'Replaces `lightning/uiRecordApi getRecord` on Broker__c (brokerCard LWC).',
  })
  @ApiOkResponse({ type: BrokerDto })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-19)' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BrokerDto> {
    return this.brokers.findOne(id);
  }
}
