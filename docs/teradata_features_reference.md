# Teradata Features Used in This Data Warehouse

This document catalogs the Teradata-specific SQL features used throughout the
codebase, with notes on the **BigQuery (GoogleSQL)** equivalent for migration
planning. It is the reference the conversion work and the parity harness lean on.

## DDL Features

| Feature | Where Used | BigQuery Migration Notes |
|---------|-----------|--------------------------|
| `CREATE SET TABLE` | Dimension tables | BigQuery has no SET/MULTISET concept; all tables allow duplicates. Use plain `CREATE TABLE`. Enforce uniqueness with dedup queries or `QUALIFY`. |
| `CREATE MULTISET TABLE` | Fact tables | Direct mapping to `CREATE TABLE`. |
| `NO FALLBACK` / `NO BEFORE/AFTER JOURNAL` / `CHECKSUM` / `MERGEBLOCKRATIO` | All tables | No equivalent. Remove — BigQuery storage durability/replication is managed. |
| `PRIMARY INDEX (PI)` | All tables | No equivalent. Consider `CLUSTER BY` on frequently filtered columns. |
| `UNIQUE PRIMARY INDEX (UPI)` | Dimension tables | No enforced PK. Document the key; dedup with `QUALIFY ROW_NUMBER()`. |
| `PARTITION BY RANGE_N(date EACH INTERVAL '1' MONTH)` | Fact tables | Use `PARTITION BY DATE_TRUNC(<date>, MONTH)` or `PARTITION BY <date>` (BigQuery partitions daily/monthly/yearly natively). |
| `COMPRESS (val, ...)` on columns | Many columns | Remove. BigQuery applies columnar compression automatically. |
| `NOT CASESPECIFIC` | VARCHAR columns | BigQuery `STRING` comparisons are case-sensitive. Normalize with `LOWER()`/`UPPER()` where case-insensitive matching is required. |
| `FORMAT 'YYYY-MM-DD'` / `FORMAT 'ZZZ,ZZ9.99'` on columns | DATE/DECIMAL columns | No column-level format. Format on read with `FORMAT_DATE()` / `FORMAT()`. |
| `GENERATED ALWAYS AS IDENTITY` | Surrogate keys | BigQuery has no IDENTITY. Use `GENERATE_UUID()`, a hash key, or a load-time sequence. |
| `COLLECT STATISTICS` | After `CREATE TABLE` | Remove — BigQuery maintains statistics automatically. |
| `COMMENT ON TABLE/COLUMN` | All tables | Use the `OPTIONS(description=...)` clause on the table/column. |
| `DECIMAL(15,2)` | Amount columns | Map to `NUMERIC` (38,9) or `BIGNUMERIC` for exact decimal money. |
| `BYTEINT` | Flag columns | Map to `INT64` (or `BOOL` for true 0/1 flags). |

## DML Features

| Feature | Where Used | BigQuery Migration Notes |
|---------|-----------|--------------------------|
| `SEL` (shorthand for SELECT) | Views, procedures, macros | Replace with `SELECT`. |
| `QUALIFY` | Views, procedures | Supported natively in GoogleSQL. |
| `ZEROIFNULL(x)` / `NULLIFZERO(x)` | Views, procedures | Use `IFNULL(x, 0)` and `NULLIF(x, 0)`. |
| `HASHROW(...)` | Regulatory view, validation | Use `FARM_FINGERPRINT(TO_JSON_STRING(...))` or `FARM_FINGERPRINT(CONCAT(...))`. |
| `SAMPLE n` | Customer history macro | Use `TABLESAMPLE SYSTEM (p PERCENT)` or `ORDER BY RAND() LIMIT n`. |
| `CSUM(x, sortkey)` | Branch performance view | `SUM(x) OVER (ORDER BY sortkey ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`. |
| `MAVG(x, n, sortkey)` | Branch performance view | `AVG(x) OVER (ORDER BY sortkey ROWS BETWEEN (n-1) PRECEDING AND CURRENT ROW)`. **MAVG(x,3) = 3 rows (current + 2 preceding), not 4.** |
| `LOCKING ROW FOR ACCESS` | All views | Remove — BigQuery has no read locks. |
| `FORMAT` in SELECT | Reports, macros | Use `FORMAT()` / `FORMAT_DATE()` for display. |
| `ACTIVITY_COUNT` | Stored procedures | Use `@@row_count` in BigQuery scripting. |
| `VOLATILE TABLE` | Monthly snapshot proc | Use a `TEMP TABLE` inside a BigQuery script, or a CTE. |
| `REPLACE PROCEDURE` | Stored procedures | Use `CREATE OR REPLACE PROCEDURE` (BigQuery scripting / SQL). |
| `REPLACE MACRO` | Macros | No macro construct. Convert to a procedure or a parameterized table function (`CREATE TABLE FUNCTION`). |
| `MERGE INTO` | SCD2, snapshot procedures | Supported in BigQuery with the same `MERGE` syntax. |
| `CAST(... AS DATE FORMAT ...)` | Various | Use `PARSE_DATE(format, str)` / `SAFE.PARSE_DATE`. |
| `ADD_MONTHS(d, n)` | Snapshot procedure | Use `DATE_ADD(d, INTERVAL n MONTH)`. |
| `CURRENT_DATE - n` (date arithmetic) | Views | Use `DATE_SUB(CURRENT_DATE(), INTERVAL n DAY)`. |
| `a || b` (concat) | Views, macros | Supported in GoogleSQL, or use `CONCAT(a, b)`. |

## BTEQ Features

| Feature | Where Used | BigQuery Migration Notes |
|---------|-----------|--------------------------|
| `.LOGON` | All BTEQ scripts | Use the `bq` CLI / client library auth (service account / ADC). |
| `.IF ERRORCODE` / `.IF ACTIVITYCOUNT` | Error handling | Use BigQuery scripting `IF`/`BEGIN...EXCEPTION` or orchestration (Cloud Composer/Airflow, Dataform). |
| `.EXPORT DATA/REPORT FILE=` | Report extraction | Use `EXPORT DATA OPTIONS(uri=...) AS SELECT ...` to GCS, or `bq extract`. |
| `.QUIT` with return codes | Exit handling | Use script `RAISE` / orchestration task exit status. |
| `.LABEL` / `.GOTO` | Error handlers | Restructure into procedural scripting (no GOTO). |
| `.SET WIDTH/SEPARATOR` | Formatting | Handle in the export step / client formatting. |

## Orchestration & lifecycle

A full Teradata → BigQuery lifecycle is more than SQL translation:

1. **Schema** — DDL conversion (this table), datatype mapping, partition/cluster design.
2. **Data movement** — one-time history load (Teradata → GCS → BigQuery via the
   BigQuery Data Transfer Service / `bq load`) plus ongoing CDC.
3. **Logic** — views, stored procedures, macros, BTEQ → GoogleSQL + scripting +
   an orchestrator (Dataform, Cloud Composer/Airflow).
4. **Validation** — row counts, checksums, and business-rule parity (see
   `verify/`).
5. **Cutover** — dual-run, reconcile, switch consumers, decommission.
