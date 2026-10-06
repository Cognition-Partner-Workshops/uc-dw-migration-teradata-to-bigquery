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

Everything else currently answers `501 Not Implemented` with the Apex source and the
ticket that ports it, e.g. `GET /properties` → `{"apexSource":"PropertyController.getPagedPropertyList","ticket":"UNT3-16"}`.

Useful scripts:

| Script | What |
| --- | --- |
| `npm test` / `npm run test:cov` | Vitest unit + HTTP tests (no database needed) |
| `npm run build` | `nest build` → `dist/` (`npm start` runs `node dist/main.js`) |
| `npm run lint` / `npm run format` | eslint (typescript-eslint) / prettier |
| `npm run openapi:export` | Writes [`openapi/openapi.json`](openapi/openapi.json) without starting a server; CI fails if it drifts from the controllers |
| `npm run prisma:migrate` | `prisma migrate dev` — create/apply a migration locally |
| `npm run prisma:deploy` | `prisma migrate deploy` — apply committed migrations (CI/CD, ECS one-off task) |

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
| `AWS_REGION` | `us-east-1` | Region for Secrets Manager |
| `AWS_SECRETS_MANAGER_SECRET_ID` | — | Optional secret to overlay |

## Layout — one Nest module per Salesforce object / Apex domain

The module layout mirrors [`docs/migration/mapping.yaml`](../../docs/migration/mapping.yaml)
so every Apex class has an obvious home:

```
src/
  main.ts                    bootstrap (listen, OpenAPI)
  app.module.ts              wires platform + domain modules
  app.factory.ts             createApp()/configureApp(): validation pipe, pino logger, shutdown hooks
  config/                    zod schema, env + Secrets Manager loader, AppConfigService
  logging/                   nestjs-pino LoggerModule
  prisma/                    PrismaService (PrismaClient + pg adapter), global PrismaModule
  health/                    GET /health, GET /health/ready
  openapi/                   DocumentBuilder config, tag list, /openapi.json + /docs setup
  common/                    PagedResultDto (Apex PagedResult), pagination query, NotPortedException
  modules/
    properties/              Property__c  — PropertyController (+ TestPropertyController)
    brokers/                 Broker__c    — brokerCard / Broker record page (LDS, no Apex)
    contacts/                Contact      — standard object, sample data only
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

## Apex → this service: concept map

| Salesforce / Apex concept | Equivalent here |
| --- | --- |
| `@AuraEnabled` static method (e.g. `PropertyController.getPagedPropertyList`) | A controller route (`@Get()/@Post()` in `*.controller.ts`) that delegates to the module service. Parameters become a validated DTO (`class-validator`), the return value a documented response DTO. `cacheable=true` → `GET` (cache headers later); non-cacheable → `POST`/`PATCH`/`DELETE`. |
| `@InvocableMethod` (`GeocodingService.geocodeAddresses`) | A plain service method, exposed as `POST /geocoding/addresses` (list in / list out, same contract as Apex) and `POST /geocode` (single address, for the UI); the Flow that invoked it becomes React UI calling that route (UNT3-19). `GeocodingModule` exports the service so `PropertiesModule` can geocode on create/update. |
| **SOQL** (`[SELECT ... FROM Property__c WHERE ... LIMIT :n OFFSET :o]`) | Prisma queries: `prisma.property.findMany({ where, orderBy, take, skip })` / `prisma.property.count({ where })`. `LIKE :pattern` → `{ contains, mode: 'insensitive' }`; relationship queries → `include`/`select`. Anything SOQL cannot express the Prisma way → `prisma.$queryRaw` with tagged-template parameters. |
| **DML** (`insert`, `update`, `upsert`, `delete`, `Database.insert(records, false)`) | `prisma.<model>.create / update / upsert / delete` and the `createMany / updateMany / deleteMany` bulk forms. Partial-success DML (`allOrNone=false`) becomes an explicit loop collecting per-record results. |
| Implicit transaction per Apex request (rollback on uncaught exception) | `prisma.$transaction(async (tx) => { ... })` (interactive transaction) around multi-statement writes; Nest's exception filter turns thrown errors into HTTP error responses after the rollback. |
| **Trigger** (`before insert`, `after update`, …) on an object | No trigger exists in dreamhouse-lwc, but the home for one is the object's module service: synchronous "before" logic lives in the service method that performs the write (same transaction); "after" side effects become either explicit service calls in the same transaction or domain events (Nest `EventEmitter2`) handled asynchronously. Database-level invariants go into the Prisma migration as constraints. |
| **`Database.Batchable` / `Queueable` / `@future` / Scheduled Apex** | A Nest module without a controller that owns a job: run as an ECS one-off task or EventBridge-scheduled task, or `@nestjs/bullmq` (SQS/Redis) for queue semantics. `start()` → a cursor/keyset query, `execute(scope)` → process one page in a transaction, `finish()` → summary + notification. Chunking is explicit (`take`/`skip` or id cursors) instead of the 200-record scope. |
| Apex test classes (`@IsTest`, `Test.startTest()`, `HttpCalloutMock`) | Vitest specs (`*.spec.ts`). Unit tests mock `PrismaService`; HTTP tests use `@nestjs/testing` + supertest; outbound HTTP (Nominatim) is mocked with `vi.fn()` on `fetch`. Apex test classes are ported 1:1 as characterisation specs in `tests/parity/characterisation` (UNT3-15): they boot this app through `test/support/testing-app.ts` with `PrismaService` routed into a rolled-back transaction per test, mock Nominatim with MSW, and stay pending (`it.todo`) until the ticket that ports the Apex class lists itself in `tests/parity/characterisation/harness/ported.ts`. |
| `with sharing` / `WITH USER_MODE` / permission set `dreamhouse` / FLS | Request authentication + authorization in a Nest guard, and Prisma `where` clauses / `select` lists scoped by the caller's role (UNT3-20). Nothing is enforced by the database layer implicitly — it must be coded. |
| `PagedResult` Apex class | [`PagedResultDto`](src/common/dto/paged-result.dto.ts) (`pageSize`, `pageNumber`, `totalItemCount`, `records`). |
| `AuraHandledException` | Nest `HttpException` subclasses (`BadRequestException`, `NotFoundException`, …); the global exception filter formats them. [`NotPortedException`](src/common/not-ported.exception.ts) (501) marks endpoints not yet ported. |
| `Http` / `HttpRequest` callouts + Remote Site Settings / Named Credentials | A typed client class around Node `fetch` (`geocoding/nominatim.client.ts`): base URL, User-Agent, timeout, bounded retries and a 1 req/s limiter all from configuration (`GEOCODING_*`); results cached in the service (Nominatim usage policy). Egress is controlled by the VPC security groups in `infra/`. A non-200 answer still becomes `{lat: null, lon: null}` like the Apex code. |
| Custom Metadata / Custom Settings / Custom Labels | Typed config in `src/config` (env + Secrets Manager); UI strings live in `app/web`. |
| `ContentVersion` / `ContentDocumentLink` (Files) | S3 object + a `files` table row linking it to a record (`files` module). |
| Static resources (`sample_data_*`) | JSON fixtures loaded by the `sample-data` module. |
| `System.debug` | Injected pino `Logger` (`this.logger.debug({ ... })`), structured JSON shipped to CloudWatch. |
| Governor limits (SOQL/DML per transaction, heap) | None, but the same rules of thumb apply: no queries in loops, bulk operations, pagination for large result sets; `ValidationPipe` + `ArrayMaxSize` cap request sizes. |
