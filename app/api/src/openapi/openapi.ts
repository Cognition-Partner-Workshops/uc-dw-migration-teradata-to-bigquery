import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { packageInfo } from '../common/package-info';

export const OPENAPI_JSON_PATH = 'openapi.json';
export const OPENAPI_DOCS_PATH = 'docs';

export const API_TAGS = [
  { name: 'health', description: 'Liveness and readiness probes' },
  {
    name: 'properties',
    description: 'Property__c — PropertyController, Property record page, Create_property flow',
  },
  { name: 'brokers', description: 'Broker__c — Broker record page, brokerCard' },
  { name: 'contacts', description: 'Contact (standard object; sample data only)' },
  { name: 'files', description: 'ContentVersion / ContentDocumentLink — FileUtilities' },
  { name: 'geocoding', description: 'GeocodingService (Nominatim callout)' },
  { name: 'sample-data', description: 'SampleDataController — sampleDataImporter' },
] as const;

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Dreamhouse API')
    .setDescription(packageInfo.description)
    .setVersion(packageInfo.version)
    .setLicense('CC0-1.0', 'https://creativecommons.org/publicdomain/zero/1.0/');
  for (const tag of API_TAGS) {
    builder.addTag(tag.name, tag.description);
  }
  return SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (_c, method) => method,
  });
}

export function setupOpenApi(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(OPENAPI_DOCS_PATH, app, document, { jsonDocumentUrl: OPENAPI_JSON_PATH });
  return document;
}
