import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Broker__c record as shown by the brokerCard LWC and the Broker record page. */
export class BrokerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Broker__c.Name' })
  name: string;

  @ApiPropertyOptional({ description: 'Broker_Id__c' })
  brokerId?: string;

  @ApiPropertyOptional({ description: 'Title__c' })
  title?: string;

  @ApiPropertyOptional({ description: 'Email__c', format: 'email' })
  email?: string;

  @ApiPropertyOptional({ description: 'Phone__c' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Mobile_Phone__c' })
  mobilePhone?: string;

  @ApiPropertyOptional({ description: 'Picture__c', format: 'uri' })
  picture?: string;
}
