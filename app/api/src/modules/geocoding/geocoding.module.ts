import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { NominatimClient } from './nominatim.client';

/** Apex `GeocodingService` (Nominatim callout). `GeocodingService` is exported for the properties module. */
@Module({
  controllers: [GeocodingController],
  providers: [
    {
      provide: NominatimClient,
      useFactory: NominatimClient.fromConfig,
      inject: [AppConfigService],
    },
    GeocodingService,
  ],
  exports: [GeocodingService],
})
export class GeocodingModule {}
