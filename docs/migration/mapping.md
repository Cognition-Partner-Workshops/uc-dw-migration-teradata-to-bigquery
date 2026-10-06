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
- **security**: permission set -> Cognito group (role); object/field/class permissions -> policy keys in app/api/src/auth/policy.ts; tab visibility -> app/web/src/app/navigation.ts
- **integration**: remote site setting / named credential -> env var in app/api/src/config/config.schema.ts; callout -> <Pascal>Service.<method> using fetch; CSP trusted site -> CloudFront response headers policy in infra/
- **platform_only_features**: LDS caching -> TanStack Query; barcode scanner -> browser BarcodeDetector + manual entry (substitute); device contacts -> dropped; in-app guidance prompts -> dropped; Lightning Message Service -> URL params + store

## Summary

- Rows: **200** (inventory ids: 200)
- Status: mapped **191**, ported **3**, tested **0**, passing **0**, dropped **6**
- Disposition: port **174**, substitute **20**, dropped **6**
- Rows with parity tests: **0**

| Source kind | Rows | mapped | ported | tested | passing | dropped | substitute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Custom objects | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Custom fields | 32 | 32 | 0 | 0 | 0 | 0 | 4 |
| List views | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Compact layouts | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Standard objects referenced | 10 | 9 | 0 | 0 | 0 | 1 | 5 |
| Apex classes | 9 | 8 | 1 | 0 | 0 | 0 | 0 |
| Apex inner classes | 4 | 2 | 2 | 0 | 0 | 0 | 2 |
| Apex methods | 23 | 23 | 0 | 0 | 0 | 0 | 2 |
| Lightning Web Components | 17 | 16 | 0 | 0 | 0 | 1 | 1 |
| LWC jest tests | 17 | 17 | 0 | 0 | 0 | 0 | 0 |
| Aura bundles | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Flows | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Lightning pages (FlexiPages) | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| Page layouts | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Tabs | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| Lightning apps | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Permission sets | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Permission set entries | 44 | 44 | 0 | 0 | 0 | 0 | 0 |
| Static resources | 4 | 4 | 0 | 0 | 0 | 0 | 1 |
| Content assets | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Lightning message channels | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| Remote site settings | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| CSP trusted sites | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| External callouts | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| In-app guidance prompts | 3 | 0 | 0 | 0 | 0 | 3 | 0 |
| Jest mock modules | 8 | 7 | 0 | 0 | 0 | 1 | 5 |

## Custom objects

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `object:Broker__c` | Broker (7 fields, sharing ReadWrite) | table `brokers` | port | mapped | UNT3-11 | — | Prisma model Broker (@@map "brokers"); id uuid PK, sf_id char(18) unique, name varchar(80) (standard Name), audit columns; API module app/api/src/modules/brokers |
| `object:Property__c` | Property (25 fields, sharing ReadWrite) | table `properties` | port | mapped | UNT3-11 | — | Prisma model Property (@@map "properties"); id uuid PK, sf_id char(18) unique, name varchar(80) (standard Name), owner_id/created_by/created_at/updated_at audit columns; API module app/api/src/modules/properties |

