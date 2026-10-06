# Dreamhouse API (`app/api`)

TypeScript / NestJS / Prisma service on PostgreSQL — the target of the Salesforce
[dreamhouse-lwc](../../salesforce/) migration. Runs on ECS Fargate behind an ALB
(see [`infra/`](../../infra/)). Companion React app: [`app/web`](../web/).

| | |
| --- | --- |
| Runtime | Node 20 (`engines` in `package.json`), TypeScript 5, CommonJS |
| Framework | NestJS 11 (Express) |
| Data | Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`) — ORM **and** migration tool |
| API docs | OpenAPI 3 generated from the controllers by `@nestjs/swagger`: `GET /openapi.json`, Swagger UI at `GET /docs` |
| Logging | pino via `nestjs-pino` (JSON in production, `pino-pretty` elsewhere) |
| Config | env vars, optionally overlaid from an AWS Secrets Manager JSON secret; validated with zod |
| Tests | Vitest (SWC transform so Nest decorator metadata works) + supertest |

## Run it

```bash
cd app/api
npm ci                      # postinstall runs `prisma generate`
cp .env.example .env        # DATABASE_URL etc.
npm run start:dev           # http://localhost:3000
```

```
GET /health          -> 200 {"status":"ok","service":"dreamhouse-api","version":"0.1.0",...}   (liveness, no DB)
GET /health/ready    -> 200 {"status":"ok","checks":{"database":"up"}} | 503 when Postgres is unreachable
GET /openapi.json    -> OpenAPI 3.0 document generated from the controllers
GET /docs            -> Swagger UI
```

Ported Apex endpoints (see [`docs/migration/mapping.yaml`](../../docs/migration/mapping.yaml)):

```
GET /properties               -> PagedResult of PropertyController.getPagedPropertyList
                                 (?searchKey=&maxPrice=&minBedrooms=&minBathrooms=&pageSize=&pageNumber=)
GET /properties/{id}/pictures -> PropertyController.getPictures (PNG/JPG/GIF rows of the files table, [] when none)
POST /files                   -> FileUtilities.createFile {base64Data, filename, recordId} -> 201 {id, url, title, fileType, size}
                                 (or {uploadKey, filename, recordId} after POST /files/presigned-upload for large files)
POST /files/presigned-upload  -> pre-signed S3 PUT for bodies above FILES_MAX_INLINE_BYTES (501 without FILES_BUCKET)
GET /files/{id}               -> the file body (302 to a pre-signed S3 URL; streamed when files live on local disk)
POST /sample-data/import      -> SampleDataController.importSampleData: admin-only (dreamhouse-admin bearer token),
                                 wipes properties/brokers/contacts and reloads the sample_data_* JSON in one transaction;
                                 403 unless the deployment allows it (SAMPLE_DATA_IMPORT_ENABLED, see Configuration)
