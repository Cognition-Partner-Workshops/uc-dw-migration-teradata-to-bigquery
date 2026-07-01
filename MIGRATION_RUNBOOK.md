# Teradata → BigQuery Migration Runbook

Object group: **stored procedures + macros** (`dml/stored_procedures/`,
`dml/macros/`) → `bigquery/procedures/`, plus the three analytic views required
to make the parity harness green (`bigquery/views/`).

Source of truth: the Teradata SQL. Each object below is reproduced faithfully;
anything that looked wrong in the source is **flagged**, not silently fixed.

## Verification

```bash
pip install -r verify/requirements.txt
python verify/run_parity.py
```

Final result — `RESULT: PASS — all 13 parity metrics match golden.` (full output
in the PR description). On `main` the harness fails (no converted views); that is
the expected before-state.

## Feature-mapping cheat sheet (applied throughout)

| Teradata | BigQuery (GoogleSQL) |
|----------|----------------------|
| `SEL` | `SELECT` |
| `LOCKING ROW FOR ACCESS` | dropped (no read locks) |
| `QUALIFY` | `QUALIFY` (native) |
| `ZEROIFNULL(x)` | `IFNULL(x, 0)` |
| `NULLIFZERO(x)` | `NULLIF(x, 0)` |
| `CSUM(x, k)` | `SUM(x) OVER (ORDER BY k ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` |
| `MAVG(x, n, k)` | `AVG(x) OVER (ORDER BY k ROWS BETWEEN (n-1) PRECEDING AND CURRENT ROW)` |
| `HASHROW(...)` | `FARM_FINGERPRINT(CONCAT(...))` |
| `ADD_MONTHS(d, n)` | `DATE_ADD(d, INTERVAL n MONTH)` |
| `d1 - d2` (date diff) | `DATE_DIFF(d1, d2, DAY)` |
| `:date - n` | `DATE_SUB(date, INTERVAL n DAY)` |
| `CAST(x AS DATE FORMAT ...)` | `PARSE_DATE(fmt, x)` / `DATE(y, m, d)` |
| `CAST(date AS DATE FORMAT 'YYYYMMDD') AS INT` | `CAST(FORMAT_DATE('%Y%m%d', date) AS INT64)` |
| `date (TIMESTAMP(6)) + time` | `TIMESTAMP(DATETIME(date, time))` |
| `a || b` | `a || b` / `CONCAT(a, b)` |
| `col (FORMAT '...')` | dropped (format on read with `FORMAT()`/`FORMAT_DATE()`) |
| `col (NOT CASESPECIFIC)` | dropped (use `LOWER()`/`UPPER()` for case-insensitive) |
| `ACTIVITY_COUNT` | `@@row_count` |
| `SQLCODE` / `SQLSTATE` | `@@error.message` (no numeric code) |
| `DECLARE EXIT HANDLER FOR SQLEXCEPTION` | `BEGIN ... EXCEPTION WHEN ERROR THEN ... END` |
| `CREATE VOLATILE TABLE ... ON COMMIT PRESERVE ROWS` | `CREATE TEMP TABLE ... AS SELECT` |
| `REPLACE PROCEDURE` | `CREATE OR REPLACE PROCEDURE` |
| `REPLACE MACRO` (1 result set) | `CREATE OR REPLACE TABLE FUNCTION` |
| `REPLACE MACRO` (N result sets) | `CREATE OR REPLACE PROCEDURE` |
| `MERGE INTO` | `MERGE` (same syntax) |
| `SAMPLE n` | `ORDER BY ... LIMIT n` / `TABLESAMPLE` / `ORDER BY RAND() LIMIT n` |
| `COLLECT STATISTICS`, `PRIMARY INDEX`, `COMPRESS` | dropped (managed by BigQuery) |
| `INTEGER`/`BIGINT`/`SMALLINT` | `INT64` |
| `DECIMAL(p,s)` | `NUMERIC` |
| `TIMESTAMP(0)` | `TIMESTAMP` |

---

## Views (`bigquery/views/`) — required for the parity harness

The harness executes the three analytic views against a natural-key seed model
(DuckDB stand-in for BigQuery). The production DDL uses SCD2 surrogate keys
(`ACCOUNT_KEY`, `CUSTOMER_KEY`, `CURRENT_FLAG`) that do not exist in the seed
model, so the views join on natural keys (`ACCOUNT_ID`, `CUSTOMER_ID`,
`BRANCH_ID`), as the Skill's view contract requires.

### `vw_regulatory_large_transactions`
- Threshold `CASE` and `QUALIFY ROW_NUMBER()` dedup reproduced exactly.
- `HASHROW(TRANSACTION_ID, TRANSACTION_DATE)` → `FARM_FINGERPRINT(CONCAT(...))`
  in production; omitted from the harness-facing view (not in the parity
  signature).
- `(NOT CASESPECIFIC)` on `FIRST_NAME`/`LAST_NAME` dropped.
- Signature: `row_count=140`, `sum_base_amount=89626796.63`, `n_categories=2`.

