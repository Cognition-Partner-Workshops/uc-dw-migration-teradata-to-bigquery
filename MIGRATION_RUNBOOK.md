# Migration Runbook — Teradata → BigQuery (Analytic Views)

Scope of this pass: the three analytic views in `ddl/views/` converted to
BigQuery Standard SQL (GoogleSQL) under `bigquery/views/`, proven green by
`python verify/run_parity.py` (all 13 parity metrics match golden).

## Verification

```bash
pip install -r verify/requirements.txt
python verify/run_parity.py     # RESULT: PASS — all 13 parity metrics match golden
```

The harness loads the pipe-delimited seeds into in-memory DuckDB (a local,
credential-free stand-in for BigQuery), executes each `bigquery/views/*.sql`, runs
the signature queries in `verify/checks/`, and diffs against
`verify/expected/parity_checksums.csv`. Converted SQL is kept in the
GoogleSQL/ANSI common subset so the same statements run on BigQuery and locally
(a small shim rewrites backtick identifiers and `SAFE_DIVIDE`).

The seed model references tables by **natural keys** (`ACCOUNT_ID`,
`CUSTOMER_ID`, `BRANCH_ID`), not the production surrogate keys — the converted
views join on those natural keys.

## Teradata → BigQuery translation decisions

| Teradata construct | BigQuery translation | Notes |
|---|---|---|
| `SEL` | `SELECT` | Keyword abbreviation. |
| `REPLACE VIEW` | `CREATE OR REPLACE VIEW` | GoogleSQL DDL form. |
| `LOCKING ROW FOR ACCESS` | removed | BigQuery has no read locks. |
| `col (NOT CASESPECIFIC)` | dropped | Use `LOWER()`/`UPPER()` for case-insensitive comparisons if required. |
| `col (FORMAT 'ZZZ,ZZ9.99')` | dropped | Presentation formatting belongs to the consuming/BI layer, not the warehouse view. |
| `ZEROIFNULL(x)` | `IFNULL(x, 0)` | |
| `NULLIFZERO(x)` | `NULLIF(x, 0)` | |
| `QUALIFY ROW_NUMBER() ...` | `QUALIFY ROW_NUMBER() ...` | Native in GoogleSQL; used for latest-batch dedup. |
| `HASHROW(...)` | `FARM_FINGERPRINT(...)` (production) | Omitted from the harness view: not part of the parity contract and not portable to the local engine. |
| `a \|\| ' ' \|\| b` | `a \|\| ' ' \|\| b` (or `CONCAT`) | String concatenation is supported. |
| `ADD_MONTHS(d, n)` | `DATE_ADD(d, INTERVAL n MONTH)` | Where a date filter is needed; the deterministic parity model retains full seed history, so no `CURRENT_DATE` filter is applied. |
| `CSUM(x, sortkey)` | `SUM(x) OVER (ORDER BY sortkey ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` | Cumulative sum. |
| `MAVG(x, n, sortkey)` | `AVG(x) OVER (ORDER BY sortkey ROWS BETWEEN (n-1) PRECEDING AND CURRENT ROW)` | See moving-average note below. |

### Moving-average window frame (the parity-caught pitfall)

`MAVG(volume, 3, month)` is a **3-row** moving average: the current row plus the
two preceding rows → `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`. The
intuitive-but-wrong `3 PRECEDING` averages **4** rows and drifts
`20_branch_performance.sum_moving_avg_volume` off golden. The frame here is
`2 PRECEDING`, which the harness confirms green.

## View-specific notes

- **`vw_regulatory_large_transactions`** — threshold + international + flagged
  filter, `QUALIFY ROW_NUMBER()` dedup on latest `ETL_BATCH_ID`. Exposes
  `base_currency_amount` and `reporting_category` for the parity signature.
- **`vw_branch_monthly_performance`** — aggregated per branch/month in a CTE,
  then `CSUM`→cumulative `SUM` window and `MAVG`→3-row `AVG` window on top.
  Exposes `cumulative_fees` and `moving_avg_volume_3m`.
- **`vw_customer_360`** — deterministic lifetime aggregates (no `CURRENT_DATE`
  window), `ZEROIFNULL`→`IFNULL`. Exposes `total_accounts` and
  `lifetime_txn_amount`.

## Not done in this pass (follow-up)

Tables (datatype + partition/cluster mapping from `SET/MULTISET`, PI/PPI,
`COMPRESS`), stored procedures (→ BigQuery scripting / `MERGE`), macros (→
procedures or table functions), and BTEQ (→ `bq load` / `EXPORT DATA` +
orchestration such as Dataform / Cloud Composer). The converted "after" SQL is
kept off `main` — `main` remains the durable Teradata before-state.
