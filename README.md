# Teradata Data Warehouse — Migration Source for BigQuery

This repository is the **before-state** for a Teradata → **Google BigQuery** data
warehouse migration lifecycle. It contains a realistic Teradata retail-banking
analytics warehouse (DDL, views, stored procedures, macros, BTEQ scripts, seed
data) plus a **programmatic parity harness** that proves a conversion preserves
data semantics — no Teradata instance and no GCP account required.

> Separate from `uc-dw-migration-teradata-to-snowflake`: each source→target
> migration path is its own repo. This one targets **BigQuery**.

## The lifecycle this repo demonstrates

```
Teradata source (main)  ──convert──▶  BigQuery GoogleSQL  ──verify──▶  parity loop green
   DDL / views / SPs           (the work Devin does)        (verify/run_parity.py)
   macros / BTEQ / seed
```

1. **Inventory** the Teradata estate (tables, views, procedures, macros, BTEQ).
2. **Convert** DDL/DML to BigQuery Standard SQL (GoogleSQL), handling Teradata-
   specific constructs (`SET/MULTISET`, PI/PPI, `COMPRESS`, `QUALIFY`,
   `ZEROIFNULL`, `CSUM`, `MAVG`, `HASHROW`, BTEQ).
3. **Verify** with the parity harness — row counts, measure sums, and window-
   function parity gate "done".
4. **Plan cutover** — history backfill, dual-run, reconcile, switch consumers.

## Repository structure

```
├── ddl/
│   ├── tables/             # Teradata CREATE TABLE statements (SET/MULTISET, PI, PPI)
│   └── views/              # Teradata CREATE VIEW statements (QUALIFY, CSUM, MAVG, HASHROW)
├── dml/
│   ├── stored_procedures/  # Teradata stored procedures (SCD2 merge, loads, snapshot)
│   ├── macros/             # Teradata macros (AML screening, balance checks, history)
│   └── scripts/            # BTEQ load/extract scripts
├── data/
│   ├── seed/               # Pipe-delimited seed data (dims hand-curated; facts generated)
│   └── validation/         # Expected row counts + checksum query templates
├── verify/                 # ── Programmatic parity harness (DuckDB-backed) ──
│   ├── run_parity.py       # Loads seeds, applies converted views, checks vs golden
│   ├── checks/             # Signature queries that define the parity contract
│   └── expected/           # Golden checksums
├── docs/                   # Feature mapping + BigQuery migration considerations
├── schemas/                # ER diagram / schema documentation
├── .workshop/playbooks/    # Portable Devin Playbook (drag-and-drop into an org)
└── .agents/skills/         # Repo Skill (auto-loaded by Devin in this repo)
```

The converted BigQuery SQL is intentionally **not on `main`** — producing it is
the migration work. A reference conversion lives on the `bigquery-reference`
branch so the harness can be demonstrated end-to-end.

## Domain: Retail Banking Analytics (Norwegian locale)

Customer / account / product / branch dimensions, a transaction fact, and a
monthly account snapshot fact, plus regulatory-reporting and branch-performance
views. Seed data uses Norwegian names, branches, and NOK currency.

## Quick start — run the parity harness

```bash
pip install -r verify/requirements.txt

# On main (no converted views yet) → harness reports the work as not done:
python verify/run_parity.py        # exits non-zero

# After converting (or: git checkout bigquery-reference) → green:
python verify/run_parity.py        # RESULT: PASS — all parity metrics match golden
```

## Convert with Devin

Drop `.workshop/playbooks/convert-teradata-to-bigquery.devin.md` into your Devin
org (Settings → Playbooks) and run its `!macro` against this repo, or paste:

```
Convert the Teradata DDL and views in this repo to BigQuery Standard SQL under a
new bigquery/ directory, mapping SET/MULTISET, PI/PPI, COMPRESS, QUALIFY,
ZEROIFNULL, CSUM, and MAVG. Then run `python verify/run_parity.py` and iterate
until every parity metric matches golden.
```

Devin auto-loads the repo Skill in `.agents/skills/teradata-to-bigquery/` for the
exact commands, file layout, and the known window-frame pitfall.

## License

MIT — see [LICENSE](LICENSE).
