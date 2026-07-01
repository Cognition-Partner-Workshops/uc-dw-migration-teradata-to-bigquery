-- ============================================================================
-- vw_customer_360
-- Converted from Teradata BANKING_DW.VW_CUSTOMER_360.
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery mappings applied:
--   SEL                        -> SELECT
--   LOCKING ROW FOR ACCESS     -> dropped
--   ZEROIFNULL(x)              -> IFNULL(x, 0)
--   a || ' ' || b              -> supported in GoogleSQL (CONCAT equivalent)
--   col (FORMAT '...')         -> dropped (format on read with FORMAT() if needed)
--
-- Divergence from source (flagged): the production view computes the recent
-- activity block over a rolling 90-day window
-- (TRANSACTION_DATE >= CURRENT_DATE - 90) using SUM(ABS(TRANSACTION_AMOUNT)).
-- The seed/parity model has no CURRENT_DATE relativity, so this view reproduces
-- the deterministic *lifetime* aggregates the parity contract specifies:
-- lifetime_txn_count / lifetime_txn_amount using SUM(ABS(BASE_CURRENCY_AMOUNT)).
--
-- Natural-key note: source joins accounts via ACCOUNT_KEY / CURRENT_FLAG and
-- reads the latest CLOSING_BALANCE per account for TOTAL_BALANCE. The seed model
-- has no SCD2 flags, so account rollups use CUSTOMER_ID directly; TOTAL_BALANCE
-- is out of the parity signature and omitted here.
-- ============================================================================
CREATE OR REPLACE VIEW vw_customer_360 AS
SELECT
    c.CUSTOMER_ID,
    c.FIRST_NAME || ' ' || c.LAST_NAME       AS full_name,
    c.CUSTOMER_SEGMENT,
    c.RISK_SCORE,
    c.CREDIT_RATING,
    c.KYC_STATUS,
    c.ONBOARDING_DATE,
    IFNULL(acct_summary.total_accounts, 0)   AS total_accounts,
    IFNULL(acct_summary.active_accounts, 0)  AS active_accounts,
    IFNULL(txn_summary.lifetime_txn_count, 0)  AS lifetime_txn_count,
    IFNULL(txn_summary.lifetime_txn_amount, 0) AS lifetime_txn_amount,
    txn_summary.last_txn_date,
    c.CITY,
    c.COUNTRY_CODE
FROM dim_customer c
LEFT JOIN (
    SELECT
        CUSTOMER_ID,
        COUNT(*) AS total_accounts,
        SUM(CASE WHEN ACCOUNT_STATUS = 'ACTIVE' THEN 1 ELSE 0 END) AS active_accounts
    FROM dim_account
    GROUP BY CUSTOMER_ID
) acct_summary
    ON c.CUSTOMER_ID = acct_summary.CUSTOMER_ID
LEFT JOIN (
    SELECT
        CUSTOMER_ID,
        COUNT(*) AS lifetime_txn_count,
        SUM(ABS(BASE_CURRENCY_AMOUNT)) AS lifetime_txn_amount,
        MAX(TRANSACTION_DATE) AS last_txn_date
    FROM fact_transaction
    GROUP BY CUSTOMER_ID
) txn_summary
    ON c.CUSTOMER_ID = txn_summary.CUSTOMER_ID
WHERE c.IS_ACTIVE = 1;
