-- ============================================================================
-- Converted from dml/scripts/bteq_extract_report.btq (Teradata BTEQ) -- part 2/2.
-- Target: BigQuery Standard SQL (GoogleSQL).
--
-- This file is Exports 2 (Branch Performance) and 3 (AML Screening). In the BTEQ
-- source these run ONLY when Export 1 produced rows: `.IF ACTIVITYCOUNT = 0 THEN
-- .GOTO NODATA` after Export 1 skips both of these. The orchestrator reproduces
-- that by gating this task behind the `check_data` branch (which probes the same
-- large-transaction window Export 1 wrote). See MIGRATION_RUNBOOK flag #11 for a
-- note that Exports 2 & 3 draw from independent data sources, so skipping them
-- when Export 1 is empty faithfully mirrors -- but may not be the intent of --
-- the original BTEQ.
--
-- BTEQ -> BigQuery mapping applied here:
--   .EXPORT REPORT FILE=...rpt      -> EXPORT DATA OPTIONS(format='CSV', header)
--                                      (fixed-width "REPORT" formatting is a
--                                      presentation concern; do it downstream)
--   EXEC AML_SCREENING(...)         -> CALL of the converted table-returning proc
-- ============================================================================

DECLARE v_month_key    INT64 DEFAULT
  EXTRACT(YEAR FROM DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH)) * 100
  + EXTRACT(MONTH FROM DATE_ADD(CURRENT_DATE(), INTERVAL -1 MONTH));

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
