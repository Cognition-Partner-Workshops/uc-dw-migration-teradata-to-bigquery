# Parity Verification Harness

A programmatic, zero-credential parity loop that proves a Teradata → BigQuery
conversion preserves data semantics. It is the source of truth that gates "done"
for the migration lab/demo.

## Why DuckDB

The converted views are written in the **GoogleSQL / ANSI common subset**, so the
same SQL that runs on BigQuery also runs in [DuckDB](https://duckdb.org). DuckDB
is used here as a local stand-in for BigQuery: it runs in-process, needs no GCP
project, billing, or network, and supports the features these views exercise
(`QUALIFY`, window frames, `IFNULL`, `||` concat). A small shim
(`BQ_SHIM` in `run_parity.py`) rewrites the few BigQuery-only spellings
(backtick identifiers, `SAFE_DIVIDE`) that do not change results.

## How it works

```
data/seed/*.csv ─load─▶ DuckDB ─apply─▶ bigquery/views/*.sql ─run─▶ verify/checks/*.sql
                                                                          │
                                                          compare ▼ against
                                                   verify/expected/parity_checksums.csv (golden)
```

- `verify/checks/*.sql` — **signature queries** that define *what parity means*
  (deterministic row counts and rounded measure sums per converted view). These
  live on `main`; they describe the contract, not the answer.
- `bigquery/views/*.sql` — the **converted views** (the migration deliverable).
  Absent on `main`; produced by the conversion work.
- `verify/expected/parity_checksums.csv` — **golden** metric values.

On `main` (before conversion) there are no files under `bigquery/views/`, so the
signature queries cannot resolve the views and the harness reports the work as
not yet done. Once the converted views exist, every metric must match golden.

## Run it

```bash
pip install -r verify/requirements.txt
python verify/run_parity.py
```

Exit code `0` = all metrics match golden; non-zero = at least one divergence
(the offending `check.metric`, expected, and actual are printed).

## The off-by-one this harness catches

`vw_branch_monthly_performance` translates Teradata `MAVG(volume, 3, month)` — a
3-row moving average (current month + 2 preceding) — to a windowed `AVG`. The
faithful frame is `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`. The tempting but
wrong translation `ROWS BETWEEN 3 PRECEDING AND CURRENT ROW` averages 4 rows. On
the seed data that shifts `sum_moving_avg_volume` from the golden
`6789480.28` to `6764463.37`, and `python verify/run_parity.py` exits non-zero
with a `MISMATCH` on `20_branch_performance.sum_moving_avg_volume`.

## Regenerating seeds (optional)

The dimension seeds are hand-curated. The two fact seeds are derived
deterministically:

```bash
python data/seed/_generate_fact_data.py
```

Output is byte-stable, so golden checksums do not move unless the generator
changes.
