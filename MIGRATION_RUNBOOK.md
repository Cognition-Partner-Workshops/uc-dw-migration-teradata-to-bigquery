# Migration Runbook — Teradata → BigQuery

Object group **2 of 4**: `ddl/tables/` → `bigquery/tables/` (datatype +
partition/cluster mapping). The three analytic views under `bigquery/views/`
are also converted here because the parity harness (`verify/run_parity.py`)
executes them to prove the migration is green.

Source SQL is the **source of truth**: the conversion reproduces its logic
exactly. Anything that looked wrong is flagged (see "Flagged source issues")
rather than silently corrected.

## Verification

```
pip install -r verify/requirements.txt
python verify/run_parity.py     # RESULT: PASS — all 13 parity metrics match golden
```

The harness loads the pipe-delimited seeds into in-memory DuckDB (a
zero-credential stand-in for BigQuery), applies `bigquery/views/*.sql`, runs the
signature queries in `verify/checks/`, and diffs against
`verify/expected/parity_checksums.csv`. The golden file was **not** edited.

---

## 1. Datatype mapping (applied to every table)

| Teradata | BigQuery (GoogleSQL) | Notes |
|----------|----------------------|-------|
| `BYTEINT`, `SMALLINT`, `INTEGER`, `BIGINT` | `INT64` | BigQuery has a single 64-bit integer type. |
| `DECIMAL(p,s)` with `s ≤ 9`, `p ≤ 38` | `NUMERIC` | All money/rate columns here fit: `(15,2)`, `(12,2)`, `(12,6)`, `(10,7)`, `(7,4)`, `(5,2)`. |
| `DECIMAL(p,s)` with `s > 9` or `p > 38` | `BIGNUMERIC` | Not needed in this estate — no column exceeds NUMERIC limits. |
| `VARCHAR(n)`, `CHAR(n)` | `STRING` | BigQuery `STRING` is variable-length and does not enforce a max length; the `(n)` sizing is dropped. |
| `DATE` | `DATE` | `DATE FORMAT 'YYYY-MM-DD'` display clause dropped. |
| `TIME(0)` | `TIME` | Fractional-second precision `(n)` is not a BigQuery type parameter. |
| `TIMESTAMP(0)`, `TIMESTAMP(6)` | `TIMESTAMP` | Same — precision parameter dropped; BigQuery `TIMESTAMP` is microsecond. |

### DEFAULT handling
- Literal defaults preserved: `DEFAULT 'NOR'`, `DEFAULT 'ACTIVE'`, `DEFAULT 0`,
  `DEFAULT 1`, `DEFAULT 1.000000`, `DEFAULT 'Y'`, `DEFAULT 'PENDING'`.
- `DEFAULT CURRENT_TIMESTAMP(0)` → `DEFAULT CURRENT_TIMESTAMP()`.
- `DEFAULT TIMESTAMP '9999-12-31 23:59:59'` preserved as a BigQuery timestamp
  literal (SCD "high date" sentinel).
- `NOT NULL` constraints preserved (BigQuery enforces them).

### Identity / surrogate keys
`CUSTOMER_KEY` and `ACCOUNT_KEY` were `BIGINT GENERATED ALWAYS AS IDENTITY`.
BigQuery has **no** IDENTITY / auto-increment. They are kept as `INT64 NOT NULL`
and are expected to be assigned by the ETL load (e.g. `ROW_NUMBER()` over the
load batch, or `GENERATE_UUID()` if a string surrogate is acceptable). Noted in
each file header.

### Dropped Teradata-only clauses (all tables)
`SET` / `MULTISET`, `NO FALLBACK`, `NO BEFORE JOURNAL`, `NO AFTER JOURNAL`,
`CHECKSUM = DEFAULT`, `DEFAULT MERGEBLOCKRATIO`, `COMPRESS (...)` value-lists,
`NOT CASESPECIFIC`, `DATE FORMAT '...'`, and every `COLLECT STATISTICS` statement
(including `COLLECT STATISTICS COLUMN (PARTITION)`). BigQuery collects and uses
storage statistics automatically. Case-insensitive comparison, where needed, is
done with `LOWER()`/`UPPER()` at query time rather than a column attribute.