```

The two `GET`s were `@AuraEnabled(cacheable=true)`, so they answer with `Cache-Control: private, max-age=30`
and an ETag (304 on conditional refetch); the web keeps them in TanStack Query for the same 30 s.

Everything else currently answers `501 Not Implemented` with the Apex source and the
ticket that ports it, e.g. `GET /contacts` → `{"apexSource":"Contact list","ticket":"UNT3-19"}`.

Useful scripts:

| Script | What |
| --- | --- |
| `npm test` / `npm run test:cov` | Vitest unit + HTTP tests (no database needed) |
| `npm run build` | `nest build` → `dist/` (`npm start` runs `node dist/main.js`) |
| `npm run lint` / `npm run format` | eslint (typescript-eslint) / prettier |
| `npm run openapi:export` | Writes [`openapi/openapi.json`](openapi/openapi.json) without starting a server; CI fails if it drifts from the controllers |
| `npm run prisma:migrate` | `prisma migrate dev` — create/apply a migration locally |
| `npm run prisma:deploy` | `prisma migrate deploy` — apply committed migrations (CI/CD, ECS one-off task) |

The `files` table (Salesforce Files collapsed into one row per document, body in S3) and the
`pg_trgm` GIN indexes that serve the `%searchKey%` filter of `GET /properties` are in migration
`20261006090000_property_controller_files` (`CREATE EXTENSION IF NOT EXISTS pg_trgm`, available in
the stock `postgres:16` images and RDS).

CI applies the committed migrations to an empty `postgres:16` service and fails on drift between
`schema.prisma` and the migrations (`prisma migrate diff --from-config-datasource --to-schema ... --exit-code`).
The field-by-field Salesforce → column mapping is generated into
[`docs/migration/schema-mapping.md`](../../docs/migration/schema-mapping.md) by `tools/schema/schema_mapping.py`.

For local development use the root docker-compose stack (`make up && make migrate`, see the
[root README](../../README.md#local-development-docker-compose)); [`Dockerfile.dev`](Dockerfile.dev) is its
hot-reload image. A stand-alone Postgres: `docker run -d --name dreamhouse-pg -e POSTGRES_USER=dreamhouse -e POSTGRES_PASSWORD=dreamhouse -e POSTGRES_DB=dreamhouse -p 5432:5432 postgres:16-alpine`. The [`Dockerfile`](Dockerfile) builds the Fargate image.

## Configuration

Validated in [`src/config/config.schema.ts`](src/config/config.schema.ts); loaded by
[`src/config/load-config.ts`](src/config/load-config.ts). Precedence: **process env** →
**Secrets Manager** (`AWS_SECRETS_MANAGER_SECRET_ID`, a JSON object such as
`{"DATABASE_URL":"postgresql://..."}`) → schema defaults. Locally a `.env` file is enough;
on ECS the task definition sets `AWS_SECRETS_MANAGER_SECRET_ID` and the task role grants
`secretsmanager:GetSecretValue`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` switches logging to plain JSON |
| `PORT` | `3000` | HTTP port |
| `LOG_LEVEL` | `info` | pino level |
| `DATABASE_URL` | — (required) | PostgreSQL connection string for Prisma |
| `GEOCODING_BASE_URL` | Nominatim | Replaces the hard-coded URL + Remote Site Setting of `GeocodingService` |
| `GEOCODING_USER_AGENT` | `dreamhouse-api (…)` | Identifies the app to Nominatim (its usage policy requires it); set something that names your deployment |
| `GEOCODING_REFERER` | — | Optional `Referer` header (Apex sent the org domain URL) |
| `GEOCODING_TIMEOUT_MS` | `10000` | Per-request timeout of the Nominatim callout |
| `GEOCODING_MAX_RETRIES` | `2` | Extra attempts on network errors, timeouts, 429 and 5xx (exponential back-off, `Retry-After` honoured) |
| `GEOCODING_MIN_INTERVAL_MS` | `1000` | Minimum spacing between Nominatim requests per process (policy: 1 req/s); `0` disables |
| `GEOCODING_CACHE_TTL_SECONDS` | `86400` | In-process cache of geocoding results (policy: cache results); `0` disables |
| `GEOCODING_CACHE_MAX_ENTRIES` | `1000` | Cache size cap (oldest entries evicted first) |
| `GEOCODING_LIVE_SMOKE` | — | `1` runs the live Nominatim smoke test (`src/modules/geocoding/geocoding.live.spec.ts`); off by default |
| `AWS_REGION` | `us-east-1` | Region for Secrets Manager and S3 |
| `AWS_SECRETS_MANAGER_SECRET_ID` | — | Optional secret to overlay |
| `FILES_BUCKET` | — | Private S3 bucket for Salesforce Files (`infra/modules/files`; the ECS task role has the object permissions). Unset → bodies are kept on disk under `FILES_LOCAL_DIR` |
| `FILES_LOCAL_DIR` | `.data/files` | Local stand-in for the bucket (docker-compose, tests) |
| `FILES_MAX_INLINE_BYTES` | `6291456` | Largest decoded body `POST /files` accepts as `base64Data` (the JSON body limit follows it); larger files use the pre-signed upload |
| `FILES_PRESIGNED_URL_TTL_SECONDS` | `900` | Lifetime of the pre-signed PUT/GET URLs |
| `SAMPLE_DATA_IMPORT_ENABLED` | — | `true`/`false` overrides the default of `POST /sample-data/import`: allowed outside `production` and off `*.rds.amazonaws.com`, refused otherwise — so the demo RDS is never wiped without this flag |
| `AUTH_TEST_JWT_SECRET` | `dreamhouse-characterisation` outside production | HS256 secret of the test bearer tokens (`tests/parity/fixtures/users.ts`) the admin guard verifies until the Cognito verifier (UNT3-20) lands; in production there is no default |

