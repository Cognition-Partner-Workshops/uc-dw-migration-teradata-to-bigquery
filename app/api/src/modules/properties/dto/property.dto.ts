import { ApiProperty } from '@nestjs/swagger';
import { PagedResultDto } from '../../../common/dto/paged-result.dto';

/**
 * Fields selected by `PropertyController.getPagedPropertyList` from Property__c. Every selected
 * field is present on each record (SOQL returns null for empty fields; so does the JSON).
 */
export class PropertySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Property__c.Name' })
  name: string;

  @ApiProperty({ description: 'Address__c', nullable: true, type: String })
  address: string | null;

  @ApiProperty({ description: 'City__c', nullable: true, type: String })
  city: string | null;

  @ApiProperty({ description: 'State__c', nullable: true, type: String })
  state: string | null;

  @ApiProperty({ description: 'Description__c', nullable: true, type: String })
  description: string | null;

  @ApiProperty({ description: 'Price__c', nullable: true, type: Number })
  price: number | null;

  @ApiProperty({ description: 'Baths__c', nullable: true, type: Number })
  baths: number | null;

  @ApiProperty({ description: 'Beds__c', nullable: true, type: Number })
  beds: number | null;

  @ApiProperty({ description: 'Thumbnail__c', nullable: true, type: String })
  thumbnail: string | null;

  @ApiProperty({ description: 'Location__Latitude__s', nullable: true, type: Number })
  latitude: number | null;

  @ApiProperty({ description: 'Location__Longitude__s', nullable: true, type: Number })
  longitude: number | null;
}

export class PagedPropertiesDto extends PagedResultDto<PropertySummaryDto> {
  @ApiProperty({ type: PropertySummaryDto, isArray: true })
  declare records: PropertySummaryDto[];
}

/** Port of the ContentVersion rows returned by `PropertyController.getPictures`. */
export class PropertyPictureDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ description: 'ContentVersion.FileExtension' })
  fileExtension: string;

  @ApiProperty({ format: 'uri' })
  url: string;
}
