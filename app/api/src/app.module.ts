import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logging/logger.module';
import { BrokersModule } from './modules/brokers/brokers.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { FilesModule } from './modules/files/files.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { SampleDataModule } from './modules/sample-data/sample-data.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // platform
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    // one module per Salesforce object / Apex domain (see docs/migration/mapping.yaml)
    PropertiesModule,
    BrokersModule,
    ContactsModule,
    FilesModule,
    GeocodingModule,
    SampleDataModule,
  ],
})
export class AppModule {}
