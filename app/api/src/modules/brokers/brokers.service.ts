import { Injectable } from '@nestjs/common';
import { NotPortedException } from '../../common/not-ported.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { BrokerDto } from './dto/broker.dto';

/** Home of everything about `Broker__c` (no Apex; LDS-driven in Salesforce). */
@Injectable()
export class BrokersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<BrokerDto[]> {
    throw new NotPortedException('Broker__c list (Broker__c tab)', 'UNT3-19');
  }

  async findOne(_id: string): Promise<BrokerDto> {
    throw new NotPortedException('Broker__c record (brokerCard / Broker_Record_Page)', 'UNT3-19');
  }
}