## Layout — one Nest module per Salesforce object / Apex domain

The module layout mirrors [`docs/migration/mapping.yaml`](../../docs/migration/mapping.yaml)
so every Apex class has an obvious home:

```
src/
  main.ts                    bootstrap (listen, OpenAPI)
  app.module.ts              wires platform + domain modules
  app.factory.ts             createApp()/configureApp(): validation pipe, PrismaExceptionFilter, pino logger, shutdown hooks
  config/                    zod schema, env + Secrets Manager loader, AppConfigService
  logging/                   nestjs-pino LoggerModule
  prisma/                    PrismaService (PrismaClient + pg adapter), global PrismaModule
  health/                    GET /health, GET /health/ready
  openapi/                   DocumentBuilder config, tag list, /openapi.json + /docs setup
  common/                    PagedResultDto (Apex PagedResult), pagination query, NotPortedException
  common/errors/             ApiErrorDto field-error contract, validation pipe factory, Prisma -> field-error filter
  common/validation/         IsCalendarDate (Salesforce Date <-> YYYY-MM-DD)
  modules/
    properties/              Property__c  — PropertyController (+ TestPropertyController), record CRUD, Create_property flow
    brokers/                 Broker__c    — record CRUD behind brokerCard / Broker record page (LDS, no Apex)
    contacts/                Contact      — standard object, sample data only (read-only)
    files/                   ContentVersion / ContentDocumentLink — FileUtilities (+ FileUtilitiesTest)
    geocoding/               GeocodingService (+ GeocodingServiceTest), Nominatim callout
    sample-data/             SampleDataController (+ TestSampleDataController), sample_data_* static resources
  generated/prisma/          generated Prisma client (git-ignored; `prisma generate`)
prisma/
  schema.prisma              Broker / Property / Contact models + PropertyStatus enum (snake_case via @@map/@map)
  migrations/                Prisma Migrate history: generated DDL + hand-written CHECKs, properties_v view, updated_at trigger
openapi/openapi.json         exported spec (kept in sync by CI)
test/                        HTTP tests (supertest) and config tests
```

Each domain module is `<name>.module.ts` + `<name>.controller.ts` (HTTP surface, OpenAPI
decorators) + `<name>.service.ts` (the ported Apex logic, talking to `PrismaService`) + `dto/`.

### Naming

- **Code**: camelCase for variables, properties, JSON fields and query parameters;
  PascalCase for classes/Prisma models; kebab-case for files and URL paths
  (`Property__c.Date_Listed__c` → `dateListed`, `Mobile_Phone__c` → `mobilePhone`).
- **SQL**: snake_case for tables and columns, plural table names. In Prisma this is done
  with `@@map("properties")` on every model and `@map("date_listed")` on every field whose
  name differs, so the client stays camelCase while the schema is snake_case.
- Salesforce 18-char Ids become UUID primary keys; the original Salesforce Id is kept in a
  `sf_id` column during migration so parity tests can join the two systems (UNT3-11).

## Field errors

