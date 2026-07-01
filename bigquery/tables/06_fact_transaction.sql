-- Converted from BANKING_DW.FACT_TRANSACTION (Teradata) to BigQuery Standard SQL.
--
-- Datatype mapping:
--   BIGINT / INTEGER / BYTEINT -> INT64
--   VARCHAR(n) / CHAR(n)       -> STRING
--   DECIMAL(15,2) / (12,6)     -> NUMERIC (scale <= 9)
--   DATE -> DATE, TIME(0) -> TIME, TIMESTAMP(6) -> TIMESTAMP, TIMESTAMP(0) -> TIMESTAMP
--
-- Dropped: MULTISET, NO FALLBACK, journals, CHECKSUM, MERGEBLOCKRATIO, COMPRESS,
--   NOT CASESPECIFIC, DATE FORMAT, COLLECT STATISTICS (incl. COLUMN (PARTITION)),
--   secondary indexes.
--
-- Physical design (largest table in the warehouse):
--   PARTITION BY RANGE_N(TRANSACTION_DATE EACH INTERVAL '1' MONTH, NO RANGE)
--       -> PARTITION BY DATE_TRUNC(TRANSACTION_DATE, MONTH). Monthly partitions
--       over 2018-2030 (~156) are well under BigQuery's 10,000-partition limit
--       and give the same partition-elimination the Teradata PPI provided.
--       NO RANGE (catch-all for out-of-range dates) has no BQ equivalent; BQ
--       routes out-of-window rows to the __UNPARTITIONED__ partition, which is
--       the natural analogue.
--   PARTITIONED PRIMARY INDEX PI_FACT_TXN(ACCOUNT_KEY, TRANSACTION_DATE):
--       TRANSACTION_DATE is now the partition key, so clustering leads with
--       ACCOUNT_KEY, then the highest-value additional filters CUSTOMER_KEY and
--       TRANSACTION_TYPE (formerly statistics/scan predicates).
CREATE TABLE IF NOT EXISTS `banking_dw.FACT_TRANSACTION`
(
    TRANSACTION_ID        INT64     NOT NULL,
    TRANSACTION_DATE      DATE      NOT NULL,
    TRANSACTION_TIME      TIME,
    TRANSACTION_TS        TIMESTAMP,
    ACCOUNT_KEY           INT64     NOT NULL,
    CUSTOMER_KEY          INT64     NOT NULL,
    PRODUCT_ID            INT64     NOT NULL,
    BRANCH_ID             INT64,
    DATE_KEY              INT64     NOT NULL,
    TRANSACTION_TYPE      STRING    NOT NULL,
    TRANSACTION_SUBTYPE   STRING,
    CHANNEL               STRING,
    TRANSACTION_AMOUNT    NUMERIC   NOT NULL,
    TRANSACTION_CURRENCY  STRING    DEFAULT 'NOK',
    BASE_CURRENCY_AMOUNT  NUMERIC,
    EXCHANGE_RATE         NUMERIC   DEFAULT 1.000000,
    RUNNING_BALANCE       NUMERIC,
    MERCHANT_ID           STRING,
    MERCHANT_NAME         STRING,
    MERCHANT_CATEGORY     STRING,      -- MCC code
    COUNTERPARTY_ACCT     STRING,
    REFERENCE_NUMBER      STRING,
    DESCRIPTION_TEXT      STRING,
    IS_INTERNATIONAL      INT64     DEFAULT 0,
    IS_FLAGGED            INT64     DEFAULT 0,
    FLAG_REASON           STRING,
    POSTING_DATE          DATE,
    VALUE_DATE            DATE,
    ETL_BATCH_ID          INT64,
    ETL_INSERT_TS         TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE_TRUNC(TRANSACTION_DATE, MONTH)
CLUSTER BY ACCOUNT_KEY, CUSTOMER_KEY, TRANSACTION_TYPE
OPTIONS(description="Grain: one row per transaction. Monthly partitioning on TRANSACTION_DATE for partition elimination.");
