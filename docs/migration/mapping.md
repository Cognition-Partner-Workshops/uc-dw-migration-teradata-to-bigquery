# 1:1 mapping matrix

Rendered from [`mapping.yaml`](mapping.yaml) by `python3 tools/mapping/mapping.py --render`; CI runs `--check`. One row per inventory id from [`inventory.json`](inventory.json). Edit the YAML, never this file.

## Conventions

- **ids**: inventory id = <sourceKind>:<apiName>; apexMethod ids are Class.method or Class.Inner.method; permission ids are <permissionSet>.<kind>.<subject>
- **status**: mapped (target decided) -> ported (code exists) -> tested (covered by parity_tests) -> passing (parity run green); dropped is terminal
- **disposition**: port (1:1 counterpart) | substitute (different mechanism, reason required) | dropped (no counterpart, reason required, target null)
- **parity_tests**: kebab-case E2E scenario ids from tests/parity (written back by UNT3-25); required once status >= tested
- **sql**: snake_case; plural table names (properties, brokers, contacts, files); column = field API name without __c in snake_case; lookups get _id; Currency -> numeric(18,2); Picklist -> enum; Geolocation -> *_latitude/*_longitude; every table has id uuid PK + sf_id char(18) unique + audit columns
- **api**: one Nest module per object/Apex domain (app/api/src/modules/<kebab>); <Pascal>Service, <Pascal>Dto; routes kebab-case plural (GET /properties, GET /properties/{id}/pictures, POST /geocoding/addresses); @AuraEnabled(cacheable=true) -> GET, otherwise POST/PATCH/DELETE; @InvocableMethod -> POST; Apex tests -> tests/parity/characterisation/<kebab-class>.spec.ts::<testMethod>
- **web**: components PascalCase in app/web/src/components/<Name>/<Name>.tsx with <Name>.test.tsx; pages in app/web/src/pages; routes kebab-case (/property-explorer, /property-finder, /properties, /properties/:id, /properties/new, /brokers, /brokers/:id, /settings); LMS channels -> URL search params + store in app/web/src/state; LDS wires -> TanStack Query over the generated API client
- **security**: permission set -> Cognito group (role); object/class permissions -> policy keys in app/api/src/auth/policy.ts (@RequirePermission); field permissions -> app/api/src/auth/field-policy.ts (FieldSecurityInterceptor); org-wide defaults / with sharing -> app/api/src/auth/sharing.ts; tab visibility -> requiredGroup in app/web/src/app/navigation.ts; matrix in docs/migration/permissions.md
- **integration**: remote site setting / named credential -> env var in app/api/src/config/config.schema.ts; callout -> <Pascal>Service.<method> using fetch; CSP trusted site -> CloudFront response headers policy in infra/
- **platform_only_features**: LDS caching -> TanStack Query; barcode scanner -> browser BarcodeDetector + manual entry (substitute); device contacts -> dropped; in-app guidance prompts -> dropped; Lightning Message Service -> URL params + store

## Summary

- Rows: **200** (inventory ids: 200)
- Status: mapped **75**, ported **119**, tested **0**, passing **0**, dropped **6**
- Disposition: port **174**, substitute **20**, dropped **6**
- Rows with parity tests: **41**

| Source kind | Rows | mapped | ported | tested | passing | dropped | substitute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Custom objects | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| Custom fields | 32 | 4 | 28 | 0 | 0 | 0 | 4 |
| List views | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Compact layouts | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Standard objects referenced | 10 | 5 | 4 | 0 | 0 | 1 | 5 |
| Apex classes | 9 | 2 | 7 | 0 | 0 | 0 | 0 |
| Apex inner classes | 4 | 0 | 4 | 0 | 0 | 0 | 2 |
| Apex methods | 23 | 6 | 17 | 0 | 0 | 0 | 2 |
| Lightning Web Components | 17 | 16 | 0 | 0 | 0 | 1 | 1 |
| LWC jest tests | 17 | 17 | 0 | 0 | 0 | 0 | 0 |
| Aura bundles | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Flows | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Lightning pages (FlexiPages) | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| Page layouts | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Tabs | 5 | 0 | 5 | 0 | 0 | 0 | 0 |
| Lightning apps | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Permission sets | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Permission set entries | 44 | 0 | 44 | 0 | 0 | 0 | 0 |
| Static resources | 4 | 3 | 1 | 0 | 0 | 0 | 1 |
| Content assets | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Lightning message channels | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Remote site settings | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| CSP trusted sites | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| External callouts | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| In-app guidance prompts | 3 | 0 | 0 | 0 | 0 | 3 | 0 |
| Jest mock modules | 8 | 7 | 0 | 0 | 0 | 1 | 5 |

## Custom objects

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `object:Broker__c` | Broker (7 fields, sharing ReadWrite) | table `brokers` | port | ported | UNT3-11 | — | Prisma model Broker (@@map "brokers"); id uuid PK, sf_id char(18) unique, name varchar(80) (standard Name), audit columns; API module app/api/src/modules/brokers. Record CRUD (UNT3-19): GET /brokers, GET/PATCH/DELETE /brokers/{id}, POST /brokers (BrokersService; BrokerDto/CreateBrokerDto/UpdateBrokerDto validate the field sizes server-side; delete clears Property__c.Broker__c via ON DELETE SET NULL) |
| `object:Property__c` | Property (25 fields, sharing ReadWrite) | table `properties` | port | ported | UNT3-11 | — | Prisma model Property (@@map "properties"); id uuid PK, sf_id char(18) unique, name varchar(80) (standard Name), owner_id/created_by/created_at/updated_at audit columns; API module app/api/src/modules/properties. Record CRUD (UNT3-19): GET /properties/{id}, POST /properties (Create_property flow, geocode option), PATCH/DELETE /properties/{id} (PropertiesService.findOne/create/update/remove; PropertyDto/CreatePropertyDto/UpdatePropertyDto in dto/property-record.dto.ts mirror the field sizes, ranges, picklist and Location__c pairing; database CHECK/FK failures are translated to the same field errors by PrismaExceptionFilter) |

## Custom fields

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `field:Broker__c.Broker_Id__c` | Broker Id (Number: 18,0) | column `brokers.broker_id` (numeric(18,0)) | port | ported | UNT3-11 | — |  |
| `field:Broker__c.Email__c` | Email (Email) | column `brokers.email` (varchar(80)) | port | ported | UNT3-11 | — | format validated by class-validator @IsEmail |
| `field:Broker__c.Mobile_Phone__c` | Mobile Phone (Phone) | column `brokers.mobile_phone` (varchar(40)) | port | ported | UNT3-11 | — |  |
| `field:Broker__c.Phone__c` | Phone (Phone) | column `brokers.phone` (varchar(40)) | port | ported | UNT3-11 | — |  |
| `field:Broker__c.Picture_IMG__c` | Picture (Text: formula) | component `RecordImage` | substitute | mapped | UNT3-22 | — | **substitute**: IMAGE() display formula; no stored column. The record page/tile renders <img src={picture}> from brokers.picture with the same size. |
| `field:Broker__c.Picture__c` | Picture (Url) | column `brokers.picture` (varchar(255)) | port | ported | UNT3-11 | — |  |
| `field:Broker__c.Title__c` | Title (Text: 30) | column `brokers.title` (varchar(30)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Address__c` | Address (Text: 100) | column `properties.address` (varchar(100)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Assessed_Value__c` | Assessed Value (Currency: 18,0) | column `properties.assessed_value` (numeric(18,2)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Baths__c` | Baths (Number: 2,0) | column `properties.baths` (integer) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Beds__c` | Beds (Number: 2,0) | column `properties.beds` (integer) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Broker__c` | Broker (Lookup: -> Broker__c) | column `properties.broker_id` (uuid references brokers(id) on delete set null) | port | ported | UNT3-11 | — | FK brokers(id), ON DELETE SET NULL (deleteConstraint SetNull); relationship Properties -> Prisma relation broker/properties; API exposes brokerId |
| `field:Property__c.City__c` | City (Text: 50) | column `properties.city` (varchar(50)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Date_Agreement__c` | Date Agreement (Date) | column `properties.date_agreement` (date) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Date_Closed__c` | Date Closed (Date) | column `properties.date_closed` (date) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Date_Contracted__c` | Date Contracted (Date) | column `properties.date_contracted` (date) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Date_Listed__c` | Date Listed (Date) | column `properties.date_listed` (date) | port | ported | UNT3-11 | — | Field default TODAY() - 10 only prefilled the standard New form; the only create path of the app, the Create_property flow, assigns $Flow.CurrentDate, so PropertiesService.create defaults dateListed to the current date when omitted (not a DB default). API shape YYYY-MM-DD (IsCalendarDate) |
| `field:Property__c.Date_Pre_Market__c` | Date Pre Market (Date) | column `properties.date_pre_market` (date) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Days_On_Market__c` | Days On Market (Number: formula) | column `properties_v.days_on_market` (integer) | port | ported | UNT3-11 | — | TODAY() - Date_Listed__c is not immutable, so not a generated column: view properties_v (prisma/migrations) exposes days_on_market = CURRENT_DATE - date_listed (0 when null, formulaTreatBlanksAs BlankAsZero); PropertiesService (UNT3-16) computes the same value as PropertyDto.daysOnMarket. (convention exception: Formula field -> column of the view properties_v (same name as the table column would have), not a stored column of properties.) |
| `field:Property__c.Description__c` | Description (LongTextArea: 500) | column `properties.description` (text) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Location__c` | Location (Location) | column `properties.location_latitude` (numeric(10,7)) | port | ported | UNT3-11 | — | (convention exception: Compound Geolocation field -> two columns: properties.location_latitude and properties.location_longitude (Salesforce exposes them as Location__Latitude__s / Location__Longitude__s).) |
| `field:Property__c.Picture_IMG__c` | Main Picture (Text: formula) | component `RecordImage` | substitute | mapped | UNT3-22 | — | **substitute**: IMAGE() display formula; no stored column. The record page/tile renders <img src={picture}> from properties.picture with the same size. |
| `field:Property__c.Picture__c` | Picture (Url) | column `properties.picture` (varchar(255)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Price_Sold__c` | Price Sold (Currency: 8,0) | column `properties.price_sold` (numeric(18,2)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Price__c` | Asking Price (Currency: 8,0) | column `properties.price` (numeric(18,2)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Record_Link__c` | Record Link (Text: formula) | route `/properties/:id` | substitute | mapped | UNT3-22 | — | **substitute**: Formula builds the Salesforce record URL ($Api.Partner_Server_URL + Id); the equivalent is the web app route, exposed as PropertyDto.recordUrl for exports. |
| `field:Property__c.State__c` | State (Text: 20) | column `properties.state` (varchar(20)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Status__c` | Status (Picklist: Contracted/Pre Market/Available/Under Agreement/Closed) | column `properties.status` (property_status (enum)) | port | ported | UNT3-11 | — | restricted picklist -> Postgres enum property_status (Contracted, Pre Market, Available, Under Agreement, Closed); API validates with class-validator @IsEnum |
| `field:Property__c.Tags__c` | Tags (Text: 255) | column `properties.tags` (varchar(255)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Thumbnail_IMG__c` | Main Thumbnail (Text: formula) | component `RecordImage` | substitute | mapped | UNT3-22 | — | **substitute**: IMAGE() display formula; no stored column. The record page/tile renders <img src={thumbnail}> from properties.thumbnail with the same size. |
| `field:Property__c.Thumbnail__c` | Thumbnail (Url) | column `properties.thumbnail` (varchar(255)) | port | ported | UNT3-11 | — |  |
| `field:Property__c.Zip__c` | Zip (Text: 10) | column `properties.zip` (varchar(10)) | port | ported | UNT3-11 | — |  |

## List views

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `listView:Broker__c.All` | All: NAME | config `app/web/src/pages/brokers/brokerListView.ts` | port | mapped | UNT3-22 | — | Columns of the /brokers list page (Mantine DataTable): name |
| `listView:Property__c.All` | All: NAME, City__c, Beds__c, Price__c, Status__c | config `app/web/src/pages/properties/propertyListView.ts` | port | mapped | UNT3-22 | — | Columns of the /properties list page: name, city, beds, price, status |

## Compact layouts

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `compactLayout:Broker__c.Broker_Compact` | Broker Compact: Name, Title__c, Phone__c, Mobile_Phone__c, Email__c | config `app/web/src/pages/brokers/brokerLayout.ts::highlights` | port | mapped | UNT3-22 | — | Record page highlights panel fields: name, title, phone, mobilePhone, email |
| `compactLayout:Property__c.Property_Compact_Layout` | Property Compact Layout: Name, City__c, Price__c, Beds__c, Baths__c | config `app/web/src/pages/properties/propertyLayout.ts::highlights` | port | mapped | UNT3-22 | — | Record page highlights panel fields: name, city, price, beds, baths |

## Standard objects referenced

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `standardObject:Case` | used by SampleDataController (DML), SampleDataController (SOQL) | — | dropped | dropped | UNT3-18 | — | **dropped**: Only touched by SampleDataController.importSampleData to delete all Cases before import; the target app has no cases. |
| `standardObject:Contact` | used by Dreamhouse (tab standard-Contact), SampleDataController (DML), SampleDataController (SOQL), TestSampleDataController (SOQL) | table `contacts` | port | ported | UNT3-11 | — | Sample data only (sample_data_contacts, standard-Contact tab). Prisma model Contact: id, sf_id, first_name, last_name, email, phone, mobile_phone, title, mailing_* columns; API module app/api/src/modules/contacts. Read-only API (UNT3-19): GET /contacts, GET /contacts/{id} (ContactsService); the permission set grants no Contact CRUD, writes stay with POST /sample-data/import (UNT3-18) |
| `standardObject:ContentDocument` | used by Dreamhouse (tab standard-File), TestPropertyController (SOQL) | table `files` | port | mapped | UNT3-18 | — | Collapsed with ContentVersion/ContentDocumentLink into one files table (id, sf_id, title, file_type, s3_key, record_id, created_at, created_by) + S3 object; table + Prisma model File created by the UNT3-16 migration (read by GET /properties/{id}/pictures), S3 write path is the files module (UNT3-18) |
| `standardObject:ContentDocumentLink` | used by Create_property (record element), FileUtilities (DML), PropertyController (SOQL), TestPropertyController (DML) | column `files.record_id` (uuid) | port | mapped | UNT3-18 | — | LinkedEntityId -> files.record_id (polymorphic: properties.id today); ShareType/Visibility dropped (no sharing model) |
| `standardObject:ContentVersion` | used by Create_property (record element), FileUtilities (DML), FileUtilities (SOQL), PropertyController (SOQL), TestPropertyController (DML) | table `files` | port | mapped | UNT3-18 | — | VersionData -> S3 object (bucket from infra, key files/<id>/<filename>); Title/IsLatest/CreatedDate -> files columns; only the latest version is kept |
| `standardObject:PermissionSet` | used by TestPropertyController (SOQL) | role `dreamhouse` | substitute | mapped | UNT3-20 | — | **substitute**: Queried only by TestPropertyController to assign the permission set to a test user; the equivalent is the Cognito group dreamhouse. |
| `standardObject:PermissionSetAssignment` | used by TestPropertyController (DML) | fixture `tests/parity/fixtures/users.ts` | substitute | ported | UNT3-20 | — | **substitute**: Test-only: group membership is a claim (cognito:groups) in the HS256 test token minted by asUser(standardUser); UNT3-20 makes the guard accept AUTH_TEST_JWT_SECRET tokens in NODE_ENV=test. |
| `standardObject:Profile` | used by TestPropertyController (SOQL) | fixture `tests/parity/fixtures/users.ts` | substitute | ported | UNT3-20 | — | **substitute**: Test-only: the Standard User profile lookup becomes the standardUser fixture (group dreamhouse); no Cognito user is created. |
| `standardObject:StaticResource` | used by SampleDataController (SOQL) | fixture `app/api/src/modules/sample-data/fixtures` | substitute | mapped | UNT3-18 | — | **substitute**: SampleDataController reads sample_data_* static resources via SOQL; the service reads the same JSON from bundled fixtures. |
| `standardObject:User` | used by TestPropertyController (DML) | fixture `tests/parity/fixtures/users.ts` | substitute | ported | UNT3-20 | — | **substitute**: Test-only: User records created for System.runAs become TestUser fixtures (standardUser, adminUser) whose bearer tokens asUser() mints; UNT3-20 wires the guard. |

## Apex classes

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apexClass:FileUtilities` | class, with sharing, 1 methods | service `FilesService` | port | mapped | UNT3-18 | — | app/api/src/modules/files/files.service.ts |
| `apexClass:FileUtilitiesTest` | test class, with sharing, 4 methods | spec `tests/parity/characterisation/file-utilities.spec.ts` | port | ported | UNT3-15 | — | Characterisation spec (one `spec()` per @isTest method, each assertion commented with its Apex line); reported as todo until UNT3-18 adds itself to tests/parity/characterisation/harness/ported.ts, `PARITY_RUN_ALL=1 npm test` runs it now; unit variant app/api/src/modules/files/files.service.spec.ts |
| `apexClass:GeocodingService` | class, with sharing, 1 methods | service `GeocodingService` | port | ported | UNT3-17 | — | app/api/src/modules/geocoding/geocoding.service.ts (geocodeAddresses + single-address geocodeAddress for the properties module, with onError 'throw' so the Create_property fault path surfaces on a failed callout (UNT3-19); in-process result cache GEOCODING_CACHE_TTL_SECONDS/GEOCODING_CACHE_MAX_ENTRIES) over nominatim.client.ts (typed fetch, User-Agent, timeout, retry, 1 req/s); unit specs geocoding.service.spec.ts + nominatim.client.spec.ts; live smoke geocoding.live.spec.ts behind GEOCODING_LIVE_SMOKE=1 |
| `apexClass:GeocodingServiceTest` | test class, with sharing, 3 methods | spec `tests/parity/characterisation/geocoding-service.spec.ts` | port | ported | UNT3-15 | — | Characterisation spec (one `spec()` per @isTest method, each assertion commented with its Apex line); active since UNT3-17 listed itself in tests/parity/characterisation/harness/ported.ts (Nominatim mocked with MSW) |
| `apexClass:PagedResult` | class, with sharing, 0 methods | dto `PagedResultDto` | port | ported | UNT3-6 | — | app/api/src/common/dto/paged-result.dto.ts (pageSize, pageNumber, totalItemCount, records) |
| `apexClass:PropertyController` | class, with sharing, 2 methods | service `PropertiesService` | port | ported | UNT3-16 | — | app/api/src/modules/properties/properties.service.ts (getPagedPropertyList, getPictures); HTTP surface in properties.controller.ts; cacheable=true -> Cache-Control private, max-age=30 (+ ETag/304) and TanStack Query staleTime 30s (app/web/src/api/queries.ts propertiesQuery / propertyPicturesQuery); with sharing -> sharing.ts recordAccessWhere/assertRecordAccess in PropertiesService + @RequirePermission on the controller (UNT3-20); unit spec properties.service.spec.ts, HTTP spec test/properties.e2e.spec.ts |
| `apexClass:SampleDataController` | class, with sharing, 5 methods | service `SampleDataService` | port | mapped | UNT3-18 | — | app/api/src/modules/sample-data/sample-data.service.ts |
| `apexClass:TestPropertyController` | test class, omitted, 4 methods | spec `tests/parity/characterisation/property-controller.spec.ts` | port | ported | UNT3-15 | — | Characterisation spec (one `spec()` per @isTest method, each assertion commented with its Apex line); live since UNT3-16 listed itself in tests/parity/characterisation/harness/ported.ts (4 passing); the ContentVersion/ContentDocumentLink DML is fixtures/files.ts createPicture, an insert into files |
| `apexClass:TestSampleDataController` | test class, omitted, 1 methods | spec `tests/parity/characterisation/sample-data-controller.spec.ts` | port | ported | UNT3-15 | — | Characterisation spec (one `spec()` per @isTest method, each assertion commented with its Apex line); reported as todo until UNT3-18 adds itself to tests/parity/characterisation/harness/ported.ts, `PARITY_RUN_ALL=1 npm test` runs it now |

## Apex inner classes

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apexInnerClass:GeocodingService.GeocodingAddress` | class, 5 fields | dto `GeocodingAddressDto` | port | ported | UNT3-6 | — | app/api/src/modules/geocoding/dto/geocoding.dto.ts (street, city, state, country, postalcode) |
| `apexInnerClass:GeocodingService.Coordinates` | class, 2 fields | dto `CoordinatesDto` | port | ported | UNT3-6 | — | app/api/src/modules/geocoding/dto/geocoding.dto.ts (lat, lon) |
| `apexInnerClass:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImpl` | class implements HttpCalloutMock, 0 fields | mock `tests/parity/mocks/nominatim.ts::nominatimSuccess` | substitute | ported | UNT3-15 | — | **substitute**: HttpCalloutMock has no equivalent; an MSW handler for GEOCODING_BASE_URL answers 200 [{lat: 3.123, lon: 31.333}] and records the intercepted calls. |
| `apexInnerClass:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImplError` | class implements HttpCalloutMock, 0 fields | mock `tests/parity/mocks/nominatim.ts::nominatimError` | substitute | ported | UNT3-15 | — | **substitute**: HttpCalloutMock has no equivalent; an MSW handler for GEOCODING_BASE_URL answers 400 with an empty JSON body. |

## Apex methods

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apexMethod:FileUtilities.createFile` | @AuraEnabled String createFile(String base64data, String filename, String recordId) | endpoint `POST /files` | port | mapped | UNT3-18 | — | FilesService.createFile(base64data, filename, recordId): PUT to S3 + insert files row in one transaction; returns FileCreatedDto {id, url}; title = filename minus extension, file_type from the extension; must accept unpadded base64 like EncodingUtil.base64Decode (the Apex fixture is 659 chars); errors -> 400 (bad base64 / blank filename) and 404 (unknown recordId) like AuraHandledException |
| `apexMethod:FileUtilitiesTest.createFileSucceedsWhenCorrectInput` | @isTest void createFileSucceedsWhenCorrectInput() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileSucceedsWhenCorrectInput` | port | ported | UNT3-15 | — |  |
| `apexMethod:FileUtilitiesTest.createFileFailsWhenIncorrectRecordId` | @isTest void createFileFailsWhenIncorrectRecordId() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileFailsWhenIncorrectRecordId` | port | ported | UNT3-15 | — |  |
| `apexMethod:FileUtilitiesTest.createFileFailsWhenIncorrectBase64Data` | @isTest void createFileFailsWhenIncorrectBase64Data() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileFailsWhenIncorrectBase64Data` | port | ported | UNT3-15 | — |  |
| `apexMethod:FileUtilitiesTest.createFileFailsWhenIncorrectFilename` | @isTest void createFileFailsWhenIncorrectFilename() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileFailsWhenIncorrectFilename` | port | ported | UNT3-15 | — |  |
| `apexMethod:GeocodingService.geocodeAddresses` | @InvocableMethod List<Coordinates> geocodeAddresses(List<GeocodingAddress> addresses) | endpoint `POST /geocoding/addresses` | port | ported | UNT3-17 | — | GeocodingService.geocodeAddresses(GeocodeAddressesDto) -> CoordinatesDto[]; one Nominatim GET per address with the non-blank fields as query params; blank address -> {lat:null, lon:null} without a callout; upstream non-200 / no match -> {lat:null, lon:null} with HTTP 200 (Apex swallows the error, pinned by geocoding-service.spec.ts::errorResponse). Single-address UI form POST /geocode (GeocodingAddressDto -> CoordinatesDto) |
| `apexMethod:GeocodingServiceTest.successResponse` | @isTest void successResponse() | spec `tests/parity/characterisation/geocoding-service.spec.ts::successResponse` | port | ported | UNT3-15 | — |  |
| `apexMethod:GeocodingServiceTest.blankAddress` | @isTest void blankAddress() | spec `tests/parity/characterisation/geocoding-service.spec.ts::blankAddress` | port | ported | UNT3-15 | — |  |
| `apexMethod:GeocodingServiceTest.errorResponse` | @isTest void errorResponse() | spec `tests/parity/characterisation/geocoding-service.spec.ts::errorResponse` | port | ported | UNT3-15 | — |  |
| `apexMethod:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImpl.respond` | HTTPResponse respond(HTTPRequest req) | mock `tests/parity/mocks/nominatim.ts::nominatimSuccess` | substitute | ported | UNT3-15 | — | **substitute**: respond() is the HttpCalloutMock body; it is the MSW resolver returned by nominatimSuccess(). |
| `apexMethod:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImplError.respond` | HTTPResponse respond(HTTPRequest req) | mock `tests/parity/mocks/nominatim.ts::nominatimError` | substitute | ported | UNT3-15 | — | **substitute**: respond() is the HttpCalloutMock body; it is the MSW resolver returned by nominatimError(). |
| `apexMethod:PropertyController.getPagedPropertyList` | @AuraEnabled PagedResult getPagedPropertyList(String searchKey, Decimal maxPrice, Integer minBedrooms, Integer minBathrooms, Integer pageSize, Integer pageNumber) | endpoint `GET /properties` | port | ported | UNT3-16 | — | query searchKey, maxPrice, minBedrooms, minBathrooms, pageSize, pageNumber -> PagedPropertiesDto (pageSize, pageNumber, totalItemCount = unpaged count, records with every SELECTed field, null when empty); LIKE %searchKey% on name/city/tags -> Prisma contains mode insensitive (ILIKE, pg_trgm GIN indexes properties_name_idx/_city_idx/_tags_idx); Price__c <= / Beds__c >= / Baths__c >= inclusive -> lte/gte over index properties_price_beds_baths_idx; ORDER BY Price__c LIMIT/OFFSET -> orderBy price asc (id tiebreak), take/skip; defaults 9999999/0/0/9/1 in PropertyQueryDto |
| `apexMethod:PropertyController.getPictures` | @AuraEnabled List<ContentVersion> getPictures(Id propertyId) | endpoint `GET /properties/{id}/pictures` | port | ported | UNT3-16 | — | PropertyPictureDto[] {id, title, fileExtension, url} from files where record_id = :id and file_type in (PNG, JPG, GIF) (index files_record_id_file_type_created_at_idx), ordered by created_at asc (Apex ORDER BY CreatedDate; files holds only the latest version); 200 [] when the record has no pictures (Apex returns null); id validated as UUID (400 otherwise) |
| `apexMethod:SampleDataController.importSampleData` | @AuraEnabled void importSampleData() | endpoint `POST /sample-data/import` | port | mapped | UNT3-18 | — | admin-only (role dreamhouse-admin); deletes properties/brokers/contacts then inserts brokers, properties, contacts in one transaction; Case cleanup dropped |
| `apexMethod:SampleDataController.insertBrokers` | void insertBrokers() | serviceMethod `SampleDataService.insertBrokers` | port | mapped | UNT3-18 | — |  |
| `apexMethod:SampleDataController.insertProperties` | void insertProperties() | serviceMethod `SampleDataService.insertProperties` | port | mapped | UNT3-18 | — |  |
| `apexMethod:SampleDataController.insertContacts` | void insertContacts() | serviceMethod `SampleDataService.insertContacts` | port | mapped | UNT3-18 | — |  |
| `apexMethod:SampleDataController.randomizeDateListed` | void randomizeDateListed(List<Property__c> properties) | serviceMethod `SampleDataService.randomizeDateListed` | port | mapped | UNT3-18 | — |  |
| `apexMethod:TestPropertyController.createProperties` | void createProperties(Integer amount) | fixture `tests/parity/fixtures/properties.ts` | port | ported | UNT3-15 | — | createProperties(prisma, amount) inserts 'Name <i>' / 20000 / 3 / 3 rows through the per-test transaction (admin DML equivalent) |
| `apexMethod:TestPropertyController.testGetPagedPropertyList` | @isTest void testGetPagedPropertyList() | spec `tests/parity/characterisation/property-controller.spec.ts::testGetPagedPropertyList` | port | ported | UNT3-15 | — |  |
| `apexMethod:TestPropertyController.testGetPicturesNoResults` | @isTest void testGetPicturesNoResults() | spec `tests/parity/characterisation/property-controller.spec.ts::testGetPicturesNoResults` | port | ported | UNT3-15 | — |  |
| `apexMethod:TestPropertyController.testGetPicturesWithResults` | @isTest void testGetPicturesWithResults() | spec `tests/parity/characterisation/property-controller.spec.ts::testGetPicturesWithResults` | port | ported | UNT3-15 | — |  |
| `apexMethod:TestSampleDataController.importSampleData` | @isTest void importSampleData() | spec `tests/parity/characterisation/sample-data-controller.spec.ts::importSampleData` | port | ported | UNT3-15 | — |  |

## Lightning Web Components

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `lwc:barcodeScanner` | Barcode Scanner (lightning__AppPage) | component `BarcodeScanner` | substitute | mapped | UNT3-23 | — | **substitute**: lightning/mobileCapabilities getBarcodeScanner is Salesforce-mobile only; the web uses the browser BarcodeDetector API when available and falls back to manual entry. — app/web/src/components/BarcodeScanner/BarcodeScanner.tsx; scanned value navigates to /properties/:id |
| `lwc:brokerCard` | Broker Card (lightning__RecordPage) | component `BrokerCard` | port | mapped | UNT3-22 | — | LDS getRecord(Property__c.Broker__c) -> TanStack Query over GET /properties/{id} + GET /brokers/{id}; link to /brokers/:id |
| `lwc:daysOnMarket` | Days on Market (lightning__AppPage, lightning__RecordPage, lightning__HomePage) | component `DaysOnMarket` | port | mapped | UNT3-22 | — | LDS getRecord(Date_Listed__c, Days_On_Market__c) -> PropertyDto.dateListed/daysOnMarket; PropertySelected subscription -> selectedProperty store |
| `lwc:errorPanel` | errorPanel (internal) | component `ErrorPanel` | port | mapped | UNT3-21 | — | props errors, friendlyMessage, type (inlineMessage\|noDataIllustration); uses reduceErrors from app/web/src/lib/errors.ts |
| `lwc:ldsUtils` | ldsUtils (internal) | util `app/web/src/lib/errors.ts::reduceErrors` | port | mapped | UNT3-21 | — | reduceErrors(error \| error[]) normalises API/fetch errors to string[] exactly like the LWC helper (TanStack Query error shape instead of LDS/Apex error shape) |
| `lwc:listContactsFromDevice` | Lists Contacts from Device (lightning__AppPage) | — | dropped | dropped | UNT3-23 | — | **dropped**: lightning/mobileCapabilities getContactsService reads the device address book; browsers have no equivalent (Contact Picker API is Android-Chrome only) and the component is not on any page. |
| `lwc:navigateToRecord` | Navigate to Record Page (lightning__FlowScreen) | component `NavigateToRecord` | port | mapped | UNT3-22 | — | Flow-screen component -> last wizard step: router navigate to /properties/:id |
| `lwc:paginator` | paginator (internal) | component `Paginator` | port | mapped | UNT3-21 | — | props pageNumber, pageSize, totalItemCount; emits previous/next |
| `lwc:propertyCarousel` | Property Carousel (lightning__RecordPage) | component `PropertyCarousel` | port | mapped | UNT3-22 | — | GET /properties/{id}/pictures + upload via POST /files; lightning/mediaUtils processImage -> browser canvas resize in app/web/src/lib/images.ts |
| `lwc:propertyFilter` | Property Filter (lightning__AppPage) | component `PropertyFilter` | port | mapped | UNT3-21 | — | publishes FiltersChange -> propertyFilters store (URL search params searchKey, maxPrice, minBedrooms, minBathrooms) |
| `lwc:propertyListMap` | Property List Map (lightning__AppPage) | component `PropertyListMap` | port | mapped | UNT3-21 | — | Leaflet (npm leaflet / react-leaflet) over GET /properties; subscribes propertyFilters, publishes selectedProperty |
| `lwc:propertyLocation` | Property Location (lightning__RecordPage) | component `PropertyLocation` | port | mapped | UNT3-22 | — | LDS getRecord(Location) -> PropertyDto.locationLatitude/Longitude; lightning/mobileCapabilities getLocationService -> navigator.geolocation |
| `lwc:propertyMap` | Property Map (lightning__AppPage, lightning__RecordPage) | component `PropertyMap` | port | mapped | UNT3-21 | — | lightning-map -> Leaflet marker; LDS getRecord -> GET /properties/{id}; subscribes selectedProperty |
| `lwc:propertySummary` | Property Summary (lightning__AppPage, lightning__RecordPage) | component `PropertySummary` | port | mapped | UNT3-21 | — | LDS getRecord(Name, Picture, Beds, Baths, Price, Broker) -> GET /properties/{id}; subscribes selectedProperty; link to record page |
| `lwc:propertyTile` | propertyTile (internal) | component `PropertyTile` | port | mapped | UNT3-21 | — | @salesforce/client/formFactor -> Mantine useMediaQuery; emits selected |
| `lwc:propertyTileList` | Property Tile List (lightning__AppPage) | component `PropertyTileList` | port | mapped | UNT3-21 | — | GET /properties with propertyFilters + Paginator; publishes selectedProperty |
| `lwc:sampleDataImporter` | Sample Property Importer (lightning__AppPage) | component `SampleDataImporter` | port | mapped | UNT3-23 | — | POST /sample-data/import with confirm dialog; admin only; toast -> Mantine notifications |

## LWC jest tests

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `lwcTest:barcodeScanner/barcodeScanner.test.js` | salesforce/force-app/main/default/lwc/barcodeScanner/__tests__/barcodeScanner.test.js | spec `app/web/src/components/BarcodeScanner/BarcodeScanner.test.tsx` | port | mapped | UNT3-23 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:brokerCard/brokerCard.test.js` | salesforce/force-app/main/default/lwc/brokerCard/__tests__/brokerCard.test.js | spec `app/web/src/components/BrokerCard/BrokerCard.test.tsx` | port | mapped | UNT3-22 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:daysOnMarket/daysOnMarket.test.js` | salesforce/force-app/main/default/lwc/daysOnMarket/__tests__/daysOnMarket.test.js | spec `app/web/src/components/DaysOnMarket/DaysOnMarket.test.tsx` | port | mapped | UNT3-22 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:errorPanel/errorPanel.test.js` | salesforce/force-app/main/default/lwc/errorPanel/__tests__/errorPanel.test.js | spec `app/web/src/components/ErrorPanel/ErrorPanel.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:ldsUtils/ldsUtils.test.js` | salesforce/force-app/main/default/lwc/ldsUtils/__tests__/ldsUtils.test.js | spec `app/web/src/lib/errors.test.ts` | port | mapped | UNT3-21 | — |  |
| `lwcTest:navigateToRecord/navigateToRecord.test.js` | salesforce/force-app/main/default/lwc/navigateToRecord/__tests__/navigateToRecord.test.js | spec `app/web/src/components/NavigateToRecord/NavigateToRecord.test.tsx` | port | mapped | UNT3-22 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:paginator/paginator.test.js` | salesforce/force-app/main/default/lwc/paginator/__tests__/paginator.test.js | spec `app/web/src/components/Paginator/Paginator.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyCarousel/propertyCarousel.test.js` | salesforce/force-app/main/default/lwc/propertyCarousel/__tests__/propertyCarousel.test.js | spec `app/web/src/components/PropertyCarousel/PropertyCarousel.test.tsx` | port | mapped | UNT3-22 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyFilter/propertyFilter.test.js` | salesforce/force-app/main/default/lwc/propertyFilter/__tests__/propertyFilter.test.js | spec `app/web/src/components/PropertyFilter/PropertyFilter.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyListMap/propertyListMap.test.js` | salesforce/force-app/main/default/lwc/propertyListMap/__tests__/propertyListMap.test.js | spec `app/web/src/components/PropertyListMap/PropertyListMap.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyLocation/propertyLocation.test.js` | salesforce/force-app/main/default/lwc/propertyLocation/__tests__/propertyLocation.test.js | spec `app/web/src/components/PropertyLocation/PropertyLocation.test.tsx` | port | mapped | UNT3-22 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyMap/propertyMap.test.js` | salesforce/force-app/main/default/lwc/propertyMap/__tests__/propertyMap.test.js | spec `app/web/src/components/PropertyMap/PropertyMap.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertySummary/propertySummary.test.js` | salesforce/force-app/main/default/lwc/propertySummary/__tests__/propertySummary.test.js | spec `app/web/src/components/PropertySummary/PropertySummary.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyTile/propertyTile.small.test.js` | salesforce/force-app/main/default/lwc/propertyTile/__tests__/propertyTile.small.test.js | spec `app/web/src/components/PropertyTile/PropertyTile.small.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyTile/propertyTile.test.js` | salesforce/force-app/main/default/lwc/propertyTile/__tests__/propertyTile.test.js | spec `app/web/src/components/PropertyTile/PropertyTile.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:propertyTileList/propertyTileList.test.js` | salesforce/force-app/main/default/lwc/propertyTileList/__tests__/propertyTileList.test.js | spec `app/web/src/components/PropertyTileList/PropertyTileList.test.tsx` | port | mapped | UNT3-21 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |
| `lwcTest:sampleDataImporter/sampleDataImporter.test.js` | salesforce/force-app/main/default/lwc/sampleDataImporter/__tests__/sampleDataImporter.test.js | spec `app/web/src/components/SampleDataImporter/SampleDataImporter.test.tsx` | port | mapped | UNT3-23 | — | Vitest + Testing Library port of the Jest suite (same cases, API mocked) |

## Aura bundles

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `aura:pageTemplate_2_7_3` | component: Three columns layout (Just one on mobile) | component `ThreeColumnLayout` | port | mapped | UNT3-21 | — | app/web/src/components/layout/ThreeColumnLayout.tsx: Mantine Grid 2/7/3 columns, stacked on mobile; used by PropertyExplorerPage and PropertyFinderPage |

## Flows

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `flow:Create_property` | Create Property (Flow, 17 elements) | route `/properties/new` | port | mapped | UNT3-23 | `create-property-flow` | Flow logic is the API (UNT3-19): one POST /properties with the screen inputs (new_property, address incl. country, property_details) and geocode: true = the geocode_address action (GeocodingService.geocodeAddress); create_property assignments Status__c Available and Date_Listed__c $Flow.CurrentDate are applied server-side; fault connectors -> 400 field errors (output.fieldErrors) / 502 GEOCODING_FAULT with nothing created. Baseline fixture tests/parity/fixtures/create-property-flow.ts, spec tests/parity/characterisation/create-property-flow.spec.ts. Web (UNT3-23): CreatePropertyWizard (app/web/src/pages/properties/CreatePropertyWizard.tsx) mirrors the screens, then upload_picture (POST /files, sets picture/thumbnail) -> navigate_to_record_detail; fault screens Error2-5/error_creating_records keep the same messages |

## Lightning pages (FlexiPages)

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `flexipage:Broker_Record_Page` | Broker Record Page (RecordPage for Broker__c) | route `/brokers/:id` | port | mapped | UNT3-22 | — | BrokerRecordPage: highlights (compact layout), details from brokerLayout.ts, related properties list |
| `flexipage:Property_Explorer` | Property Explorer (AppPage) | route `/property-explorer` | port | mapped | UNT3-21 | — | PropertyExplorerPage in ThreeColumnLayout: PropertyFilter + create-property link (flowruntime:interview) \| PropertyTileList \| PropertySummary + PropertyMap |
| `flexipage:Property_Finder` | Property Finder (AppPage) | route `/property-finder` | port | mapped | UNT3-21 | — | PropertyFinderPage in ThreeColumnLayout: BarcodeScanner + PropertyFilter \| PropertyListMap \| PropertySummary + DaysOnMarket |
| `flexipage:Property_Record_Page` | Property Record Page (RecordPage for Property__c) | route `/properties/:id` | port | mapped | UNT3-22 | — | PropertyRecordPage: highlights, detail tabs (Details/Dates/Broker) from propertyLayout.ts, sidebar BrokerCard, DaysOnMarket, PropertyMap, PropertyLocation, PropertyCarousel; related files list |
| `flexipage:Settings` | Settings (AppPage) | route `/settings` | port | mapped | UNT3-23 | — | SettingsPage: SampleDataImporter; visible to role dreamhouse-admin only |

## Page layouts

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `layout:Broker__c-Broker Layout` | Broker__c: 4 sections, 10 fields | config `app/web/src/pages/brokers/brokerLayout.ts` | port | mapped | UNT3-22 | — | sections Picture / Information / System Information with the same field order; related list Properties (name, address, price, beds, baths, status) |
| `layout:Property__c-Property Layout` | Property__c: 6 sections, 26 fields | config `app/web/src/pages/properties/propertyLayout.ts` | port | mapped | UNT3-22 | — | sections and field order 1:1; related Files list -> files; Activities/History related lists dropped (no activities in target) |

## Tabs

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tab:Broker__c` | Broker__c (customObject) | route `/brokers` | port | ported | UNT3-22 | — | nav tab Brokers (navigation.ts) -> /brokers; route mounted (UNT3-7); broker list page body (listView Broker__c.All) in UNT3-22 |
| `tab:Property_Explorer` | Property Explorer (flexipage) | route `/property-explorer` | port | ported | UNT3-21 | — | nav tab Property Explorer (navigation.ts) -> /property-explorer; route mounted with MapView (UNT3-7); page body in UNT3-21 |
| `tab:Property_Finder` | Property Finder (flexipage) | route `/property-finder` | port | ported | UNT3-21 | — | nav tab Property Finder (navigation.ts) -> /property-finder; route mounted with MapView (UNT3-7); page body in UNT3-21 |
| `tab:Property__c` | Property__c (customObject) | route `/properties` | port | ported | UNT3-22 | — | nav tab Properties (navigation.ts) -> /properties; route mounted (UNT3-7); property list page body (listView Property__c.All) in UNT3-22 |
| `tab:Settings` | Settings (flexipage) | route `/settings` | port | ported | UNT3-23 | — | nav tab Settings (navigation.ts) -> /settings; route mounted (UNT3-7); visible to / openable by group dreamhouse-admin only (UNT3-20, RequireGroup in routes.tsx); page body (UNT3-23) pending |

## Lightning apps

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `application:Dreamhouse` | Dreamhouse: tabs standard-home, Property_Explorer, Property_Finder, standard-Contact, Property__c, Broker__c, standard-File, Settings | component `AppShell` | port | ported | UNT3-7 | — | app/web/src/app/AppShell.tsx renders the navbar from app/web/src/app/navigation.ts (appTabs: one entry per <tabs> of Dreamhouse.app-meta.xml in the same order — home, property-explorer, property-finder, contacts, properties, brokers, files, settings; navigation.test.ts asserts it against the XML); brand colour #86BD4A (app/web/src/app/theme.ts) and logo asset; record View overrides -> routes /properties/:id and /brokers/:id; login -> /login (Cognito, stub locally) |

## Permission sets

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `permissionSet:dreamhouse` | dreamhouse | role `dreamhouse` | port | ported | UNT3-20 | `permission-set-standard-user-crud`, `permission-set-no-group-403`, `permission-set-no-token-401` | Cognito user-pool group dreamhouse (infra/modules/auth) = this permission set; dreamhouse-admin = System Administrator superset (Settings, sample import, FileUtilities, all Contact/file rows). Token: AuthGuard (app/api/src/auth/auth.guard.ts; Cognito JWKS RS256, HS256 in NODE_ENV=test, stub tokens in dev) -> 401 INVALID_SESSION_ID; groups -> PermissionsGuard over policy.ts -> 403 INSUFFICIENT_ACCESS_OR_READONLY. Matrix docs/migration/permissions.md; tests app/api/test/permissions.e2e.spec.ts (group x object x operation + hidden fields, asserted against this XML by src/auth/salesforce-metadata.test-support.ts), src/auth/policy.spec.ts, tests/parity/characterisation/permission-set.spec.ts |

## Permission set entries

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `permission:dreamhouse.application.Dreamhouse` | application visible=True | policy `policy.app.access` | port | ported | UNT3-20 | `permission-set-no-group-403` | policy key app.access (policy.ts APP_ACCESS: dreamhouse, dreamhouse-admin) is required by PermissionsGuard on every non-@Public route; web: RequireAuth renders AccessDeniedPage for a signed-in user without the group (AppShell.test.tsx) |
| `permission:dreamhouse.apexClass.PagedResult` | Apex class access enabled=True | policy `policy.properties.invoke` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | policy.ts CLASS_ACCESS PagedResult -> group dreamhouse; the PagedResult DTO is only reachable through GET /properties (properties.read) |
| `permission:dreamhouse.apexClass.PropertyController` | Apex class access enabled=True | policy `policy.properties.invoke` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | policy.ts CLASS_ACCESS PropertyController -> group dreamhouse; @RequirePermission(properties.read) on GET /properties and GET /properties/{id}/pictures (+ files.read for ContentDocument) in properties.controller.ts; with sharing -> sharing.ts recordAccessWhere in PropertiesService |
| `permission:dreamhouse.apexClass.SampleDataController` | Apex class access enabled=True | policy `policy.sampleData.invoke` | port | ported | UNT3-20 | `permission-set-class-access-admin-only` | policy.ts CLASS_ACCESS SampleDataController -> dreamhouse-admin only (documented deviation DEVIATIONS.sampleDataAdminOnly: the demo must not let every user wipe and reload the data set); @RequirePermission(sampleData.invoke) on POST /sample-data/import -> standard group 403 |
| `permission:dreamhouse.object.Broker__c` | object CRUD create,read,edit,delete + viewAllRecords,modifyAllRecords | policy `policy.brokers.crud` | port | ported | UNT3-20 | `permission-set-standard-user-crud`, `permission-set-no-group-403`, `permission-set-no-token-401`, `permission-set-sharing-read-write-all` | policy keys brokers.create/read/edit/delete (policy.ts OBJECT_PERMISSIONS, FULL_ACCESS for dreamhouse) on POST /brokers, GET /brokers + /brokers/{id}, PATCH /brokers/{id}, DELETE /brokers/{id}; viewAllRecords/modifyAllRecords + sharingModel ReadWrite -> sharing.ts recordAccessWhere returns no ownership filter; create stamps ownerId/createdBy |
| `permission:dreamhouse.object.Property__c` | object CRUD create,read,edit,delete + viewAllRecords,modifyAllRecords | policy `policy.properties.crud` | port | ported | UNT3-20 | `permission-set-standard-user-crud`, `permission-set-no-group-403`, `permission-set-no-token-401`, `permission-set-sharing-read-write-all` | policy keys properties.create/read/edit/delete (policy.ts OBJECT_PERMISSIONS, FULL_ACCESS for dreamhouse) on POST /properties, GET /properties + /properties/{id} (+ /pictures), PATCH /properties/{id}, DELETE /properties/{id}; viewAllRecords/modifyAllRecords + sharingModel ReadWrite -> no ownership filter (sharing.ts); create stamps ownerId/createdBy |
| `permission:dreamhouse.field.Broker__c.Broker_Id__c` | field readable=True editable=True | policy `policy.brokers.fields.broker_id` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Broker__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Broker__c.Email__c` | field readable=True editable=True | policy `policy.brokers.fields.email` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Broker__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Broker__c.Mobile_Phone__c` | field readable=True editable=True | policy `policy.brokers.fields.mobile_phone` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Broker__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Broker__c.Phone__c` | field readable=True editable=True | policy `policy.brokers.fields.phone` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Broker__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Broker__c.Picture_IMG__c` | field readable=True editable=False | policy `policy.brokers.fields.picture_img` | port | ported | UNT3-20 | `permission-set-formula-fields-read-only` | field-policy.ts FIELD_PERMISSIONS[Broker__c] formula field: readable=true, editable=false -> returned by FieldSecurityInterceptor, a value in a POST/PATCH body is rejected 403 INVALID_FIELD_FOR_INSERT_UPDATE (assertWritable) for every group |
| `permission:dreamhouse.field.Broker__c.Picture__c` | field readable=True editable=True | policy `policy.brokers.fields.picture` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Broker__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Broker__c.Title__c` | field readable=True editable=True | policy `policy.brokers.fields.title` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Broker__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Address__c` | field readable=True editable=True | policy `policy.properties.fields.address` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Assessed_Value__c` | field readable=True editable=True | policy `policy.properties.fields.assessed_value` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Baths__c` | field readable=True editable=True | policy `policy.properties.fields.baths` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Beds__c` | field readable=True editable=True | policy `policy.properties.fields.beds` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Broker__c` | field readable=True editable=True | policy `policy.properties.fields.broker` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.City__c` | field readable=True editable=True | policy `policy.properties.fields.city` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Date_Agreement__c` | field readable=True editable=True | policy `policy.properties.fields.date_agreement` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Date_Closed__c` | field readable=True editable=True | policy `policy.properties.fields.date_closed` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Date_Contracted__c` | field readable=True editable=True | policy `policy.properties.fields.date_contracted` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Date_Listed__c` | field readable=True editable=True | policy `policy.properties.fields.date_listed` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Date_Pre_Market__c` | field readable=True editable=True | policy `policy.properties.fields.date_pre_market` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Days_On_Market__c` | field readable=True editable=False | policy `policy.properties.fields.days_on_market` | port | ported | UNT3-20 | `permission-set-formula-fields-read-only` | field-policy.ts FIELD_PERMISSIONS[Property__c] formula field: readable=true, editable=false -> returned by FieldSecurityInterceptor, a value in a POST/PATCH body is rejected 403 INVALID_FIELD_FOR_INSERT_UPDATE (assertWritable) for every group |
| `permission:dreamhouse.field.Property__c.Description__c` | field readable=True editable=True | policy `policy.properties.fields.description` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Location__c` | field readable=True editable=True | policy `policy.properties.fields.location` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Name` | field readable=True editable=True | policy `policy.properties.fields.name` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Picture_IMG__c` | field readable=True editable=False | policy `policy.properties.fields.picture_img` | port | ported | UNT3-20 | `permission-set-formula-fields-read-only` | field-policy.ts FIELD_PERMISSIONS[Property__c] formula field: readable=true, editable=false -> returned by FieldSecurityInterceptor, a value in a POST/PATCH body is rejected 403 INVALID_FIELD_FOR_INSERT_UPDATE (assertWritable) for every group |
| `permission:dreamhouse.field.Property__c.Picture__c` | field readable=True editable=True | policy `policy.properties.fields.picture` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Price_Sold__c` | field readable=True editable=True | policy `policy.properties.fields.price_sold` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Price__c` | field readable=True editable=True | policy `policy.properties.fields.price` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Record_Link__c` | field readable=True editable=False | policy `policy.properties.fields.record_link` | port | ported | UNT3-20 | `permission-set-formula-fields-read-only` | field-policy.ts FIELD_PERMISSIONS[Property__c] formula field: readable=true, editable=false -> returned by FieldSecurityInterceptor, a value in a POST/PATCH body is rejected 403 INVALID_FIELD_FOR_INSERT_UPDATE (assertWritable) for every group |
| `permission:dreamhouse.field.Property__c.State__c` | field readable=True editable=True | policy `policy.properties.fields.state` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Status__c` | field readable=True editable=True | policy `policy.properties.fields.status` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Tags__c` | field readable=True editable=True | policy `policy.properties.fields.tags` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Thumbnail_IMG__c` | field readable=True editable=False | policy `policy.properties.fields.thumbnail_img` | port | ported | UNT3-20 | `permission-set-formula-fields-read-only` | field-policy.ts FIELD_PERMISSIONS[Property__c] formula field: readable=true, editable=false -> returned by FieldSecurityInterceptor, a value in a POST/PATCH body is rejected 403 INVALID_FIELD_FOR_INSERT_UPDATE (assertWritable) for every group |
| `permission:dreamhouse.field.Property__c.Thumbnail__c` | field readable=True editable=True | policy `policy.properties.fields.thumbnail` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.field.Property__c.Zip__c` | field readable=True editable=True | policy `policy.properties.fields.zip` | port | ported | UNT3-20 | `permission-set-standard-user-crud` | field-policy.ts FIELD_PERMISSIONS[Property__c] readable+editable for group dreamhouse (and dreamhouse-admin); FieldSecurityInterceptor strips the column for a caller without read access and rejects a write without edit access; hidden-field cases in app/api/test/permissions.e2e.spec.ts |
| `permission:dreamhouse.tab.Broker__c` | tab Visible | config `app/web/src/app/navigation.ts::Broker__c` | port | ported | UNT3-20 | — | navigation.ts requiredGroup dreamhouse on the tab (visibleTabs filters the navbar in AppShell.tsx); asserted against this <tabSettings> block by navigation.test.ts |
| `permission:dreamhouse.tab.Property_Explorer` | tab Visible | config `app/web/src/app/navigation.ts::Property_Explorer` | port | ported | UNT3-20 | — | navigation.ts requiredGroup dreamhouse on the tab (visibleTabs filters the navbar in AppShell.tsx); asserted against this <tabSettings> block by navigation.test.ts |
| `permission:dreamhouse.tab.Property_Finder` | tab Visible | config `app/web/src/app/navigation.ts::Property_Finder` | port | ported | UNT3-20 | — | navigation.ts requiredGroup dreamhouse on the tab (visibleTabs filters the navbar in AppShell.tsx); asserted against this <tabSettings> block by navigation.test.ts |
| `permission:dreamhouse.tab.Property__c` | tab Visible | config `app/web/src/app/navigation.ts::Property__c` | port | ported | UNT3-20 | — | navigation.ts requiredGroup dreamhouse on the tab (visibleTabs filters the navbar in AppShell.tsx); asserted against this <tabSettings> block by navigation.test.ts |
| `permission:dreamhouse.tab.Settings` | tab Visible | config `app/web/src/app/navigation.ts::Settings` | port | ported | UNT3-20 | — | deviation: navigation.ts requiredGroup dreamhouse-admin (the XML grants Visible to dreamhouse; the migrated Settings tab only hosts the sample-data import, which is admin-only - see permission:dreamhouse.apexClass.SampleDataController); route /settings wrapped in RequireGroup -> AccessDeniedPage for group dreamhouse; navigation.test.ts lists it in ADMIN_ONLY_DEVIATIONS |

## Static resources

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `staticResource:leafletjs` | JS library that renders maps (168861 bytes) | dependency `leaflet` | substitute | ported | UNT3-7 | — | **substitute**: The zipped Leaflet 1.x static resource becomes the npm packages leaflet + react-leaflet (same library, same marker/tile assets). — leaflet@1.9.4 + react-leaflet@4 wrapped by MapView (app/web/src/components/MapView/MapView.tsx); marker icons via Vite asset URLs (leaflet-icons.ts) |
| `staticResource:sample_data_brokers` | Sample data used to initialize Broker__c records (2850 bytes) | fixture `app/api/src/modules/sample-data/fixtures/brokers.json` | port | mapped | UNT3-18 | — | same JSON content, keys renamed to camelCase DTO fields |
| `staticResource:sample_data_contacts` | Sample data used to initialize Contact records (723 bytes) | fixture `app/api/src/modules/sample-data/fixtures/contacts.json` | port | mapped | UNT3-18 | — | same JSON content, keys renamed to camelCase DTO fields |
| `staticResource:sample_data_properties` | Sample data used to initialize Property__c records (9088 bytes) | fixture `app/api/src/modules/sample-data/fixtures/properties.json` | port | mapped | UNT3-18 | — | same JSON content, keys renamed to camelCase DTO fields |

## Content assets

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `contentAsset:dreamhouselogosquare` | dreamhouselogosquare | asset `app/web/public/dreamhouse-logo-square.png` | port | ported | UNT3-7 | — | copied byte-for-byte from contentassets/dreamhouselogosquare.asset (PNG 555x555); rendered by DreamhouseLogo in the app shell and login page, also the favicon |

## Lightning message channels

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `messageChannel:FiltersChange` | Filters Change Message Channel: searchKey, maxPrice, minBedrooms, minBathrooms | store `app/web/src/state/propertyFilters.ts` | port | mapped | UNT3-21 | — | searchKey, maxPrice, minBedrooms, minBathrooms as URL search params (useSearchParams) so filters are linkable; publish = setFilters, subscribe = useFilters |
| `messageChannel:PropertySelected` | Property Selected Message Channel: propertyId | store `app/web/src/state/selectedProperty.ts` | port | mapped | UNT3-21 | — | propertyId in URL search param `selected` + small store; publish = selectProperty, subscribe = useSelectedProperty |

## Remote site settings

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `remoteSiteSetting:nominatim_openstreetmap` | https://nominatim.openstreetmap.org | env `GEOCODING_BASE_URL` | port | ported | UNT3-17 | — | app/api/src/config/config.schema.ts (default https://nominatim.openstreetmap.org/search?format=json) read by nominatim.client.ts; Apex `http-referer` -> optional GEOCODING_REFERER; egress allowed by the ECS task security group in infra/ |

## CSP trusted sites

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cspTrustedSite:openStreetMap` | https://tile.openstreetmap.org (ImgSrc) | infra `infra/modules/web/cloudfront.tf::response_headers_policy.img-src` | port | ported | UNT3-9 | — | aws_cloudfront_response_headers_policy.web (local.csp) img-src https://tile.openstreetmap.org https://*.tile.openstreetmap.org (Leaflet tile subdomains); value from var.csp_image_sources in infra/envs/demo/variables.tf |
| `cspTrustedSite:s3_us_west_2_amazonaws_com` | https://s3-us-west-2.amazonaws.com (ImgSrc) | infra `infra/modules/web/cloudfront.tf::response_headers_policy.img-src` | port | ported | UNT3-9 | — | aws_cloudfront_response_headers_policy.web (local.csp) img-src https://s3-us-west-2.amazonaws.com (sample picture URLs) plus the demo files bucket https://sf2aws-demo-files-599083837640.s3.us-east-1.amazonaws.com (module.files) |

## External callouts

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `callout:GeocodingService.geocodeAddresses` | http https://nominatim.openstreetmap.org/search?format=json | httpClient `GeocodingService.geocodeAddress` | port | ported | UNT3-17 | — | GeocodingService.geocodeAddress -> NominatimClient.search (app/api/src/modules/geocoding/nominatim.client.ts) — Node fetch GET {GEOCODING_BASE_URL}&street=&city=&state=&country=&postalcode= with GEOCODING_USER_AGENT (Nominatim usage policy); GEOCODING_TIMEOUT_MS (10s) via AbortController; GEOCODING_MAX_RETRIES (2) with back-off on network errors/timeouts/429/5xx only; process-wide limiter GEOCODING_MIN_INTERVAL_MS (1 req/s); mocked with MSW in the characterisation spec and vi.fn() fetch in nominatim.client.spec.ts; live smoke geocoding.live.spec.ts behind GEOCODING_LIVE_SMOKE=1 |

## In-app guidance prompts

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `prompt:Property` | Property (4 steps) | — | dropped | dropped | UNT3-23 | — | **dropped**: Salesforce in-app guidance (walkthrough prompts) is a platform feature with no equivalent in the demo scope; the walkthrough text moves to the demo runbook (UNT3-27). |
| `prompt:PropertyExplorer` | Property Explorer (7 steps) | — | dropped | dropped | UNT3-23 | — | **dropped**: Salesforce in-app guidance (walkthrough prompts) is a platform feature with no equivalent in the demo scope; the walkthrough text moves to the demo runbook (UNT3-27). |
| `prompt:PropertyFinder` | Property Finder (3 steps) | — | dropped | dropped | UNT3-23 | — | **dropped**: Salesforce in-app guidance (walkthrough prompts) is a platform feature with no equivalent in the demo scope; the walkthrough text moves to the demo runbook (UNT3-27). |

## Jest mock modules

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `jestMock:apex` | exports refreshApex | mock `app/web/src/test/mocks/api.ts` | port | mapped | UNT3-21 | — | refreshApex -> queryClient.invalidateQueries; API client mocked with msw handlers |
| `jestMock:global/navigator` | exports mockGeolocation | mock `app/web/src/test/mocks/navigator.ts` | port | mapped | UNT3-21 | — | mockGeolocation -> vi.stubGlobal navigator.geolocation |
| `jestMock:lightning/mediaUtils` | exports processImage | mock `app/web/src/test/mocks/images.ts` | substitute | mapped | UNT3-21 | — | **substitute**: processImage is a Salesforce-only helper; the canvas resize util in app/web/src/lib/images.ts is mocked instead. |
| `jestMock:lightning/messageService` | exports APPLICATION_SCOPE, MessageContext, createMessageChannel, createMessageContext, publish, releaseMessageContext, subscribe, unsubscribe | mock `app/web/src/test/mocks/stores.ts` | substitute | mapped | UNT3-21 | — | **substitute**: LMS does not exist on the web; tests wrap components in a MemoryRouter + store provider and assert on the propertyFilters/selectedProperty stores. |
| `jestMock:lightning/mobileCapabilities` | exports getBarcodeScanner, getLocationService, resetBarcodeScannerStubs, setBarcodeScanError, setBarcodeScannerAvailable, setDeviceLocationServiceAvailable, setUserCanceledScan | mock `app/web/src/test/mocks/barcodeDetector.ts` | substitute | mapped | UNT3-21 | — | **substitute**: Mobile capabilities are replaced by browser APIs; the BarcodeDetector and navigator.geolocation stubs cover the same cases (available / unavailable / cancelled / error). |
| `jestMock:lightning/navigation` | exports CurrentPageReference, NavigationMixin, getGenerateUrlCalledWith, getNavigateCalledWith | mock `app/web/src/test/mocks/router.ts` | substitute | mapped | UNT3-21 | — | **substitute**: NavigationMixin/CurrentPageReference become React Router; the helper renders in a MemoryRouter and exposes getNavigateCalledWith over a spied useNavigate. |
| `jestMock:lightning/platformShowToastEvent` | exports ShowToastEvent, ShowToastEventName | mock `app/web/src/test/mocks/notifications.ts` | substitute | mapped | UNT3-21 | — | **substitute**: ShowToastEvent becomes Mantine notifications; the helper spies notifications.show. |
| `jestMock:schema` | exports Property__c | — | dropped | dropped | UNT3-21 | — | **dropped**: LWC @salesforce/schema imports have no counterpart: field names are typed from the generated OpenAPI client. |