Every record route answers rule failures with one body, [`ApiErrorDto`](src/common/errors/api-error.dto.ts),
shaped like the Lightning UI API DML error that `lightning-record-form` and `ldsUtils.reduceErrors`
consumed, so the React forms can render errors inline the same way:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed: beds, name",
  "output": {
    "errors": [],
    "fieldErrors": {
      "beds": [{ "field": "beds", "errorCode": "FIELD_INTEGRITY_EXCEPTION", "message": "beds must not be greater than 99" }],
      "name": [{ "field": "name", "errorCode": "REQUIRED_FIELD_MISSING", "message": "name should not be empty" }]
    }
  }
}
```

`errorCode` is the Salesforce `StatusCode` name of the same failure (`REQUIRED_FIELD_MISSING`,
`STRING_TOO_LONG`, `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST`, `INVALID_EMAIL_ADDRESS`,
`INVALID_CROSS_REFERENCE_KEY`, `DUPLICATE_VALUE`, `INVALID_TYPE_ON_FIELD_IN_RECORD`,
`FIELD_INTEGRITY_EXCEPTION`, `INVALID_FIELD`). Two sources feed it: the global `ValidationPipe`
([`validation-exception.factory.ts`](src/common/errors/validation-exception.factory.ts)) for the DTO rules, and
[`PrismaExceptionFilter`](src/common/errors/prisma-exception.filter.ts) for rules that live only in Postgres
(CHECK → the column's field, FK → the lookup field, unique → `DUPLICATE_VALUE`, missing row → `404`).
Record-level failures (`output.errors`) carry no field, e.g. `GEOCODING_FAULT` (502) when the
Create_property geocoding call fails outright. Contract tests: `test/record-crud.e2e.spec.ts`.

## Apex → this service: concept map

| Salesforce / Apex concept | Equivalent here |
| --- | --- |
| `@AuraEnabled` static method (e.g. `PropertyController.getPagedPropertyList`) | A controller route (`@Get()/@Post()` in `*.controller.ts`) that delegates to the module service. Parameters become a validated DTO (`class-validator`), the return value a documented response DTO. `cacheable=true` → `GET` (cache headers later); non-cacheable → `POST`/`PATCH`/`DELETE`. |
| `@InvocableMethod` (`GeocodingService.geocodeAddresses`) | A plain service method, exposed as `POST /geocoding/addresses` (list in / list out, same contract as Apex) and `POST /geocode` (single address, for the UI). The Flow that invoked it (`Create_property`) is `POST /properties` with `geocode: true`: `GeocodingModule` exports the service so `PropertiesService` runs the `geocode_address` step inside the create/update. |
| **SOQL** (`[SELECT ... FROM Property__c WHERE ... LIMIT :n OFFSET :o]`) | Prisma queries: `prisma.property.findMany({ where, orderBy, take, skip })` / `prisma.property.count({ where })`. `LIKE :pattern` → `{ contains, mode: 'insensitive' }`; relationship queries → `include`/`select`. Anything SOQL cannot express the Prisma way → `prisma.$queryRaw` with tagged-template parameters. |
| **DML** (`insert`, `update`, `upsert`, `delete`, `Database.insert(records, false)`) | `prisma.<model>.create / update / upsert / delete` and the `createMany / updateMany / deleteMany` bulk forms. Partial-success DML (`allOrNone=false`) becomes an explicit loop collecting per-record results. |
| Implicit transaction per Apex request (rollback on uncaught exception) | `prisma.$transaction(async (tx) => { ... })` (interactive transaction) around multi-statement writes; Nest's exception filter turns thrown errors into HTTP error responses after the rollback. |
| **Trigger** (`before insert`, `after update`, …) on an object | No trigger exists in dreamhouse-lwc, but the home for one is the object's module service: synchronous "before" logic lives in the service method that performs the write (same transaction); "after" side effects become either explicit service calls in the same transaction or domain events (Nest `EventEmitter2`) handled asynchronously. Database-level invariants go into the Prisma migration as constraints. |
| **`Database.Batchable` / `Queueable` / `@future` / Scheduled Apex** | A Nest module without a controller that owns a job: run as an ECS one-off task or EventBridge-scheduled task, or `@nestjs/bullmq` (SQS/Redis) for queue semantics. `start()` → a cursor/keyset query, `execute(scope)` → process one page in a transaction, `finish()` → summary + notification. Chunking is explicit (`take`/`skip` or id cursors) instead of the 200-record scope. |
| Apex test classes (`@IsTest`, `Test.startTest()`, `HttpCalloutMock`) | Vitest specs (`*.spec.ts`). Unit tests mock `PrismaService`; HTTP tests use `@nestjs/testing` + supertest; outbound HTTP (Nominatim) is mocked with `vi.fn()` on `fetch`. Apex test classes are ported 1:1 as characterisation specs in `tests/parity/characterisation` (UNT3-15): they boot this app through `test/support/testing-app.ts` with `PrismaService` routed into a rolled-back transaction per test, mock Nominatim with MSW, and stay pending (`it.todo`) until the ticket that ports the Apex class lists itself in `tests/parity/characterisation/harness/ported.ts`. |
| `with sharing` / `WITH USER_MODE` / permission set `dreamhouse` / FLS | Request authentication + authorization in a Nest guard, and Prisma `where` clauses / `select` lists scoped by the caller's role (UNT3-20). Nothing is enforced by the database layer implicitly — it must be coded. |
| `PagedResult` Apex class | [`PagedResultDto`](src/common/dto/paged-result.dto.ts) (`pageSize`, `pageNumber`, `totalItemCount`, `records`). |
| `AuraHandledException` | Nest `HttpException` subclasses (`BadRequestException`, `NotFoundException`, …); the global exception filter formats them. [`NotPortedException`](src/common/not-ported.exception.ts) (501) marks endpoints not yet ported. |
| Lightning Data Service record pages / `lightning-record-form` (implicit create/read/update/delete + validation) | Explicit CRUD routes per object: `GET /properties/{id}`, `POST /properties`, `PATCH /properties/{id}`, `DELETE /properties/{id}` (same for `/brokers`; Contacts are read-only sample data). The schema-step rules (field sizes, `Beds__c`/`Baths__c` 0..99, restricted `Status__c` picklist, `Location__c` lat/lon pairing, lookups to existing records) are enforced server-side by the DTOs (`class-validator`) with the database CHECK/FK constraints as safety net. See [Field errors](#field-errors). |
| Screen flow (`Create_property`) | One `POST /properties` with the screens' inputs; `geocode: true` runs the `geocode_address` action (Nominatim) before the insert, the `create_property` assignments (`Status__c = Available`, `Date_Listed__c = $Flow.CurrentDate`) are applied when the body omits them. Fault connectors → `400` field errors / `502 GEOCODING_FAULT`, nothing inserted. Baseline: `tests/parity/fixtures/create-property-flow.ts`. Picture upload stays `POST /files` (UNT3-18), the screens are the React wizard (UNT3-23). |
| `Http` / `HttpRequest` callouts + Remote Site Settings / Named Credentials | A typed client class around Node `fetch` (`geocoding/nominatim.client.ts`): base URL, User-Agent, timeout, bounded retries and a 1 req/s limiter all from configuration (`GEOCODING_*`); results cached in the service (Nominatim usage policy). Egress is controlled by the VPC security groups in `infra/`. A non-200 answer still becomes `{lat: null, lon: null}` like the Apex code. |
| Custom Metadata / Custom Settings / Custom Labels | Typed config in `src/config` (env + Secrets Manager); UI strings live in `app/web`. |
| `ContentVersion` / `ContentDocumentLink` (Files) | S3 object + a `files` table row linking it to a record (`files` module): `FilesService.createFile` writes both in one transaction behind a `FileStorage` port (`S3FileStorage` in AWS, `LocalFileStorage` on disk); large files go straight to S3 with a pre-signed PUT and are finalised with their `uploadKey`. |
| Static resources (`sample_data_*`) | The same JSON bundled under `src/modules/sample-data/fixtures/` (keys renamed to the Prisma field names; a spec asserts they still equal the static resources), loaded by `SampleDataService` inside one transaction. The wipe-and-reload is admin-only and fenced by `SAMPLE_DATA_IMPORT_ENABLED`. |
| `System.debug` | Injected pino `Logger` (`this.logger.debug({ ... })`), structured JSON shipped to CloudWatch. |
| Governor limits (SOQL/DML per transaction, heap) | None, but the same rules of thumb apply: no queries in loops, bulk operations, pagination for large result sets; `ValidationPipe` + `ArrayMaxSize` cap request sizes. |
