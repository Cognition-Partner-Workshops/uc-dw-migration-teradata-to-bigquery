-- Converted from BANKING_DW.DIM_PRODUCT (Teradata) to BigQuery Standard SQL.
--
-- Datatype mapping: INTEGER/BYTEINT -> INT64, VARCHAR/CHAR -> STRING,
--   DECIMAL(7,4)/(15,2)/(10,2) -> NUMERIC, DATE -> DATE, TIMESTAMP(0) -> TIMESTAMP.
-- Dropped: SET, NO FALLBACK, journals, CHECKSUM, MERGEBLOCKRATIO, COMPRESS,
--   NOT CASESPECIFIC, DATE FORMAT, COLLECT STATISTICS, secondary indexes.
--
-- Physical design:
--   No PPI in the source (small reference dimension) -> no PARTITION BY. A
--   product catalog is tiny and low-churn; partitioning would add no pruning
--   benefit.
--   PRIMARY INDEX UPI_PRODUCT_ID(PRODUCT_ID) -> CLUSTER BY PRODUCT_ID, with the
--   former secondary indexes PRODUCT_CODE and PRODUCT_CATEGORY folded in.
CREATE TABLE IF NOT EXISTS `banking_dw.DIM_PRODUCT`
(
    PRODUCT_ID           INT64    NOT NULL,
    PRODUCT_CODE         STRING   NOT NULL,
    PRODUCT_NAME         STRING   NOT NULL,
    PRODUCT_CATEGORY     STRING   NOT NULL,
    PRODUCT_SUBCATEGORY  STRING,
    BASE_INTEREST_RATE   NUMERIC,
    MIN_BALANCE          NUMERIC  DEFAULT 0,
    MAX_BALANCE          NUMERIC,
    FEE_STRUCTURE        STRING,
    MONTHLY_FEE          NUMERIC  DEFAULT 0,
    IS_REGULATED         INT64    DEFAULT 1,
    REGULATORY_CODE      STRING,
    LAUNCH_DATE          DATE,
    DISCONTINUE_DATE     DATE,
    IS_ACTIVE            INT64    DEFAULT 1,
    ETL_BATCH_ID         INT64,
    ETL_INSERT_TS        TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY PRODUCT_ID, PRODUCT_CODE, PRODUCT_CATEGORY
OPTIONS(description="Banking product catalog dimension");