### `vw_branch_monthly_performance`
- `CSUM(SUM(FEES_CHARGED), SNAPSHOT_MONTH_KEY)` → running `SUM(...) OVER (... ROWS
  BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`.
- `MAVG(SUM(TOTAL_DEBITS+TOTAL_CREDITS), 3, SNAPSHOT_MONTH_KEY)` → `AVG(...) OVER
  (... ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`.
  **⚠ Known pitfall:** `MAVG(x, 3)` averages the current row + 2 preceding = 3
  rows. Translating to `3 PRECEDING` (4 rows) inflates `sum_moving_avg_volume`
  and fails the harness.
- **⚠ Flagged:** Teradata legacy `CSUM`/`MAVG` take only a sort key (no
  `PARTITION BY`); a literal read makes them run across all branches. The output
  grain is `(branch, month)` and the measures are per-branch running aggregates
  ("...YTD", "3-month moving average"), so the faithful business intent
  partitions the windows by `BRANCH_ID`. The golden checksums confirm per-branch
  windows.
- **⚠ Flagged (mislabel):** the source column is named `CUMULATIVE_FEES_YTD` but
  the `CSUM` never resets at year boundaries — it is cumulative since the first
  month. Reproduced as-is (`cumulative_fees`); a true YTD would add
  `PARTITION BY BRANCH_ID, year`.
- **Scope:** the production view also filters
  `SNAPSHOT_DATE >= ADD_MONTHS(CURRENT_DATE, -24)` and joins `DIM_DATE` for a
  `MONTH_LABEL`. The seed model has no `DIM_DATE` and no `CURRENT_DATE`
  relativity, so both are dropped to keep the signature deterministic.
- Signature: `row_count=240`, `sum_cumulative_fees=208824.74`,
  `sum_moving_avg_volume=6789480.28`.

### `vw_customer_360`
- `ZEROIFNULL(...)` → `IFNULL(..., 0)`; `||` concat retained.
- **⚠ Flagged divergence:** the production view computes recent activity over a
  rolling 90-day window (`TRANSACTION_DATE >= CURRENT_DATE - 90`) using
  `SUM(ABS(TRANSACTION_AMOUNT))`. The seed model has no `CURRENT_DATE`
  relativity, so this view reproduces the deterministic **lifetime** aggregates
  the parity contract specifies (`lifetime_txn_count`, `lifetime_txn_amount`
  using `SUM(ABS(BASE_CURRENCY_AMOUNT))`).
- `TOTAL_BALANCE` (latest `CLOSING_BALANCE` per current account) is out of the
  parity signature and omitted.
- Signature: `row_count=15`, `sum_total_accounts=20`,
  `sum_lifetime_txn_amount=91260509.57`.

---

## Stored procedures (`bigquery/procedures/`) — PRIMARY deliverable

These target the production `BANKING_DW` schema (SCD2 surrogate keys, staging
tables). They are not exercised by the parity harness (which uses the seed
model); they are the migrated procedural logic.

### `sp_customer_scd2.sql` — SCD Type 2 upsert
- Two-step SCD2 pattern reproduced exactly:
  1. `UPDATE ... FROM (subquery)` expires currently-active rows whose tracked
     attributes changed (`CURRENT_FLAG 'Y' → 'N'`, set `EFFECTIVE_TO`).
     `ACTIVITY_COUNT → @@row_count` into `p_changed`.
  2. `INSERT ... SELECT ... QUALIFY` inserts a fresh current version for every
     staged customer no longer having a `CURRENT_FLAG='Y'` row — which, because
     step 1 already expired changed customers, covers both new versions of
     changed customers **and** brand-new customers. `@@row_count → p_new_rows`.
- `UPDATE ... FROM` is supported natively in BigQuery DML.
- `COLLECT STATISTICS` dropped.
- **⚠ Flagged source defect (reproduced, not fixed):** the step-2 dedup uses
  `QUALIFY ROW_NUMBER() OVER (PARTITION BY existing.CUSTOMER_ID ORDER BY
  existing.EFFECTIVE_TO DESC) = 1`. For brand-new customers there is no matching
  expired row, so `existing.CUSTOMER_ID` is `NULL`; all NULL-partition rows are
  grouped together and only **one** brand-new customer survives per batch — the
  rest are silently dropped. Preserved to match source behavior. A correct
  version would `PARTITION BY stg.CUSTOMER_ID`.

### `sp_load_daily_transactions.sql` — daily fact load
- `DECLARE EXIT HANDLER FOR SQLEXCEPTION` → `BEGIN ... EXCEPTION WHEN ERROR THEN
  ... END` wrapping the body.
- Reject step (unknown accounts → `STG_TRANSACTION_ERRORS`) and valid-insert
  step reproduced; `ACTIVITY_COUNT → @@row_count`.
- `date (TIMESTAMP(6)) + (time - TIME '00:00:00')` → `TIMESTAMP(DATETIME(date,
  time))`; `DATE_KEY` via `CAST(FORMAT_DATE('%Y%m%d', date) AS INT64)`.
