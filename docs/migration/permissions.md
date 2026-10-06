# Permission matrix — `dreamhouse` permission set → Cognito groups + API guards

Plan step s4.6 (UNT3-20). Source of truth: `salesforce/force-app/main/default/permissionsets/dreamhouse.permissionset-meta.xml`
and the `<sharingModel>` of `objects/*/*.object-meta.xml`. Target: `app/api/src/auth/` (policy tables, guards,
interceptor) and `app/web/src/app/navigation.ts` (tab visibility). The tests below read the XML and fail if either side drifts.

| Salesforce | Target |
|---|---|
| Permission set `dreamhouse` (assigned to a Standard User) | Cognito user-pool group `dreamhouse` (`infra/modules/auth`) |
| System Administrator (View All / Modify All Data, Author Apex) | group `dreamhouse-admin` (superset; demo-only) |
| Session id / login | bearer access token: Cognito JWT (RS256, JWKS, `token_use=access`, `client_id`) → `AuthGuard`; missing/invalid → **401** `INVALID_SESSION_ID` |
| `<applicationVisibilities>` Dreamhouse | policy key `app.access`, required on every non-`@Public()` route; web `RequireAuth` → access-denied page |
| `<objectPermissions>` (CRUD, View All, Modify All) | `OBJECT_PERMISSIONS` in `policy.ts` → keys `<resource>.create/read/edit/delete`, checked by `PermissionsGuard` via `@RequirePermission(...)`; denied → **403** `INSUFFICIENT_ACCESS_OR_READONLY` (`permission` + `requiredGroups` in the body) |
| `<fieldPermissions>` (readable / editable) | `FIELD_PERMISSIONS` in `field-policy.ts`; `FieldSecurityInterceptor` (`@SfObjectAccess`) strips unreadable columns from responses and rejects a body containing a non-editable field with **403** `INVALID_FIELD_FOR_INSERT_UPDATE` (per-field `fieldErrors`) |
| `<classAccesses>` | `CLASS_ACCESS` in `policy.ts` → keys `<resource>.invoke` on the routes that replace the class' `@AuraEnabled` methods |
| `<tabSettings>` / app `<tabs>` | `requiredGroup` per tab in `navigation.ts`; `visibleTabs(groups)` renders the navbar, `RequireGroup` guards the route |
| `with sharing` + org-wide defaults | `sharing.ts`: `recordAccessWhere(principal, object)` is added to every query, `assertRecordAccess` to detail/update/delete; creates stamp `ownerId` / `createdBy` from the token |
| No group at all (user not assigned the permission set) | `app.access` fails → **403** on every route exactly where Salesforce shows *Insufficient privileges*; the web app shows the access-denied page instead of the tabs |

Auth modes (`AUTH_MODE`, `app/api/src/auth/auth.config.ts`): `cognito` (production, forced when `NODE_ENV=production`),
`test` (HS256 tokens minted by `app/api/test/support/test-users.ts` / `tests/parity/fixtures/users.ts`; the default under
`NODE_ENV=test`), `stub` (local dev: the web stub client's `stub-token-for-<user>`, groups from the username: `admin*` → both
groups, `guest*` → none, else `dreamhouse`).

## Group × object × operation

✅ allowed · ❌ 403 · (all) = no ownership filter (View All / Modify All, OWD Public Read/Write) · (own) = `ownerId = sub`.

