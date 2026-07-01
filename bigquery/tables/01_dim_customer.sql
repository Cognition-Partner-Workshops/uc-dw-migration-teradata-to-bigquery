-- Converted from BANKING_DW.DIM_CUSTOMER (Teradata) to BigQuery Standard SQL.
--
-- Datatype mapping:
--   INTEGER / BIGINT / BYTEINT / SMALLINT -> INT64
--   VARCHAR(n) / CHAR(n)                  -> STRING (length not enforced in BQ)
--   DECIMAL(5,2)                          -> NUMERIC (p<=38, s<=9)
--   DATE                                  -> DATE
--   TIMESTAMP(0)                          -> TIMESTAMP
--
-- Dropped Teradata-only clauses: SET, NO FALLBACK, NO BEFORE/AFTER JOURNAL,
--   CHECKSUM, MERGEBLOCKRATIO, COMPRESS value-lists, NOT CASESPECIFIC,
--   DATE FORMAT 'YYYY-MM-DD', COLLECT STATISTICS, secondary INDEX definitions
--   (BigQuery has no secondary indexes; those access paths are served by
--   clustering below).
--
-- Identity: CUSTOMER_KEY was GENERATED ALWAYS AS IDENTITY. BigQuery has no
--   IDENTITY/auto-increment; the surrogate is assigned by the ETL load
--   (e.g. ROW_NUMBER() or GENERATE_UUID()). Kept as INT64 NOT NULL.
--
-- Physical design:
--   PARTITION BY RANGE_N(ONBOARDING_DATE EACH INTERVAL '1' YEAR)
--       -> PARTITION BY DATE_TRUNC(ONBOARDING_DATE, YEAR) (yearly granularity).
--   PRIMARY INDEX UPI_CUSTOMER_KEY(CUSTOMER_KEY) -> CLUSTER BY CUSTOMER_KEY,
--       with the former secondary indexes (CUSTOMER_ID, CUSTOMER_SEGMENT,
--       COUNTRY_CODE) folded into clustering (BigQuery allows up to 4 columns).
CREATE TABLE IF NOT EXISTS `banking_dw.DIM_CUSTOMER`
(
    CUSTOMER_ID       INT64      NOT NULL OPTIONS(description="Natural key from source system"),
    CUSTOMER_KEY      INT64      NOT NULL OPTIONS(description="Surrogate key for SCD Type 2; assigned by ETL"),
    FIRST_NAME        STRING     NOT NULL,
    LAST_NAME         STRING     NOT NULL,
    DATE_OF_BIRTH     DATE,
    GENDER            STRING,
    MARITAL_STATUS    STRING,
    EMAIL_ADDRESS     STRING,
    PHONE_NUMBER      STRING,
    ADDRESS_LINE_1    STRING,
    ADDRESS_LINE_2    STRING,
    CITY              STRING,
    STATE_PROVINCE    STRING,
    POSTAL_CODE       STRING,
    COUNTRY_CODE      STRING     DEFAULT 'NOR',
    CUSTOMER_SEGMENT  STRING,
    RISK_SCORE        NUMERIC,
    CREDIT_RATING     STRING,
    KYC_STATUS        STRING     DEFAULT 'PENDING' OPTIONS(description="Know Your Customer verification status"),
    ONBOARDING_DATE   DATE       NOT NULL,
    LAST_REVIEW_DATE  DATE,
    IS_ACTIVE         INT64      DEFAULT 1,
    EFFECTIVE_FROM    TIMESTAMP  DEFAULT CURRENT_TIMESTAMP(),
    EFFECTIVE_TO      TIMESTAMP  DEFAULT TIMESTAMP '9999-12-31 23:59:59',
    CURRENT_FLAG      STRING     DEFAULT 'Y',
    ETL_BATCH_ID      INT64,
    ETL_INSERT_TS     TIMESTAMP  DEFAULT CURRENT_TIMESTAMP(),
    ETL_UPDATE_TS     TIMESTAMP  DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE_TRUNC(ONBOARDING_DATE, YEAR)
CLUSTER BY CUSTOMER_KEY, CUSTOMER_ID, CUSTOMER_SEGMENT, COUNTRY_CODE
OPTIONS(description="SCD Type 2 customer dimension with KYC and risk attributes");
