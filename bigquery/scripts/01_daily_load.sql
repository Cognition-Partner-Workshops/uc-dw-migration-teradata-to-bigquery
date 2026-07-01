-- ============================================================================
-- Converted from dml/scripts/bteq_daily_load.btq (Teradata BTEQ).
-- Target: BigQuery Standard SQL (GoogleSQL) multi-statement SCRIPT.
--
-- This is the SQL body of the daily load. The BTEQ dot-command control flow
-- (.LOGON/.QUIT/.IF/.GOTO/.LABEL) is NOT re-created inside SQL; it is lifted into
-- the orchestrator (see bigquery/orchestration/daily_load_dag.py and the
-- "BTEQ -> BigQuery orchestration" section of MIGRATION_RUNBOOK.md). What remains
-- here is set-based, idempotent SQL that a single orchestrator task runs.
--
-- BTEQ -> BigQuery mapping applied in this file:
--   .LOGON / .LOGOFF / .QUIT      -> orchestrator connection + task exit status
--   DATABASE BANKING_DW           -> fully-qualified `project.banking_dw.*` names
--   .SET WIDTH/SEPARATOR/TITLE...  -> presentation only; dropped
--   .IF ACTIVITYCOUNT = 0 / .GOTO -> ASSERT / IF in script, or a branch task
--   .IF ERRORCODE <> 0 / .GOTO    -> BEGIN ... EXCEPTION WHEN ERROR block
--   VOLATILE TABLE VT_BATCH        -> script variable + a real batch-control row
--   CALL SP_*                      -> CALL of the converted BigQuery procedures
--   COLLECT STATISTICS / LOCKING   -> dropped (no equivalent in BigQuery)
--
-- NOTE: staging ingest (Teradata TPT/FastLoad into STG_TRANSACTIONS) is a
-- `bq load` step that runs BEFORE this script; see
-- bigquery/scripts/bq_load_daily_transactions.sh.
-- ============================================================================

DECLARE v_batch_date  DATE    DEFAULT CURRENT_DATE();
DECLARE v_batch_id    INT64;
DECLARE v_staged_rows INT64;
DECLARE v_new_rows    INT64;
DECLARE v_changed     INT64;
DECLARE v_rows_ins    INT64;
DECLARE v_rows_rej    INT64;

BEGIN
  -- --------------------------------------------------------------------------
  -- Step 1: Validate staging data (BTEQ Step 1 + `.IF ACTIVITYCOUNT = 0`).
  -- The BTEQ .GOTO NOSTAGING becomes an ASSERT that fails the task cleanly so
  -- the orchestrator can route to the "no staging" warning branch.
  -- --------------------------------------------------------------------------
  SET v_staged_rows = (
    SELECT COUNT(*)
    FROM `banking_dw.stg_transactions`
    WHERE load_date = v_batch_date
  );

  IF v_staged_rows = 0 THEN
    -- Equivalent to BTEQ `.LABEL NOSTAGING; .QUIT 4;` (warning, not error).
    RAISE USING MESSAGE = FORMAT(
      'NOSTAGING: no staging rows for %t', v_batch_date);
  END IF;

  -- --------------------------------------------------------------------------
  -- Step 2: Allocate a new batch id and record the batch as RUNNING.
  -- Replaces the VOLATILE TABLE VT_BATCH pattern. Writing the control row up
  -- front (status RUNNING) fixes a latent BTEQ bug where the error handler read
  -- VT_BATCH before it was created (see MIGRATION_RUNBOOK flag #1).
  -- Concurrency: guard single-writer via the orchestrator; MAX()+1 is not safe
  -- under parallel runs (flag #4).
  -- --------------------------------------------------------------------------
  SET v_batch_id = (
    SELECT COALESCE(MAX(batch_id), 0) + 1
    FROM `banking_dw.etl_batch_control`
  );

  MERGE `banking_dw.etl_batch_control` T
  USING (SELECT v_batch_id AS batch_id) S
  ON T.batch_id = S.batch_id
  WHEN NOT MATCHED THEN
    INSERT (batch_id, batch_date, batch_status, start_ts, end_ts)
    VALUES (v_batch_id, v_batch_date, 'RUNNING', CURRENT_TIMESTAMP(), NULL);

  -- Step 3: SCD2 customer dimension update (BTEQ Step 3).
  CALL `banking_dw.sp_customer_scd2`(v_batch_id, v_new_rows, v_changed);

  -- Step 4: Load daily transactions (BTEQ Step 4).
  CALL `banking_dw.sp_load_daily_transactions`(
    v_batch_date, v_batch_id, v_rows_ins, v_rows_rej);

  -- Step 5: Balance reconciliation (BTEQ Step 5 EXEC DAILY_BALANCE_CHECK).
  -- The Teradata macro returned result sets to the terminal; here we persist the
  -- reconciliation so the result is captured rather than discarded (flag #5).
  CALL `banking_dw.sp_daily_balance_check`(v_batch_date);

  -- Step 6: Export the reconciliation report (BTEQ Step 6 `.EXPORT REPORT`).
  -- The date token in the destination URI is resolved by the orchestrator (BTEQ
  -- did NOT substitute YYYYMMDD -- flag #2); shown here with a bound value.
  EXPORT DATA OPTIONS (
    uri = FORMAT('gs://banking-dw-reports/daily_recon_%s_*.csv',
                 FORMAT_DATE('%Y%m%d', v_batch_date)),
    format = 'CSV', overwrite = true, header = true
  ) AS
  SELECT
    'DAILY_RECONCILIATION' AS report_type,
    v_batch_date           AS report_date,
    v_batch_id             AS batch_id,
    v_staged_rows          AS staged_rows,
    (SELECT COUNT(*) FROM `banking_dw.fact_transaction`
      WHERE etl_batch_id = v_batch_id)                       AS loaded_rows,
    (SELECT COUNT(*) FROM `banking_dw.stg_transaction_errors`
      WHERE batch_id = v_batch_id)                           AS error_rows;

  -- Step 7: Record batch completion (BTEQ Step 7 + implicit `.QUIT 0`).
  UPDATE `banking_dw.etl_batch_control`
  SET batch_status = 'COMPLETED', end_ts = CURRENT_TIMESTAMP()
  WHERE batch_id = v_batch_id;

EXCEPTION WHEN ERROR THEN
  -- BTEQ `.LABEL ERRORHANDLER` / `.IF ERRORCODE <> 0 THEN .GOTO ERRORHANDLER`.
  -- Mark the batch FAILED (idempotent: the RUNNING row already exists from Step
  -- 2, so this cannot fail on a missing VT_BATCH the way the BTEQ script could).
  IF v_batch_id IS NOT NULL THEN
    UPDATE `banking_dw.etl_batch_control`
    SET batch_status = 'FAILED', end_ts = CURRENT_TIMESTAMP()
    WHERE batch_id = v_batch_id;
  END IF;

  INSERT INTO `banking_dw.etl_log` (procedure_name, batch_id, log_level,
                                    log_message, log_ts)
  VALUES ('01_daily_load', v_batch_id, 'ERROR',
          @@error.message, CURRENT_TIMESTAMP());

  RAISE USING MESSAGE = FORMAT('ETL pipeline failed: %s', @@error.message);
END;
