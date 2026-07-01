"""Cloud Composer / Airflow DAG for the monthly regulatory/management extracts.

Replaces the BTEQ control flow in dml/scripts/bteq_extract_report.btq. Each
`.EXPORT ... ; SEL ...; .EXPORT RESET;` block is one EXPORT DATA statement; the
`.IF ACTIVITYCOUNT = 0 THEN .GOTO NODATA` guard becomes a branch on a row count.

BTEQ construct                    -> Airflow / BigQuery
--------------------------------    -------------------------------------------
.EXPORT DATA / REPORT FILE=...      EXPORT DATA OPTIONS(uri=gs://...) AS SELECT
.EXPORT RESET                       end of the EXPORT DATA statement
.IF ACTIVITYCOUNT = 0 -> .GOTO      BranchPythonOperator on a COUNT(*) probe
.LABEL NODATA (.QUIT 4)             warn task
literal YYYYMM / YYYYMMDD in URI    resolved by the orchestrator ({{ ds }} etc.)

Idempotency: EXPORT DATA uses overwrite=true, so re-running a month re-writes the
same GCS prefix rather than appending.
"""
from __future__ import annotations

import datetime

from airflow import DAG
from airflow.operators.empty import EmptyOperator
from airflow.operators.python import BranchPythonOperator
from airflow.providers.google.cloud.hooks.bigquery import BigQueryHook
from airflow.providers.google.cloud.operators.bigquery import (
    BigQueryInsertJobOperator,
)

PROJECT = "{{ var.value.gcp_project }}"
DATASET = "banking_dw"
GCP_CONN_ID = "google_cloud_default"

default_args = {"owner": "data-platform", "retries": 1}


def _read_sql(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _has_large_txns(**context) -> str:
    """BTEQ `.IF ACTIVITYCOUNT = 0 THEN .GOTO NODATA` after Export 1."""
    sql = f"""
        SELECT COUNT(*) AS n
        FROM `{PROJECT}.{DATASET}.vw_regulatory_large_transactions`
        WHERE transaction_date
              BETWEEN DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH) AND CURRENT_DATE()
    """
    hook = BigQueryHook(gcp_conn_id=GCP_CONN_ID, use_legacy_sql=False)
    rows = hook.get_records(sql)
    return "run_extracts" if rows and rows[0][0] > 0 else "warn_no_data"


with DAG(
    dag_id="banking_dw_monthly_extract",
    description="Monthly regulatory/management extracts (from bteq_extract_report.btq)",
    schedule="0 4 2 * *",  # 04:00 on the 2nd of each month
    start_date=datetime.datetime(2024, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["banking-dw", "bteq-migration"],
) as dag:

    check_data = BranchPythonOperator(
        task_id="check_data", python_callable=_has_large_txns
    )

    warn_no_data = EmptyOperator(task_id="warn_no_data")  # .LABEL NODATA (.QUIT 4)

    run_extracts = BigQueryInsertJobOperator(
        task_id="run_extracts",
        gcp_conn_id=GCP_CONN_ID,
        configuration={
            "query": {
                "query": _read_sql("bigquery/scripts/02_extract_report.sql"),
                "useLegacySql": False,
            }
        },
    )

    done = EmptyOperator(task_id="done", trigger_rule="none_failed_min_one_success")

    check_data >> [run_extracts, warn_no_data] >> done
