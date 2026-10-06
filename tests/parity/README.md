# tests/parity

Parity harness of the Salesforce → React + NestJS/Postgres migration. Today it holds the
**characterisation specs**: every Apex test class ported 1:1 to a Vitest suite that pins the
same behaviour against the target API (plan step s4.1, ticket UNT3-15). The Playwright E2E
scenarios that run live against both apps land here with UNT3-24.

| Apex test class (`salesforce/force-app/main/default/classes`) | Spec                                                                                                 | Target surface                                     | Turns green with |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- |
| `TestPropertyController`                                      | [`characterisation/property-controller.spec.ts`](characterisation/property-controller.spec.ts)       | `GET /properties`, `GET /properties/{id}/pictures` | UNT3-16          |
| `GeocodingServiceTest`                                        | [`characterisation/geocoding-service.spec.ts`](characterisation/geocoding-service.spec.ts)           | `POST /geocoding/addresses`                        | UNT3-17          |
| `FileUtilitiesTest`                                           | [`characterisation/file-utilities.spec.ts`](characterisation/file-utilities.spec.ts)                 | `POST /files`                                      | UNT3-18          |
| `TestSampleDataController`                                    | [`characterisation/sample-data-controller.spec.ts`](characterisation/sample-data-controller.spec.ts) | `POST /sample-data/import`                         | UNT3-18          |

Each `spec('<apexTestMethod>', …)` carries the Apex method and line of every fixture, call and
assertion as a comment (`// line 70: Assert.areEqual(5, result.records.size())`), so a failing
expectation points straight back at the source. The complete matrix, with one row per Apex
test method, is `docs/migration/mapping.yaml` (ids `apexMethod:<TestClass>.<method>`).

## How the Apex test runtime maps

| Apex                                                     | Here                                                                                                                                                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test transaction rolled back after each `@isTest` method | `useApiTestContext()` opens an interactive Prisma transaction per test and rolls it back; the booted Nest app's `PrismaService` is proxied onto it (`characterisation/harness/transactional-prisma.ts`)                          |
| `@TestSetup` / `insert new Property__c(...)`             | `fixtures/properties.ts` (`createProperties(prisma, 5)` = `TestPropertyController.createProperties`), `fixtures/files.ts` (`createPicture(prisma, …)` = `insert ContentVersion` + `insert ContentDocumentLink`, one `files` row) |
| `Test.setMock(HttpCalloutMock.class, …)`                 | MSW handlers for Nominatim in `mocks/nominatim.ts` (`nominatimSuccess()`, `nominatimError()`); they also record the intercepted calls so "no callout" cases can be asserted                                                      |
| `System.runAs(testUser)`                                 | `.set(asUser(standardUser))`: a bearer token for a user in the matching Cognito group, minted with `AUTH_TEST_JWT_SECRET` (`fixtures/users.ts`); the API guard (UNT3-20) accepts these in `NODE_ENV=test`                        |
| `System.assertEquals` / `Assert.*`                       | `expect(...)`                                                                                                                                                                                                                    |
| `AuraHandledException`                                   | an HTTP 4xx from the endpoint                                                                                                                                                                                                    |

## Pending vs. live suites

Suites go live one port at a time. `characterise('<ApexTestClass>', '<ticket>')`
returns `it` once the ticket is listed in `characterisation/harness/ported.ts`, and `it.todo`
until then, so:

- `npm test` (what `make test` and CI run) reports pending suites as **todo** and stays green;
- `npm run test:all` (`PARITY_RUN_ALL=1`, `make characterise`, the informational CI step) runs
  everything and shows the current red baseline.

A port ticket (UNT3-16/17/18) adds itself to `PORTED_TICKETS`; from then on its suite is a
required check. Live today: `TestPropertyController` (UNT3-16), `FileUtilitiesTest` and
`TestSampleDataController` (UNT3-18).

## Running locally

Through docker-compose (no local Node needed): `make up && make migrate && make test`, or
`make characterise` for the full run. Natively: install `app/api` first (the specs boot it
in-process through the `file:../../app/api` link), point `DATABASE_URL` at a migrated Postgres
and run Vitest:

```bash
(cd app/api && npm ci && npm run prisma:deploy)
cd tests/parity && npm ci
npm test              # pending suites as todo
npm run test:all      # everything, red until the ports land
npm run lint && npm run typecheck && npm run format:check
```

`vitest.setup.ts` defaults `DATABASE_URL` to the compose database and `GEOCODING_BASE_URL` to
Nominatim, the URL the MSW handlers intercept.
