#!/usr/bin/env python3
"""Generate deterministic fact seed data for the Teradata->BigQuery parity harness.

The dimension seeds (dim_customer, dim_account, dim_product, dim_branch) are
hand-curated and committed. This script derives two coherent *fact* tables from
them so the verification harness has a runnable, reproducible star schema:

  - fact_transaction_sample.csv            (transaction-grain)
  - fact_monthly_account_snapshot_sample.csv (account x month grain)

The harness uses natural keys (ACCOUNT_ID, CUSTOMER_ID, BRANCH_ID) rather than
the surrogate keys (ACCOUNT_KEY/CUSTOMER_KEY) of the production Teradata model —
this keeps the local DuckDB parity run self-contained while preserving the
analytic shapes (cumulative sum, moving average, regulatory thresholds).

Output is fully deterministic (fixed seed + pure arithmetic), so regenerating
yields byte-identical CSVs and stable golden checksums.
"""
from __future__ import annotations

import csv
import os
from datetime import date
from calendar import monthrange

SEED_DIR = os.path.dirname(os.path.abspath(__file__))
DELIM = "|"

# Deterministic months: 2024-01 .. 2025-12 (24 months)
MONTHS = [(y, m) for y in (2024, 2025) for m in range(1, 13)]


def _lcg(n: int) -> float:
    """Deterministic pseudo-random in [0,1) from an integer (no RNG state)."""
    x = (1103515245 * n + 12345) & 0x7FFFFFFF
    return x / 0x7FFFFFFF


def read_accounts() -> list[dict]:
    path = os.path.join(SEED_DIR, "dim_account_sample.csv")
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh, delimiter=DELIM))


def month_end(y: int, m: int) -> date:
    return date(y, m, monthrange(y, m)[1])


def gen_snapshots(accounts: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for acct in accounts:
        acct_id = acct["ACCOUNT_ID"]
        cust_id = acct["CUSTOMER_ID"]
        branch_id = acct["BRANCH_ID"]
        # Deterministic per-account base balance derived from id digits.
        base = 50000 + (sum(int(c) for c in acct_id if c.isdigit()) % 9) * 25000
        for idx, (y, m) in enumerate(MONTHS):
            r = _lcg(idx * 97 + int(branch_id) * 13 + len(acct_id))
            closing = round(base * (1.0 + 0.04 * idx) + r * 10000, 2)
            debits = round(2000 + r * 8000 + idx * 50, 2)
            credits = round(2500 + (1 - r) * 9000 + idx * 60, 2)
            fees = round(20 + (idx % 4) * 5 + r * 15, 2)
            interest = round(closing * 0.0015, 2)
            rows.append(
                {
                    "SNAPSHOT_DATE": month_end(y, m).isoformat(),
                    "SNAPSHOT_MONTH_KEY": f"{y}{m:02d}",
                    "ACCOUNT_ID": acct_id,
                    "CUSTOMER_ID": cust_id,
                    "BRANCH_ID": branch_id,
                    "PRODUCT_ID": acct["PRODUCT_ID"],
                    "OPENING_BALANCE": round(closing - credits + debits, 2),
                    "CLOSING_BALANCE": closing,
                    "TOTAL_DEBITS": debits,
                    "TOTAL_CREDITS": credits,
                    "DEBIT_COUNT": 5 + (idx % 7),
                    "CREDIT_COUNT": 3 + (idx % 5),
                    "FEES_CHARGED": fees,
                    "INTEREST_CHARGED": interest,
                    "CURRENCY_CODE": acct["CURRENCY_CODE"],
                    "ETL_BATCH_ID": 20240000 + idx,
                }
            )
    return rows


def gen_transactions(accounts: list[dict]) -> list[dict]:
    rows: list[dict] = []
    txn_id = 9_000_000_000
    types = ["DEBIT", "CREDIT", "TRANSFER", "FEE", "INTEREST"]
    channels = ["BRANCH", "ATM", "ONLINE", "MOBILE", "POS"]
    for acct in accounts:
        acct_id = acct["ACCOUNT_ID"]
        cust_id = acct["CUSTOMER_ID"]
        branch_id = acct["BRANCH_ID"]
        # ~25 transactions per account, spread across the 24 months.
        for k in range(25):
            txn_id += 1
            r = _lcg(txn_id)
            y, m = MONTHS[k % len(MONTHS)]
            day = 1 + int(r * 27)
            # Occasional large / international / flagged rows to exercise the
            # regulatory reporting view thresholds.
            if k % 11 == 0:
                amount = round(100000 + r * 250000, 2)  # exceeds 100k threshold
            elif k % 7 == 0:
                amount = round(25000 + r * 40000, 2)  # intl threshold band
            else:
                amount = round(50 + r * 9000, 2)
            is_intl = 1 if k % 7 == 0 else 0
            is_flagged = 1 if k % 13 == 0 else 0
            currency = "EUR" if is_intl else "NOK"
            rate = 11.5 if currency == "EUR" else 1.0
            rows.append(
                {
                    "TRANSACTION_ID": txn_id,
                    "TRANSACTION_DATE": date(y, m, day).isoformat(),
                    "ACCOUNT_ID": acct_id,
                    "CUSTOMER_ID": cust_id,
                    "BRANCH_ID": branch_id,
                    "PRODUCT_ID": acct["PRODUCT_ID"],
                    "TRANSACTION_TYPE": types[k % len(types)],
                    "CHANNEL": channels[k % len(channels)],
                    "TRANSACTION_AMOUNT": amount,
                    "TRANSACTION_CURRENCY": currency,
                    "BASE_CURRENCY_AMOUNT": round(amount * rate, 2),
                    "IS_INTERNATIONAL": is_intl,
                    "IS_FLAGGED": is_flagged,
                    "MERCHANT_NAME": f"MERCHANT-{(txn_id % 50):02d}",
                    "ETL_BATCH_ID": 20240000 + (k % 24),
                }
            )
    return rows


def write_csv(name: str, rows: list[dict]) -> None:
    path = os.path.join(SEED_DIR, name)
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), delimiter=DELIM)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows):>5} rows -> {name}")


def main() -> None:
    accounts = read_accounts()
    write_csv("fact_monthly_account_snapshot_sample.csv", gen_snapshots(accounts))
    write_csv("fact_transaction_sample.csv", gen_transactions(accounts))


if __name__ == "__main__":
    main()
