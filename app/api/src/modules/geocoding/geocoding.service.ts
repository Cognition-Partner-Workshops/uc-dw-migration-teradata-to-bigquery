import { Injectable } from '@nestjs/common';
import { NotPortedException } from '../../common/not-ported.exception';
import { AppConfigService } from '../../config/app-config.service';
import { CoordinatesDto, GeocodingAddressDto } from './dto/geocoding.dto';

/**
 * Home of Apex `GeocodingService` (+ `GeocodingServiceTest`).
 * The Apex HTTP callout to Nominatim (Remote Site Setting `nominatim_openstreetmap`)
 * becomes an outbound `fetch` here; `GEOCODING_BASE_URL` replaces the hard-coded URL.
 */
@Injectable()
export class GeocodingService {
  constructor(private readonly config: AppConfigService) {}

  get baseUrl(): string {
    return this.config.get('GEOCODING_BASE_URL');
  }

  async geocodeAddresses(_addresses: GeocodingAddressDto[]): Promise<CoordinatesDto[]> {
    throw new NotPortedException('GeocodingService.geocodeAddresses', 'UNT3-17');
  }
}
