-- ============================================================================
-- daily_balance_check  (BigQuery scripting procedure)
-- Converted from Teradata BANKING_DW.DAILY_BALANCE_CHECK (REPLACE MACRO).
-- Target dialect: BigQuery Standard SQL (GoogleSQL) scripting.
--
-- The Teradata macro emits TWO independently-shaped result sets, so it is mapped
-- to a stored procedure that runs both SELECTs (each returns a result set) rather
-- than a table function (a TVF returns a single fixed shape).
--   CALL BANKING_DW.daily_balance_check(DATE '2024-01-31');
--
-- Teradata -> BigQuery mappings applied:
--   REPLACE MACRO                   -> CREATE OR REPLACE PROCEDURE
--   :check_date                     -> procedure parameter check_date
--   SEL                            -> SELECT
--   col (FORMAT '...')              -> dropped (format on read if needed)
--   a || ' ' || b                   -> supported in GoogleSQL
--   QUALIFY ROW_NUMBER()            -> pushed into a CTE (see flag)
--
-- ⚠ FLAGGED SOURCE LOGIC (reproduced faithfully as intended):
--   The source's first query mixes QUALIFY ROW_NUMBER() OVER (PARTITION BY
--   ACCOUNT_KEY ...) with GROUP BY ACCOUNT_TYPE/CURRENCY. The intent is
--   "take each account's latest transaction on check_date (its end-of-day
--   balance), THEN aggregate those balances by account type/currency." That
--   ordering (row-level dedup before grouping) is expressed here with an
--   explicit CTE so the semantics are unambiguous on BigQuery.
-- ============================================================================
CREATE OR REPLACE PROCEDURE BANKING_DW.daily_balance_check(
    IN check_date DATE
)
BEGIN
    -- Result set 1: balance summary by account type / currency.
    WITH latest_per_account AS (
        SELECT
            a.ACCOUNT_TYPE,
            a.CURRENCY_CODE,
            ft.ACCOUNT_KEY,
            ft.RUNNING_BALANCE
        FROM BANKING_DW.DIM_ACCOUNT a
        INNER JOIN BANKING_DW.FACT_TRANSACTION ft
            ON a.ACCOUNT_KEY = ft.ACCOUNT_KEY
        WHERE a.CURRENT_FLAG = 'Y'
          AND a.ACCOUNT_STATUS = 'ACTIVE'
          AND ft.TRANSACTION_DATE = check_date
        QUALIFY ROW_NUMBER() OVER (PARTITION BY ft.ACCOUNT_KEY
                                   ORDER BY ft.TRANSACTION_TS DESC) = 1
    )
    SELECT
        'BALANCE_SUMMARY' AS CHECK_TYPE,
        ACCOUNT_TYPE,
        CURRENCY_CODE,
        COUNT(*) AS ACCOUNT_COUNT,
        SUM(RUNNING_BALANCE) AS TOTAL_BALANCE,
        AVG(RUNNING_BALANCE) AS AVG_BALANCE,
        MIN(RUNNING_BALANCE) AS MIN_BALANCE,
        MAX(RUNNING_BALANCE) AS MAX_BALANCE
    FROM latest_per_account
    GROUP BY ACCOUNT_TYPE, CURRENCY_CODE
    ORDER BY ACCOUNT_TYPE, CURRENCY_CODE;

    -- Result set 2: accounts with negative balances (excluding credit products).
    SELECT
        'NEGATIVE_BALANCE_ALERT' AS CHECK_TYPE,
        a.ACCOUNT_ID,
        c.FIRST_NAME || ' ' || c.LAST_NAME AS CUSTOMER_NAME,
        a.ACCOUNT_TYPE,
        ft.RUNNING_BALANCE AS CURRENT_BALANCE,
        a.OVERDRAFT_LIMIT AS OVERDRAFT_LIMIT,
        ft.RUNNING_BALANCE - a.OVERDRAFT_LIMIT AS OVER_LIMIT_AMOUNT
    FROM BANKING_DW.DIM_ACCOUNT a
    INNER JOIN BANKING_DW.DIM_CUSTOMER c
        ON a.CUSTOMER_ID = c.CUSTOMER_ID AND c.CURRENT_FLAG = 'Y'
    INNER JOIN BANKING_DW.FACT_TRANSACTION ft
        ON a.ACCOUNT_KEY = ft.ACCOUNT_KEY
    WHERE a.CURRENT_FLAG = 'Y'
      AND a.ACCOUNT_TYPE NOT IN ('CREDIT_CARD', 'LOAN')
      AND ft.TRANSACTION_DATE = check_date
      AND ft.RUNNING_BALANCE < 0
    QUALIFY ROW_NUMBER() OVER (PARTITION BY ft.ACCOUNT_KEY
                               ORDER BY ft.TRANSACTION_TS DESC) = 1
    ORDER BY ft.RUNNING_BALANCE ASC;
END;
