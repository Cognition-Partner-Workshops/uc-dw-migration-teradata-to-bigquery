# Dreamhouse web (`app/web`)

React re-implementation of the Salesforce **Dreamhouse** Lightning app
([`salesforce/`](../../salesforce/), frozen). Vite 7 + React 18 + TypeScript, React Router,
TanStack Query, [Mantine](https://mantine.dev) (record pages, data tables, forms, modals),
Leaflet 1.9.4 (the same library the Salesforce app ships as the `leafletjs` static
resource), Vitest + Testing Library. Node 22.

```bash
npm ci && cp .env.example .env
npm run dev          # http://localhost:5173 — proxies /api/* to the API on :3000 (VITE_DEV_API_PROXY)
npm test             # Vitest + Testing Library (jsdom)
npm run lint         # eslint + prettier --check
npm run build        # tsc -b && vite build  -> dist/
npm run api:generate # regenerate the typed API client from ../api/openapi/openapi.json
```

## Layout

| Path | What |
| --- | --- |
| `src/app/tabs.ts` | **Navigation config.** One entry per `<tabs>` of `Dreamhouse.app-meta.xml`, in the same order; the shell renders from this list and a test asserts it matches the Salesforce metadata. |
| `src/app/routes.tsx` | React Router tree: `/login` + everything else behind `RequireAuth` inside the `AppShell`. |
| `src/app/theme.ts`, `providers.tsx`, `query-client.ts` | Mantine theme (Dreamhouse green `#86BD4A` from the app metadata), provider stack, QueryClient defaults. |
| `src/api/schema.d.ts` | **Generated** OpenAPI types (`npm run api:generate`); do not edit. |
| `src/api/client.ts`, `queries.ts` | `openapi-fetch` client typed by the schema (adds the auth bearer), TanStack `queryOptions` / query keys. |
| `src/auth/` | `AuthClient` interface with two implementations: `stub-auth-client.ts` (local, any username/password) and `cognito-auth-client.ts` (`amazon-cognito-identity-js`, USER_SRP_AUTH). `auth-client.ts` picks one from `VITE_AUTH_MODE`. |
| `src/components/AppShell.tsx` | Header + navbar rendered from `appTabs`, user menu, live `GET /health` badge. |
| `src/components/MapView.tsx` | Leaflet map wrapper (OpenStreetMap tiles, markers) for the propertyMap / propertyListMap / propertyLocation replacements. |
| `src/pages/` | One page per tab/record page. Pages whose LWCs are not ported yet render `MigrationPlaceholder` naming the Salesforce sources and the owning ticket. |
| `scripts/generate-api-client.mjs` | The one API-client script (`--check` mode is used in CI). |

## Typed API client

`npm run api:generate` reads the API's committed OpenAPI document
([`app/api/openapi/openapi.json`](../api/openapi/openapi.json)) with `openapi-typescript` and
writes `src/api/schema.d.ts`; `openapi-fetch` uses those types so `api.GET('/properties', …)`
is checked against the real paths, parameters and DTOs. Point it at a running API with
`npm run api:generate -- http://localhost:3000/openapi.json`. CI runs
`npm run api:generate -- --check` so the generated file can never drift from the spec.

## Authentication

| `VITE_AUTH_MODE` | Behaviour |
| --- | --- |
| `stub` (default, `.env.example`) | No network. Any non-empty username/password signs in; the session lives in `localStorage` and the API gets `Authorization: Bearer stub-token-for-<user>`. The login page and header say so. |
| `cognito` | Cognito user pool via `amazon-cognito-identity-js`. Requires `VITE_COGNITO_USER_POOL_ID` and `VITE_COGNITO_CLIENT_ID` (set by the infra ticket); the access token JWT is sent to the API. |

## Salesforce → web mapping

| Salesforce | Here |
| --- | --- |
| `Dreamhouse` Lightning app, `<tabs>` | `src/app/tabs.ts` → `AppShell` navbar |
| `Property_Explorer` / `Property_Finder` Lightning pages | `/property-explorer`, `/property-finder` (Leaflet `MapView`; LWC ports in UNT3-21) |
| `Property__c` / `Broker__c` tabs and record pages, `Contact`, Files, `Settings` page | `/properties(/:id)`, `/brokers(/:id)`, `/contacts`, `/files`, `/settings` (UNT3-22) |
| Salesforce login | `/login` (Cognito, stubbed locally) |
| `leafletjs` static resource | `leaflet` npm package 1.9.4 |

The full matrix is [`docs/migration/mapping.yaml`](../../docs/migration/mapping.yaml).
