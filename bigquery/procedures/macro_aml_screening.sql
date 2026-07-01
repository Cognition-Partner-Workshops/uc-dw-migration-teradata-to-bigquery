-- ============================================================================
-- aml_screening  (BigQuery scripting procedure)
-- Converted from Teradata BANKING_DW.AML_SCREENING (REPLACE MACRO).
-- Target dialect: BigQuery Standard SQL (GoogleSQL) scripting.
--
-- The macro emits THREE differently-shaped result sets (one per AML pattern),
-- so it maps to a stored procedure rather than a single table function.
--   CALL BANKING_DW.aml_screening(DATE '2024-03-31', 30, 50000.00);
--   -- pass NULLs to fall back to the Teradata macro defaults.
--
-- Teradata -> BigQuery mappings applied:
--   REPLACE MACRO                   -> CREATE OR REPLACE PROCEDURE
--   :param DEFAULT ...              -> nullable params + IFNULL() defaults (see flag)
--   SEL                            -> SELECT
--   col (FORMAT '...')              -> dropped (format on read if needed)
--   a || ' ' || b                   -> supported in GoogleSQL
--   (d1 - d2) day arithmetic        -> DATE_DIFF(d1, d2, DAY)
--   (:date - n)                     -> DATE_SUB(date, INTERVAL n DAY)
--   cr.CREDIT_DATE + 3              -> DATE_ADD(cr.CREDIT_DATE, INTERVAL 3 DAY)
--
-- ⚠ FLAGGED MAPPING: BigQuery procedures/TVFs do not support default argument
--   values. The Teradata macro defaulted screening_date = DATE (today),
--   lookback_days = 30, amount_threshold = 50000.00. Those defaults are applied
--   here via IFNULL() so callers may pass NULL to get macro-equivalent behavior.
-- ============================================================================
CREATE OR REPLACE PROCEDURE BANKING_DW.aml_screening(
    IN screening_date DATE,
    IN lookback_days INT64,
    IN amount_threshold NUMERIC
)
BEGIN
    DECLARE v_screening_date DATE;
    DECLARE v_lookback_days INT64;
    DECLARE v_amount_threshold NUMERIC;

    -- Apply Teradata macro defaults when arguments are NULL.
    SET v_screening_date = IFNULL(screening_date, CURRENT_DATE());
    SET v_lookback_days = IFNULL(lookback_days, 30);
    SET v_amount_threshold = IFNULL(amount_threshold, 50000.00);

    -- Pattern 1: Structuring — multiple transactions just below threshold.
    SELECT
        'STRUCTURING' AS PATTERN_TYPE,
        c.CUSTOMER_ID,
        c.FIRST_NAME || ' ' || c.LAST_NAME AS CUSTOMER_NAME,
        c.KYC_STATUS,
        a.ACCOUNT_ID,
        COUNT(*) AS TXN_COUNT,
        SUM(ft.BASE_CURRENCY_AMOUNT) AS TOTAL_AMOUNT,
        AVG(ft.BASE_CURRENCY_AMOUNT) AS AVG_AMOUNT,
        MAX(ft.TRANSACTION_DATE) AS LAST_TXN_DATE
    FROM BANKING_DW.FACT_TRANSACTION ft
    INNER JOIN BANKING_DW.DIM_ACCOUNT a
        ON ft.ACCOUNT_KEY = a.ACCOUNT_KEY AND a.CURRENT_FLAG = 'Y'
    INNER JOIN BANKING_DW.DIM_CUSTOMER c
        ON ft.CUSTOMER_KEY = c.CUSTOMER_KEY AND c.CURRENT_FLAG = 'Y'
    WHERE ft.TRANSACTION_DATE BETWEEN DATE_SUB(v_screening_date, INTERVAL v_lookback_days DAY)
                                  AND v_screening_date
      AND ft.TRANSACTION_TYPE IN ('CREDIT', 'DEBIT')
      AND ft.BASE_CURRENCY_AMOUNT BETWEEN (v_amount_threshold * 0.8) AND v_amount_threshold
    GROUP BY c.CUSTOMER_ID, c.FIRST_NAME, c.LAST_NAME, c.KYC_STATUS, a.ACCOUNT_ID
    HAVING COUNT(*) >= 3
    ORDER BY SUM(ft.BASE_CURRENCY_AMOUNT) DESC;

    -- Pattern 2: Rapid movement — large deposits followed by immediate withdrawals.
    SELECT
        'RAPID_MOVEMENT' AS PATTERN_TYPE,
        c.CUSTOMER_ID,
        c.FIRST_NAME || ' ' || c.LAST_NAME AS CUSTOMER_NAME,
        a.ACCOUNT_ID,
        cr.CREDIT_DATE,
        cr.CREDIT_AMOUNT,
        dr.DEBIT_DATE,
        dr.DEBIT_AMOUNT,
        DATE_DIFF(dr.DEBIT_DATE, cr.CREDIT_DATE, DAY) AS DAYS_BETWEEN
    FROM BANKING_DW.DIM_CUSTOMER c
    INNER JOIN BANKING_DW.DIM_ACCOUNT a
        ON c.CUSTOMER_ID = a.CUSTOMER_ID AND a.CURRENT_FLAG = 'Y'
    INNER JOIN (
        SELECT ACCOUNT_KEY, TRANSACTION_DATE AS CREDIT_DATE,
               BASE_CURRENCY_AMOUNT AS CREDIT_AMOUNT
        FROM BANKING_DW.FACT_TRANSACTION
        WHERE TRANSACTION_TYPE = 'CREDIT'
          AND BASE_CURRENCY_AMOUNT >= v_amount_threshold
          AND TRANSACTION_DATE BETWEEN DATE_SUB(v_screening_date, INTERVAL v_lookback_days DAY)
                                   AND v_screening_date
    ) cr ON a.ACCOUNT_KEY = cr.ACCOUNT_KEY
    INNER JOIN (
        SELECT ACCOUNT_KEY, TRANSACTION_DATE AS DEBIT_DATE,
               BASE_CURRENCY_AMOUNT AS DEBIT_AMOUNT
        FROM BANKING_DW.FACT_TRANSACTION
        WHERE TRANSACTION_TYPE IN ('DEBIT', 'TRANSFER')
          AND BASE_CURRENCY_AMOUNT >= v_amount_threshold * 0.9
          AND TRANSACTION_DATE BETWEEN DATE_SUB(v_screening_date, INTERVAL v_lookback_days DAY)
                                   AND v_screening_date
    ) dr ON cr.ACCOUNT_KEY = dr.ACCOUNT_KEY
        AND dr.DEBIT_DATE BETWEEN cr.CREDIT_DATE AND DATE_ADD(cr.CREDIT_DATE, INTERVAL 3 DAY)
    WHERE c.CURRENT_FLAG = 'Y'
    ORDER BY cr.CREDIT_AMOUNT DESC;

    -- Pattern 3: International high-value transactions from newly onboarded customers.
    SELECT
        'NEW_CUSTOMER_INTL' AS PATTERN_TYPE,
        c.CUSTOMER_ID,
        c.FIRST_NAME || ' ' || c.LAST_NAME AS CUSTOMER_NAME,
        c.ONBOARDING_DATE,
        DATE_DIFF(v_screening_date, c.ONBOARDING_DATE, DAY) AS DAYS_SINCE_ONBOARD,
        c.KYC_STATUS,
        COUNT(*) AS INTL_TXN_COUNT,
        SUM(ft.BASE_CURRENCY_AMOUNT) AS TOTAL_INTL_AMOUNT
    FROM BANKING_DW.FACT_TRANSACTION ft
    INNER JOIN BANKING_DW.DIM_CUSTOMER c
        ON ft.CUSTOMER_KEY = c.CUSTOMER_KEY AND c.CURRENT_FLAG = 'Y'
    WHERE ft.IS_INTERNATIONAL = 1
      AND ft.TRANSACTION_DATE BETWEEN DATE_SUB(v_screening_date, INTERVAL v_lookback_days DAY)
                                  AND v_screening_date
      AND c.ONBOARDING_DATE >= DATE_SUB(v_screening_date, INTERVAL 90 DAY)
    GROUP BY c.CUSTOMER_ID, c.FIRST_NAME, c.LAST_NAME,
             c.ONBOARDING_DATE, c.KYC_STATUS
    HAVING SUM(ft.BASE_CURRENCY_AMOUNT) >= v_amount_threshold
    ORDER BY SUM(ft.BASE_CURRENCY_AMOUNT) DESC;
END;
