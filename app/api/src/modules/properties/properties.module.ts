import { Module } from '@nestjs/common';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

/** Salesforce `Property__c` + `PropertyController`. Imports `GeocodingModule` so create/update can geocode addresses. */
@Module({
  imports: [GeocodingModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
