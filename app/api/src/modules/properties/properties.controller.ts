import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiNotImplementedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PropertyQueryDto } from './dto/property-query.dto';
import { PagedPropertiesDto, PropertyPictureDto } from './dto/property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Paged, filtered property list',
    description:
      'Port of `@AuraEnabled PropertyController.getPagedPropertyList` (used by propertyTileList).',
  })
  @ApiOkResponse({ type: PagedPropertiesDto })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-16)' })
  getPagedPropertyList(@Query() query: PropertyQueryDto): Promise<PagedPropertiesDto> {
    return this.properties.getPagedPropertyList(query);
  }

  @Get(':id/pictures')
  @ApiOperation({
    summary: 'Pictures attached to a property',
    description:
      'Port of `@AuraEnabled PropertyController.getPictures` (used by propertyCarousel).',
  })
  @ApiOkResponse({ type: PropertyPictureDto, isArray: true })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-16)' })
  getPictures(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyPictureDto[]> {
    return this.properties.getPictures(id);
  }
}
