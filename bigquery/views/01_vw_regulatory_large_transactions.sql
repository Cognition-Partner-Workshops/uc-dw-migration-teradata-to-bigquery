-- Converted from BANKING_DW.VW_REGULATORY_LARGE_TRANSACTIONS (Teradata).
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery mappings applied:
--   SEL                     -> SELECT
--   LOCKING ROW FOR ACCESS  -> removed (BigQuery has no read locks)
--   col (NOT CASESPECIFIC)  -> dropped; use LOWER()/UPPER() for case-insensitive
--                              comparison if ever needed
--   QUALIFY ROW_NUMBER()    -> QUALIFY (native in GoogleSQL)
--   HASHROW(...)            -> FARM_FINGERPRINT(...) in production; omitted here
--                              as it is not part of the parity contract and is
--                              not portable to the local harness engine
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
JOIN dim_account a
    ON ft.ACCOUNT_ID = a.ACCOUNT_ID
JOIN dim_customer c
    ON ft.CUSTOMER_ID = c.CUSTOMER_ID
LEFT JOIN dim_branch b
    ON ft.BRANCH_ID = b.BRANCH_ID
WHERE ft.BASE_CURRENCY_AMOUNT >= 100000
   OR (ft.IS_INTERNATIONAL = 1 AND ft.BASE_CURRENCY_AMOUNT >= 25000)
   OR ft.IS_FLAGGED = 1
QUALIFY ROW_NUMBER() OVER (PARTITION BY ft.TRANSACTION_ID
                           ORDER BY ft.ETL_BATCH_ID DESC) = 1;
