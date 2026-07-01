-- ============================================================================
-- Converted from dml/scripts/bteq_extract_report.btq (Teradata BTEQ).
-- Target: BigQuery Standard SQL (GoogleSQL).
--
-- Each BTEQ `.EXPORT DATA/REPORT ... ; SEL ... ; .EXPORT RESET;` block becomes a
-- single `EXPORT DATA OPTIONS(...) AS SELECT ...` statement writing to GCS.
--
-- BTEQ -> BigQuery mapping applied here:
--   .EXPORT DATA FILE=...csv        -> EXPORT DATA OPTIONS(format='CSV')
--   .EXPORT REPORT FILE=...rpt      -> EXPORT DATA OPTIONS(format='CSV', header)
--                                      (fixed-width "REPORT" formatting is a
--                                      presentation concern; do it downstream)
--   col (FORMAT '...') / (CHAR(n))  -> dropped; format on read (FORMAT()) if the
--                                      consumer needs display formatting
--   ADD_MONTHS(CURRENT_DATE, -1)    -> DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH)
--   .IF ACTIVITYCOUNT = 0 / .GOTO   -> ASSERT / branch task in the orchestrator
--   EXEC AML_SCREENING(...)         -> CALL of the converted table-returning proc
--
-- FLAG: the BTEQ destinations embed literal "YYYYMM"/"YYYYMMDD" that BTEQ does
-- NOT substitute (see MIGRATION_RUNBOOK flag #2). The date suffix is supplied by
-- the orchestrator; shown below with FORMAT_DATE() on a bound reporting month.
-- ============================================================================

DECLARE v_report_month DATE DEFAULT DATE_TRUNC(
  DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH), MONTH);
DECLARE v_month_start  DATE DEFAULT DATE_TRUNC(
  DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH), MONTH);
DECLARE v_month_end    DATE DEFAULT LAST_DAY(
  DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH));
DECLARE v_month_key    INT64 DEFAULT
  EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH)) * 100
  + EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH));

-- ----------------------------------------------------------------------------
-- Export 1: Large Transaction Report (CSV for regulatory submission).
-- BTEQ used BETWEEN ADD_MONTHS(CURRENT_DATE,-1) AND CURRENT_DATE. That window is
-- ~1 month wide but anchored on today, not on calendar-month boundaries; kept
-- faithfully here (see flag #3) -- switch to [v_month_start, v_month_end] if a
-- whole calendar month is intended.
-- ----------------------------------------------------------------------------
EXPORT DATA OPTIONS (
  uri = FORMAT('gs://banking-dw-exports/large_txn_report_%d_*.csv', v_month_key),
  format = 'CSV', overwrite = true, header = true
) AS
SELECT
  transaction_id,
  transaction_date,
  customer_id,
  first_name,
  last_name,
  kyc_status,
  account_id,
  account_type,
  transaction_type,
  transaction_amount,
  transaction_currency,
  base_currency_amount,
  is_international,
  reporting_category,
  merchant_name
FROM `banking_dw.vw_regulatory_large_transactions`
WHERE transaction_date BETWEEN DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH)
                           AND CURRENT_DATE()
ORDER BY transaction_date, transaction_id;

-- ----------------------------------------------------------------------------
-- Export 2: Branch Performance Summary.
-- BTEQ `.EXPORT REPORT` (fixed-width) -> CSV; the branch view carries the
-- SNAPSHOT_MONTH_KEY the BTEQ filter computed from ADD_MONTHS(CURRENT_DATE,-1).
-- ----------------------------------------------------------------------------
EXPORT DATA OPTIONS (
  uri = FORMAT('gs://banking-dw-exports/branch_performance_%d_*.csv', v_month_key),
  format = 'CSV', overwrite = true, header = true
) AS
SELECT
  branch_name,
  region,
  snapshot_month_key,
  accounts_serviced,
  total_deposits,
  total_fees,
  region_deposit_rank
FROM `banking_dw.vw_branch_monthly_performance`
WHERE snapshot_month_key = v_month_key
ORDER BY region, region_deposit_rank;

-- ----------------------------------------------------------------------------
-- Export 3: AML Screening Results.
-- BTEQ `EXEC AML_SCREENING(CURRENT_DATE, 30, 50000.00)` (a multi-result-set
-- macro) -> CALL of the converted table-returning procedure, unioned for export.
-- The screening proc lives in the macros object group; this script only wires
-- the export. Its multiple result sets are unioned by pattern_type here.
-- ----------------------------------------------------------------------------
EXPORT DATA OPTIONS (
  uri = FORMAT('gs://banking-dw-exports/aml_screening_%s_*.csv',
               FORMAT_DATE('%Y%m%d', CURRENT_DATE())),
  format = 'CSV', overwrite = true, header = true
) AS
SELECT *
FROM `banking_dw.tf_aml_screening`(CURRENT_DATE(), 30, 50000.00);
