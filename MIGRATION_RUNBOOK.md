# Migration Runbook — Teradata → BigQuery

Object group **4 of 4: `dml/scripts/` (BTEQ)**. This runbook records every
Teradata → BigQuery translation decision for the BTEQ load/extract scripts, plus
the three analytic views required to make the parity harness green.

Deliverables in this PR:

| Area | Source (Teradata) | Converted (BigQuery) |
|------|-------------------|----------------------|
| Views (parity gate) | `ddl/views/0{1,2,3}_*.sql` | `bigquery/views/0{1,2,3}_*.sql` |
| BTEQ daily load | `dml/scripts/bteq_daily_load.btq` | `bigquery/scripts/01_daily_load.sql`, `bigquery/scripts/bq_load_daily_transactions.sh` |
| BTEQ monthly extract | `dml/scripts/bteq_extract_report.btq` | `bigquery/scripts/02_extract_report.sql` |
| Orchestration | BTEQ `.IF/.GOTO/.LABEL` control flow | `bigquery/orchestration/daily_load_dag.py`, `bigquery/orchestration/monthly_extract_dag.py` |

---

## 1. Analytic views (parity harness contract)

The harness (`verify/run_parity.py`) executes only `bigquery/views/*.sql` and
diffs signature metrics against `verify/expected/parity_checksums.csv`. All three
views were converted from the Teradata sources and reference the seed tables by
**natural keys** (`ACCOUNT_ID` / `CUSTOMER_ID` / `BRANCH_ID`).

### `vw_regulatory_large_transactions`
| Teradata | BigQuery |
|----------|----------|
| `REPLACE VIEW` | `CREATE OR REPLACE VIEW` |
| `SEL` | `SELECT` |
| `LOCKING ROW FOR ACCESS` | dropped (no read locks) |
| `col (NOT CASESPECIFIC)` | dropped (use `LOWER()`/`UPPER()` if needed) |
| `HASHROW(a,b)` | `FARM_FINGERPRINT()` on BigQuery; omitted here (not in parity contract, keeps SQL in the DuckDB-runnable subset) |
| `QUALIFY ROW_NUMBER() ...` | `QUALIFY` (native GoogleSQL) |
| surrogate `*_KEY` joins | natural-key joins |

### `vw_branch_monthly_performance`
| Teradata | BigQuery |
|----------|----------|
| `CSUM(x, monthkey)` | `SUM(x) OVER (PARTITION BY branch ORDER BY monthkey ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` |
| `MAVG(x, 3, monthkey)` | `AVG(x) OVER (PARTITION BY branch ORDER BY monthkey ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` |
| `NULLIFZERO(x)` | `NULLIF(x, 0)` |
| `FORMAT 'ZZZ...'` | dropped (format on read) |
| `WHERE ... >= ADD_MONTHS(CURRENT_DATE, -24)` | dropped for deterministic parity; on BigQuery use `DATE_ADD(CURRENT_DATE(), INTERVAL -24 MONTH)` |

**Known pitfall (caught by the harness):** `MAVG(volume, 3, month)` is a **3-row**
window — current row + 2 preceding = `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`.
The intuitive `3 PRECEDING` averages 4 rows and fails
`20_branch_performance.sum_moving_avg_volume` (expected `6789480.28`). The
`CSUM`/`MAVG` running windows are scoped **per `BRANCH_ID`** (`PARTITION BY
BRANCH_ID`), matching the golden signature.

