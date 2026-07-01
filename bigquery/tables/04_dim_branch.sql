-- Converted from BANKING_DW.DIM_BRANCH (Teradata) to BigQuery Standard SQL.
--
-- Datatype mapping: INTEGER/BYTEINT/SMALLINT -> INT64, VARCHAR/CHAR -> STRING,
--   DECIMAL(10,7) -> NUMERIC (scale 7 <= 9, fits NUMERIC), DATE -> DATE,
--   TIMESTAMP(0) -> TIMESTAMP.
-- Dropped: SET, NO FALLBACK, journals, CHECKSUM, MERGEBLOCKRATIO, COMPRESS,
--   NOT CASESPECIFIC, DATE FORMAT, COLLECT STATISTICS, secondary indexes.
--
-- Physical design:
--   No PPI in the source (small dimension) -> no PARTITION BY.
--   PRIMARY INDEX UPI_BRANCH_ID(BRANCH_ID) -> CLUSTER BY BRANCH_ID, with the
--   former secondary indexes BRANCH_CODE and REGION folded in.
CREATE TABLE IF NOT EXISTS `banking_dw.DIM_BRANCH`
(
    BRANCH_ID       INT64    NOT NULL,
    BRANCH_CODE     STRING   NOT NULL,
    BRANCH_NAME     STRING   NOT NULL,
    BRANCH_TYPE     STRING,
    ADDRESS_LINE_1  STRING,
    CITY            STRING,
    COUNTY          STRING,
    REGION          STRING,
    POSTAL_CODE     STRING,
    COUNTRY_CODE    STRING   DEFAULT 'NOR',
    LATITUDE        NUMERIC,
    LONGITUDE       NUMERIC,
    MANAGER_ID      INT64,
    OPENING_DATE    DATE,
    CLOSING_DATE    DATE,
    IS_ACTIVE       INT64    DEFAULT 1,
    EMPLOYEE_COUNT  INT64,
    ETL_BATCH_ID    INT64,
    ETL_INSERT_TS   TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY BRANCH_ID, BRANCH_CODE, REGION
OPTIONS(description="Branch dimension with Norwegian regional hierarchy");
