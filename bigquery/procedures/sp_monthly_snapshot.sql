-- ============================================================================
-- sp_monthly_snapshot  (BigQuery scripting procedure)
-- Converted from Teradata BANKING_DW.SP_MONTHLY_SNAPSHOT.
-- Target dialect: BigQuery Standard SQL (GoogleSQL) scripting.
--
-- Purpose: compute month-end account snapshots from transaction activity and
-- MERGE them into FACT_MONTHLY_ACCOUNT_SNAPSHOT. Carries opening balance from
-- the prior month's closing balance.
--
-- Teradata -> BigQuery mappings applied:
--   REPLACE PROCEDURE               -> CREATE OR REPLACE PROCEDURE
--   CREATE VOLATILE TABLE ... WITH DATA / PRIMARY INDEX / ON COMMIT PRESERVE ROWS
--                                   -> CREATE TEMP TABLE ... AS SELECT
--                                      (PI / ON COMMIT clauses dropped)
--   ADD_MONTHS(d, n)                -> DATE_ADD(d, INTERVAL n MONTH)
--   ADD_MONTHS(start,1) - 1         -> DATE_SUB(DATE_ADD(start, INTERVAL 1 MONTH), INTERVAL 1 DAY)
--   CAST('yyyy-mm-01' AS DATE FORMAT ...) -> DATE(year, month, 1)
--   ZEROIFNULL(x)                   -> IFNULL(x, 0)
--   (date2 - date1 + 1) day count   -> DATE_DIFF(date2, date1, DAY) + 1
--   col (SMALLINT)                  -> CAST(... AS INT64)
--   ACTIVITY_COUNT                  -> @@row_count
--   MERGE INTO ... WHEN MATCHED / NOT MATCHED -> MERGE (same syntax in GoogleSQL)
--   DROP TABLE (volatile)           -> DROP TABLE (temp); auto-dropped at script end
--   COLLECT STATISTICS              -> dropped
--
-- Note: TEMP tables live for the duration of the multi-statement script, which
-- matches ON COMMIT PRESERVE ROWS semantics for a single-session procedure.
-- ============================================================================
CREATE OR REPLACE PROCEDURE BANKING_DW.sp_monthly_snapshot(
    IN p_snapshot_year INT64,
    IN p_snapshot_month INT64,
    IN p_batch_id INT64,
    OUT p_rows_merged INT64,
    OUT p_return_code INT64
)
BEGIN
    DECLARE v_snapshot_date DATE;
    DECLARE v_period_start DATE;
    DECLARE v_period_end DATE;
    DECLARE v_prev_snapshot_date DATE;
    DECLARE v_snapshot_month_key INT64;

    SET p_return_code = 0;
    SET p_rows_merged = 0;

    -- Calculate period boundaries.
    SET v_period_start = DATE(p_snapshot_year, p_snapshot_month, 1);
    SET v_period_end = DATE_SUB(DATE_ADD(v_period_start, INTERVAL 1 MONTH), INTERVAL 1 DAY);
    SET v_snapshot_date = v_period_end;
    SET v_snapshot_month_key = (p_snapshot_year * 100) + p_snapshot_month;
    SET v_prev_snapshot_date = DATE_ADD(v_period_start, INTERVAL -1 MONTH);

    -- Volatile table -> TEMP table for aggregated transaction data.
    CREATE TEMP TABLE VT_TXN_AGGREGATES AS
    SELECT
        ft.ACCOUNT_KEY,
        SUM(CASE WHEN ft.TRANSACTION_TYPE IN ('DEBIT', 'FEE')
                 THEN ABS(ft.TRANSACTION_AMOUNT) ELSE 0 END) AS TOTAL_DEBITS,
        SUM(CASE WHEN ft.TRANSACTION_TYPE IN ('CREDIT', 'INTEREST')
                 THEN ft.TRANSACTION_AMOUNT ELSE 0 END) AS TOTAL_CREDITS,
        SUM(CASE WHEN ft.TRANSACTION_TYPE IN ('DEBIT', 'FEE') THEN 1 ELSE 0 END) AS DEBIT_COUNT,
        SUM(CASE WHEN ft.TRANSACTION_TYPE IN ('CREDIT', 'INTEREST') THEN 1 ELSE 0 END) AS CREDIT_COUNT,
        SUM(CASE WHEN ft.TRANSACTION_TYPE = 'INTEREST' AND ft.TRANSACTION_AMOUNT > 0
                 THEN ft.TRANSACTION_AMOUNT ELSE 0 END) AS INTEREST_EARNED,
        SUM(CASE WHEN ft.TRANSACTION_TYPE = 'INTEREST' AND ft.TRANSACTION_AMOUNT < 0
                 THEN ABS(ft.TRANSACTION_AMOUNT) ELSE 0 END) AS INTEREST_CHARGED,
        SUM(CASE WHEN ft.TRANSACTION_TYPE = 'FEE'
                 THEN ABS(ft.TRANSACTION_AMOUNT) ELSE 0 END) AS FEES_CHARGED,
        MIN(ft.RUNNING_BALANCE) AS MIN_BALANCE,
        MAX(ft.RUNNING_BALANCE) AS MAX_BALANCE,
        AVG(ft.RUNNING_BALANCE) AS AVG_BALANCE,
        SUM(CASE WHEN ft.RUNNING_BALANCE < 0 THEN 1 ELSE 0 END) AS OVERDRAFT_DAYS
    FROM BANKING_DW.FACT_TRANSACTION ft
    WHERE ft.TRANSACTION_DATE BETWEEN v_period_start AND v_period_end
    GROUP BY ft.ACCOUNT_KEY;

    -- Merge into snapshot table.
    MERGE INTO BANKING_DW.FACT_MONTHLY_ACCOUNT_SNAPSHOT tgt
    USING (
        SELECT
            v_snapshot_date AS SNAPSHOT_DATE,
            v_snapshot_month_key AS SNAPSHOT_MONTH_KEY,
            a.ACCOUNT_KEY,
            a.CUSTOMER_KEY,
            a.PRODUCT_ID,
            a.BRANCH_ID,
            IFNULL(prev.CLOSING_BALANCE, 0) AS OPENING_BALANCE,
            IFNULL(prev.CLOSING_BALANCE, 0)
                + IFNULL(agg.TOTAL_CREDITS, 0)
                - IFNULL(agg.TOTAL_DEBITS, 0) AS CLOSING_BALANCE,
            IFNULL(agg.AVG_BALANCE, 0) AS AVERAGE_BALANCE,
            IFNULL(agg.MIN_BALANCE, 0) AS MINIMUM_BALANCE,
            IFNULL(agg.MAX_BALANCE, 0) AS MAXIMUM_BALANCE,
            IFNULL(agg.TOTAL_DEBITS, 0) AS TOTAL_DEBITS,
            IFNULL(agg.TOTAL_CREDITS, 0) AS TOTAL_CREDITS,
            IFNULL(agg.DEBIT_COUNT, 0) AS DEBIT_COUNT,
            IFNULL(agg.CREDIT_COUNT, 0) AS CREDIT_COUNT,
            IFNULL(agg.INTEREST_EARNED, 0) AS INTEREST_EARNED,
            IFNULL(agg.INTEREST_CHARGED, 0) AS INTEREST_CHARGED,
            IFNULL(agg.FEES_CHARGED, 0) AS FEES_CHARGED,
            CAST(IFNULL(agg.OVERDRAFT_DAYS, 0) AS INT64) AS DAYS_IN_OVERDRAFT,
            CASE WHEN agg.ACCOUNT_KEY IS NULL
                 THEN CAST(DATE_DIFF(v_period_end, v_period_start, DAY) + 1 AS INT64)
                 ELSE CAST(0 AS INT64)
            END AS DAYS_DORMANT,
            a.CURRENCY_CODE,
            p_batch_id AS ETL_BATCH_ID
        FROM BANKING_DW.DIM_ACCOUNT a
        LEFT JOIN BANKING_DW.DIM_CUSTOMER c
            ON a.CUSTOMER_ID = c.CUSTOMER_ID
           AND c.CURRENT_FLAG = 'Y'
        LEFT JOIN VT_TXN_AGGREGATES agg
            ON a.ACCOUNT_KEY = agg.ACCOUNT_KEY
        LEFT JOIN BANKING_DW.FACT_MONTHLY_ACCOUNT_SNAPSHOT prev
            ON a.ACCOUNT_KEY = prev.ACCOUNT_KEY
           AND prev.SNAPSHOT_DATE = v_prev_snapshot_date
        WHERE a.CURRENT_FLAG = 'Y'
          AND a.ACCOUNT_STATUS IN ('ACTIVE', 'DORMANT')
    ) src
    ON tgt.ACCOUNT_KEY = src.ACCOUNT_KEY
       AND tgt.SNAPSHOT_MONTH_KEY = src.SNAPSHOT_MONTH_KEY
    WHEN MATCHED THEN UPDATE SET
        OPENING_BALANCE = src.OPENING_BALANCE,
        CLOSING_BALANCE = src.CLOSING_BALANCE,
        AVERAGE_BALANCE = src.AVERAGE_BALANCE,
        MINIMUM_BALANCE = src.MINIMUM_BALANCE,
        MAXIMUM_BALANCE = src.MAXIMUM_BALANCE,
        TOTAL_DEBITS = src.TOTAL_DEBITS,
        TOTAL_CREDITS = src.TOTAL_CREDITS,
        DEBIT_COUNT = src.DEBIT_COUNT,
        CREDIT_COUNT = src.CREDIT_COUNT,
        INTEREST_EARNED = src.INTEREST_EARNED,
        INTEREST_CHARGED = src.INTEREST_CHARGED,
        FEES_CHARGED = src.FEES_CHARGED,
        DAYS_IN_OVERDRAFT = src.DAYS_IN_OVERDRAFT,
        DAYS_DORMANT = src.DAYS_DORMANT,
        ETL_BATCH_ID = src.ETL_BATCH_ID,
        ETL_INSERT_TS = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
        SNAPSHOT_DATE, SNAPSHOT_MONTH_KEY, ACCOUNT_KEY, CUSTOMER_KEY,
        PRODUCT_ID, BRANCH_ID, OPENING_BALANCE, CLOSING_BALANCE,
        AVERAGE_BALANCE, MINIMUM_BALANCE, MAXIMUM_BALANCE,
        TOTAL_DEBITS, TOTAL_CREDITS, DEBIT_COUNT, CREDIT_COUNT,
        INTEREST_EARNED, INTEREST_CHARGED, FEES_CHARGED,
        DAYS_IN_OVERDRAFT, DAYS_DORMANT, CURRENCY_CODE,
        ETL_BATCH_ID, ETL_INSERT_TS
    ) VALUES (
        src.SNAPSHOT_DATE, src.SNAPSHOT_MONTH_KEY, src.ACCOUNT_KEY, src.CUSTOMER_KEY,
        src.PRODUCT_ID, src.BRANCH_ID, src.OPENING_BALANCE, src.CLOSING_BALANCE,
        src.AVERAGE_BALANCE, src.MINIMUM_BALANCE, src.MAXIMUM_BALANCE,
        src.TOTAL_DEBITS, src.TOTAL_CREDITS, src.DEBIT_COUNT, src.CREDIT_COUNT,
        src.INTEREST_EARNED, src.INTEREST_CHARGED, src.FEES_CHARGED,
        src.DAYS_IN_OVERDRAFT, src.DAYS_DORMANT, src.CURRENCY_CODE,
        src.ETL_BATCH_ID, CURRENT_TIMESTAMP()
    );

    SET p_rows_merged = @@row_count;

    -- Clean up temp table (also auto-dropped at end of script).
    DROP TABLE VT_TXN_AGGREGATES;

    -- COLLECT STATISTICS ... -> dropped.
END;