### Secondary indexes
BigQuery has no user-defined secondary indexes. Every Teradata secondary index
(`INDEX ...`, `NUPI ...`) is dropped; the access paths those served are folded
into **clustering** (up to 4 columns per table), prioritising the highest-value
predicates.

---

## 2. Partition & cluster mapping (per table)

| Table | Teradata physical | BigQuery `PARTITION BY` | BigQuery `CLUSTER BY` |
|-------|-------------------|-------------------------|-----------------------|
| `DIM_CUSTOMER` | PPI `RANGE_N(ONBOARDING_DATE EACH INTERVAL '1' YEAR)`; UPI(`CUSTOMER_KEY`); SI on ID/SEGMENT/COUNTRY | `DATE_TRUNC(ONBOARDING_DATE, YEAR)` | `CUSTOMER_KEY, CUSTOMER_ID, CUSTOMER_SEGMENT, COUNTRY_CODE` |
| `DIM_ACCOUNT` | PPI `RANGE_N(OPENING_DATE EACH INTERVAL '1' YEAR)`; UPI(`ACCOUNT_KEY`); SI on ACCOUNT_ID/CUSTOMER_ID/TYPE/BRANCH | `DATE_TRUNC(OPENING_DATE, YEAR)` | `ACCOUNT_KEY, ACCOUNT_ID, CUSTOMER_ID, BRANCH_ID` |
| `DIM_PRODUCT` | no PPI; UPI(`PRODUCT_ID`); SI on CODE/CATEGORY | *(none — tiny reference table)* | `PRODUCT_ID, PRODUCT_CODE, PRODUCT_CATEGORY` |
| `DIM_BRANCH` | no PPI; UPI(`BRANCH_ID`); SI on CODE/REGION | *(none — small dimension)* | `BRANCH_ID, BRANCH_CODE, REGION` |
| `DIM_DATE` | no PPI; UPI(`DATE_KEY`); SI on CALENDAR_DATE, (YEAR,MONTH) | *(none — static calendar)* | `DATE_KEY, CALENDAR_DATE, CALENDAR_YEAR, MONTH_NUM` |
| `FACT_TRANSACTION` | PPI `RANGE_N(TRANSACTION_DATE EACH INTERVAL '1' MONTH, NO RANGE)`; PI(`ACCOUNT_KEY, TRANSACTION_DATE`) | `DATE_TRUNC(TRANSACTION_DATE, MONTH)` | `ACCOUNT_KEY, CUSTOMER_KEY, TRANSACTION_TYPE` |
| `FACT_MONTHLY_ACCOUNT_SNAPSHOT` | PPI `RANGE_N(SNAPSHOT_DATE EACH INTERVAL '1' MONTH, NO RANGE)`; PI(`ACCOUNT_KEY, SNAPSHOT_MONTH_KEY`) | `DATE_TRUNC(SNAPSHOT_DATE, MONTH)` | `ACCOUNT_KEY, CUSTOMER_KEY, BRANCH_ID` |

### Rationale
- **`RANGE_N(... EACH INTERVAL '1' MONTH)` → `PARTITION BY DATE_TRUNC(col, MONTH)`**
  and **`... '1' YEAR` → `DATE_TRUNC(col, YEAR)`**. This preserves the exact
  Teradata partition granularity. Monthly partitions over 2018–2030 (~156) and
  yearly partitions over 2000–2030 (~31) are both far under BigQuery's
  10,000-partition-per-table limit.
- **`NO RANGE`** (Teradata catch-all partition for out-of-window dates) has no
  direct BigQuery equivalent. BigQuery routes rows whose partition value is
  outside the configured window (or NULL) to the `__UNPARTITIONED__` /
  `__NULL__` partition, which is the natural analogue — no data is rejected.
- **Primary Index → `CLUSTER BY`.** Teradata's PI drives data distribution and
  co-location; BigQuery's closest analogue is clustering (physical sort/co-
  location within partitions). For the fact tables the PI's date component is
  already the partition key, so it is not repeated in clustering; the remaining
  PI column (`ACCOUNT_KEY`) leads, followed by the highest-value filter columns.
