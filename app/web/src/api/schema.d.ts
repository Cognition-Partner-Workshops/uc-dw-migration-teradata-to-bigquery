/* eslint-disable */
// GENERATED FILE — do not edit. Regenerate with `npm run api:generate` (source: app/api/openapi/openapi.json).
export type paths = {
    "/brokers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List brokers
         * @description Broker__c tab (list view), ordered by name.
         */
        get: operations["brokers_findAll"];
        put?: never;
        /**
         * Create a broker
         * @description LDS `createRecord(Broker__c)`.
         */
        post: operations["brokers_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/brokers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a broker
         * @description LDS `getRecord` as used by the brokerCard LWC / Broker_Record_Page.
         */
        get: operations["brokers_findOne"];
        put?: never;
        post?: never;
        /**
         * Delete a broker
         * @description LDS `deleteRecord(Broker__c)`; properties keep existing with brokerId cleared.
         */
        delete: operations["brokers_remove"];
        options?: never;
        head?: never;
        /**
         * Update a broker
         * @description LDS `updateRecord(Broker__c)`.
         */
        patch: operations["brokers_update"];
        trace?: never;
    };
    "/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List contacts
         * @description standard-Contact tab (sample data).
         */
        get: operations["contacts_findAll"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contacts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a contact */
        get: operations["contacts_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upload a file and link it to a record
         * @description Port of `@AuraEnabled FileUtilities.createFile(base64data, filename, recordId)` (Property record page picture upload). Stores the body in the files bucket and inserts the `files` row linked to the record; the file then shows up in `GET /properties/{id}/pictures` and is served by `GET /files/{id}`. Bodies larger than FILES_MAX_INLINE_BYTES go through `POST /files/presigned-upload` first and are finalised here with `uploadKey` instead of `base64Data`.
         */
        post: operations["files_createFile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download a file
         * @description Body of the file behind a `files` row (`ContentVersion.VersionData`). With the S3 bucket this answers `302` to a pre-signed URL; without it the API streams the object itself.
         */
        get: operations["files_getFile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/files/presigned-upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pre-signed S3 upload for large files
         * @description Returns a short-lived pre-signed `PUT` URL into the files bucket. After the upload succeeds, call `POST /files` with the returned `uploadKey` to create the file row (no counterpart in Apex, which was limited by request size).
         */
        post: operations["files_createPresignedUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geocode": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Geocode a single address
         * @description Single-address form of `geocodeAddresses` for the UI (Create_property wizard address screen). Nominatim (OpenStreetMap) usage policy applies: requests are spaced 1/s and results are cached server-side.
         */
        post: operations["geocoding_geocode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/geocoding/addresses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Geocode one or more addresses
         * @description Port of `@InvocableMethod GeocodingService.geocodeAddresses` (called from the Create_property flow). Returns one Coordinates entry per input address, in order; `{lat: null, lon: null}` for a blank address, an unknown address or an upstream failure (the Apex callout swallowed non-200 answers).
         */
        post: operations["geocoding_geocodeAddresses"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness: the process is up (no dependency checks) */
        get: operations["health_liveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness: PostgreSQL reachable through Prisma */
        get: operations["health_readiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/properties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Paged, filtered property list
         * @description Port of `@AuraEnabled(cacheable=true) PropertyController.getPagedPropertyList` (used by propertyTileList). Same filter semantics as the SOQL: case-insensitive `%searchKey%` on name, city or tags; inclusive `maxPrice` / `minBedrooms` / `minBathrooms` bounds; ordered by price ascending.
         */
        get: operations["properties_getPagedPropertyList"];
        put?: never;
        /**
         * Create a property (Create_property flow)
         * @description The `Create_property` screen flow as one call: the flow inputs (name, description, brokerId, price, address/city/state/zip/country, beds, baths, tags) plus any other writable Property__c field. With `geocode: true` the geocode_address Apex action runs first and fills latitude/longitude; a geocoder failure is the flow fault path (502, nothing created). The record-create assignments of the flow are applied when omitted: `status: "Available"`, `dateListed: today`. The picture upload screen is `POST /files` on the returned id. Also LDS `createRecord(Property__c)` for the standard New action.
         */
        post: operations["properties_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/properties/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a property
         * @description LDS `getRecord` on Property__c as used by propertySummary / propertyLocation / propertyMap and the record page.
         */
        get: operations["properties_findOne"];
        put?: never;
        post?: never;
        /**
         * Delete a property
         * @description LDS `deleteRecord(Property__c)`; linked files go with it (ContentDocumentLink cascade).
         */
        delete: operations["properties_remove"];
        options?: never;
        head?: never;
        /**
         * Update a property
         * @description LDS `updateRecord(Property__c)` (record page Edit, inline edit). `geocode: true` re-geocodes the resulting address, as the flow did on create.
         */
        patch: operations["properties_update"];
        trace?: never;
    };
    "/properties/{id}/pictures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Pictures attached to a property
         * @description Port of `@AuraEnabled(cacheable=true) PropertyController.getPictures` (used by propertyCarousel): PNG/JPG/GIF files linked to the property, oldest first. `[]` when none (Apex returned null).
         */
        get: operations["properties_getPictures"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sample-data/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reset and reload the sample data set (admin only)
         * @description Port of `@AuraEnabled SampleDataController.importSampleData` (Settings tab, sampleDataImporter LWC): deletes every property, broker and contact, then inserts the `sample_data_*` static resources, all in one transaction. Requires the `dreamhouse-admin` group and is refused unless the deployment allows it (SAMPLE_DATA_IMPORT_ENABLED).
         */
        post: operations["sampleData_importSampleData"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        ApiErrorDto: {
            /** @example Bad Request */
            error: string;
            /** @example Validation failed: beds, name */
            message: string;
            output: components["schemas"]["ApiErrorOutputDto"];
            /** @example 400 */
            statusCode: number;
        };
        ApiErrorOutputDto: {
            errors: components["schemas"]["RecordErrorDto"][];
            /**
             * @description Field errors keyed by API field name
             * @example {
             *       "beds": [
             *         {
             *           "field": "beds",
             *           "errorCode": "FIELD_INTEGRITY_EXCEPTION",
             *           "message": "beds must not be greater than 99"
             *         }
             *       ]
             *     }
             */
            fieldErrors: {
                [key: string]: components["schemas"]["FieldErrorDto"][];
            };
        };
        BrokerDto: {
            /** @description Broker_Id__c (Number 18,0) as a digit string */
            brokerId: string | null;
            /**
             * Format: date-time
             * @description CreatedDate
             */
            createdAt: string;
            /**
             * Format: email
             * @description Email__c
             */
            email: string | null;
            /** Format: uuid */
            id: string;
            /** @description Mobile_Phone__c */
            mobilePhone: string | null;
            /** @description Broker__c.Name */
            name: string;
            /** @description Phone__c */
            phone: string | null;
            /**
             * Format: uri
             * @description Picture__c
             */
            picture: string | null;
            /** @description Original Salesforce Id while migrating */
            sfId: string | null;
            /** @description Title__c */
            title: string | null;
            /**
             * Format: date-time
             * @description LastModifiedDate
             */
            updatedAt: string;
        };
        ContactDto: {
            /**
             * Format: email
             * @description Email
             */
            email: string | null;
            /** @description FirstName */
            firstName: string | null;
            /** Format: uuid */
            id: string;
            /** @description LastName */
            lastName: string;
            /** @description MobilePhone */
            mobilePhone: string | null;
            /** @description Phone */
            phone: string | null;
            /** @description Original Salesforce Id while migrating */
            sfId: string | null;
            /** @description Title */
            title: string | null;
        };
        CoordinatesDto: {
            lat?: Record<string, never> | null;
            lon?: Record<string, never> | null;
        };
        CreateBrokerDto: {
            /** @description Broker_Id__c (Number 18,0) as a digit string */
            brokerId?: Record<string, never>;
            /**
             * Format: email
             * @description Email__c
             */
            email?: Record<string, never>;
            /** @description Mobile_Phone__c */
            mobilePhone?: Record<string, never>;
            /** @description Broker__c.Name (required) */
            name: string;
            /** @description Phone__c */
            phone?: Record<string, never>;
            /**
             * Format: uri
             * @description Picture__c
             */
            picture?: Record<string, never>;
            /** @description Title__c */
            title?: Record<string, never>;
        };
        CreateFileDto: {
            /** @description File body, base64 encoded (ContentVersion.VersionData). Missing padding and a `data:` URL prefix are accepted. Required unless `uploadKey` is given; decoded size is capped by FILES_MAX_INLINE_BYTES. */
            base64Data?: string;
            /**
             * @description ContentVersion.Title / PathOnClient
             * @example house01.jpg
             */
            filename: string;
            /**
             * Format: uuid
             * @description Record the file is linked to (ContentDocumentLink.LinkedEntityId)
             */
            recordId: string;
            /**
             * @description Key returned by POST /files/presigned-upload once the PUT to S3 completed
             * @example uploads/4f0c.../8e1a.../house01.jpg
             */
            uploadKey?: string;
        };
        CreatePropertyDto: {
            /** @description Address__c (flow: property_address.street) */
            address?: Record<string, never>;
            /** @description Assessed_Value__c */
            assessedValue?: Record<string, never>;
            /** @description Baths__c (flow: number_of_baths, screen default 2) */
            baths?: Record<string, never>;
            /** @description Beds__c (flow: number_of_beds, screen default 4) */
            beds?: Record<string, never>;
            /**
             * Format: uuid
             * @description Broker__c lookup (flow: property_broker.recordId)
             */
            brokerId?: Record<string, never>;
            /** @description City__c (flow: property_address.city) */
            city?: Record<string, never>;
            /** @description Only used for geocoding (flow: property_address.country → geocode_address.country); not stored */
            country?: string;
            /** @description Date_Agreement__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateAgreement?: Record<string, never>;
            /** @description Date_Closed__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateClosed?: Record<string, never>;
            /** @description Date_Contracted__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateContracted?: Record<string, never>;
            /** @description Date_Listed__c, YYYY-MM-DD (Salesforce Date / Postgres date); defaults to the current date ($Flow.CurrentDate) */
            dateListed?: Record<string, never>;
            /** @description Date_Pre_Market__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            datePreMarket?: Record<string, never>;
            /** @description Description__c (flow: property_description) */
            description?: Record<string, never>;
            /**
             * @description Create_property flow option: run the geocode_address action (Apex GeocodingService → Nominatim) on address/city/state/country/zip and store the result as latitude/longitude. A geocoder failure answers 502 GEOCODING_FAULT (flow fault path) and creates nothing.
             * @default false
             */
            geocode: boolean;
            /** @description Location__Latitude__s; must be set together with longitude (ignored when geocode=true) */
            latitude?: Record<string, never>;
            /** @description Location__Longitude__s; must be set together with latitude (ignored when geocode=true) */
            longitude?: Record<string, never>;
            /** @description Property__c.Name (flow: property_name, required) */
            name: string;
            /**
             * Format: uri
             * @description Picture__c
             */
            picture?: Record<string, never>;
            /** @description Price__c (flow: property_price, screen default 100000) */
            price?: Record<string, never>;
            /** @description Price_Sold__c */
            priceSold?: Record<string, never>;
            /** @description State__c (flow: property_address.province) */
            state?: Record<string, never>;
            /**
             * @description Status__c restricted picklist; defaults to the flow value `Available`
             * @enum {string}
             */
            status?: "Contracted" | "Pre Market" | "Available" | "Under Agreement" | "Closed";
            /** @description Tags__c (flow: property_tags) */
            tags?: Record<string, never>;
            /**
             * Format: uri
             * @description Thumbnail__c
             */
            thumbnail?: Record<string, never>;
            /** @description Zip__c (flow: property_address.postalCode) */
            zip?: Record<string, never>;
        };
        FieldErrorDto: {
            /**
             * @description Salesforce StatusCode name for the failed rule
             * @example FIELD_INTEGRITY_EXCEPTION
             * @enum {string}
             */
            errorCode: "REQUIRED_FIELD_MISSING" | "STRING_TOO_LONG" | "INVALID_TYPE_ON_FIELD_IN_RECORD" | "FIELD_INTEGRITY_EXCEPTION" | "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST" | "INVALID_EMAIL_ADDRESS" | "INVALID_ID_FIELD" | "INVALID_CROSS_REFERENCE_KEY" | "INVALID_FIELD" | "DUPLICATE_VALUE" | "GEOCODING_FAULT" | "INVALID_SESSION_ID" | "INSUFFICIENT_ACCESS_OR_READONLY" | "INVALID_FIELD_FOR_INSERT_UPDATE";
            /**
             * @description API field name (camelCase)
             * @example beds
             */
            field: string;
            /** @example beds must not be greater than 99 */
            message: string;
        };
        FileCreatedDto: {
            /**
             * @description ContentDocument.FileType (upper-case extension)
             * @example JPG
             */
            fileType: string;
            /**
             * Format: uuid
             * @description Equivalent of the returned ContentDocumentLink.Id
             */
            id: string;
            /** @description Stored size in bytes */
            size: number;
            /** @description ContentVersion.Title (filename without extension) */
            title: string;
            /**
             * @description API path that serves the file (same value GET /properties/{id}/pictures returns)
             * @example /files/4f0c6a9e-1b2d-4c3e-8f90-123456789abc
             */
            url: string;
        };
        GeocodeAddressesDto: {
            addresses: components["schemas"]["GeocodingAddressDto"][];
        };
        GeocodingAddressDto: {
            city?: string;
            country?: string;
            postalcode?: string;
            state?: string;
            street?: string;
        };
        HealthDto: {
            /** @example dreamhouse-api */
            service: string;
            /** @enum {string} */
            status: "ok";
            /** @example 2026-10-06T07:00:00.000Z */
            timestamp: string;
            /** @example 12.3 */
            uptimeSeconds: number;
            /** @example 0.1.0 */
            version: string;
        };
        PagedPropertiesDto: {
            /** @example 1 */
            pageNumber: number;
            /** @example 9 */
            pageSize: number;
            records: components["schemas"]["PropertySummaryDto"][];
            /** @example 42 */
            totalItemCount: number;
        };
        PresignedUploadDto: {
            /** Format: date-time */
            expiresAt: string;
            /**
             * @description Headers the PUT must carry (signed into the URL)
             * @example {
             *       "Content-Type": "image/jpeg"
             *     }
             */
            headers: Record<string, never>;
            /** @enum {string} */
            method: "PUT";
            /** @description Pass back as `uploadKey` to POST /files after the PUT succeeded */
            uploadKey: string;
            /**
             * Format: uri
             * @description Pre-signed S3 URL to PUT the file body to
             */
            url: string;
        };
        PresignedUploadRequestDto: {
            /**
             * @description MIME type the client will send; derived from the filename when omitted
             * @example image/jpeg
             */
            contentType?: string;
            /**
             * @description ContentVersion.Title / PathOnClient
             * @example house01.jpg
             */
            filename: string;
            /**
             * Format: uuid
             * @description Record the file will be linked to
             */
            recordId: string;
        };
        PropertyDto: {
            /** @description Address__c */
            address: string | null;
            /** @description Assessed_Value__c */
            assessedValue: number | null;
            /** @description Baths__c */
            baths: number | null;
            /** @description Beds__c */
            beds: number | null;
            /**
             * Format: uuid
             * @description Broker__c (lookup)
             */
            brokerId: string | null;
            /** @description City__c */
            city: string | null;
            /**
             * Format: date-time
             * @description CreatedDate
             */
            createdAt: string;
            /** @description Date_Agreement__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateAgreement: string | null;
            /** @description Date_Closed__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateClosed: string | null;
            /** @description Date_Contracted__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateContracted: string | null;
            /** @description Date_Listed__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateListed: string | null;
            /** @description Date_Pre_Market__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            datePreMarket: string | null;
            /** @description Description__c */
            description: string | null;
            /** Format: uuid */
            id: string;
            /** @description Location__Latitude__s */
            latitude: number | null;
            /** @description Location__Longitude__s */
            longitude: number | null;
            /** @description Property__c.Name */
            name: string;
            /** @description Picture__c */
            picture: string | null;
            /** @description Price__c */
            price: number | null;
            /** @description Price_Sold__c */
            priceSold: number | null;
            /** @description Original Salesforce Id while migrating */
            sfId: string | null;
            /** @description State__c */
            state: string | null;
            /**
             * @description Status__c
             * @enum {string|null}
             */
            status: "Contracted" | "Pre Market" | "Available" | "Under Agreement" | "Closed" | null;
            /** @description Tags__c */
            tags: string | null;
            /** @description Thumbnail__c */
            thumbnail: string | null;
            /**
             * Format: date-time
             * @description LastModifiedDate
             */
            updatedAt: string;
            /** @description Zip__c */
            zip: string | null;
        };
        PropertyPictureDto: {
            /** @description ContentVersion.FileExtension */
            fileExtension: string;
            /** Format: uuid */
            id: string;
            title: string;
            /** Format: uri */
            url: string;
        };
        PropertySummaryDto: {
            /** @description Address__c */
            address: string | null;
            /** @description Baths__c */
            baths: number | null;
            /** @description Beds__c */
            beds: number | null;
            /** @description City__c */
            city: string | null;
            /** @description Description__c */
            description: string | null;
            /** Format: uuid */
            id: string;
            /** @description Location__Latitude__s */
            latitude: number | null;
            /** @description Location__Longitude__s */
            longitude: number | null;
            /** @description Property__c.Name */
            name: string;
            /** @description Price__c */
            price: number | null;
            /** @description State__c */
            state: string | null;
            /** @description Thumbnail__c */
            thumbnail: string | null;
        };
        ReadinessDto: {
            /**
             * @description Per-dependency state; `down` entries carry the error message in `errors`.
             * @example {
             *       "database": "up"
             *     }
             */
            checks: Record<string, never>;
            /**
             * @example {
             *       "database": "connection refused"
             *     }
             */
            errors?: Record<string, never>;
            /** @enum {string} */
            status: "ok" | "error";
        };
        RecordErrorDto: {
            /**
             * @example GEOCODING_FAULT
             * @enum {string}
             */
            errorCode: "REQUIRED_FIELD_MISSING" | "STRING_TOO_LONG" | "INVALID_TYPE_ON_FIELD_IN_RECORD" | "FIELD_INTEGRITY_EXCEPTION" | "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST" | "INVALID_EMAIL_ADDRESS" | "INVALID_ID_FIELD" | "INVALID_CROSS_REFERENCE_KEY" | "INVALID_FIELD" | "DUPLICATE_VALUE" | "GEOCODING_FAULT" | "INVALID_SESSION_ID" | "INSUFFICIENT_ACCESS_OR_READONLY" | "INVALID_FIELD_FOR_INSERT_UPDATE";
            message: string;
        };
        SampleDataCountsDto: {
            /** @example 8 */
            brokers: number;
            /** @example 5 */
            contacts: number;
            /** @example 12 */
            properties: number;
        };
        SampleDataImportResultDto: {
            /** @description Rows deleted before the reload */
            deleted: components["schemas"]["SampleDataCountsDto"];
            /** @description Rows inserted from the sample data JSON */
            inserted: components["schemas"]["SampleDataCountsDto"];
        };
        UpdateBrokerDto: {
            /** @description Broker_Id__c (Number 18,0) as a digit string */
            brokerId?: Record<string, never>;
            /**
             * Format: email
             * @description Email__c
             */
            email?: Record<string, never>;
            /** @description Mobile_Phone__c */
            mobilePhone?: Record<string, never>;
            /** @description Broker__c.Name */
            name?: string;
            /** @description Phone__c */
            phone?: Record<string, never>;
            /**
             * Format: uri
             * @description Picture__c
             */
            picture?: Record<string, never>;
            /** @description Title__c */
            title?: Record<string, never>;
        };
        UpdatePropertyDto: {
            /** @description Address__c (flow: property_address.street) */
            address?: Record<string, never>;
            /** @description Assessed_Value__c */
            assessedValue?: Record<string, never>;
            /** @description Baths__c (flow: number_of_baths, screen default 2) */
            baths?: Record<string, never>;
            /** @description Beds__c (flow: number_of_beds, screen default 4) */
            beds?: Record<string, never>;
            /**
             * Format: uuid
             * @description Broker__c lookup (flow: property_broker.recordId)
             */
            brokerId?: Record<string, never>;
            /** @description City__c (flow: property_address.city) */
            city?: Record<string, never>;
            /** @description Only used for geocoding (flow: property_address.country → geocode_address.country); not stored */
            country?: string;
            /** @description Date_Agreement__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateAgreement?: Record<string, never>;
            /** @description Date_Closed__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateClosed?: Record<string, never>;
            /** @description Date_Contracted__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            dateContracted?: Record<string, never>;
            /** @description Date_Listed__c, YYYY-MM-DD (Salesforce Date / Postgres date); defaults to the current date ($Flow.CurrentDate) */
            dateListed?: Record<string, never>;
            /** @description Date_Pre_Market__c, YYYY-MM-DD (Salesforce Date / Postgres date) */
            datePreMarket?: Record<string, never>;
            /** @description Description__c (flow: property_description) */
            description?: Record<string, never>;
            /**
             * @description Create_property flow option: run the geocode_address action (Apex GeocodingService → Nominatim) on address/city/state/country/zip and store the result as latitude/longitude. A geocoder failure answers 502 GEOCODING_FAULT (flow fault path) and creates nothing.
             * @default false
             */
            geocode: boolean;
            /** @description Location__Latitude__s; must be set together with longitude (ignored when geocode=true) */
            latitude?: Record<string, never>;
            /** @description Location__Longitude__s; must be set together with latitude (ignored when geocode=true) */
            longitude?: Record<string, never>;
            /** @description Property__c.Name */
            name?: string;
            /**
             * Format: uri
             * @description Picture__c
             */
            picture?: Record<string, never>;
            /** @description Price__c (flow: property_price, screen default 100000) */
            price?: Record<string, never>;
            /** @description Price_Sold__c */
            priceSold?: Record<string, never>;
            /** @description State__c (flow: property_address.province) */
            state?: Record<string, never>;
            /**
             * @description Status__c restricted picklist; defaults to the flow value `Available`
             * @enum {string}
             */
            status?: "Contracted" | "Pre Market" | "Available" | "Under Agreement" | "Closed";
            /** @description Tags__c (flow: property_tags) */
            tags?: Record<string, never>;
            /**
             * Format: uri
             * @description Thumbnail__c
             */
            thumbnail?: Record<string, never>;
            /** @description Zip__c (flow: property_address.postalCode) */
            zip?: Record<string, never>;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
    brokers_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrokerDto"][];
                };
            };
        };
    };
    brokers_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateBrokerDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrokerDto"];
                };
            };
            /** @description Field errors (output.fieldErrors) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorDto"];
                };
            };
        };
    };
    brokers_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrokerDto"];
                };
            };
            /** @description No broker with this id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    brokers_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description No broker with this id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    brokers_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateBrokerDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrokerDto"];
                };
            };
            /** @description Field errors (output.fieldErrors) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorDto"];
                };
            };
            /** @description No broker with this id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    contacts_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactDto"][];
                };
            };
        };
    };
    contacts_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContactDto"];
                };
            };
            /** @description No contact with this id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    files_createFile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateFileDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FileCreatedDto"];
                };
            };
            /** @description Blank or invalid filename / base64Data (Apex AuraHandledException) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description recordId does not exist (Apex: ContentDocumentLink insert failed) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Decoded body exceeds FILES_MAX_INLINE_BYTES */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    files_getFile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description File body (local storage) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/octet-stream": string;
                    "image/gif": string;
                    "image/jpeg": string;
                    "image/png": string;
                };
            };
            /** @description Redirect to a pre-signed S3 URL */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description No such file */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    files_createPresignedUpload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PresignedUploadRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PresignedUploadDto"];
                };
            };
            /** @description recordId does not exist */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Deployment has no S3 files bucket (FILES_BUCKET unset) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    geocoding_geocode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GeocodingAddressDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CoordinatesDto"];
                };
            };
        };
    };
    geocoding_geocodeAddresses: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GeocodeAddressesDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CoordinatesDto"][];
                };
            };
        };
    };
    health_liveness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthDto"];
                };
            };
        };
    };
    health_readiness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessDto"];
                };
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReadinessDto"];
                };
            };
        };
    };
    properties_getPagedPropertyList: {
        parameters: {
            query?: {
                maxPrice?: number;
                minBathrooms?: number;
                minBedrooms?: number;
                pageNumber?: number;
                pageSize?: number;
                /** @description Matches name, city or tags (SOQL `LIKE %searchKey%`) */
                searchKey?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PagedPropertiesDto"];
                };
            };
        };
    };
    properties_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePropertyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyDto"];
                };
            };
            /** @description Field errors (output.fieldErrors) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorDto"];
                };
            };
            /** @description Geocoding fault (output.errors[0].errorCode = GEOCODING_FAULT) */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorDto"];
                };
            };
        };
    };
    properties_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyDto"];
                };
            };
            /** @description No property with this id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    properties_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description No property with this id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    properties_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePropertyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyDto"];
                };
            };
            /** @description Field errors (output.fieldErrors) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorDto"];
                };
            };
            /** @description No property with this id */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Geocoding fault */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorDto"];
                };
            };
        };
    };
    properties_getPictures: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PropertyPictureDto"][];
                };
            };
        };
    };
    sampleData_importSampleData: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SampleDataImportResultDto"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Import disabled on this deployment, or caller is not a dreamhouse-admin */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
