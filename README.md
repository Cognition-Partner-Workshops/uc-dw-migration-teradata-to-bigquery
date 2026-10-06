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
tools/             Extraction / load / helper scripts; tools/inventory/ generates docs/migration/inventory.{json,md}
tests/parity/      Parity tests run live against both the Salesforce org and the target app
docs/migration/    Migration docs; docs/migration/mapping.yaml is the 1:1 mapping matrix
.github/workflows/ CI for this branch
```

`infra/` is intentionally empty here; it is filled by the later migration tickets.

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
[`src/app/tabs.ts`](app/web/src/app/tabs.ts), one entry per tab of the `Dreamhouse`
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

[`docs/migration/mapping.yaml`](docs/migration/mapping.yaml) is the single source of
truth for the 1:1 mapping from every Salesforce artifact to its target
(Postgres table/column, API endpoint, React component, infra resource). Every PR
that touches an artifact must keep it current.

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
