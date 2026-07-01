-- ============================================================================
-- sp_customer_scd2  (BigQuery scripting procedure)
-- Converted from Teradata BANKING_DW.SP_CUSTOMER_SCD2.
-- Target dialect: BigQuery Standard SQL (GoogleSQL) scripting.
--
-- Purpose: apply SCD Type 2 changes to DIM_CUSTOMER. Reproduces the source's
-- two-step pattern exactly:
--   Step 1 — expire (close out) currently-active rows whose tracked attributes
--            changed in staging (CURRENT_FLAG 'Y' -> 'N', set EFFECTIVE_TO).
--   Step 2 — insert a fresh current version for every staged customer that no
--            longer has a CURRENT_FLAG = 'Y' row. Because Step 1 has already
--            expired the *changed* customers, this INSERT covers BOTH the new
--            versions of changed customers AND brand-new customers.
--
-- Teradata -> BigQuery mappings applied:
--   REPLACE PROCEDURE          -> CREATE OR REPLACE PROCEDURE
--   IN / OUT params            -> supported natively
--   DECLARE / SET              -> DECLARE / SET (BigQuery scripting)
--   TIMESTAMP(0)               -> TIMESTAMP
--   CURRENT_TIMESTAMP(0)       -> CURRENT_TIMESTAMP()
--   ACTIVITY_COUNT             -> @@row_count
--   UPDATE ... FROM (subq)     -> BigQuery UPDATE ... SET ... FROM (subq) WHERE
--   SEL                        -> SELECT
--   QUALIFY ROW_NUMBER()       -> QUALIFY (native)
--   TIMESTAMP '9999-12-31...'  -> TIMESTAMP '9999-12-31 23:59:59'
--   COLLECT STATISTICS         -> dropped (BigQuery maintains stats automatically)
--
-- ⚠ FLAGGED SOURCE LOGIC (reproduced faithfully, NOT fixed):
--   The Step 2 INSERT dedups with
--     QUALIFY ROW_NUMBER() OVER (PARTITION BY existing.CUSTOMER_ID
--                                ORDER BY existing.EFFECTIVE_TO DESC) = 1
--   For brand-new customers there is no matching expired row, so
--   existing.CUSTOMER_ID is NULL. ROW_NUMBER() groups ALL NULL-partition rows
--   together, so only ONE brand-new customer survives per batch — additional
--   brand-new customers are silently dropped. This is a latent source defect.
--   It is preserved here to match source behavior; see MIGRATION_RUNBOOK.md.
--   (A corrected version would partition by stg.CUSTOMER_ID.)
-- ============================================================================
CREATE OR REPLACE PROCEDURE BANKING_DW.sp_customer_scd2(
    IN p_batch_id INT64,
    OUT p_new_rows INT64,
    OUT p_changed INT64,
    OUT p_return_code INT64
)
BEGIN
    DECLARE v_current_ts TIMESTAMP;

    SET v_current_ts = CURRENT_TIMESTAMP();
    SET p_return_code = 0;
    SET p_new_rows = 0;
    SET p_changed = 0;

    -- Step 1: Expire changed records.
    UPDATE BANKING_DW.DIM_CUSTOMER tgt
    SET CURRENT_FLAG = 'N',
        EFFECTIVE_TO = v_current_ts,
        ETL_UPDATE_TS = v_current_ts,
        ETL_BATCH_ID = p_batch_id
    FROM (
        SELECT stg.CUSTOMER_ID
        FROM BANKING_DW.STG_CUSTOMER stg
        INNER JOIN BANKING_DW.DIM_CUSTOMER dim
            ON stg.CUSTOMER_ID = dim.CUSTOMER_ID
           AND dim.CURRENT_FLAG = 'Y'
        WHERE (
            stg.CUSTOMER_SEGMENT <> dim.CUSTOMER_SEGMENT
            OR stg.RISK_SCORE <> dim.RISK_SCORE
            OR stg.CREDIT_RATING <> dim.CREDIT_RATING
            OR stg.KYC_STATUS <> dim.KYC_STATUS
            OR stg.ADDRESS_LINE_1 <> dim.ADDRESS_LINE_1
            OR stg.CITY <> dim.CITY
            OR stg.STATE_PROVINCE <> dim.STATE_PROVINCE
            OR stg.POSTAL_CODE <> dim.POSTAL_CODE
            OR COALESCE(stg.PHONE_NUMBER, '') <> COALESCE(dim.PHONE_NUMBER, '')
            OR COALESCE(stg.EMAIL_ADDRESS, '') <> COALESCE(dim.EMAIL_ADDRESS, '')
            OR stg.MARITAL_STATUS <> dim.MARITAL_STATUS
        )
    ) src
    WHERE tgt.CUSTOMER_ID = src.CUSTOMER_ID
      AND tgt.CURRENT_FLAG = 'Y';

    SET p_changed = @@row_count;

    -- Step 2: Insert new versions of changed records + brand-new customers.
    INSERT INTO BANKING_DW.DIM_CUSTOMER (
        CUSTOMER_ID, FIRST_NAME, LAST_NAME, DATE_OF_BIRTH, GENDER,
        MARITAL_STATUS, EMAIL_ADDRESS, PHONE_NUMBER,
        ADDRESS_LINE_1, ADDRESS_LINE_2, CITY, STATE_PROVINCE,
        POSTAL_CODE, COUNTRY_CODE, CUSTOMER_SEGMENT, RISK_SCORE,
        CREDIT_RATING, KYC_STATUS, ONBOARDING_DATE, LAST_REVIEW_DATE,
        IS_ACTIVE, EFFECTIVE_FROM, EFFECTIVE_TO, CURRENT_FLAG,
        ETL_BATCH_ID, ETL_INSERT_TS, ETL_UPDATE_TS
    )
    SELECT
        stg.CUSTOMER_ID,
        stg.FIRST_NAME,
        stg.LAST_NAME,
        stg.DATE_OF_BIRTH,
        stg.GENDER,
        stg.MARITAL_STATUS,
        stg.EMAIL_ADDRESS,
        stg.PHONE_NUMBER,
        stg.ADDRESS_LINE_1,
        stg.ADDRESS_LINE_2,
        stg.CITY,
        stg.STATE_PROVINCE,
        stg.POSTAL_CODE,
        COALESCE(stg.COUNTRY_CODE, 'NOR'),
        stg.CUSTOMER_SEGMENT,
        stg.RISK_SCORE,
        stg.CREDIT_RATING,
        stg.KYC_STATUS,
        COALESCE(existing.ONBOARDING_DATE, CURRENT_DATE()),
        CURRENT_DATE(),
        1,
        v_current_ts,
        TIMESTAMP '9999-12-31 23:59:59',
        'Y',
        p_batch_id,
        v_current_ts,
        v_current_ts
    FROM BANKING_DW.STG_CUSTOMER stg
    LEFT JOIN BANKING_DW.DIM_CUSTOMER existing
        ON stg.CUSTOMER_ID = existing.CUSTOMER_ID
       AND existing.CURRENT_FLAG = 'N'
    WHERE stg.CUSTOMER_ID NOT IN (
        SELECT CUSTOMER_ID FROM BANKING_DW.DIM_CUSTOMER WHERE CURRENT_FLAG = 'Y'
    )
    QUALIFY ROW_NUMBER() OVER (PARTITION BY existing.CUSTOMER_ID
                               ORDER BY existing.EFFECTIVE_TO DESC) = 1;

    SET p_new_rows = @@row_count;

    -- COLLECT STATISTICS ... -> dropped (BigQuery maintains statistics automatically).
END;
