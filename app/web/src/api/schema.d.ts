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
         * @description Replaces the Broker__c list view / tab.
         */
        get: operations["brokers_findAll"];
        put?: never;
        post?: never;
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
         * @description Replaces `lightning/uiRecordApi getRecord` on Broker__c (brokerCard LWC).
         */
        get: operations["brokers_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List contacts */
        get: operations["contacts_findAll"];
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
         * @description Port of `@AuraEnabled FileUtilities.createFile` (used by the Property record page picture upload).
         */
        post: operations["files_createFile"];
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
         * @description Port of `@InvocableMethod GeocodingService.geocodeAddresses` (called from the Create_property flow). Returns one Coordinates entry per input address, in order.
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
         * @description Port of `@AuraEnabled PropertyController.getPagedPropertyList` (used by propertyTileList).
         */
        get: operations["properties_getPagedPropertyList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
         * @description Port of `@AuraEnabled PropertyController.getPictures` (used by propertyCarousel).
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
         * Reset and reload the sample data set
         * @description Port of `@AuraEnabled SampleDataController.importSampleData` (Settings tab, sampleDataImporter LWC).
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
        BrokerDto: {
            /** @description Broker_Id__c */
            brokerId?: string;
            /**
             * Format: email
             * @description Email__c
             */
            email?: string;
            /** Format: uuid */
            id: string;
            /** @description Mobile_Phone__c */
            mobilePhone?: string;
            /** @description Broker__c.Name */
            name: string;
            /** @description Phone__c */
            phone?: string;
            /**
             * Format: uri
             * @description Picture__c
             */
            picture?: string;
            /** @description Title__c */
            title?: string;
        };
        ContactDto: {
            /** Format: email */
            email?: string;
            firstName: string;
            /** Format: uuid */
            id: string;
            lastName: string;
            phone?: string;
        };
        CoordinatesDto: {
            lat?: Record<string, never> | null;
            lon?: Record<string, never> | null;
        };
        CreateFileDto: {
            /** @description File body, base64 encoded (ContentVersion.VersionData) */
            base64Data: string;
            /** @description ContentVersion.Title / PathOnClient */
            filename: string;
            /**
             * Format: uuid
             * @description Record the file is linked to (ContentDocumentLink.LinkedEntityId)
             */
            recordId: string;
        };
        FileCreatedDto: {
            /**
             * Format: uuid
             * @description Equivalent of the returned ContentDocumentLink.Id
             */
            id: string;
            /**
             * Format: uri
             * @description Where the stored file can be fetched from (S3)
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
            address?: string;
            /** @description Baths__c */
            baths?: number;
            /** @description Beds__c */
            beds?: number;
            /** @description City__c */
            city?: string;
            /** @description Description__c */
            description?: string;
            /** Format: uuid */
            id: string;
            /** @description Location__Latitude__s */
            latitude?: number;
            /** @description Location__Longitude__s */
            longitude?: number;
            /** @description Property__c.Name */
            name: string;
            /** @description Price__c */
            price?: number;
            /** @description State__c */
            state?: string;
            /** @description Thumbnail__c */
            thumbnail?: string;
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
        SampleDataImportResultDto: {
            /**
             * @example {
             *       "brokers": 8,
             *       "properties": 12,
             *       "contacts": 10
             *     }
             */
            inserted: Record<string, never>;
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
            /** @description Not ported yet (UNT3-19) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
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
            /** @description Not ported yet (UNT3-19) */
            501: {
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
            /** @description Not ported yet (UNT3-19) */
            501: {
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
            /** @description Not ported yet (UNT3-18) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
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
            /** @description Not ported yet (UNT3-17) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
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
            /** @description Not ported yet (UNT3-16) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
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
            /** @description Not ported yet (UNT3-16) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
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
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SampleDataImportResultDto"];
                };
            };
            /** @description Not ported yet (UNT3-18) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
