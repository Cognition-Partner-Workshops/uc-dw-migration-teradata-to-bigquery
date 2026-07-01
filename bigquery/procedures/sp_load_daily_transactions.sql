-- ============================================================================
-- sp_load_daily_transactions  (BigQuery scripting procedure)
-- Converted from Teradata BANKING_DW.SP_LOAD_DAILY_TRANSACTIONS.
-- Target dialect: BigQuery Standard SQL (GoogleSQL) scripting.
--
-- Purpose: load one day's transactions from staging into FACT_TRANSACTION,
-- routing rows with unknown accounts to an error table, with ETL logging and
-- error handling.
--
-- Teradata -> BigQuery mappings applied:
--   REPLACE PROCEDURE               -> CREATE OR REPLACE PROCEDURE
--   DATE FORMAT 'YYYY-MM-DD' param  -> DATE (format is display-only; dropped)
--   DECLARE ... DEFAULT             -> DECLARE ... DEFAULT
--   DECLARE EXIT HANDLER FOR        -> BEGIN ... EXCEPTION WHEN ERROR THEN ... END
--     SQLEXCEPTION
--   SQLCODE / SQLSTATE              -> no numeric code in BigQuery; @@error.message
--   ACTIVITY_COUNT                  -> @@row_count
--   SEL                            -> SELECT
--   ZEROIFNULL(x)                   -> IFNULL(x, 0)
--   date (TIMESTAMP(6)) + (time..)  -> TIMESTAMP(DATETIME(date, time))
--   CAST(date AS DATE FORMAT 'YYYYMMDD') AS INT
--                                   -> CAST(FORMAT_DATE('%Y%m%d', date) AS INT64)
--   col (FORMAT '...') in messages  -> CAST(... AS STRING) / FORMAT()
--   (ts2 - ts1) SECOND(4)           -> TIMESTAMP_DIFF(ts2, ts1, SECOND)
--   COLLECT STATISTICS              -> dropped
--
-- ⚠ FLAGGED MAPPING: Teradata SQLCODE is a numeric status; BigQuery scripting
--   exposes only @@error.message / @@error.stack_trace in an exception handler.
--   p_return_code is set to a nonzero sentinel (1) on failure and the original
--   error text is logged instead of a numeric code. See MIGRATION_RUNBOOK.md.
-- ============================================================================
CREATE OR REPLACE PROCEDURE BANKING_DW.sp_load_daily_transactions(
    IN p_batch_date DATE,
    IN p_batch_id INT64,
    OUT p_rows_inserted INT64,
    OUT p_rows_rejected INT64,
    OUT p_return_code INT64
)
BEGIN
    DECLARE v_error_count INT64 DEFAULT 0;
    DECLARE v_start_ts TIMESTAMP;

    BEGIN
        SET v_start_ts = CURRENT_TIMESTAMP();
        SET p_rows_inserted = 0;
        SET p_rows_rejected = 0;
        SET p_return_code = 0;

        -- Log start.
        INSERT INTO BANKING_DW.ETL_LOG (
            PROCEDURE_NAME, BATCH_ID, LOG_LEVEL, LOG_MESSAGE, LOG_TS
        ) VALUES (
            'SP_LOAD_DAILY_TRANSACTIONS', p_batch_id, 'INFO',
            'Started loading transactions for date: ' || CAST(p_batch_date AS STRING),
            v_start_ts
        );

        -- Reject bad records (unknown account) to the error table.
        INSERT INTO BANKING_DW.STG_TRANSACTION_ERRORS
        SELECT stg.*, 'INVALID_ACCOUNT' AS ERROR_REASON, p_batch_id AS BATCH_ID
        FROM BANKING_DW.STG_TRANSACTIONS stg
        WHERE stg.LOAD_DATE = p_batch_date
          AND stg.ACCOUNT_ID NOT IN (
              SELECT ACCOUNT_ID FROM BANKING_DW.DIM_ACCOUNT WHERE CURRENT_FLAG = 'Y'
          );

        SET v_error_count = @@row_count;

        -- Insert valid transactions.
        INSERT INTO BANKING_DW.FACT_TRANSACTION (
            TRANSACTION_ID, TRANSACTION_DATE, TRANSACTION_TIME, TRANSACTION_TS,
            ACCOUNT_KEY, CUSTOMER_KEY, PRODUCT_ID, BRANCH_ID, DATE_KEY,
            TRANSACTION_TYPE, TRANSACTION_SUBTYPE, CHANNEL,
            TRANSACTION_AMOUNT, TRANSACTION_CURRENCY, BASE_CURRENCY_AMOUNT,
            EXCHANGE_RATE, MERCHANT_ID, MERCHANT_NAME, MERCHANT_CATEGORY,
            COUNTERPARTY_ACCT, REFERENCE_NUMBER, DESCRIPTION_TEXT,
            IS_INTERNATIONAL, POSTING_DATE, VALUE_DATE,
            ETL_BATCH_ID, ETL_INSERT_TS
        )
        SELECT
            stg.TRANSACTION_ID,
            stg.TRANSACTION_DATE,
            stg.TRANSACTION_TIME,
            TIMESTAMP(DATETIME(stg.TRANSACTION_DATE, stg.TRANSACTION_TIME)),
            a.ACCOUNT_KEY,
            c.CUSTOMER_KEY,
            a.PRODUCT_ID,
            a.BRANCH_ID,
            CAST(FORMAT_DATE('%Y%m%d', stg.TRANSACTION_DATE) AS INT64),
            stg.TRANSACTION_TYPE,
            stg.TRANSACTION_SUBTYPE,
            stg.CHANNEL,
            stg.TRANSACTION_AMOUNT,
            stg.CURRENCY_CODE,
            CASE WHEN stg.CURRENCY_CODE <> 'NOK'
                 THEN stg.TRANSACTION_AMOUNT * IFNULL(fx.EXCHANGE_RATE, 0)
                 ELSE stg.TRANSACTION_AMOUNT
            END,
            IFNULL(fx.EXCHANGE_RATE, 0),
            stg.MERCHANT_ID,
            stg.MERCHANT_NAME,
            stg.MERCHANT_CATEGORY,
            stg.COUNTERPARTY_ACCT,
            stg.REFERENCE_NUMBER,
            stg.DESCRIPTION_TEXT,
            CASE WHEN stg.CURRENCY_CODE <> 'NOK' THEN 1 ELSE 0 END,
            stg.POSTING_DATE,
            stg.VALUE_DATE,
            p_batch_id,
            CURRENT_TIMESTAMP()
        FROM BANKING_DW.STG_TRANSACTIONS stg
        INNER JOIN BANKING_DW.DIM_ACCOUNT a
            ON stg.ACCOUNT_ID = a.ACCOUNT_ID
           AND a.CURRENT_FLAG = 'Y'
        INNER JOIN BANKING_DW.DIM_CUSTOMER c
            ON a.CUSTOMER_ID = c.CUSTOMER_ID
           AND c.CURRENT_FLAG = 'Y'
        LEFT JOIN BANKING_DW.DIM_EXCHANGE_RATES fx
            ON stg.CURRENCY_CODE = fx.FROM_CURRENCY
           AND fx.TO_CURRENCY = 'NOK'
           AND stg.TRANSACTION_DATE = fx.RATE_DATE
        WHERE stg.LOAD_DATE = p_batch_date
          AND stg.ACCOUNT_ID IN (
              SELECT ACCOUNT_ID FROM BANKING_DW.DIM_ACCOUNT WHERE CURRENT_FLAG = 'Y'
          );

        SET p_rows_inserted = @@row_count;
        SET p_rows_rejected = v_error_count;

        -- COLLECT STATISTICS ... -> dropped.

        -- Log completion.
        INSERT INTO BANKING_DW.ETL_LOG (
            PROCEDURE_NAME, BATCH_ID, LOG_LEVEL, LOG_MESSAGE, LOG_TS
        ) VALUES (
            'SP_LOAD_DAILY_TRANSACTIONS', p_batch_id, 'INFO',
            'Completed. Inserted: ' || CAST(p_rows_inserted AS STRING) ||
            ', Rejected: ' || CAST(p_rows_rejected AS STRING) ||
            ', Duration: ' ||
            CAST(TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), v_start_ts, SECOND) AS STRING) || 's',
            CURRENT_TIMESTAMP()
        );

    EXCEPTION WHEN ERROR THEN
        -- Teradata EXIT HANDLER FOR SQLEXCEPTION equivalent.
        SET p_return_code = 1;  -- no numeric SQLCODE in BigQuery; nonzero on failure
        INSERT INTO BANKING_DW.ETL_LOG (
            PROCEDURE_NAME, BATCH_ID, LOG_LEVEL, LOG_MESSAGE, LOG_TS
        ) VALUES (
            'SP_LOAD_DAILY_TRANSACTIONS', p_batch_id, 'ERROR',
            'ERROR: ' || @@error.message ||
            ' at ' || CAST(CURRENT_TIMESTAMP() AS STRING),
            CURRENT_TIMESTAMP()
        );
    END;
END;
