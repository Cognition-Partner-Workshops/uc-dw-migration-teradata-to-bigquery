import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PagedResultDto } from '../../../common/dto/paged-result.dto';

/** Fields selected by `PropertyController.getPagedPropertyList` from Property__c. */
export class PropertySummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Property__c.Name' })
  name: string;

  @ApiPropertyOptional({ description: 'Address__c' })
  address?: string;

  @ApiPropertyOptional({ description: 'City__c' })
  city?: string;

  @ApiPropertyOptional({ description: 'State__c' })
  state?: string;

  @ApiPropertyOptional({ description: 'Description__c' })
  description?: string;

  @ApiPropertyOptional({ description: 'Price__c' })
  price?: number;

  @ApiPropertyOptional({ description: 'Baths__c' })
  baths?: number;

  @ApiPropertyOptional({ description: 'Beds__c' })
  beds?: number;

  @ApiPropertyOptional({ description: 'Thumbnail__c' })
  thumbnail?: string;

  @ApiPropertyOptional({ description: 'Location__Latitude__s' })
  latitude?: number;

  @ApiPropertyOptional({ description: 'Location__Longitude__s' })
  longitude?: number;
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