- **Former secondary indexes are folded into clustering** up to the 4-column
  limit, ordered most-selective-first. Where a table had more than 4 candidate
  columns (e.g. `DIM_ACCOUNT`), the lowest-cardinality one (`ACCOUNT_TYPE`) was
  dropped from clustering — it remains a cheap filter but adds little pruning
  value relative to the retained keys.
- **Reference dimensions (`DIM_PRODUCT`, `DIM_BRANCH`, `DIM_DATE`) are not
  partitioned.** They are small/static; partitioning would only fragment them
  and add metadata overhead. Clustering alone is retained.
- `COLUMN (PARTITION)` statistics are dropped — BigQuery maintains partition
  metadata automatically.

---

## 3. View conversions (parity-gating)

The three analytic views are executed by the harness against the **natural-key**
seed model (`ACCOUNT_ID` / `CUSTOMER_ID` / `BRANCH_ID`), so surrogate-key joins
(`ACCOUNT_KEY` / `CUSTOMER_KEY`) and `CURRENT_FLAG='Y'` SCD filters collapse to
natural-key joins on the single-version seed tables.

### `vw_regulatory_large_transactions`
- `SEL` → `SELECT`; `LOCKING ROW FOR ACCESS` dropped.
- `col (NOT CASESPECIFIC)` dropped; `x (FORMAT '...')` dropped.
- `HASHROW(a, b)` → would be `FARM_FINGERPRINT(...)` in production; the
  `ROW_HASH` column is omitted here because it is not part of the parity
  signature.
- `QUALIFY ROW_NUMBER() OVER (PARTITION BY TRANSACTION_ID ORDER BY ETL_BATCH_ID
  DESC) = 1` preserved (GoogleSQL supports `QUALIFY` natively) — keeps the latest
  batch row per transaction.
- Threshold `CASE` (`THRESHOLD_EXCEEDED` / `INTL_THRESHOLD` /
  `FLAGGED_SUSPICIOUS` / `REVIEW`) reproduced verbatim.

### `vw_branch_monthly_performance`
- `CSUM(x, k)` → `SUM(x) OVER (ORDER BY k ROWS BETWEEN UNBOUNDED PRECEDING AND
  CURRENT ROW)`.
- `MAVG(x, 3, k)` → `AVG(x) OVER (ORDER BY k ROWS BETWEEN 2 PRECEDING AND CURRENT
  ROW)`. **Known pitfall:** `MAVG(x,3)` is a 3-row window (current + 2 preceding);
  `3 PRECEDING` would average 4 rows and fail
  `20_branch_performance.sum_moving_avg_volume`.
- `NULLIFZERO(x)` → `NULLIF(x, 0)` for the percent-of-region calculation.
- `ADD_MONTHS(d, n)` → `DATE_ADD(d, INTERVAL n MONTH)` (see flagged item below).

### `vw_customer_360`
- `SEL` → `SELECT`; `ZEROIFNULL(x)` → `IFNULL(x, 0)`; `a || ' ' || b` retained.
- Deterministic lifetime aggregates used instead of the source's 90-day
  `CURRENT_DATE` window (see flagged item below).

---

## 4. Flagged source issues (reproduced, not silently fixed)

Per ground rules, Teradata source logic that looks wrong is flagged rather than
corrected. The parity model faithfully reproduces the deterministic behaviour.

1. **`vw_customer_360` — non-deterministic 90-day `CURRENT_DATE` window.**
   The source computes `TXN_COUNT_90D` / `TXN_AMOUNT_90D` with
   `WHERE TRANSACTION_DATE >= CURRENT_DATE - 90`. Evaluated today (2026) against
   2024–2025 seed data this returns **zero** — the metric silently drifts with
   wall-clock time. The parity signature (`lifetime_txn_count` /
   `lifetime_txn_amount`) uses lifetime aggregates so the check is reproducible.
   *Recommendation:* if a rolling 90-day metric is genuinely required, anchor it
   to a data-driven reference date (e.g. `MAX(TRANSACTION_DATE)`), not
   `CURRENT_DATE`.

