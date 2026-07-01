-- Converted from BANKING_DW.DIM_DATE (Teradata) to BigQuery Standard SQL.
--
-- Datatype mapping: INTEGER/BYTEINT/SMALLINT -> INT64, VARCHAR/CHAR -> STRING,
--   DATE -> DATE.
-- Dropped: SET, NO FALLBACK, journals, CHECKSUM, MERGEBLOCKRATIO, COMPRESS,
--   DATE FORMAT, COLLECT STATISTICS, secondary indexes.
--
-- Physical design:
--   No PPI in the source -> no PARTITION BY. A calendar dimension is a small,
--   static lookup (~thousands of rows); partitioning would only fragment it.
--   PRIMARY INDEX UPI_DATE_KEY(DATE_KEY) -> CLUSTER BY DATE_KEY, with the former
--   secondary indexes CALENDAR_DATE and (CALENDAR_YEAR, MONTH_NUM) folded in.
CREATE TABLE IF NOT EXISTS `banking_dw.DIM_DATE`
(
    DATE_KEY              INT64   NOT NULL,   -- YYYYMMDD format
    CALENDAR_DATE         DATE    NOT NULL,
    DAY_OF_WEEK           INT64   NOT NULL,   -- 1=Monday, 7=Sunday
    DAY_NAME              STRING  NOT NULL,
    DAY_OF_MONTH          INT64   NOT NULL,
    DAY_OF_YEAR           INT64   NOT NULL,
    WEEK_OF_YEAR          INT64   NOT NULL,
    ISO_WEEK              INT64   NOT NULL,
    MONTH_NUM             INT64   NOT NULL,
    MONTH_NAME            STRING  NOT NULL,
    MONTH_SHORT           STRING  NOT NULL,
    QUARTER_NUM           INT64   NOT NULL,
    QUARTER_NAME          STRING  NOT NULL,   -- Q1, Q2, Q3, Q4
    HALF_YEAR             INT64   NOT NULL,
    CALENDAR_YEAR         INT64   NOT NULL,
    FISCAL_YEAR           INT64   NOT NULL,
    FISCAL_QUARTER        INT64   NOT NULL,
    IS_WEEKEND            INT64   NOT NULL,
    IS_NORWEGIAN_HOLIDAY  INT64   DEFAULT 0,
    HOLIDAY_NAME          STRING,
    IS_BUSINESS_DAY       INT64   NOT NULL,
    IS_MONTH_END          INT64   NOT NULL,
    IS_QUARTER_END        INT64   NOT NULL,
    IS_YEAR_END           INT64   NOT NULL,
    PRIOR_DAY_DATE        DATE,
    NEXT_DAY_DATE         DATE,
    SAME_DAY_PREV_YEAR    DATE
)
CLUSTER BY DATE_KEY, CALENDAR_DATE, CALENDAR_YEAR, MONTH_NUM
OPTIONS(description="Calendar dimension with Norwegian holidays and fiscal year alignment");
