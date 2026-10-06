# Salesforce → React + Postgres on AWS (demo)

This orphan branch (`salesforce-to-aws-demo`) hosts a migration demo: a Salesforce
application is re-implemented as a React web app with a TypeScript API on
PostgreSQL, deployed to AWS. It shares no history with `main` of this repository
(an unrelated Teradata → BigQuery project); all work lands here via PRs targeting
`salesforce-to-aws-demo`.

## The source application

The source is the open-source Salesforce sample app
[trailheadapps/dreamhouse-lwc](https://github.com/trailheadapps/dreamhouse-lwc)
(a real-estate listings app), imported **unchanged** under [`salesforce/`](salesforce/)
as a git subtree pinned to upstream commit
[`119e53db0138ca7be3e2d3e4e75f3447e616c535`](https://github.com/trailheadapps/dreamhouse-lwc/tree/119e53db0138ca7be3e2d3e4e75f3447e616c535)
(2026-10-01). Nothing under `salesforce/` is edited by the migration; it is the
frozen "before" state the target is proven against.

What it contains (see the [mapping matrix](docs/migration/mapping.yaml) for the full inventory):

| Salesforce artifact | Summary |
| --- | --- |
| Custom objects | `Property__c` (24 custom fields incl. geolocation, status, pricing dates) and `Broker__c` (7 custom fields) |
| Apex | `PropertyController`, `GeocodingService`, `SampleDataController`, `FileUtilities`, `PagedResult` + 4 test classes |
| Lightning Web Components | 17 LWCs (property list/tile/map/filter/carousel, broker card, paginator, sample-data importer, …) + 1 Aura page template |
| Flow | `Create_property` screen flow |
| Security | `dreamhouse` permission set, CSP trusted sites and a remote site setting for OpenStreetMap geocoding |
| UI shell | `Dreamhouse` app, 5 tabs, 5 Lightning pages, 2 page layouts, 2 Lightning Message Channels, in-app prompts |
| Static resources | Leaflet.js, sample JSON data (brokers, properties, contacts) |
| Sample data | `salesforce/data/*.json` + `sample-data-plan.json` for `sf data import tree` |

## Repository layout

```
salesforce/        Source SFDX project (trailheadapps/dreamhouse-lwc, pinned; read-only)
app/api/           Target API — TypeScript, NestJS + Prisma on PostgreSQL (ECS Fargate + ALB)
app/web/           Target web app — React 18 + Vite + TypeScript (Mantine, React Router, TanStack Query, Leaflet)
infra/             Terraform for AWS (account 599083837640, us-east-1)
tools/             Extraction / load / helper scripts; tools/inventory/ generates docs/migration/inventory.{json,md},
                   tools/mapping/ owns mapping.yaml, tools/schema/ generates schema-mapping.md from the Prisma schema
tests/parity/      Apex tests ported as characterisation specs (characterisation/) + parity/E2E suite
docs/migration/    Migration docs; docs/migration/mapping.yaml is the 1:1 mapping matrix
.github/workflows/ CI for this branch
```

`infra/` holds the Terraform for the AWS demo environment (`make infra-up` / `make infra-plan` /
`make infra-destroy`; details in [`infra/README.md`](infra/README.md)).

CI/CD: every PR runs lint + unit tests for the API and the web app, the Prisma migrations against
a Postgres service container, the mapping/schema/inventory checks and `terraform fmt/validate/plan`
([`infra.yml`](.github/workflows/infra.yml)). Every push to `salesforce-to-aws-demo` that touches
the apps runs [`deploy.yml`](.github/workflows/deploy.yml): API image → ECR, `prisma migrate deploy`
as a one-off ECS task, ECS service roll-out, SPA → S3 + CloudFront invalidation, smoke checks.
GitHub reaches AWS through the OIDC roles Terraform creates in `infra/modules/cicd`; no AWS keys
are stored in GitHub.

## Local development (docker-compose)

The root [`docker-compose.yml`](docker-compose.yml) + [`Makefile`](Makefile) run the whole
target stack locally: Postgres 16, the API with hot reload and the web app with HMR. You need
Docker (Compose v2) and GNU make — no local Node or Postgres. This is the environment the
workers and the E2E suite use until the AWS environment exists.

```bash
make up          # build the dev images, start db + api + web, wait until all are healthy
make migrate     # prisma migrate deploy: apply app/api/prisma/migrations to the local database
make seed        # load data/migrated/ (the migrated data set; empty until UNT3-12/13 fill it)
make test        # API and web unit tests + Apex characterisation specs (pending suites report as todo)
make characterise # run every characterisation spec for real: the red baseline the Apex ports turn green
make e2e         # smoke-check the running stack, then run the Playwright suite once it exists (UNT3-24)
```

After `make up && make migrate`: API at <http://localhost:3000/health> (`/health/ready` also
pings Postgres, `/docs`, `/openapi.json`), web at <http://localhost:5173> (its `/api` proxies to
the API). The source trees are bind-mounted into the containers: saving under `app/api/src`
restarts Nest, saving under `app/web/src` hot-reloads the browser. `node_modules` live in named
volumes seeded from the images and are reinstalled automatically when a `package-lock.json`
changes. Containers run as your uid/gid, so generated files stay yours — always drive the stack
through `make` (or `export DEV_UID=$(id -u) DEV_GID=$(id -g)` before calling `docker compose`
yourself), otherwise the containers fall back to uid 1000 and cannot write `src/generated/`.