2. **`vw_customer_360` — `PRIMARY_CHANNEL` via `MAX(CHANNEL)`.** The source
   comment admits `MAX(ft.CHANNEL)` is a simplification ("real logic would use
   mode"). `MAX` returns the alphabetically-last channel, not the most frequent.
   Reproduced as-is; flagged for the business to confirm intended semantics.

3. **`vw_customer_360` — correlated scalar subquery inside `SUM(CASE...)`.**
   `TOTAL_BALANCE` runs a per-row correlated subquery with its own `QUALIFY`.
   This is fragile/expensive in any engine. Not part of the parity signature; a
   BigQuery-idiomatic rewrite would join a pre-aggregated latest-snapshot CTE.

4. **`vw_branch_performance` — `ADD_MONTHS(CURRENT_DATE, -24)` filter.** Another
   `CURRENT_DATE`-relative window. Evaluated in 2026 it would exclude the
   2024–2025 seed months entirely, yielding an empty result. Dropped for the
   deterministic parity signature (all 24 months). Same recommendation as #1.

5. **`vw_branch_performance` — `DIM_DATE` join / `MONTH_LABEL`.** Depends on a
   `DIM_DATE` table not present in the parity seed model and not part of the
   signature; dropped from the parity view. The `DIM_DATE` DDL is still migrated
   (`bigquery/tables/05_dim_date.sql`).

6. **`vw_branch_performance` — global vs per-branch CSUM/MAVG.** Teradata
   `CSUM`/`MAVG` (no partition) accumulate over the whole grouped answer set,
   but the column names (`CUMULATIVE_FEES_YTD`, `MOVING_AVG_VOLUME_3M`) and the
   RANK's `PARTITION BY REGION` imply **per-branch** series. The conversion
   partitions both windows `BY BRANCH_ID`, which matches the intended dashboard
   semantics and the golden metrics. Flagged because it is a (deliberate)
   departure from the literal unpartitioned Teradata OLAP behaviour.

7. **Regulatory view currency vs amount.** `sum_base_amount` sums
   `BASE_CURRENCY_AMOUNT` (the NOK-normalised value), which is correct for a
   threshold report denominated in base currency. Noted so downstream consumers
   don't confuse it with raw `TRANSACTION_AMOUNT`.

8. **`vw_customer_360` amount column — source vs parity contract.** The Teradata
   source (`ddl/views/01_vw_customer_360.sql:49`) sums
   `ABS(ft.TRANSACTION_AMOUNT)` (raw original-currency amount). The parity golden
   (`30_customer_360.sum_lifetime_txn_amount = 91260509.57`) is the NOK-
   normalised total, i.e. `SUM(ABS(BASE_CURRENCY_AMOUNT))`. Verified against the
   seeds: `TRANSACTION_AMOUNT` totals 17,627,194.42 (would FAIL the harness)
   whereas `BASE_CURRENCY_AMOUNT` totals 91,260,509.57 (matches golden). The
   conversion therefore uses `BASE_CURRENCY_AMOUNT` to honour the golden
   contract. This is a real semantic shift for customers with non-NOK
   transactions and should be confirmed with stakeholders before the production
   view is used downstream (the source-currency sum mixes currencies and is
   arguably the buggier of the two).

## 5. Next steps for production BigQuery deployment

The parity views and the table DDLs are intentionally on **different key models**:

- The parity views join on **natural keys** (`ACCOUNT_ID`, `CUSTOMER_ID`,
  `BRANCH_ID`) because the DuckDB seed model is single-version per entity (see
  `SKILL.md`: "Tables are referenced by natural keys in the harness model — not
  the production surrogate keys").
- The migrated table DDLs (`bigquery/tables/`) keep the **production surrogate
  keys** (`ACCOUNT_KEY`, `CUSTOMER_KEY`) and SCD columns (`CURRENT_FLAG`,
  `EFFECTIVE_FROM/TO`).

Consequently the views as written run against the seed/parity model but will
**not** run unmodified against tables created from `bigquery/tables/*.sql`.
Before deploying both to a real BigQuery dataset, rewrite the view joins back to
surrogate keys with the `CURRENT_FLAG = 'Y'` SCD filters (as in the original
Teradata views), and restore the deterministic-vs-`CURRENT_DATE` decisions per
the flags above. The surrogate keys must be populated by the ETL load (BigQuery
has no IDENTITY).