### `vw_customer_360`
| Teradata | BigQuery |
|----------|----------|
| `ZEROIFNULL(x)` | `IFNULL(x, 0)` |
| `a \|\| ' ' \|\| b` | supported in GoogleSQL (or `CONCAT`) |
| `FORMAT 'ZZZ...'` | dropped |
| surrogate `*_KEY` joins | natural-key joins (`CUSTOMER_ID`) |
| 90-day txn window (`CURRENT_DATE - 90`) | **lifetime** aggregates (see flag #7) |

### Parity result

`python verify/run_parity.py` → `RESULT: PASS — all 13 parity metrics match
golden.` Full output is pasted verbatim in the PR description.

---

## 2. BTEQ → BigQuery: primary deliverable

### 2.1 Dot-command and control-flow mapping

| BTEQ construct | BigQuery / orchestration |
|----------------|--------------------------|
| `.LOGON TDPROD/etl_svc_acct,;` | Orchestrator GCP connection + service account (Workload Identity / Secret Manager) — never an embedded password |
| `.LOGOFF` / `.QUIT 0` | task success |
| `.QUIT 4` | branch to a **warn** task (non-fatal) |
| `.QUIT 8` | task failure → error-handler task |
| `.SET WIDTH/SEPARATOR/TITLEDASHES` | presentation only; dropped |
| `DATABASE BANKING_DW;` | fully-qualified `project.banking_dw.*` |
| `.IF ACTIVITYCOUNT = 0 THEN .GOTO <lbl>` | `BranchPythonOperator` on a `COUNT(*)` probe (and `ASSERT`/`IF` inside the script) |
| `.IF ERRORCODE <> 0 THEN .GOTO ERRORHANDLER` | `BEGIN ... EXCEPTION WHEN ERROR THEN ...` + Airflow `trigger_rule=one_failed` handler task |
| `.LABEL NOSTAGING / NODATA / ERRORHANDLER` | dedicated warn / fail-handler tasks |
| `CREATE VOLATILE TABLE VT_BATCH` | a real `etl_batch_control` row (status `RUNNING`) + a script variable |
| `CALL SP_*` / `EXEC macro` | `CALL` of the converted procedures / table function |
| data load (staging) | `bq load` (`bigquery/scripts/bq_load_daily_transactions.sh`) |
| `.EXPORT DATA/REPORT FILE=...` | `EXPORT DATA OPTIONS(uri='gs://...') AS SELECT ...` |
| `.EXPORT RESET` | end of the `EXPORT DATA` statement |
| `COLLECT STATISTICS` / `LOCKING` | dropped (no equivalent) |

### 2.2 Daily load DAG (`banking_dw_daily_load`)

Step sequence (BTEQ step → task):

1. **Staging ingest** → `load_staging` (`bq load` into a date-partitioned
   `stg_transactions`). Replaces Teradata TPT/FastLoad.
2. **Validate staging** (BTEQ Step 1) → `check_staging` branch: 0 rows → the
   `warn_no_staging` task (BTEQ `.LABEL NOSTAGING` / `.QUIT 4`); else continue.
3. **Steps 2–7** run as one scripted BigQuery job (`run_daily_load` executing
   `01_daily_load.sql`):
   - allocate `batch_id`, write `etl_batch_control` row as `RUNNING`;
   - `CALL sp_customer_scd2` (SCD2 merge);
   - `CALL sp_load_daily_transactions`;
   - `CALL sp_daily_balance_check`;
   - `EXPORT DATA` reconciliation report to GCS;
   - mark the batch `COMPLETED`.
4. **Error handling** (BTEQ `.LABEL ERRORHANDLER`): the script's
   `EXCEPTION WHEN ERROR` marks the batch `FAILED`, logs `@@error.message`, and
   re-raises; the `error_handler` task (`trigger_rule=one_failed`) is a
   belt-and-suspenders sweep of any stranded `RUNNING` row.

### 2.3 Monthly extract DAG (`banking_dw_monthly_extract`)

1. `check_data` branch (BTEQ `.IF ACTIVITYCOUNT = 0 THEN .GOTO NODATA`): no large
   txns in window → `warn_no_data` (`.LABEL NODATA` / `.QUIT 4`).
2. `run_extracts` executes `02_extract_report.sql` — three `EXPORT DATA`
   statements:
   - Export 1: large-transaction regulatory CSV (from
     `vw_regulatory_large_transactions`);
   - Export 2: branch-performance summary (from
     `vw_branch_monthly_performance`);
   - Export 3: AML screening results (`CALL tf_aml_screening(...)`).

### 2.4 Idempotency & error handling

- **Staging load** truncates its date partition (`bq load --replace` /
  `WRITE_TRUNCATE`), so a re-run for a date replaces rather than duplicates.
- **Batch control** is keyed by `batch_id`; the `RUNNING`→`COMPLETED`/`FAILED`
  lifecycle makes the state observable and re-runs safe.
- **Exports** use `overwrite = true` — re-running a period re-writes the same GCS
  prefix.
- **Retries** are configured per task; the scripted job is transactional at the
  statement level and self-marks `FAILED` on exception.

---

## 3. Flagged source issues (reproduced faithfully, not silently "fixed")

The source behavior is preserved so the parity harness passes; these are called
out for the cutover owners to decide on.

1. **`ERRORHANDLER` reads `VT_BATCH` before it exists.** In `bteq_daily_load.btq`,
   Step 2 (`.IF ERRORCODE <> 0 THEN .GOTO ERRORHANDLER`) can jump to the handler
   **before** `VT_BATCH` is created in Step 3. The handler's
   `INSERT ... SELECT ... FROM VT_BATCH` would then fail on a non-existent table,
   masking the original error. The BigQuery port avoids this by writing the
   `etl_batch_control` row (status `RUNNING`) up front, so the handler always has
   a row to update.
2. **Date tokens are not substituted by BTEQ.** `daily_recon_YYYYMMDD.txt`,
   `large_txn_report_YYYYMM.csv`, etc. contain **literal** `YYYYMMDD`/`YYYYMM` —
   BTEQ does not expand them, so every run overwrites the same file. The
   orchestrator now supplies the real date (`FORMAT_DATE` / `{{ ds }}`).
3. **Anchored vs. calendar-month window.** Export 1 filters
   `transaction_date BETWEEN ADD_MONTHS(CURRENT_DATE,-1) AND CURRENT_DATE` — a
   rolling ~1-month window anchored on run day, not the previous **calendar**
   month (which Export 2's `SNAPSHOT_MONTH_KEY` filter implies). Kept faithfully;
   `02_extract_report.sql` includes ready `v_month_start`/`v_month_end` if a
   whole calendar month is intended.
4. **`MAX(BATCH_ID) + 1` is not concurrency-safe.** Two simultaneous runs can
   allocate the same id. Serialize via the orchestrator (single active DAG run)
   or move to a sequence/`GENERATE_UUID()` surrogate.
5. **`EXEC DAILY_BALANCE_CHECK` output was discarded.** The Teradata macro
   returned result sets to the BTEQ terminal that were never captured. The port
   persists the reconciliation (`CALL sp_daily_balance_check`) instead of
   dropping it.
6. **Empty logon password.** `.LOGON TDPROD/etl_svc_acct,;` relied on a
   stored/empty password. Do not carry this over — authenticate with a GCP
   service account via Workload Identity / Secret Manager.
7. **`vw_customer_360` 90-day window is non-deterministic.** The source computes
   `TXN_*_LAST_90_DAYS` from `CURRENT_DATE - 90`, which drifts by run date and is
   empty against the static seeds. The parity contract asks for deterministic
   lifetime aggregates, so the converted view sums over all history; re-add the
   90-day window on BigQuery where recency is required.
8. **`vw_customer_360` sums base-currency, not local-currency, amounts.** The
   Teradata source sums `ABS(TRANSACTION_AMOUNT)` (local currency, e.g. EUR),
   whereas the parity golden (`30_customer_360.sum_lifetime_txn_amount =
   91260509.57`) was generated from `ABS(BASE_CURRENCY_AMOUNT)` (NOK). Summing a
   single base currency is the more correct metric (it avoids mixing currencies),
   and the harness gates "done" against that golden, so the converted view uses
   `BASE_CURRENCY_AMOUNT`. Consumers comparing against the literal Teradata view
   will see different totals — confirm the intended metric before cutover.

---

## 4. Cutover notes

History backfill (extract → GCS → `bq load`/BigQuery Data Transfer Service),
dual-run, reconcile against the parity harness over a full window, then repoint
consumers. See `docs/bigquery_migration_considerations.md` for datatype and
partition/cluster mappings.
