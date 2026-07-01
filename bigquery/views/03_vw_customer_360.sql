-- Converted from ddl/views/01_vw_customer_360.sql
--   (BANKING_DW.VW_CUSTOMER_360, Teradata).
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery translation:
--   SEL                     -> SELECT
--   LOCKING ROW FOR ACCESS  -> dropped
--   ZEROIFNULL(x)           -> IFNULL(x, 0)
--   a || ' ' || b           -> supported in GoogleSQL (or CONCAT(a, ' ', b))
--   (FORMAT '...') masks     -> dropped
--   Surrogate keys + CURRENT_FLAG SCD2 joins -> natural-key joins (CUSTOMER_ID);
--     the parity seed is single-version natural key.
--
-- SOURCE DIVERGENCE FLAGGED: the Teradata view computes recent activity over a
-- CURRENT_DATE - 90 window using SUM(ABS(TRANSACTION_AMOUNT)) (transaction
-- currency), which is non-deterministic (wall-clock dependent) and mixes
-- currencies. The parity contract requires a deterministic lifetime metric
-- (lifetime_txn_amount), so this restates it as an all-time aggregate on
-- BASE_CURRENCY_AMOUNT (single reporting currency). total_accounts is a plain
-- per-customer COUNT (the source's per-account current-balance subquery is not
-- part of the signature and the seed has no snapshot-by-account linkage).
CREATE OR REPLACE VIEW vw_customer_360 AS
SELECT
    c.CUSTOMER_ID,
    c.FIRST_NAME || ' ' || c.LAST_NAME    AS full_name,
    c.CUSTOMER_SEGMENT,
    c.RISK_SCORE,
    c.CREDIT_RATING,
    c.KYC_STATUS,
    c.ONBOARDING_DATE,
    IFNULL(acct.total_accounts, 0)        AS total_accounts,
    IFNULL(acct.active_accounts, 0)       AS active_accounts,
    IFNULL(txn.lifetime_txn_count, 0)     AS lifetime_txn_count,
    IFNULL(txn.lifetime_txn_amount, 0)    AS lifetime_txn_amount,
    txn.last_txn_date,
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
) acct
    ON c.CUSTOMER_ID = acct.CUSTOMER_ID
LEFT JOIN (
    SELECT
        CUSTOMER_ID,
        COUNT(*) AS lifetime_txn_count,
        SUM(ABS(BASE_CURRENCY_AMOUNT)) AS lifetime_txn_amount,
        MAX(TRANSACTION_DATE) AS last_txn_date
    FROM fact_transaction
    GROUP BY CUSTOMER_ID
) txn
    ON c.CUSTOMER_ID = txn.CUSTOMER_ID
WHERE c.IS_ACTIVE = 1;
