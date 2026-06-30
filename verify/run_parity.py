#!/usr/bin/env python3
"""Programmatic parity harness for the Teradata -> BigQuery DW migration.

What it does
------------
1. Loads the committed seed CSVs (`data/seed/*.csv`) into an in-memory DuckDB
   database. DuckDB is used as a local, zero-credential stand-in for BigQuery
   Standard SQL: the converted views are written in the ANSI/GoogleSQL common
   subset so the *same* SQL that runs on BigQuery also runs here.
2. Applies a tiny BigQuery -> DuckDB shim (see `BQ_SHIM`) for the handful of
   dialect differences that do not affect results (backtick identifiers,
   `SAFE_DIVIDE`).
3. Executes the converted view definitions in `bigquery/views/*.sql` (the
   migration deliverable).
4. Runs the parity "signature" queries in `verify/checks/*.sql` and compares the
   resulting metrics against the golden values in
   `verify/expected/parity_checksums.csv`.

Exit code is 0 only if every metric matches golden. On `main` (before the
conversion exists) there are no files under `bigquery/views/`, so the view
queries fail and the harness reports the work as not yet done.

Usage:  python verify/run_parity.py
"""
from __future__ import annotations

import csv
import glob
import os
import re
import sys

try:
    import duckdb
except ImportError:
    sys.exit("duckdb is required: pip install -r verify/requirements.txt")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_DIR = os.path.join(ROOT, "data", "seed")
VIEWS_DIR = os.path.join(ROOT, "bigquery", "views")
CHECKS_DIR = os.path.join(ROOT, "verify", "checks")
GOLDEN = os.path.join(ROOT, "verify", "expected", "parity_checksums.csv")
TOLERANCE = 0.01  # absolute tolerance for numeric metrics

# Natural-key seed tables the converted views read from.
SEED_TABLES = {
    "dim_customer": "dim_customer_sample.csv",
    "dim_account": "dim_account_sample.csv",
    "dim_product": "dim_product_sample.csv",
    "dim_branch": "dim_branch_sample.csv",
    "fact_transaction": "fact_transaction_sample.csv",
    "fact_monthly_account_snapshot": "fact_monthly_account_snapshot_sample.csv",
}

# Minimal BigQuery -> DuckDB rewrites that preserve semantics.
BQ_SHIM = [
    (re.compile(r"`([A-Za-z0-9_]+)`"), r"\1"),  # strip backtick identifiers
    (re.compile(r"\bSAFE_DIVIDE\s*\(([^,]+),([^)]+)\)"), r"(\1 / NULLIF(\2, 0))"),
]


def load_seeds(con: duckdb.DuckDBPyConnection) -> None:
    for table, fname in SEED_TABLES.items():
        path = os.path.join(SEED_DIR, fname)
        if not os.path.exists(path):
            sys.exit(f"missing seed file: {path}")
        con.execute(
            f"CREATE TABLE {table} AS "
            f"SELECT * FROM read_csv_auto('{path}', delim='|', header=true)"
        )


def shim(sql: str) -> str:
    for pat, repl in BQ_SHIM:
        sql = pat.sub(repl, sql)
    return sql


def apply_views(con: duckdb.DuckDBPyConnection) -> list[str]:
    files = sorted(glob.glob(os.path.join(VIEWS_DIR, "*.sql")))
    if not files:
        print("  (no converted views found under bigquery/views/)")
    for f in files:
        with open(f) as fh:
            con.execute(shim(fh.read()))
    return files


def read_golden() -> dict[tuple[str, str], float]:
    golden: dict[tuple[str, str], float] = {}
    with open(GOLDEN, newline="") as fh:
        for row in csv.DictReader(fh):
            golden[(row["check"], row["metric"])] = float(row["value"])
    return golden


def run_checks(con: duckdb.DuckDBPyConnection) -> dict[tuple[str, str], float]:
    actual: dict[tuple[str, str], float] = {}
    for f in sorted(glob.glob(os.path.join(CHECKS_DIR, "*.sql"))):
        check = os.path.splitext(os.path.basename(f))[0]
        with open(f) as fh:
            cur = con.execute(shim(fh.read()))
        cols = [d[0] for d in cur.description]
        row = cur.fetchone()
        for col, val in zip(cols, row):
            actual[(check, col)] = float(val) if val is not None else 0.0
    return actual


def main() -> int:
    con = duckdb.connect()
    load_seeds(con)
    try:
        apply_views(con)
    except Exception as exc:  # noqa: BLE001 - report as a parity failure
        print(f"FAILED to apply converted views: {exc}")
        print("\nRESULT: FAIL — conversion incomplete or invalid.")
        return 1

    golden = read_golden()
    try:
        actual = run_checks(con)
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED to run parity checks: {exc}")
        print("\nRESULT: FAIL — converted views do not satisfy the parity queries.")
        return 1

    failures = 0
    width = max(len(c) + len(m) for c, m in golden) + 4
    for key in sorted(golden):
        exp = golden[key]
        got = actual.get(key)
        label = f"{key[0]}.{key[1]}".ljust(width)
        if got is None:
            print(f"  MISSING  {label} expected {exp}")
            failures += 1
        elif abs(got - exp) > TOLERANCE:
            print(f"  MISMATCH {label} expected {exp}  got {got}")
            failures += 1
        else:
            print(f"  ok       {label} {got}")

    print()
    if failures:
        print(f"RESULT: FAIL — {failures} metric(s) diverged from golden.")
        return 1
    print(f"RESULT: PASS — all {len(golden)} parity metrics match golden.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
