-- ============================================================================
-- Converted from dml/scripts/bteq_extract_report.btq (Teradata BTEQ) -- part 1/2.
-- Target: BigQuery Standard SQL (GoogleSQL).
--
-- This file is Export 1 (Large Transaction Report) ONLY. In the BTEQ source,
-- Export 1 runs UNCONDITIONALLY (it always writes a file, possibly empty); the
-- `.IF ACTIVITYCOUNT = 0 THEN .GOTO NODATA` check happens AFTER Export 1 and only
-- skips Exports 2 & 3. To preserve that behaviour, Export 1 is its own task that
-- always runs; Exports 2 & 3 live in 02b_extract_branch_aml.sql behind the branch.
--
-- BTEQ -> BigQuery mapping applied here:
--   .EXPORT DATA FILE=...csv        -> EXPORT DATA OPTIONS(format='CSV')
--   col (FORMAT '...') / (CHAR(n))  -> dropped; format on read (FORMAT()) if the
--                                      consumer needs display formatting
--   ADD_MONTHS(CURRENT_DATE, -1)    -> DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH)
--
-- FLAG: the BTEQ destination embeds a literal "YYYYMM" that BTEQ does NOT
-- substitute (see MIGRATION_RUNBOOK flag #2); the month suffix is supplied here.
-- FLAG: CURRENT_DATE() reproduces the source and is run-day-relative, not
-- backfill-safe (see flag #10).
-- ============================================================================

DECLARE v_month_key    INT64 DEFAULT
  EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH)) * 100
  + EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH));

-- ----------------------------------------------------------------------------
-- Export 1: Large Transaction Report (CSV for regulatory submission).
-- BTEQ used BETWEEN ADD_MONTHS(CURRENT_DATE,-1) AND CURRENT_DATE. That window is
-- ~1 month wide but anchored on today, not on calendar-month boundaries; kept
-- faithfully here (see flag #3).
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
