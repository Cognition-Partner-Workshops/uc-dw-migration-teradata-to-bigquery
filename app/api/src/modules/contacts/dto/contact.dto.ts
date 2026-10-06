import { ApiProperty } from '@nestjs/swagger';

/** Standard `Contact` as shipped in salesforce/data/contacts-data.json (SOQL null → JSON null). */
export class ContactDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Original Salesforce Id while migrating',
    nullable: true,
    type: String,
  })
  sfId: string | null;

  @ApiProperty({ description: 'FirstName', nullable: true, type: String })
  firstName: string | null;

  @ApiProperty({ description: 'LastName' })
  lastName: string;

  @ApiProperty({ description: 'Email', nullable: true, type: String, format: 'email' })
  email: string | null;

  @ApiProperty({ description: 'Phone', nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ description: 'MobilePhone', nullable: true, type: String })
  mobilePhone: string | null;

  @ApiProperty({ description: 'Title', nullable: true, type: String })
  title: string | null;
}
