import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoordinatesDto, GeocodeAddressesDto, GeocodingAddressDto } from './dto/geocoding.dto';
import { RequirePermission } from '../../auth/decorators';
import { GeocodingService } from './geocoding.service';

/** GeocodingService ran as a flow action: no Apex class access needed, any app user may call it (`geocoding.invoke`). */
@ApiTags('geocoding')
@Controller()
@RequirePermission('geocoding.invoke')
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Post('geocoding/addresses')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Geocode one or more addresses',
    description:
      'Port of `@InvocableMethod GeocodingService.geocodeAddresses` (called from the Create_property flow). ' +
      'Returns one Coordinates entry per input address, in order; `{lat: null, lon: null}` for a blank ' +
      'address, an unknown address or an upstream failure (the Apex callout swallowed non-200 answers).',
  })
  @ApiOkResponse({ type: CoordinatesDto, isArray: true })
  geocodeAddresses(@Body() body: GeocodeAddressesDto): Promise<CoordinatesDto[]> {
    return this.geocoding.geocodeAddresses(body.addresses);
  }

  @Post('geocode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Geocode a single address',
    description:
      'Single-address form of `geocodeAddresses` for the UI (Create_property wizard address screen). ' +
      'Nominatim (OpenStreetMap) usage policy applies: requests are spaced 1/s and results are cached server-side.',
  })
  @ApiOkResponse({ type: CoordinatesDto })
  geocode(@Body() address: GeocodingAddressDto): Promise<CoordinatesDto> {
    return this.geocoding.geocodeAddress(address);
  }
}