Other targets (`make help` lists them): `make smoke` (what `make e2e` runs first —
[`tools/dev/smoke.sh`](tools/dev/smoke.sh)), `make lint`, `make logs`, `make psql`,
`make migrate-status`, `make migrate-dev NAME=<name>` (new migration from `schema.prisma`), `make openapi` (re-export
the spec and regenerate the web client), `make down`, `make reset` (also drops the database and
`node_modules` volumes), `make clean` (also removes the images). Ports move with `API_PORT`,
`WEB_PORT` and `DB_PORT` — e.g. `echo DB_PORT=5433 > .env` when a local Postgres already owns
5432 (the root `.env` is read by compose and git-ignored). [`compose.yml`](.github/workflows/compose.yml)
runs `make up && make migrate`, the smoke checks, `make seed` and `make test` on a clean checkout
in CI.

## Target API (`app/api`)

[`app/api`](app/api/) is the NestJS + Prisma service (Node 20, TypeScript). It is laid
out as one Nest module per Salesforce object / Apex domain (`properties`, `brokers`,
`contacts`, `files`, `geocoding`, `sample-data`) so every Apex class has an obvious home;
its [README](app/api/README.md) maps Apex concepts (triggers, SOQL, DML, `@AuraEnabled`,
`Database.Batchable`, …) to their equivalents in the service.

```bash
cd app/api && npm ci && cp .env.example .env
npm test && npm run build      # Vitest, nest build
npm run start:dev              # GET /health, GET /health/ready, GET /openapi.json, GET /docs
```

[`api.yml`](.github/workflows/api.yml) lints, tests, builds, checks that
[`app/api/openapi/openapi.json`](app/api/openapi/openapi.json) matches the controllers
and smoke-tests `/health` and `/openapi.json` on every PR touching `app/api`.

## Target web app (`app/web`)

[`app/web`](app/web/) is the React 18 + Vite + TypeScript app (Node 22) with Mantine,
React Router, TanStack Query and Leaflet 1.9.4 (the same library the Salesforce app ships
as a static resource). Its shell renders the navigation from
[`src/app/navigation.ts`](app/web/src/app/navigation.ts), one entry per tab of the `Dreamhouse`
Lightning app (a test asserts the list matches `Dreamhouse.app-meta.xml`), and the login
page talks to Cognito (`VITE_AUTH_MODE=cognito`) or a local stub (default). The API client
is generated from the API's OpenAPI document by one script; see the
[README](app/web/README.md).

```bash
cd app/web && npm ci && cp .env.example .env
npm run api:generate           # typed client from ../api/openapi/openapi.json
npm test && npm run lint && npm run build
npm run dev                    # http://localhost:5173, proxies /api -> localhost:3000
```

[`web.yml`](.github/workflows/web.yml) checks the generated client is in sync, lints, tests,
builds and smoke-tests the built shell on every PR touching `app/web` or the OpenAPI spec.

## Mapping matrix

[`docs/migration/permissions.md`](docs/migration/permissions.md) is the permission matrix (permission set → Cognito groups → API guards).
[`docs/migration/mapping.yaml`](docs/migration/mapping.yaml) is the single source of
truth for the 1:1 mapping from every Salesforce artifact to its target
(Postgres table/column, API endpoint, React component, infra resource), one row per
inventory id with `target`, `disposition`, `status` and `parity_tests`; the rendered
view is [`mapping.md`](docs/migration/mapping.md). Every PR that touches an artifact
must keep it current: `python3 tools/mapping/mapping.py --check` runs in CI and fails
unless every inventory id appears exactly once, target names follow the conventions
and `mapping.md` is regenerated (`--render`). See [`tools/mapping`](tools/mapping/README.md).

## Schema mapping

[`docs/migration/schema-mapping.md`](docs/migration/schema-mapping.md) is generated by
`python3 tools/schema/schema_mapping.py --render` from the inventory, `mapping.yaml`,
[`app/api/prisma/schema.prisma`](app/api/prisma/schema.prisma) and the migrations: every
Salesforce field → Postgres column with its type, plus enums, foreign keys, CHECK
constraints, views and triggers. CI runs `--check`, which also fails when a mapped column
is missing from the Prisma schema. See [`tools/schema`](tools/schema/README.md).

## Artifact inventory

[`docs/migration/inventory.json`](docs/migration/inventory.json) (summary:
[`inventory.md`](docs/migration/inventory.md)) is generated by
`python3 tools/inventory/inventory.py` and lists every object, field, Apex method
(with SOQL/DML/callouts), LWC/Aura dependency, flow, page, tab, permission set and
integration setting under `force-app`. The script asserts that no file under
`force-app` is missing and CI runs `--check` to keep the committed output current.

## Validating the Salesforce source

The imported metadata is validated offline (no org required):

```bash
cd salesforce
npm ci --ignore-scripts
sf project convert source --output-dir /tmp/mdapi-out   # 19 metadata types in package.xml
npm run lint && npm run test:unit                       # 17 LWC jest suites, 83 tests
```

With an authenticated org (`SF_USERNAME` / `SF_PASSWORD` / `SF_INSTANCE_URL`, never
committed) the same metadata can be check-only deployed with
`sf project deploy validate --source-dir force-app --test-level RunLocalTests`.

The GitHub Actions workflow
[`salesforce-source.yml`](.github/workflows/salesforce-source.yml) runs the offline
checks on every PR to `salesforce-to-aws-demo`.

## Decisions already made

- Source app: trailheadapps/dreamhouse-lwc (above).
- API: TypeScript, NestJS + Prisma; runs on ECS Fargate behind an ALB.
- Data is extracted from the live Salesforce org; parity tests run live against both apps.
