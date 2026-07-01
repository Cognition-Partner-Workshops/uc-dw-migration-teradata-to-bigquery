#!/usr/bin/env bash
# ============================================================================
# Staging ingest for the daily load.
#
# In Teradata, rows landed in BANKING_DW.STG_TRANSACTIONS via TPT / FastLoad /
# MultiLoad before the BTEQ daily-load script ran. On BigQuery the equivalent is
# `bq load` (or the BigQuery Data Transfer Service / storage-write API) into a
# staging table, after which bigquery/scripts/01_daily_load.sql promotes the data
# into FACT_TRANSACTION via the converted procedures.
#
# BTEQ `.LOGON TDPROD/etl_svc_acct,;` -> a GCP service account. Do NOT embed
# credentials (the BTEQ logon relied on an empty/stored password -- flag #6).
# Authenticate the runner with Workload Identity or
# GOOGLE_APPLICATION_CREDENTIALS pointing at a Secret Manager-provisioned key.
#
# Idempotency: the destination is a date-partitioned staging table and we
# truncate the target partition with $WRITE_DISPOSITION=WRITE_TRUNCATE so a
# re-run for the same date replaces (does not duplicate) rows.
# ============================================================================
set -euo pipefail

PROJECT="${PROJECT:?set PROJECT}"
DATASET="${DATASET:-banking_dw}"
LOAD_DATE="${LOAD_DATE:-$(date -u +%F)}"                 # resolves BTEQ's YYYYMMDD
SRC_URI="${SRC_URI:?set SRC_URI, e.g. gs://banking-dw-landing/stg_transactions/${LOAD_DATE}/*.csv}"
# Default the schema to the file shipped alongside this script (resolved from the
# script's own location, not the caller's CWD) so the load does not depend on the
# worker working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA="${SCHEMA:-${SCRIPT_DIR}/../schemas/stg_transactions.json}"
if [[ ! -f "${SCHEMA}" ]]; then
  echo "schema file not found: ${SCHEMA} (set SCHEMA=/path/to/schema.json)" >&2
  exit 2
fi

DEST="${PROJECT}:${DATASET}.stg_transactions\$${LOAD_DATE//-/}"

bq load \
  --project_id="${PROJECT}" \
  --source_format=CSV \
  --field_delimiter='|' \
  --skip_leading_rows=1 \
  --replace \
  --time_partitioning_field=load_date \
  --time_partitioning_type=DAY \
  --schema="${SCHEMA}" \
  "${DEST}" \
  "${SRC_URI}"

echo "Loaded ${SRC_URI} -> ${DEST}"
