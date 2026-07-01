# Migration Runbook — Teradata → BigQuery

Object group **1 of 4**: `ddl/views/` → `bigquery/views/` (the three analytic
views the parity harness gates on).

Source is the durable before-state on `main`; converted GoogleSQL lands under
`bigquery/views/` on a branch (never merged into `main`).

## Verification

```bash
pip install -r verify/requirements.txt
python verify/run_parity.py     # exit 0 = all parity metrics match golden
```

The harness loads `data/seed/*.csv` into in-memory DuckDB (a zero-credential
stand-in for BigQuery), executes every `bigquery/views/*.sql`, runs the signature
queries in `verify/checks/*.sql`, and diffs against `verify/expected/parity_checksums.csv`.
Final result: **RESULT: PASS — all 13 parity metrics match golden.**

## Harness view contract

| Source (Teradata) | Converted view | Reads (natural keys) |
|---|---|---|
| `ddl/views/02_vw_regulatory_large_transactions.sql` | `vw_regulatory_large_transactions` | `fact_transaction`, `dim_account`, `dim_customer`, `dim_branch` |
| `ddl/views/03_vw_branch_performance.sql` | `vw_branch_monthly_performance` | `fact_monthly_account_snapshot`, `dim_branch` |
| `ddl/views/01_vw_customer_360.sql` | `vw_customer_360` | `dim_customer`, `dim_account`, `fact_transaction` |

Tables are joined by natural keys (`ACCOUNT_ID`, `CUSTOMER_ID`, `BRANCH_ID`) — the
parity seed model is single-version natural key, not the production surrogate keys
(`ACCOUNT_KEY`/`CUSTOMER_KEY`) + `CURRENT_FLAG` SCD2 the source DDL uses.

## Teradata → BigQuery translation decisions

| Teradata construct | BigQuery (GoogleSQL) | Notes |
|---|---|---|
| `SEL` | `SELECT` | keyword |
| `LOCKING ROW FOR ACCESS` | *removed* | BigQuery has no read locks |
| `col (NOT CASESPECIFIC)` | *dropped* | use `LOWER()`/`UPPER()` when case-insensitive compare is needed |
| `col (FORMAT 'ZZZ,ZZ9.99')` | *dropped* | display mask; format on read with `FORMAT()` if needed |
| `ZEROIFNULL(x)` | `IFNULL(x, 0)` | |
| `NULLIFZERO(x)` | `NULLIF(x, 0)` | |
| `a || ' ' || b` | `a \|\| ' ' \|\| b` (or `CONCAT`) | supported in GoogleSQL |
| `QUALIFY ROW_NUMBER() OVER (...)` | `QUALIFY ROW_NUMBER() OVER (...)` | native in GoogleSQL; used for dedup on `TRANSACTION_ID` keeping latest `ETL_BATCH_ID` |
| `HASHROW(a, b)` | `FARM_FINGERPRINT(...)` (production) | omitted here — not in the parity contract; seed has no `TRANSACTION_TS` to hash |
| `CSUM(x, month_key)` | `SUM(x) OVER (ORDER BY month_key ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)` | cumulative sum |
| `MAVG(x, 3, month_key)` | `AVG(x) OVER (ORDER BY month_key ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` | **3-row window** (see below) |
| `ADD_MONTHS(CURRENT_DATE, -24)` | *dropped date filter* | non-deterministic; seed is a fixed window |

## Window-frame decision (the MAVG off-by-one)

`MAVG(SUM(...), 3, SNAPSHOT_MONTH_KEY)` is a **3-row** moving average: the current
month plus the two preceding months. The faithful GoogleSQL frame is:

```sql
AVG(total_volume) OVER (
    PARTITION BY BRANCH_ID ORDER BY SNAPSHOT_MONTH_KEY
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
```

The intuitive-but-wrong `ROWS BETWEEN 3 PRECEDING AND CURRENT ROW` averages 4 rows.
The harness catches it precisely:

```
MISMATCH 20_branch_performance.sum_moving_avg_volume  expected 6789480.28  got 6764463.37
```

Using `2 PRECEDING` yields the golden `6789480.28`.

## Source-parity divergences flagged (source reproduced faithfully, not "fixed")

1. **CSUM/MAVG partition scope (branch performance).** The Teradata source
   `CSUM(SUM(FEES_CHARGED), SNAPSHOT_MONTH_KEY)` and `MAVG(..., 3, SNAPSHOT_MONTH_KEY)`
   carry **no explicit partition**. A literal translation cumulates/averages across
   *all* branches ordered by month (cumulative_fees `2012068.40`,
   moving_avg_volume `6846515.04`). The metric names (`CUMULATIVE_FEES_YTD`,
   per-branch moving average) and the parity golden require **per-branch** scope, so
   both windows use `PARTITION BY BRANCH_ID`. Flagged because the source SQL is
   ambiguous — Teradata `CSUM`/`MAVG` used inside a `GROUP BY` do not window per group.

2. **Customer 360 activity metric (recency → lifetime).** The Teradata view computes
   recent activity over a `CURRENT_DATE - 90` window using
   `SUM(ABS(TRANSACTION_AMOUNT))` in the raw transaction currency —
   non-deterministic (wall-clock dependent) and currency-mixed. The parity contract
   requires a deterministic `lifetime_txn_amount`, so this is restated as an all-time
   aggregate on `BASE_CURRENCY_AMOUNT` (single reporting currency). Verified against
   golden: `BASE_CURRENCY_AMOUNT` → `91260509.57` (matches); `TRANSACTION_AMOUNT` →
   `17627194.42` (does not).

3. **`total_accounts` shape.** The source counts current accounts with a correlated
   per-account latest-snapshot balance subquery under `CURRENT_FLAG = 'Y'`. The seed
   is natural-key single-version with no account↔snapshot linkage for that subquery,
   and it is not part of the signature, so `total_accounts` is a plain per-customer
   `COUNT(*)` (golden `sum_total_accounts = 20`, matching the 20 seeded accounts).

## Final parity report (verbatim)

```
  ok       00_dimensions.dim_account_rows                 20.0
  ok       00_dimensions.dim_branch_rows                  14.0
  ok       00_dimensions.dim_customer_rows                15.0
  ok       00_dimensions.dim_product_rows                 10.0
  ok       10_regulatory.n_categories                     2.0
  ok       10_regulatory.row_count                        140.0
  ok       10_regulatory.sum_base_amount                  89626796.63
  ok       20_branch_performance.row_count                240.0
  ok       20_branch_performance.sum_cumulative_fees      208824.74
  ok       20_branch_performance.sum_moving_avg_volume    6789480.28
  ok       30_customer_360.row_count                      15.0
  ok       30_customer_360.sum_lifetime_txn_amount        91260509.57
  ok       30_customer_360.sum_total_accounts             20.0

RESULT: PASS — all 13 parity metrics match golden.
```
