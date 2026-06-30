# Teradata → BigQuery: Migration Considerations

Planning notes specific to landing this retail-banking warehouse on BigQuery.
Pair this with `teradata_features_reference.md` (feature-level mapping) and the
parity harness in `verify/`.

## Datatype mapping

| Teradata | BigQuery | Notes |
|----------|----------|-------|
| `INTEGER`, `BIGINT`, `SMALLINT`, `BYTEINT` | `INT64` | One integer type in BigQuery. Use `BOOL` for true 0/1 flags. |
| `DECIMAL(p,s)` ≤ (38,9) | `NUMERIC` | Exact money. Use `BIGNUMERIC` for larger precision/scale. |
| `FLOAT` | `FLOAT64` | |
| `CHAR(n)` / `VARCHAR(n)` | `STRING` | No length enforcement; validate on load. |
| `DATE` | `DATE` | |
| `TIME(0)` | `TIME` | |
| `TIMESTAMP(n)` | `TIMESTAMP` (UTC) or `DATETIME` (no zone) | Pick based on whether values are zone-aware. |

## Physical design

- **Partitioning.** Teradata PPI `RANGE_N(... EACH INTERVAL '1' MONTH)` → BigQuery
  time partitioning. For `FACT_TRANSACTION` partition by `TRANSACTION_DATE`
  (monthly via `PARTITION BY DATE_TRUNC(TRANSACTION_DATE, MONTH)`), enabling
  partition pruning equivalent to PPI elimination.
- **Clustering.** Teradata Primary Index drove data distribution; BigQuery has no
  distribution but `CLUSTER BY` on common filter/join columns (e.g.
  `ACCOUNT_KEY`, `CUSTOMER_KEY`) gives similar scan reduction.
- **No indexes / no stats collection.** Drop `COLLECT STATISTICS`, secondary
  indexes, and join indexes. Re-express join-index acceleration as materialized
  views where it pays off.

## Logic conversion

- **Views** convert almost 1:1 once `SEL`, `QUALIFY`, `ZEROIFNULL`, `CSUM`,
  `MAVG`, and `FORMAT` are mapped (see reference). Window-frame off-by-ones are
  the main correctness risk — the harness gates them.
- **Stored procedures / macros** → BigQuery scripting (`CREATE PROCEDURE`) or, for
  set-returning macros, `CREATE TABLE FUNCTION`. Prefer pushing orchestration
  (loops, error handling, scheduling) into Dataform or Cloud Composer rather than
  re-creating BTEQ control flow inside SQL.
- **BTEQ** load/extract scripts → `bq load` / `EXPORT DATA` + an orchestrator.

## Loading & lifecycle

1. **History backfill** — extract Teradata tables to GCS (e.g. Parquet), then
   `bq load` or the BigQuery Data Transfer Service.
2. **Ongoing ingestion** — CDC into a staging dataset, then `MERGE` into curated
   tables (the SCD2 procedure converts to a `MERGE`).
3. **Dual-run & reconcile** — run source and target in parallel; gate cutover on
   the parity harness going green over a full reconciliation window.
4. **Cutover** — repoint BI/consumers, freeze the Teradata side, decommission.

## What the parity harness proves (and what it doesn't)

- **Proves:** converted GoogleSQL is syntactically valid and the converted
  analytics reproduce deterministic row counts and measure sums on a controlled
  dataset — including the `CSUM`/`MAVG` window translations.
- **Does not prove (out of scope here):** performance/cost tuning, IAM and
  row/column-level security, streaming ingestion correctness, and full-volume
  reconciliation. Those belong in the cutover plan.
