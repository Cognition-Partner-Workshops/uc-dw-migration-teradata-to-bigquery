-- Converted from BANKING_DW.FACT_MONTHLY_ACCOUNT_SNAPSHOT (Teradata) to
-- BigQuery Standard SQL.
--
-- Datatype mapping: BIGINT/INTEGER/SMALLINT -> INT64, CHAR -> STRING,
--   DECIMAL(15,2)/(12,2) -> NUMERIC, DATE -> DATE, TIMESTAMP(0) -> TIMESTAMP.
-- Dropped: MULTISET, NO FALLBACK, journals, CHECKSUM, MERGEBLOCKRATIO, COMPRESS,
--   DATE FORMAT, COLLECT STATISTICS (incl. COLUMN (PARTITION)), secondary indexes.
--
-- Physical design (periodic snapshot, one row per account per month):
--   PARTITION BY RANGE_N(SNAPSHOT_DATE EACH INTERVAL '1' MONTH, NO RANGE)
--       -> PARTITION BY DATE_TRUNC(SNAPSHOT_DATE, MONTH). SNAPSHOT_MONTH_KEY
--       (YYYYMM INT) mirrors the partition grain but the physical partition key
--       is the DATE column, as BigQuery partitions on DATE/TIMESTAMP/INT-range.
--   PRIMARY INDEX PI_MONTHLY_SNAP(ACCOUNT_KEY, SNAPSHOT_MONTH_KEY):
--       SNAPSHOT month is the partition, so clustering leads with ACCOUNT_KEY,
--       then CUSTOMER_KEY and BRANCH_ID for common roll-up filters.
CREATE TABLE IF NOT EXISTS `banking_dw.FACT_MONTHLY_ACCOUNT_SNAPSHOT`
(
    SNAPSHOT_DATE          DATE     NOT NULL,
    SNAPSHOT_MONTH_KEY     INT64    NOT NULL,   -- YYYYMM format
    ACCOUNT_KEY            INT64    NOT NULL,
    CUSTOMER_KEY           INT64    NOT NULL,
    PRODUCT_ID             INT64    NOT NULL,
    BRANCH_ID              INT64,
    OPENING_BALANCE        NUMERIC  NOT NULL,
    CLOSING_BALANCE        NUMERIC  NOT NULL,
    AVERAGE_BALANCE        NUMERIC,
    MINIMUM_BALANCE        NUMERIC,
    MAXIMUM_BALANCE        NUMERIC,
    TOTAL_DEBITS           NUMERIC  DEFAULT 0,
    TOTAL_CREDITS          NUMERIC  DEFAULT 0,
    DEBIT_COUNT            INT64    DEFAULT 0,
    CREDIT_COUNT           INT64    DEFAULT 0,
    INTEREST_EARNED        NUMERIC  DEFAULT 0,
    INTEREST_CHARGED       NUMERIC  DEFAULT 0,
    FEES_CHARGED           NUMERIC  DEFAULT 0,
    DAYS_IN_OVERDRAFT      INT64    DEFAULT 0,
    DAYS_DORMANT           INT64    DEFAULT 0,
    CURRENCY_CODE          STRING   DEFAULT 'NOK',
    BASE_CURRENCY_CLOSING  NUMERIC,
    ETL_BATCH_ID           INT64,
    ETL_INSERT_TS          TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE_TRUNC(SNAPSHOT_DATE, MONTH)
CLUSTER BY ACCOUNT_KEY, CUSTOMER_KEY, BRANCH_ID
OPTIONS(description="Monthly periodic snapshot: one row per account per calendar month");
