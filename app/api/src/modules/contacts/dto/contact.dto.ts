import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Standard `Contact` as shipped in salesforce/data/contacts-data.json. */
export class ContactDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional({ format: 'email' })
  email?: string;

  @ApiPropertyOptional()
  phone?: string;
}