## Custom fields

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `field:Broker__c.Broker_Id__c` | Broker Id (Number: 18,0) | column `brokers.broker_id` (numeric(18,0)) | port | mapped | UNT3-11 | — |  |
| `field:Broker__c.Email__c` | Email (Email) | column `brokers.email` (varchar(80)) | port | mapped | UNT3-11 | — | format validated by class-validator @IsEmail |
| `field:Broker__c.Mobile_Phone__c` | Mobile Phone (Phone) | column `brokers.mobile_phone` (varchar(40)) | port | mapped | UNT3-11 | — |  |
| `field:Broker__c.Phone__c` | Phone (Phone) | column `brokers.phone` (varchar(40)) | port | mapped | UNT3-11 | — |  |
| `field:Broker__c.Picture_IMG__c` | Picture (Text: formula) | component `RecordImage` | substitute | mapped | UNT3-22 | — | **substitute**: IMAGE() display formula; no stored column. The record page/tile renders <img src={picture}> from brokers.picture with the same size. |
| `field:Broker__c.Picture__c` | Picture (Url) | column `brokers.picture` (varchar(255)) | port | mapped | UNT3-11 | — |  |
| `field:Broker__c.Title__c` | Title (Text: 30) | column `brokers.title` (varchar(30)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Address__c` | Address (Text: 100) | column `properties.address` (varchar(100)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Assessed_Value__c` | Assessed Value (Currency: 18,0) | column `properties.assessed_value` (numeric(18,2)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Baths__c` | Baths (Number: 2,0) | column `properties.baths` (integer) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Beds__c` | Beds (Number: 2,0) | column `properties.beds` (integer) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Broker__c` | Broker (Lookup: -> Broker__c) | column `properties.broker_id` (uuid references brokers(id) on delete set null) | port | mapped | UNT3-11 | — | FK brokers(id), ON DELETE SET NULL (deleteConstraint SetNull); relationship Properties -> Prisma relation broker/properties; API exposes brokerId |
| `field:Property__c.City__c` | City (Text: 50) | column `properties.city` (varchar(50)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Date_Agreement__c` | Date Agreement (Date) | column `properties.date_agreement` (date) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Date_Closed__c` | Date Closed (Date) | column `properties.date_closed` (date) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Date_Contracted__c` | Date Contracted (Date) | column `properties.date_contracted` (date) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Date_Listed__c` | Date Listed (Date) | column `properties.date_listed` (date) | port | mapped | UNT3-11 | — | default TODAY() - 10 applied in PropertiesService.create (not a DB default) |
| `field:Property__c.Date_Pre_Market__c` | Date Pre Market (Date) | column `properties.date_pre_market` (date) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Days_On_Market__c` | Days On Market (Number: formula) | computed `PropertyDto.daysOnMarket` (integer) | port | mapped | UNT3-11 | — | TODAY() - Date_Listed__c is not immutable, so not a generated column: computed in PropertiesService from properties.date_listed (UTC date) and exposed on the DTO; also a SQL view column properties_v.days_on_market for the data reconciliation. |
| `field:Property__c.Description__c` | Description (LongTextArea: 500) | column `properties.description` (text) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Location__c` | Location (Location) | column `properties.location_latitude` (numeric(10,7)) | port | mapped | UNT3-11 | — | (convention exception: Compound Geolocation field -> two columns: properties.location_latitude and properties.location_longitude (Salesforce exposes them as Location__Latitude__s / Location__Longitude__s).) |
| `field:Property__c.Picture_IMG__c` | Main Picture (Text: formula) | component `RecordImage` | substitute | mapped | UNT3-22 | — | **substitute**: IMAGE() display formula; no stored column. The record page/tile renders <img src={picture}> from properties.picture with the same size. |
| `field:Property__c.Picture__c` | Picture (Url) | column `properties.picture` (varchar(255)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Price_Sold__c` | Price Sold (Currency: 8,0) | column `properties.price_sold` (numeric(18,2)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Price__c` | Asking Price (Currency: 8,0) | column `properties.price` (numeric(18,2)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Record_Link__c` | Record Link (Text: formula) | route `/properties/:id` | substitute | mapped | UNT3-22 | — | **substitute**: Formula builds the Salesforce record URL ($Api.Partner_Server_URL + Id); the equivalent is the web app route, exposed as PropertyDto.recordUrl for exports. |
| `field:Property__c.State__c` | State (Text: 20) | column `properties.state` (varchar(20)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Status__c` | Status (Picklist: Contracted/Pre Market/Available/Under Agreement/Closed) | column `properties.status` (property_status (enum)) | port | mapped | UNT3-11 | — | restricted picklist -> Postgres enum property_status (Contracted, Pre Market, Available, Under Agreement, Closed); API validates with class-validator @IsEnum |
| `field:Property__c.Tags__c` | Tags (Text: 255) | column `properties.tags` (varchar(255)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Thumbnail_IMG__c` | Main Thumbnail (Text: formula) | component `RecordImage` | substitute | mapped | UNT3-22 | — | **substitute**: IMAGE() display formula; no stored column. The record page/tile renders <img src={thumbnail}> from properties.thumbnail with the same size. |
| `field:Property__c.Thumbnail__c` | Thumbnail (Url) | column `properties.thumbnail` (varchar(255)) | port | mapped | UNT3-11 | — |  |
| `field:Property__c.Zip__c` | Zip (Text: 10) | column `properties.zip` (varchar(10)) | port | mapped | UNT3-11 | — |  |

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
| `standardObject:Contact` | used by Dreamhouse (tab standard-Contact), SampleDataController (DML), SampleDataController (SOQL), TestSampleDataController (SOQL) | table `contacts` | port | mapped | UNT3-11 | — | Sample data only (sample_data_contacts, standard-Contact tab). Prisma model Contact: id, sf_id, first_name, last_name, email, phone, mobile_phone, title, mailing_* columns; API module app/api/src/modules/contacts |
| `standardObject:ContentDocument` | used by Dreamhouse (tab standard-File), TestPropertyController (SOQL) | table `files` | port | mapped | UNT3-18 | — | Collapsed with ContentVersion/ContentDocumentLink into one files table (id, sf_id, title, file_type, s3_key, record_id, created_at) + S3 object; files module |
| `standardObject:ContentDocumentLink` | used by Create_property (record element), FileUtilities (DML), PropertyController (SOQL), TestPropertyController (DML) | column `files.record_id` (uuid) | port | mapped | UNT3-18 | — | LinkedEntityId -> files.record_id (polymorphic: properties.id today); ShareType/Visibility dropped (no sharing model) |
| `standardObject:ContentVersion` | used by Create_property (record element), FileUtilities (DML), FileUtilities (SOQL), PropertyController (SOQL), TestPropertyController (DML) | table `files` | port | mapped | UNT3-18 | — | VersionData -> S3 object (bucket from infra, key files/<id>/<filename>); Title/IsLatest/CreatedDate -> files columns; only the latest version is kept |
| `standardObject:PermissionSet` | used by TestPropertyController (SOQL) | role `dreamhouse` | substitute | mapped | UNT3-20 | — | **substitute**: Queried only by TestPropertyController to assign the permission set to a test user; the equivalent is the Cognito group dreamhouse. |
| `standardObject:PermissionSetAssignment` | used by TestPropertyController (DML) | fixture `tests/parity/fixtures/users.ts` | substitute | mapped | UNT3-20 | — | **substitute**: Test-only: adding the test user to the Cognito group dreamhouse is done by the parity fixture (admin-add-user-to-group). |
| `standardObject:Profile` | used by TestPropertyController (SOQL) | fixture `tests/parity/fixtures/users.ts` | substitute | mapped | UNT3-20 | — | **substitute**: Test-only: the Standard User profile lookup becomes creating a test user in the Cognito user pool. |
| `standardObject:StaticResource` | used by SampleDataController (SOQL) | fixture `app/api/src/modules/sample-data/fixtures` | substitute | mapped | UNT3-18 | — | **substitute**: SampleDataController reads sample_data_* static resources via SOQL; the service reads the same JSON from bundled fixtures. |
| `standardObject:User` | used by TestPropertyController (DML) | fixture `tests/parity/fixtures/users.ts` | substitute | mapped | UNT3-20 | — | **substitute**: Test-only: User records created with System.runAs become Cognito test users created by the parity fixture. |

## Apex classes

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apexClass:FileUtilities` | class, with sharing, 1 methods | service `FilesService` | port | mapped | UNT3-18 | — | app/api/src/modules/files/files.service.ts |
| `apexClass:FileUtilitiesTest` | test class, with sharing, 4 methods | spec `tests/parity/characterisation/file-utilities.spec.ts` | port | mapped | UNT3-15 | — | Characterisation spec run against both systems; unit variant app/api/src/modules/files/files.service.spec.ts |
| `apexClass:GeocodingService` | class, with sharing, 1 methods | service `GeocodingService` | port | mapped | UNT3-17 | — | app/api/src/modules/geocoding/geocoding.service.ts |
| `apexClass:GeocodingServiceTest` | test class, with sharing, 3 methods | spec `tests/parity/characterisation/geocoding-service.spec.ts` | port | mapped | UNT3-15 | — |  |
| `apexClass:PagedResult` | class, with sharing, 0 methods | dto `PagedResultDto` | port | ported | UNT3-6 | — | app/api/src/common/dto/paged-result.dto.ts (pageSize, pageNumber, totalItemCount, records) |
| `apexClass:PropertyController` | class, with sharing, 2 methods | service `PropertiesService` | port | mapped | UNT3-16 | — | app/api/src/modules/properties/properties.service.ts; HTTP surface in properties.controller.ts |
| `apexClass:SampleDataController` | class, with sharing, 5 methods | service `SampleDataService` | port | mapped | UNT3-18 | — | app/api/src/modules/sample-data/sample-data.service.ts |
| `apexClass:TestPropertyController` | test class, omitted, 4 methods | spec `tests/parity/characterisation/property-controller.spec.ts` | port | mapped | UNT3-15 | — |  |
| `apexClass:TestSampleDataController` | test class, omitted, 1 methods | spec `tests/parity/characterisation/sample-data-controller.spec.ts` | port | mapped | UNT3-15 | — |  |

## Apex inner classes

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apexInnerClass:GeocodingService.GeocodingAddress` | class, 5 fields | dto `GeocodingAddressDto` | port | ported | UNT3-6 | — | app/api/src/modules/geocoding/dto/geocoding.dto.ts (street, city, state, country, postalcode) |
| `apexInnerClass:GeocodingService.Coordinates` | class, 2 fields | dto `CoordinatesDto` | port | ported | UNT3-6 | — | app/api/src/modules/geocoding/dto/geocoding.dto.ts (lat, lon) |
| `apexInnerClass:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImpl` | class implements HttpCalloutMock, 0 fields | mock `app/web/src/test/mocks/nominatim.ts::nominatimSuccess` | substitute | mapped | UNT3-15 | — | **substitute**: HttpCalloutMock has no equivalent; outbound fetch is stubbed (vi.fn on global fetch / msw handler) with the same success payload. |
| `apexInnerClass:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImplError` | class implements HttpCalloutMock, 0 fields | mock `app/web/src/test/mocks/nominatim.ts::nominatimError` | substitute | mapped | UNT3-15 | — | **substitute**: HttpCalloutMock has no equivalent; outbound fetch is stubbed with the same error payload. |

## Apex methods

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apexMethod:FileUtilities.createFile` | @AuraEnabled String createFile(String base64data, String filename, String recordId) | endpoint `POST /files` | port | mapped | UNT3-18 | — | FilesService.createFile(base64data, filename, recordId): PUT to S3 + insert files row in one transaction; returns FileCreatedDto {contentDocumentId}; errors -> 400 (bad base64 / filename) and 404 (unknown recordId) like AuraHandledException |
| `apexMethod:FileUtilitiesTest.createFileSucceedsWhenCorrectInput` | @isTest void createFileSucceedsWhenCorrectInput() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileSucceedsWhenCorrectInput` | port | mapped | UNT3-15 | — |  |
| `apexMethod:FileUtilitiesTest.createFileFailsWhenIncorrectRecordId` | @isTest void createFileFailsWhenIncorrectRecordId() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileFailsWhenIncorrectRecordId` | port | mapped | UNT3-15 | — |  |
| `apexMethod:FileUtilitiesTest.createFileFailsWhenIncorrectBase64Data` | @isTest void createFileFailsWhenIncorrectBase64Data() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileFailsWhenIncorrectBase64Data` | port | mapped | UNT3-15 | — |  |
| `apexMethod:FileUtilitiesTest.createFileFailsWhenIncorrectFilename` | @isTest void createFileFailsWhenIncorrectFilename() | spec `tests/parity/characterisation/file-utilities.spec.ts::createFileFailsWhenIncorrectFilename` | port | mapped | UNT3-15 | — |  |
| `apexMethod:GeocodingService.geocodeAddresses` | @InvocableMethod List<Coordinates> geocodeAddresses(List<GeocodingAddress> addresses) | endpoint `POST /geocoding/addresses` | port | mapped | UNT3-17 | — | GeocodingService.geocodeAddresses(GeocodeAddressesDto) -> CoordinatesDto[]; one Nominatim call per address; blank address -> {lat:null, lon:null}; upstream error -> 502 |
| `apexMethod:GeocodingServiceTest.successResponse` | @isTest void successResponse() | spec `tests/parity/characterisation/geocoding-service.spec.ts::successResponse` | port | mapped | UNT3-15 | — |  |
| `apexMethod:GeocodingServiceTest.blankAddress` | @isTest void blankAddress() | spec `tests/parity/characterisation/geocoding-service.spec.ts::blankAddress` | port | mapped | UNT3-15 | — |  |
| `apexMethod:GeocodingServiceTest.errorResponse` | @isTest void errorResponse() | spec `tests/parity/characterisation/geocoding-service.spec.ts::errorResponse` | port | mapped | UNT3-15 | — |  |
| `apexMethod:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImpl.respond` | HTTPResponse respond(HTTPRequest req) | spec `tests/parity/characterisation/geocoding-service.spec.ts::OpenStreetMapHttpCalloutMockImpl` | substitute | mapped | UNT3-15 | — | **substitute**: respond() is the HttpCalloutMock body; it becomes the stubbed fetch response inside the spec. |
| `apexMethod:GeocodingServiceTest.OpenStreetMapHttpCalloutMockImplError.respond` | HTTPResponse respond(HTTPRequest req) | spec `tests/parity/characterisation/geocoding-service.spec.ts::OpenStreetMapHttpCalloutMockImplError` | substitute | mapped | UNT3-15 | — | **substitute**: respond() is the HttpCalloutMock body; it becomes the stubbed fetch response inside the spec. |
| `apexMethod:PropertyController.getPagedPropertyList` | @AuraEnabled PagedResult getPagedPropertyList(String searchKey, Decimal maxPrice, Integer minBedrooms, Integer minBathrooms, Integer pageSize, Integer pageNumber) | endpoint `GET /properties` | port | mapped | UNT3-16 | — | query searchKey, maxPrice, minBedrooms, minBathrooms, pageSize, pageNumber -> PagedPropertiesDto; LIKE %searchKey% on name/city/tags -> Prisma contains (insensitive); same ordering/offset semantics as the SOQL |
| `apexMethod:PropertyController.getPictures` | @AuraEnabled List<ContentVersion> getPictures(Id propertyId) | endpoint `GET /properties/{id}/pictures` | port | mapped | UNT3-16 | — | PropertyPictureDto[] from files where record_id = :id (latest version), ordered by created_at desc |
| `apexMethod:SampleDataController.importSampleData` | @AuraEnabled void importSampleData() | endpoint `POST /sample-data/import` | port | mapped | UNT3-18 | — | admin-only (role dreamhouse-admin); deletes properties/brokers/contacts then inserts brokers, properties, contacts in one transaction; Case cleanup dropped |
| `apexMethod:SampleDataController.insertBrokers` | void insertBrokers() | serviceMethod `SampleDataService.insertBrokers` | port | mapped | UNT3-18 | — |  |
| `apexMethod:SampleDataController.insertProperties` | void insertProperties() | serviceMethod `SampleDataService.insertProperties` | port | mapped | UNT3-18 | — |  |
| `apexMethod:SampleDataController.insertContacts` | void insertContacts() | serviceMethod `SampleDataService.insertContacts` | port | mapped | UNT3-18 | — |  |
| `apexMethod:SampleDataController.randomizeDateListed` | void randomizeDateListed(List<Property__c> properties) | serviceMethod `SampleDataService.randomizeDateListed` | port | mapped | UNT3-18 | — |  |
| `apexMethod:TestPropertyController.createProperties` | void createProperties(Integer amount) | fixture `tests/parity/fixtures/properties.ts` | port | mapped | UNT3-15 | — | createProperties(amount) test helper |
| `apexMethod:TestPropertyController.testGetPagedPropertyList` | @isTest void testGetPagedPropertyList() | spec `tests/parity/characterisation/property-controller.spec.ts::testGetPagedPropertyList` | port | mapped | UNT3-15 | — |  |
| `apexMethod:TestPropertyController.testGetPicturesNoResults` | @isTest void testGetPicturesNoResults() | spec `tests/parity/characterisation/property-controller.spec.ts::testGetPicturesNoResults` | port | mapped | UNT3-15 | — |  |
| `apexMethod:TestPropertyController.testGetPicturesWithResults` | @isTest void testGetPicturesWithResults() | spec `tests/parity/characterisation/property-controller.spec.ts::testGetPicturesWithResults` | port | mapped | UNT3-15 | — |  |
| `apexMethod:TestSampleDataController.importSampleData` | @isTest void importSampleData() | spec `tests/parity/characterisation/sample-data-controller.spec.ts::importSampleData` | port | mapped | UNT3-15 | — |  |

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
| `flow:Create_property` | Create Property (Flow, 17 elements) | route `/properties/new` | port | mapped | UNT3-23 | — | CreatePropertyWizard (app/web/src/pages/properties/CreatePropertyWizard.tsx): screens address -> geocode (POST /geocoding/addresses) -> property_details -> create (POST /properties) -> upload_picture (POST /files, sets picture/thumbnail) -> navigate_to_record_detail; fault screens Error2-5/error_creating_records keep the same messages |

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
| `tab:Broker__c` | Broker__c (customObject) | route `/brokers` | port | mapped | UNT3-22 | — | nav tab Brokers -> broker list page (listView Broker__c.All) |
| `tab:Property_Explorer` | Property Explorer (flexipage) | route `/property-explorer` | port | mapped | UNT3-21 | — | nav tab Property Explorer |
| `tab:Property_Finder` | Property Finder (flexipage) | route `/property-finder` | port | mapped | UNT3-21 | — | nav tab Property Finder |
| `tab:Property__c` | Property__c (customObject) | route `/properties` | port | mapped | UNT3-22 | — | nav tab Properties -> property list page (listView Property__c.All) |
| `tab:Settings` | Settings (flexipage) | route `/settings` | port | mapped | UNT3-23 | — | nav tab Settings (admin only) |

## Lightning apps

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `application:Dreamhouse` | Dreamhouse: tabs standard-home, Property_Explorer, Property_Finder, standard-Contact, Property__c, Broker__c, standard-File, Settings | component `AppShell` | port | mapped | UNT3-7 | — | app/web/src/app/AppShell.tsx + navigation config app/web/src/app/navigation.ts (tab order: home, property-explorer, property-finder, contacts, properties, brokers, files, settings); brand colour #86BD4A and logo asset; record View overrides -> routes /properties/:id and /brokers/:id |

## Permission sets

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `permissionSet:dreamhouse` | dreamhouse | role `dreamhouse` | port | mapped | UNT3-20 | — | Cognito user-pool group dreamhouse (plus dreamhouse-admin for Settings/sample import); enforced by RolesGuard in app/api/src/auth; policy table app/api/src/auth/policy.ts |

## Permission set entries

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `permission:dreamhouse.application.Dreamhouse` | application visible=True | policy `policy.app.access` | port | mapped | UNT3-20 | — | any member of group dreamhouse may sign in to the web app; others get the access-denied page |
| `permission:dreamhouse.apexClass.PagedResult` | Apex class access enabled=True | policy `policy.properties.invoke` | port | mapped | UNT3-20 | — | RolesGuard on the properties controller routes (group dreamhouse) |
| `permission:dreamhouse.apexClass.PropertyController` | Apex class access enabled=True | policy `policy.properties.invoke` | port | mapped | UNT3-20 | — | RolesGuard on the properties controller routes (group dreamhouse) |
| `permission:dreamhouse.apexClass.SampleDataController` | Apex class access enabled=True | policy `policy.sampleData.invoke` | port | mapped | UNT3-20 | — | RolesGuard on the sampleData controller routes (group dreamhouse; sample import additionally requires dreamhouse-admin) |
| `permission:dreamhouse.object.Broker__c` | object CRUD create,read,edit,delete + viewAllRecords,modifyAllRecords | policy `policy.brokers.crud` | port | mapped | UNT3-20 | — | group dreamhouse: create/read/update/delete on /brokers; viewAll/modifyAll -> no ownership filter (matches org-wide ReadWrite) |
| `permission:dreamhouse.object.Property__c` | object CRUD create,read,edit,delete + viewAllRecords,modifyAllRecords | policy `policy.properties.crud` | port | mapped | UNT3-20 | — | group dreamhouse: create/read/update/delete on /properties; viewAll/modifyAll -> no ownership filter (matches org-wide ReadWrite) |
| `permission:dreamhouse.field.Broker__c.Broker_Id__c` | field readable=True editable=True | policy `policy.brokers.fields.broker_id` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Broker__c.Email__c` | field readable=True editable=True | policy `policy.brokers.fields.email` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Broker__c.Mobile_Phone__c` | field readable=True editable=True | policy `policy.brokers.fields.mobile_phone` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Broker__c.Phone__c` | field readable=True editable=True | policy `policy.brokers.fields.phone` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Broker__c.Picture_IMG__c` | field readable=True editable=False | policy `policy.brokers.fields.picture_img` | port | mapped | UNT3-20 | — | read-only (formula) for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Broker__c.Picture__c` | field readable=True editable=True | policy `policy.brokers.fields.picture` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Broker__c.Title__c` | field readable=True editable=True | policy `policy.brokers.fields.title` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Address__c` | field readable=True editable=True | policy `policy.properties.fields.address` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Assessed_Value__c` | field readable=True editable=True | policy `policy.properties.fields.assessed_value` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Baths__c` | field readable=True editable=True | policy `policy.properties.fields.baths` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Beds__c` | field readable=True editable=True | policy `policy.properties.fields.beds` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Broker__c` | field readable=True editable=True | policy `policy.properties.fields.broker` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.City__c` | field readable=True editable=True | policy `policy.properties.fields.city` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Date_Agreement__c` | field readable=True editable=True | policy `policy.properties.fields.date_agreement` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Date_Closed__c` | field readable=True editable=True | policy `policy.properties.fields.date_closed` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Date_Contracted__c` | field readable=True editable=True | policy `policy.properties.fields.date_contracted` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Date_Listed__c` | field readable=True editable=True | policy `policy.properties.fields.date_listed` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Date_Pre_Market__c` | field readable=True editable=True | policy `policy.properties.fields.date_pre_market` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Days_On_Market__c` | field readable=True editable=False | policy `policy.properties.fields.days_on_market` | port | mapped | UNT3-20 | — | read-only (formula) for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Description__c` | field readable=True editable=True | policy `policy.properties.fields.description` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Location__c` | field readable=True editable=True | policy `policy.properties.fields.location` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Name` | field readable=True editable=True | policy `policy.properties.fields.name` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Picture_IMG__c` | field readable=True editable=False | policy `policy.properties.fields.picture_img` | port | mapped | UNT3-20 | — | read-only (formula) for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Picture__c` | field readable=True editable=True | policy `policy.properties.fields.picture` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Price_Sold__c` | field readable=True editable=True | policy `policy.properties.fields.price_sold` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Price__c` | field readable=True editable=True | policy `policy.properties.fields.price` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Record_Link__c` | field readable=True editable=False | policy `policy.properties.fields.record_link` | port | mapped | UNT3-20 | — | read-only (formula) for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.State__c` | field readable=True editable=True | policy `policy.properties.fields.state` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Status__c` | field readable=True editable=True | policy `policy.properties.fields.status` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Tags__c` | field readable=True editable=True | policy `policy.properties.fields.tags` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Thumbnail_IMG__c` | field readable=True editable=False | policy `policy.properties.fields.thumbnail_img` | port | mapped | UNT3-20 | — | read-only (formula) for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Thumbnail__c` | field readable=True editable=True | policy `policy.properties.fields.thumbnail` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.field.Property__c.Zip__c` | field readable=True editable=True | policy `policy.properties.fields.zip` | port | mapped | UNT3-20 | — | readable + editable for group dreamhouse; field policy list app/api/src/auth/field-policy.ts filters DTOs and rejects writes |
| `permission:dreamhouse.tab.Broker__c` | tab Visible | config `app/web/src/app/navigation.ts::Broker__c` | port | mapped | UNT3-20 | — | tab /brokers visible to group dreamhouse |
| `permission:dreamhouse.tab.Property_Explorer` | tab Visible | config `app/web/src/app/navigation.ts::Property_Explorer` | port | mapped | UNT3-20 | — | tab /property-explorer visible to group dreamhouse |
| `permission:dreamhouse.tab.Property_Finder` | tab Visible | config `app/web/src/app/navigation.ts::Property_Finder` | port | mapped | UNT3-20 | — | tab /property-finder visible to group dreamhouse |
| `permission:dreamhouse.tab.Property__c` | tab Visible | config `app/web/src/app/navigation.ts::Property__c` | port | mapped | UNT3-20 | — | tab /properties visible to group dreamhouse |
| `permission:dreamhouse.tab.Settings` | tab Visible | config `app/web/src/app/navigation.ts::Settings` | port | mapped | UNT3-20 | — | tab /settings visible to group dreamhouse (Settings: dreamhouse-admin) |

## Static resources

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `staticResource:leafletjs` | JS library that renders maps (168861 bytes) | dependency `leaflet` | substitute | mapped | UNT3-7 | — | **substitute**: The zipped Leaflet 1.x static resource becomes the npm packages leaflet + react-leaflet (same library, same marker/tile assets). |
| `staticResource:sample_data_brokers` | Sample data used to initialize Broker__c records (2850 bytes) | fixture `app/api/src/modules/sample-data/fixtures/brokers.json` | port | mapped | UNT3-18 | — | same JSON content, keys renamed to camelCase DTO fields |
| `staticResource:sample_data_contacts` | Sample data used to initialize Contact records (723 bytes) | fixture `app/api/src/modules/sample-data/fixtures/contacts.json` | port | mapped | UNT3-18 | — | same JSON content, keys renamed to camelCase DTO fields |
| `staticResource:sample_data_properties` | Sample data used to initialize Property__c records (9088 bytes) | fixture `app/api/src/modules/sample-data/fixtures/properties.json` | port | mapped | UNT3-18 | — | same JSON content, keys renamed to camelCase DTO fields |

## Content assets

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `contentAsset:dreamhouselogosquare` | dreamhouselogosquare | asset `app/web/public/dreamhouse-logo-square.png` | port | mapped | UNT3-7 | — | app shell logo |

## Lightning message channels

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `messageChannel:FiltersChange` | Filters Change Message Channel: searchKey, maxPrice, minBedrooms, minBathrooms | store `app/web/src/state/propertyFilters.ts` | port | mapped | UNT3-21 | — | searchKey, maxPrice, minBedrooms, minBathrooms as URL search params (useSearchParams) so filters are linkable; publish = setFilters, subscribe = useFilters |
| `messageChannel:PropertySelected` | Property Selected Message Channel: propertyId | store `app/web/src/state/selectedProperty.ts` | port | mapped | UNT3-21 | — | propertyId in URL search param `selected` + small store; publish = selectProperty, subscribe = useSelectedProperty |

## Remote site settings

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `remoteSiteSetting:nominatim_openstreetmap` | https://nominatim.openstreetmap.org | env `GEOCODING_BASE_URL` | port | mapped | UNT3-17 | — | app/api/src/config/config.schema.ts (default https://nominatim.openstreetmap.org); egress allowed by the ECS task security group in infra/ |

## CSP trusted sites

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cspTrustedSite:openStreetMap` | https://tile.openstreetmap.org (ImgSrc) | infra `infra/modules/web/cloudfront.tf::response_headers_policy.img-src` | port | mapped | UNT3-9 | — | CSP img-src https://tile.openstreetmap.org (and connect-src for tile fetches) on the CloudFront response headers policy |
| `cspTrustedSite:s3_us_west_2_amazonaws_com` | https://s3-us-west-2.amazonaws.com (ImgSrc) | infra `infra/modules/web/cloudfront.tf::response_headers_policy.img-src` | port | mapped | UNT3-9 | — | CSP img-src https://s3-us-west-2.amazonaws.com (sample picture URLs) plus the demo files bucket |

## External callouts

| Id | Source | Target | Disposition | Status | Ticket | Parity tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `callout:GeocodingService.geocodeAddresses` | http https://nominatim.openstreetmap.org/search?format=json | httpClient `GeocodingService.geocodeAddresses` | port | mapped | UNT3-17 | — | Node fetch GET {GEOCODING_BASE_URL}/search?format=json&street=&city=&state=&country=&postalcode= with User-Agent header; 10s timeout; mocked in specs |

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
