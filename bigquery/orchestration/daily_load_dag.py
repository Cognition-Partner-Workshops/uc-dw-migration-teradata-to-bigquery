"""Cloud Composer / Airflow DAG for the daily banking-DW load.

This replaces the BTEQ dot-command control flow in dml/scripts/bteq_daily_load.btq.
BTEQ's linear script with .IF/.GOTO/.LABEL jumps is re-expressed as an explicit
task graph so control flow lives in the orchestrator, not inside SQL.

BTEQ construct                      -> Airflow / BigQuery
----------------------------------    -----------------------------------------
.LOGON / .LOGOFF                      DAG connection (gcp_conn_id) + task teardown
.QUIT 0 / 4 / 8                       task success / branch to warn / task failure
.IF ACTIVITYCOUNT = 0 THEN .GOTO      BranchPythonOperator on a row-count check
.IF ERRORCODE <> 0 THEN .GOTO         task failure -> trigger_rule + on_failure DAG
.LABEL NOSTAGING / ERRORHANDLER       dedicated warn / fail-handler tasks
VOLATILE TABLE VT_BATCH               a real etl_batch_control row (status RUNNING)
CALL SP_*                             BigQueryInsertJobOperator running the proc

Idempotency: retriable tasks; the batch-control row is keyed by batch_id and the
staging load truncates its date partition, so a full re-run for a date is safe.
"""
from __future__ import annotations

import datetime

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.empty import EmptyOperator
from airflow.operators.python import BranchPythonOperator
from airflow.providers.google.cloud.hooks.bigquery import BigQueryHook
from airflow.providers.google.cloud.operators.bigquery import (
    BigQueryInsertJobOperator,
)
from airflow.utils.trigger_rule import TriggerRule

PROJECT = "{{ var.value.gcp_project }}"
DATASET = "banking_dw"
GCP_CONN_ID = "google_cloud_default"

default_args = {
    "owner": "data-platform",
    "retries": 2,
    "retry_delay": datetime.timedelta(minutes=5),
}


def _read_sql(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _check_staging(**context) -> str:
    """BTEQ Step 1 + `.IF ACTIVITYCOUNT = 0 THEN .GOTO NOSTAGING`."""
    sql = f"""
        SELECT COUNT(*) AS n
        FROM `{PROJECT}.{DATASET}.stg_transactions`
        WHERE load_date = DATE('{{{{ ds }}}}')
    """
    hook = BigQueryHook(gcp_conn_id=GCP_CONN_ID, use_legacy_sql=False)
    rows = hook.get_records(sql)
    return "run_daily_load" if rows and rows[0][0] > 0 else "warn_no_staging"


with DAG(
    dag_id="banking_dw_daily_load",
    description="Daily Teradata->BigQuery banking DW load (from bteq_daily_load.btq)",
    schedule="0 2 * * *",
    start_date=datetime.datetime(2024, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["banking-dw", "bteq-migration"],
) as dag:

    # Staging ingest (bq load) -- replaces Teradata TPT/FastLoad into staging.
    load_staging = BashOperator(
        task_id="load_staging",
        bash_command=(
            "PROJECT={{ var.value.gcp_project }} "
            "LOAD_DATE={{ ds }} "
            "SRC_URI=gs://banking-dw-landing/stg_transactions/{{ ds_nodash }}/*.csv "
            "bash bigquery/scripts/bq_load_daily_transactions.sh"
        ),
    )

    # BTEQ Step 1 branch: staging present?
    check_staging = BranchPythonOperator(
        task_id="check_staging",
        python_callable=_check_staging,
    )

    warn_no_staging = EmptyOperator(task_id="warn_no_staging")  # .LABEL NOSTAGING (.QUIT 4)

    # BTEQ Steps 2-7: the whole SQL body runs as one scripted job. Its internal
    # BEGIN...EXCEPTION mirrors .GOTO ERRORHANDLER and marks the batch FAILED.
    run_daily_load = BigQueryInsertJobOperator(
        task_id="run_daily_load",
        gcp_conn_id=GCP_CONN_ID,
        configuration={
            "query": {
                "query": _read_sql("bigquery/scripts/01_daily_load.sql"),
                "useLegacySql": False,
            }
        },
    )

    # .LABEL ERRORHANDLER: runs only if the load task failed.
    error_handler = BigQueryInsertJobOperator(
        task_id="error_handler",
        gcp_conn_id=GCP_CONN_ID,
        trigger_rule=TriggerRule.ONE_FAILED,
        configuration={
            "query": {
                "query": (
                    f"UPDATE `{PROJECT}.{DATASET}.etl_batch_control` "
                    "SET batch_status='FAILED', end_ts=CURRENT_TIMESTAMP() "
                    "WHERE batch_status='RUNNING'"
                ),
                "useLegacySql": False,
            }
        },
    )

    done = EmptyOperator(task_id="done", trigger_rule=TriggerRule.NONE_FAILED_MIN_ONE_SUCCESS)

    load_staging >> check_staging >> [run_daily_load, warn_no_staging]
    run_daily_load >> [error_handler, done]
    warn_no_staging >> done
