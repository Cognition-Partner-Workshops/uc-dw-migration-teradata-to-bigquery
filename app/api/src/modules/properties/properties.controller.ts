import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
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
import { PropertyQueryDto } from './dto/property-query.dto';
import { CreatePropertyDto, PropertyDto, UpdatePropertyDto } from './dto/property-record.dto';
import { PagedPropertiesDto, PropertyPictureDto } from './dto/property.dto';
import { PropertiesService } from './properties.service';

/**
 * `@AuraEnabled(cacheable=true)` → the response may be reused by the caller for a short while
 * (the LDS client cache); `private` because `with sharing` makes the answer user-specific.
 * Express adds a weak ETag, so TanStack Query refetches revalidate with 304.
 */
export const CACHEABLE = 'private, max-age=30, stale-while-revalidate=60';

const FIELD_ERRORS = { type: ApiErrorDto, description: 'Field errors (output.fieldErrors)' };
const NOT_FOUND = { description: 'No property with this id' };

/**
 * Authorization (src/auth/policy.ts): object CRUD of `Property__c` per route; the two Apex
 * methods additionally need class access to PropertyController/PagedResult (`properties.invoke`).
 * Field-level security of Property__c applies to every body and response (`@SfObjectAccess`).
 */
@ApiTags('properties')
@Controller('properties')
@SfObjectAccess('Property__c')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @RequirePermission('properties.read', 'properties.invoke')
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

  @Post()
  @RequirePermission('properties.create')
  @ApiOperation({
    summary: 'Create a property (Create_property flow)',
    description:
      'The `Create_property` screen flow as one call: the flow inputs (name, description, brokerId, price, ' +
      'address/city/state/zip/country, beds, baths, tags) plus any other writable Property__c field. With ' +
      '`geocode: true` the geocode_address Apex action runs first and fills latitude/longitude; a geocoder ' +
      'failure is the flow fault path (502, nothing created). The record-create assignments of the flow are ' +
      'applied when omitted: `status: "Available"`, `dateListed: today`. The picture upload screen is ' +
      '`POST /files` on the returned id. Also LDS `createRecord(Property__c)` for the standard New action.',
  })
  @ApiCreatedResponse({ type: PropertyDto })
  @ApiBadRequestResponse(FIELD_ERRORS)
  @ApiBadGatewayResponse({
    type: ApiErrorDto,
    description: 'Geocoding fault (output.errors[0].errorCode = GEOCODING_FAULT)',
  })
  create(@Body() body: CreatePropertyDto): Promise<PropertyDto> {
    return this.properties.create(body);
  }

  @Get(':id')
  @RequirePermission('properties.read')
  @Header('Cache-Control', CACHEABLE)
  @ApiOperation({
    summary: 'Get a property',
    description:
      'LDS `getRecord` on Property__c as used by propertySummary / propertyLocation / propertyMap and the record page.',
  })
  @ApiOkResponse({ type: PropertyDto })
  @ApiNotFoundResponse(NOT_FOUND)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyDto> {
    return this.properties.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('properties.edit')
  @ApiOperation({
    summary: 'Update a property',
    description:
      'LDS `updateRecord(Property__c)` (record page Edit, inline edit). `geocode: true` re-geocodes the ' +
      'resulting address, as the flow did on create.',
  })
  @ApiOkResponse({ type: PropertyDto })
  @ApiBadRequestResponse(FIELD_ERRORS)
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'Geocoding fault' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePropertyDto,
  ): Promise<PropertyDto> {
    return this.properties.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('properties.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a property',
    description:
      'LDS `deleteRecord(Property__c)`; linked files go with it (ContentDocumentLink cascade).',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse(NOT_FOUND)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.properties.remove(id);
  }

  @Get(':id/pictures')
  @RequirePermission('properties.read', 'properties.invoke', 'files.read')
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
