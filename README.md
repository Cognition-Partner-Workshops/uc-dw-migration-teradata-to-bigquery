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
app/web/           Target web app — React
infra/             Terraform for AWS (account 599083837640, us-east-1)
tools/             Extraction / load / helper scripts
tests/parity/      Parity tests run live against both the Salesforce org and the target app
docs/migration/    Migration docs; docs/migration/mapping.yaml is the 1:1 mapping matrix
.github/workflows/ CI for this branch
```

`app/api`, `app/web` and `infra/` are intentionally empty here; they are filled by
the later migration tickets.

## Mapping matrix

[`docs/migration/mapping.yaml`](docs/migration/mapping.yaml) is the single source of
truth for the 1:1 mapping from every Salesforce artifact to its target
(Postgres table/column, API endpoint, React component, infra resource). Every PR
that touches an artifact must keep it current.

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
