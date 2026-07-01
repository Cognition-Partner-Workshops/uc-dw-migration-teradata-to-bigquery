-- Converted from BANKING_DW.VW_REGULATORY_LARGE_TRANSACTIONS (Teradata).
-- Source: ddl/views/02_vw_regulatory_large_transactions.sql
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery translation decisions:
--   REPLACE VIEW           -> CREATE OR REPLACE VIEW
--   SEL                    -> SELECT
--   LOCKING ROW FOR ACCESS -> dropped (BigQuery has no read locks)
--   col (NOT CASESPECIFIC) -> dropped; use LOWER()/UPPER() for case-insensitive
--                             comparison if ever needed
--   HASHROW(a, b)          -> FARM_FINGERPRINT(...) on BigQuery. Not part of the
--                             parity contract, so omitted here to keep the view
--                             in the DuckDB-runnable common subset.
--   QUALIFY ROW_NUMBER()   -> QUALIFY (native GoogleSQL)
--   surrogate *_KEY joins  -> natural-key joins (ACCOUNT_ID / CUSTOMER_ID /
--                             BRANCH_ID) per the harness seed model.
--
-- COLUMNS OMITTED vs. the Teradata source: TRANSACTION_TS, TRANSACTION_SUBTYPE,
-- COUNTERPARTY_ACCT, REFERENCE_NUMBER, DESCRIPTION_TEXT and ROW_HASH (HASHROW).
-- These are NOT present in the parity harness seed model (data/seed/
-- fact_transaction_sample.csv), so selecting them would break the local run; they
-- are outside the parity contract. Restore them against the real FACT_TRANSACTION
-- at cutover if downstream consumers need them (see MIGRATION_RUNBOOK flag #9).
CREATE OR REPLACE VIEW vw_regulatory_large_transactions AS
SELECT
    ft.TRANSACTION_ID,
    ft.TRANSACTION_DATE,
    c.CUSTOMER_ID,
    c.FIRST_NAME,
    c.LAST_NAME,
    c.KYC_STATUS,
    a.ACCOUNT_ID,
    a.ACCOUNT_TYPE,
    ft.TRANSACTION_TYPE,
    ft.TRANSACTION_AMOUNT,
    ft.TRANSACTION_CURRENCY,
    ft.BASE_CURRENCY_AMOUNT,
    ft.MERCHANT_NAME,
    ft.IS_INTERNATIONAL,
    b.BRANCH_NAME,
    b.REGION,
    CASE
        WHEN ft.BASE_CURRENCY_AMOUNT >= 100000 THEN 'THRESHOLD_EXCEEDED'
        WHEN ft.IS_INTERNATIONAL = 1
             AND ft.BASE_CURRENCY_AMOUNT >= 25000 THEN 'INTL_THRESHOLD'
        WHEN ft.IS_FLAGGED = 1 THEN 'FLAGGED_SUSPICIOUS'
        ELSE 'REVIEW'
    END AS reporting_category,
    ft.ETL_BATCH_ID
FROM fact_transaction ft
INNER JOIN dim_account a
    ON ft.ACCOUNT_ID = a.ACCOUNT_ID
INNER JOIN dim_customer c
    ON ft.CUSTOMER_ID = c.CUSTOMER_ID
LEFT JOIN dim_branch b
    ON ft.BRANCH_ID = b.BRANCH_ID
WHERE ft.BASE_CURRENCY_AMOUNT >= 100000
   OR (ft.IS_INTERNATIONAL = 1 AND ft.BASE_CURRENCY_AMOUNT >= 25000)
   OR ft.IS_FLAGGED = 1
QUALIFY ROW_NUMBER() OVER (PARTITION BY ft.TRANSACTION_ID
                           ORDER BY ft.ETL_BATCH_ID DESC) = 1;
