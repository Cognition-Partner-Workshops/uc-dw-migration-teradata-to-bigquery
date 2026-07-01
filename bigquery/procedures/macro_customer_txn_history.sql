-- ============================================================================
-- customer_txn_history  (BigQuery table function)
-- Converted from Teradata BANKING_DW.CUSTOMER_TXN_HISTORY (REPLACE MACRO).
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- A Teradata macro that returns a single result set maps cleanly to a BigQuery
-- table-valued function (CREATE TABLE FUNCTION), which can be queried like a
-- table:  SELECT * FROM BANKING_DW.customer_txn_history(1001, DATE '2024-01-01',
--                                                       DATE '2024-03-31', 'ALL');
--
-- Teradata -> BigQuery mappings applied:
--   REPLACE MACRO                   -> CREATE OR REPLACE TABLE FUNCTION
--   :param                          -> named function parameters
--   SEL                            -> SELECT
--   col (FORMAT '...')              -> dropped (format on read with FORMAT() if needed)
--   COALESCE(...)                   -> COALESCE(...) (same)
--   SAMPLE 1000                     -> LIMIT 1000 (see flag below)
--
-- ⚠ FLAGGED MAPPINGS:
--   * Parameter DEFAULTS: the Teradata macro defaulted start_date = DATE - 30,
--     end_date = DATE, txn_type = 'ALL'. BigQuery table functions do NOT support
--     default argument values, so callers must pass all four arguments. A thin
--     wrapper proc or the caller should supply CURRENT_DATE()-based defaults.
--   * SAMPLE 1000 in Teradata returns a (pseudo-random) sample of up to 1000
--     rows. Combined with ORDER BY, the intent here is "the 1000 most-recent
--     transactions", so this is mapped to a deterministic ORDER BY ... LIMIT 1000.
--     Use ORDER BY RAND() LIMIT 1000 or TABLESAMPLE for true random sampling.
-- ============================================================================
CREATE OR REPLACE TABLE FUNCTION BANKING_DW.customer_txn_history(
    cust_id INT64,
    start_date DATE,
    end_date DATE,
    txn_type STRING
) AS (
    SELECT
        ft.TRANSACTION_DATE AS TXN_DATE,
        ft.TRANSACTION_TIME AS TXN_TIME,
        a.ACCOUNT_ID,
        a.ACCOUNT_TYPE,
        ft.TRANSACTION_TYPE,
        ft.TRANSACTION_SUBTYPE,
        ft.CHANNEL,
        ft.TRANSACTION_AMOUNT AS AMOUNT,
        ft.TRANSACTION_CURRENCY AS CCY,
        ft.RUNNING_BALANCE AS BALANCE,
        COALESCE(ft.MERCHANT_NAME, ft.COUNTERPARTY_ACCT, '--') AS PAYEE,
        ft.DESCRIPTION_TEXT AS DESCRIPTION,
        ft.REFERENCE_NUMBER AS REF_NO
    FROM BANKING_DW.FACT_TRANSACTION ft
    INNER JOIN BANKING_DW.DIM_ACCOUNT a
        ON ft.ACCOUNT_KEY = a.ACCOUNT_KEY AND a.CURRENT_FLAG = 'Y'
    INNER JOIN BANKING_DW.DIM_CUSTOMER c
        ON ft.CUSTOMER_KEY = c.CUSTOMER_KEY AND c.CURRENT_FLAG = 'Y'
    WHERE c.CUSTOMER_ID = cust_id
      AND ft.TRANSACTION_DATE BETWEEN start_date AND end_date
      AND (ft.TRANSACTION_TYPE = txn_type OR txn_type = 'ALL')
    ORDER BY ft.TRANSACTION_DATE DESC, ft.TRANSACTION_TIME DESC
    LIMIT 1000
);
