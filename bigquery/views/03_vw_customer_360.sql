-- Converted from BANKING_DW.VW_CUSTOMER_360 (Teradata).
-- Source: ddl/views/01_vw_customer_360.sql
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery translation decisions:
--   REPLACE VIEW           -> CREATE OR REPLACE VIEW
--   SEL                    -> SELECT
--   LOCKING ROW FOR ACCESS -> dropped (no read locks in BigQuery)
--   ZEROIFNULL(x)          -> IFNULL(x, 0)
--   a || ' ' || b          -> supported in GoogleSQL (or CONCAT)
--   FORMAT 'ZZZ...'        -> dropped; format on read with FORMAT() if needed
--   surrogate *_KEY joins  -> natural-key joins (CUSTOMER_ID) per harness model.
--   90-day txn window      -> lifetime aggregates. The source computes
--                             TXN_*_LAST_90_DAYS via CURRENT_DATE - 90, which is
--                             non-deterministic (depends on run date) and empty
--                             against static seeds. The parity contract asks for
--                             deterministic lifetime aggregates
--                             (total_accounts, lifetime_txn_amount), so this view
--                             sums over all history. On BigQuery, re-add the
--                             90-day window where recency is required:
--                             WHERE transaction_date >=
--                               DATE_ADD(CURRENT_DATE(), INTERVAL -90 DAY).
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
        COUNT(*)                                                   AS total_accounts,
        SUM(CASE WHEN ACCOUNT_STATUS = 'ACTIVE' THEN 1 ELSE 0 END) AS active_accounts
    FROM dim_account
    GROUP BY CUSTOMER_ID
) acct
    ON c.CUSTOMER_ID = acct.CUSTOMER_ID
LEFT JOIN (
    SELECT
        CUSTOMER_ID,
        COUNT(*)                        AS lifetime_txn_count,
        SUM(ABS(BASE_CURRENCY_AMOUNT))  AS lifetime_txn_amount,
        MAX(TRANSACTION_DATE)           AS last_txn_date
    FROM fact_transaction
    GROUP BY CUSTOMER_ID
) txn
    ON c.CUSTOMER_ID = txn.CUSTOMER_ID
WHERE c.IS_ACTIVE = 1;
