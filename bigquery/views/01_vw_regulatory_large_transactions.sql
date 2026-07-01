-- Converted from BANKING_DW.VW_REGULATORY_LARGE_TRANSACTIONS (Teradata).
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery translation notes:
--   SEL                    -> SELECT
--   LOCKING ROW FOR ACCESS -> dropped (BigQuery has no read locks)
--   col (NOT CASESPECIFIC) -> dropped (case-sensitivity hint; use UPPER/LOWER
--                             on comparison if case-insensitive match is needed)
--   HASHROW(a, b)          -> FARM_FINGERPRINT(CONCAT(...)) in production. Not
--                             part of the parity signature, so the ROW_HASH
--                             column is omitted from this parity-scoped view.
--   QUALIFY ROW_NUMBER()   -> QUALIFY (native in GoogleSQL) to keep the latest
--                             ETL_BATCH_ID row per TRANSACTION_ID.
--   Surrogate keys ACCOUNT_KEY/CUSTOMER_KEY and CURRENT_FLAG='Y' SCD filters
--   collapse to natural-key joins (ACCOUNT_ID / CUSTOMER_ID / BRANCH_ID) in the
--   parity model, which is single-version per entity.
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
