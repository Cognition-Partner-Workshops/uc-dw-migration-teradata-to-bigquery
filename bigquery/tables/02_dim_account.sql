-- Converted from BANKING_DW.DIM_ACCOUNT (Teradata) to BigQuery Standard SQL.
--
-- Datatype mapping:
--   BIGINT / INTEGER / BYTEINT -> INT64
--   VARCHAR(n) / CHAR(n)       -> STRING
--   DECIMAL(7,4) / (15,2)      -> NUMERIC
--   DATE -> DATE, TIMESTAMP(0) -> TIMESTAMP
--
-- Dropped: MULTISET, NO FALLBACK, NO BEFORE/AFTER JOURNAL, CHECKSUM,
--   MERGEBLOCKRATIO, COMPRESS lists, NOT CASESPECIFIC, DATE FORMAT,
--   COLLECT STATISTICS, secondary INDEX definitions.
--
-- Identity: ACCOUNT_KEY was GENERATED ALWAYS AS IDENTITY -> assigned by ETL.
--
-- Physical design:
--   PARTITION BY RANGE_N(OPENING_DATE EACH INTERVAL '1' YEAR)
--       -> PARTITION BY DATE_TRUNC(OPENING_DATE, YEAR).
--   PRIMARY INDEX UPI_ACCOUNT_KEY(ACCOUNT_KEY) -> CLUSTER BY ACCOUNT_KEY.
--       Former secondary indexes folded into clustering: ACCOUNT_ID,
--       CUSTOMER_ID, BRANCH_ID. ACCOUNT_TYPE's secondary index is dropped
--       (4-column clustering limit); it remains a good filter but is lower
--       cardinality than the retained keys.
CREATE TABLE IF NOT EXISTS `banking_dw.DIM_ACCOUNT`
(
    ACCOUNT_KEY          INT64     NOT NULL OPTIONS(description="Surrogate key; assigned by ETL"),
    ACCOUNT_ID           STRING    NOT NULL,
    CUSTOMER_ID          INT64     NOT NULL,
    ACCOUNT_TYPE         STRING    NOT NULL,
    ACCOUNT_SUBTYPE      STRING,
    CURRENCY_CODE        STRING    DEFAULT 'NOK',
    OPENING_DATE         DATE      NOT NULL,
    CLOSING_DATE         DATE,
    ACCOUNT_STATUS       STRING    DEFAULT 'ACTIVE',
    INTEREST_RATE        NUMERIC,
    CREDIT_LIMIT         NUMERIC,
    OVERDRAFT_LIMIT      NUMERIC   DEFAULT 0,
    BRANCH_ID            INT64,
    RELATIONSHIP_MGR_ID  INT64,
    PRODUCT_ID           INT64     NOT NULL,
    IS_JOINT_ACCOUNT     INT64     DEFAULT 0,
    TAX_REPORTING_FLAG   INT64     DEFAULT 1,
    EFFECTIVE_FROM       TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    EFFECTIVE_TO         TIMESTAMP DEFAULT TIMESTAMP '9999-12-31 23:59:59',
    CURRENT_FLAG         STRING    DEFAULT 'Y',
    ETL_BATCH_ID         INT64,
    ETL_INSERT_TS        TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    ETL_UPDATE_TS        TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE_TRUNC(OPENING_DATE, YEAR)
CLUSTER BY ACCOUNT_KEY, ACCOUNT_ID, CUSTOMER_ID, BRANCH_ID
OPTIONS(description="Account dimension with SCD Type 2 tracking for status and rate changes");