- `ZEROIFNULL(fx.EXCHANGE_RATE)` → `IFNULL(fx.EXCHANGE_RATE, 0)`.
- Duration in the completion log: `(ts2 - ts1) SECOND(4)` →
  `TIMESTAMP_DIFF(ts2, ts1, SECOND)`.
- **⚠ Flagged mapping:** Teradata `SQLCODE` is numeric; BigQuery scripting
  exposes only `@@error.message`. `p_return_code` is set to a nonzero sentinel
  (`1`) on failure and the original error text is logged. Callers relying on a
  specific numeric code must adapt.

### `sp_monthly_snapshot.sql` — month-end snapshot MERGE
- `CREATE VOLATILE TABLE ... WITH DATA PRIMARY INDEX (...) ON COMMIT PRESERVE
  ROWS` → `CREATE TEMP TABLE ... AS SELECT` (PI / ON-COMMIT clauses dropped; the
  TEMP table lives for the whole script, matching PRESERVE ROWS for a single
  session).
- Period math: `DATE(year, month, 1)`, `DATE_SUB(DATE_ADD(start, INTERVAL 1
  MONTH), INTERVAL 1 DAY)`, `ADD_MONTHS(start, -1) → DATE_ADD(start, INTERVAL -1
  MONTH)`.
- `MERGE INTO ... WHEN MATCHED / WHEN NOT MATCHED` reproduced verbatim; all
  `ZEROIFNULL → IFNULL`, `(SMALLINT) → CAST(... AS INT64)`, dormant-day count
  `(period_end - period_start + 1) → DATE_DIFF(...) + 1`.
- `@@row_count → p_rows_merged`; `DROP TABLE` retained; `COLLECT STATISTICS`
  dropped.

---

## Macros (`bigquery/procedures/`) — PRIMARY deliverable

Teradata macros have no BigQuery equivalent. A macro returning **one** result set
→ table function; a macro returning **multiple** result sets → procedure.

### `macro_customer_txn_history.sql` → `customer_txn_history` (TABLE FUNCTION)
- Single result set → `CREATE OR REPLACE TABLE FUNCTION`, queryable as a table.
- `:param` → typed function parameters; all `FORMAT` clauses dropped.
- **⚠ Flagged — no default args:** BigQuery table functions cannot declare
  default argument values. The macro defaulted `start_date = DATE-30`,
  `end_date = DATE`, `txn_type = 'ALL'`; callers must now pass all four
  arguments (or use a thin wrapper that supplies `CURRENT_DATE()`-based
  defaults).
- **⚠ Flagged — `SAMPLE 1000`:** Teradata `SAMPLE` is a random sample. Combined
  with the `ORDER BY`, the intent is "1000 most-recent transactions", so it is
  mapped to `ORDER BY ... LIMIT 1000`. Use `ORDER BY RAND() LIMIT 1000` or
  `TABLESAMPLE` for a true random sample.

### `macro_daily_balance_check.sql` → `daily_balance_check` (PROCEDURE)
- Two differently-shaped result sets → procedure with two `SELECT`s.
- **⚠ Flagged source logic (reproduced as intended):** result set 1 mixes
  `QUALIFY ROW_NUMBER() OVER (PARTITION BY ACCOUNT_KEY ...)` with `GROUP BY
  ACCOUNT_TYPE/CURRENCY`. The intent is "take each account's latest transaction
  on `check_date` (its end-of-day balance), then aggregate by type/currency."
  This ordering is made explicit with a CTE (`latest_per_account`) that dedups
  before grouping.

### `macro_aml_screening.sql` → `aml_screening` (PROCEDURE)
- Three differently-shaped result sets (Structuring / Rapid movement / New
  customer intl) → procedure with three `SELECT`s.
- Date arithmetic mapped: `(d1 - d2) → DATE_DIFF`, `(:date - n) → DATE_SUB`,
  `cr.CREDIT_DATE + 3 → DATE_ADD(..., INTERVAL 3 DAY)`.
- **⚠ Flagged — no default args:** macro defaults (`screening_date = DATE`,
  `lookback_days = 30`, `amount_threshold = 50000.00`) are applied via `IFNULL()`
  on nullable parameters, so callers may pass `NULL` for macro-equivalent
  behavior.

---

## Out of scope / recommended next steps

- **BTEQ scripts** (`dml/scripts/*.btq`): `.LOGON`/`.EXPORT`/`.IF ERRORCODE`/
  `.LABEL`/`.GOTO` → `bq load` / `EXPORT DATA` + orchestration (Dataform / Cloud
  Composer). Do not re-create GOTO/LABEL control flow inside SQL.
- **DDL tables** (`ddl/tables/`): datatype + partition (`PARTITION BY
  DATE_TRUNC(TRANSACTION_DATE, MONTH)`) + `CLUSTER BY` mapping.
- **Orchestration:** push loops, error handling, and scheduling into Dataform /
  Cloud Composer rather than BigQuery scripting where practical.
- **Validation at scale:** dual-run and reconcile over a full window before
  cutover; the parity harness covers deterministic analytics parity only.