| Object (OWD) | Operation | route | no group / other group | `dreamhouse` | `dreamhouse-admin` |
|---|---|---|---|---|---|
| Property__c (ReadWrite) | read | `GET /properties`, `GET /properties/{id}`, `GET /properties/{id}/pictures` | ❌ | ✅ (all) | ✅ (all) |
| | create | `POST /properties` | ❌ | ✅ | ✅ |
| | edit | `PATCH /properties/{id}` | ❌ | ✅ (all) | ✅ (all) |
| | delete | `DELETE /properties/{id}` | ❌ | ✅ (all) | ✅ (all) |
| Broker__c (ReadWrite) | read | `GET /brokers`, `GET /brokers/{id}` | ❌ | ✅ (all) | ✅ (all) |
| | create | `POST /brokers` | ❌ | ✅ | ✅ |
| | edit | `PATCH /brokers/{id}` | ❌ | ✅ (all) | ✅ (all) |
| | delete | `DELETE /brokers/{id}` | ❌ | ✅ (all) | ✅ (all) |
| Contact (ControlledByParent, no Account → Private) | read | `GET /contacts`, `GET /contacts/{id}` | ❌ | ✅ (own) | ✅ (all) |
| ContentDocument (ControlledByParent) | read | pictures of a property the caller can read | ❌ | ✅ | ✅ |
| | create | `POST /files` | ❌ | ❌ (`files.invoke`, see classes) | ✅ |

## Group × Apex class

| `<classAccesses>` | route | no group | `dreamhouse` | `dreamhouse-admin` | note |
|---|---|---|---|---|---|
| PropertyController (enabled) | `GET /properties`, `GET /properties/{id}/pictures` | ❌ | ✅ | ✅ | `properties.invoke` |
| PagedResult (enabled) | response shape of `GET /properties` | ❌ | ✅ | ✅ | `properties.invoke` |
| SampleDataController (enabled) | `POST /sample-data/import` | ❌ | ❌ | ✅ | **deviation**: `DEVIATIONS.sampleDataAdminOnly` — a demo user must not wipe/reload the data set |
| FileUtilities (not granted) | `POST /files` | ❌ | ❌ | ✅ | the permission set does not list the class; kept as-is (`files.invoke`) |
| GeocodingService (not granted; invocable action of the Create_property flow) | `POST /geocoding/addresses` | ❌ | ✅ | ✅ | **deviation**: the flow runs in system context, so `app.access` is enough (`geocoding.invoke`) |

## Hidden / read-only fields

Every field in `<fieldPermissions>` is readable+editable for both groups, except the formula fields, which Salesforce
only exposes `readable=true` / `editable=false`:

| Field | read | write (`POST`/`PATCH`) |
|---|---|---|
| `Broker__c.Picture_IMG__c` → `pictureImg` | ✅ | ❌ `INVALID_FIELD_FOR_INSERT_UPDATE` |
| `Property__c.Days_On_Market__c` → `daysOnMarket` | ✅ | ❌ |
| `Property__c.Picture_IMG__c` → `pictureImg` | ✅ | ❌ |
| `Property__c.Record_Link__c` → `recordLink` | ✅ | ❌ |
| `Property__c.Thumbnail_IMG__c` → `thumbnailImg` | ✅ | ❌ |

A caller with no read access to an object never reaches the serializer (403 first); a group with partial field access
(none today) gets the column removed from the JSON by `stripUnreadable`.

## Tabs (web)

| Tab | `<tabSettings>` | `requiredGroup` |
|---|---|---|
| Home, Contacts, Files (standard tabs of the app) | profile default | `dreamhouse` |
| Property_Explorer, Property_Finder, Property__c, Broker__c | Visible | `dreamhouse` |
| Settings | Visible | `dreamhouse-admin` — **deviation**, the tab only hosts the admin-only sample import |

## Evidence

- `app/api/src/auth/policy.spec.ts` — policy tables == permission-set XML (objects, fields, classes, app, tabs via web test), sharing model == object XML.
- `app/api/test/permissions.e2e.spec.ts` — group × object × operation matrix over the HTTP surface (expected result derived from the XML, not from `policy.ts`), hidden-field read/write cases, 401 cases (no / malformed / expired / wrong-issuer / wrong-secret token), admin-only operations, ownership columns and sharing filters.
- `app/web/src/app/navigation.test.ts`, `AppShell.test.tsx` — tab visibility vs `<tabSettings>`, access-denied page for a user without the group.
- `tests/parity/characterisation/permission-set.spec.ts` — the same denials/grants live against Postgres (scenario ids `permission-set-*` in `mapping.yaml`).
