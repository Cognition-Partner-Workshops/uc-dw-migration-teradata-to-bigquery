# Playbook: Convert a Teradata Data Warehouse to BigQuery (with a parity loop)

Macro suggestion: `!convert-teradata-to-bigquery`

## Overview

Convert a Teradata warehouse (DDL, views, stored procedures, macros, BTEQ) to
**BigQuery Standard SQL (GoogleSQL)** and **prove** the conversion with a
programmatic parity harness. The guiding principle: *confidence comes from a
verification loop that catches real divergences — not from review by eye.* The
work is not done until the parity harness is green.

## Required from user

- **The source repo** — a Teradata warehouse laid out as `ddl/`, `dml/`,
  `data/seed/`, with a parity harness under `verify/`.
- **The verification** — `python verify/run_parity.py` (loads seeds, applies the
  converted views, compares signature metrics to golden). This is the source of
  truth for "done".
- **Target scope** — which objects to convert first (default: the three analytic
  views the harness checks, then tables, then procedures/macros/BTEQ).

## Procedure

1. **Orient.** Read `docs/teradata_features_reference.md` and
   `docs/bigquery_migration_considerations.md`. Note the Teradata-specific
   constructs in scope: `SET/MULTISET`, PI/PPI, `COMPRESS`, `NOT CASESPECIFIC`,
   `QUALIFY`, `ZEROIFNULL`/`NULLIFZERO`, `CSUM`, `MAVG`, `HASHROW`, `FORMAT`,
   `ADD_MONTHS`, BTEQ dot-commands.
2. **Establish the baseline.** Run `python verify/run_parity.py`. On `main` it
   fails (no converted views) — that is the expected before-state.
3. **Convert the views** into `bigquery/views/*.sql` as `CREATE OR REPLACE VIEW`
   statements in GoogleSQL. Apply the feature mappings. Keep the converted SQL in
   the ANSI/GoogleSQL common subset so the harness can execute it locally.
4. **Run the loop.** `python verify/run_parity.py`. Read every `MISMATCH`/`MISSING`
   line, fix the conversion against the feature reference, and re-run until
   `RESULT: PASS`.
5. **Extend** to tables (datatype + partition/cluster mapping), stored procedures
   (→ BigQuery scripting / `MERGE`), macros (→ procedures or table functions),
   and BTEQ (→ `bq load` / `EXPORT DATA` + orchestration). Document decisions in
   `MIGRATION_RUNBOOK.md`.
6. **Fan out for scale (optional).** For a large estate, spawn a child session
   per object group; each converts its slice, runs the harness on its branch, and
   opens its own PR.

## Specifications (postconditions)

- `bigquery/views/` contains valid GoogleSQL for the in-scope views.
- `python verify/run_parity.py` exits `0` — every parity metric matches golden.
- A `MIGRATION_RUNBOOK.md` records each Teradata→BigQuery translation decision.
- The converted SQL is **not merged into `main`** (main stays the durable
  before-state); it lands on a branch / PR.

## Worked example — a real bug the parity loop caught

`vw_branch_monthly_performance` translates Teradata `MAVG(volume, 3, month)` to a
windowed `AVG`. The faithful frame is `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`
(3 rows: current + 2 preceding). The intuitive-but-wrong `ROWS BETWEEN 3
PRECEDING AND CURRENT ROW` averages 4 rows. On the seed data the harness flags:

```
MISMATCH 20_branch_performance.sum_moving_avg_volume  expected 6789480.28  got 6764463.37
```

Fixing the frame to `2 PRECEDING` turns the loop green. This off-by-one is
invisible to eyeball review — the verification loop is what catches it.

## Advice

- Lead with the verification loop; let a real caught divergence build confidence.
- Map `CSUM`/`MAVG`/`QUALIFY`/`ZEROIFNULL` precisely — window frames and
  null-handling are the usual correctness risks.
- Prefer Dataform / Cloud Composer for BTEQ control flow rather than re-creating
  GOTO/LABEL logic inside SQL.

## Forbidden actions

- Do not merge the converted "after" SQL into `main` — keep main the before-state.
- Do not declare success without a green `verify/run_parity.py`.
- Do not hand-edit `verify/expected/parity_checksums.csv` to force a pass — fix
  the conversion, not the golden file.
