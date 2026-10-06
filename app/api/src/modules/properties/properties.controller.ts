import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PropertyQueryDto } from './dto/property-query.dto';
import { PagedPropertiesDto, PropertyPictureDto } from './dto/property.dto';
import { PropertiesService } from './properties.service';

/**
 * `@AuraEnabled(cacheable=true)` → the response may be reused by the caller for a short while
 * (the LDS client cache); `private` because `with sharing` makes the answer user-specific.
 * Express adds a weak ETag, so TanStack Query refetches revalidate with 304.
 */
export const CACHEABLE = 'private, max-age=30, stale-while-revalidate=60';

@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @Header('Cache-Control', CACHEABLE)
  @ApiOperation({
    summary: 'Paged, filtered property list',
    description:
      'Port of `@AuraEnabled(cacheable=true) PropertyController.getPagedPropertyList` (used by propertyTileList). ' +
      'Same filter semantics as the SOQL: case-insensitive `%searchKey%` on name, city or tags; inclusive ' +
      '`maxPrice` / `minBedrooms` / `minBathrooms` bounds; ordered by price ascending.',
  })
  @ApiOkResponse({ type: PagedPropertiesDto })
  getPagedPropertyList(@Query() query: PropertyQueryDto): Promise<PagedPropertiesDto> {
    return this.properties.getPagedPropertyList(query);
  }

  @Get(':id/pictures')
  @Header('Cache-Control', CACHEABLE)
  @ApiOperation({
    summary: 'Pictures attached to a property',
    description:
      'Port of `@AuraEnabled(cacheable=true) PropertyController.getPictures` (used by propertyCarousel): ' +
      'PNG/JPG/GIF files linked to the property, oldest first. `[]` when none (Apex returned null).',
  })
  @ApiOkResponse({ type: PropertyPictureDto, isArray: true })
  getPictures(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyPictureDto[]> {
    return this.properties.getPictures(id);
  }
}
