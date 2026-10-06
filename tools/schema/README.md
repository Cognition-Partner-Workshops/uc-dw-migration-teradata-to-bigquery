# tools/schema — Salesforce field → Postgres column mapping

`schema_mapping.py` generates [`docs/migration/schema-mapping.md`](../../docs/migration/schema-mapping.md):
every Salesforce field of every ported object, the column it became, the Postgres type,
nullability, the Prisma field, plus the enums, foreign keys, CHECK constraints, views and
triggers that implement the type rules. Python 3.10+ and PyYAML, nothing else.

```
python3 tools/schema/schema_mapping.py --render   # rewrite schema-mapping.md
python3 tools/schema/schema_mapping.py --check    # CI: consistency + md current (exit 2 on inconsistency, 1 when stale)
python3 -m unittest tools/schema/test_schema_mapping.py
```

## Inputs

| Input | Used for |
| --- | --- |
| `docs/migration/inventory.json` | the Salesforce objects and their fields (type, length, precision, formula, lookup target) |
| `docs/migration/mapping.yaml` | which table each object row targets and which `table.column` (or view column / component / route) each field row targets |
| `app/api/prisma/schema.prisma` | tables (`@@map`), columns (`@map`), native types (`@db.*`), enums, relations (`onDelete`), indexes |
| `app/api/prisma/migrations/*/migration.sql` | hand-written `ALTER TABLE ... ADD CONSTRAINT ... CHECK`, `CREATE VIEW`, `CREATE TRIGGER`; the `--` comment above each statement becomes its "Mirrors"/"Purpose" column |

## Checks

`--check` fails when

- a `mapping.yaml` row targets `table.column` and the Prisma model mapped to `table` has no column with that `@map`,
- a Prisma column other than `id`, `sf_id`, `name` and the audit columns is not claimed by a Salesforce field (a mapping row, a Geolocation pair or the standard Contact field list),
- an object row with status ≥ `ported` targets a table with no Prisma model (tables still `mapped` are listed as pending instead),
- the committed `schema-mapping.md` differs from what `--render` would write.

Standard objects (Contact) have no inventory fields; their Salesforce field names and types
come from `CONTACT_FIELDS` in the script. Add to it when the `contacts` model grows.
