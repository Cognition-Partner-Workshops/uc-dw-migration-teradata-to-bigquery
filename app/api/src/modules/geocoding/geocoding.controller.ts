import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiNotImplementedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoordinatesDto, GeocodeAddressesDto } from './dto/geocoding.dto';
import { GeocodingService } from './geocoding.service';

@ApiTags('geocoding')
@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Post('addresses')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Geocode one or more addresses',
    description:
      'Port of `@InvocableMethod GeocodingService.geocodeAddresses` (called from the Create_property flow). ' +
      'Returns one Coordinates entry per input address, in order.',
  })
  @ApiOkResponse({ type: CoordinatesDto, isArray: true })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-17)' })
  geocodeAddresses(@Body() body: GeocodeAddressesDto): Promise<CoordinatesDto[]> {
    return this.geocoding.geocodeAddresses(body.addresses);
  }
}
