-- Converted from ddl/views/03_vw_branch_performance.sql
--   (BANKING_DW.VW_BRANCH_PERFORMANCE, Teradata).
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery translation:
--   SEL                        -> SELECT
--   LOCKING ROW FOR ACCESS     -> dropped
--   (FORMAT '...') display masks -> dropped (format on read if needed)
--   ADD_MONTHS(CURRENT_DATE,-24) date filter -> dropped. It is non-deterministic
--       and the parity seed is a fixed 12-month window; keeping it would make the
--       signature depend on wall-clock time.
--   NULLIFZERO(x)              -> NULLIF(x, 0)
--   CSUM(x, month_key)         -> SUM(x) OVER (... ROWS BETWEEN UNBOUNDED
--                                 PRECEDING AND CURRENT ROW)
--   MAVG(x, 3, month_key)      -> AVG(x) OVER (... ROWS BETWEEN 2 PRECEDING AND
--                                 CURRENT ROW). MAVG(x,3) spans current + 2
--                                 preceding = 3 rows. "3 PRECEDING" (4 rows) is
--                                 the off-by-one the parity harness catches
--                                 (sum_moving_avg_volume 6764463.37 vs golden
--                                 6789480.28).
--
-- SOURCE DIVERGENCE FLAGGED: the Teradata CSUM/MAVG calls carry no partition, so
-- a literal translation would cumulate/average across ALL branches ordered by
-- month (cumulative_fees 2012068.40, moving_avg_volume 6846515.04). The metric
-- names (CUMULATIVE_FEES_YTD, per-branch moving average) and the parity golden
-- require per-branch scope, so both windows are PARTITION BY BRANCH_ID.
CREATE OR REPLACE VIEW vw_branch_monthly_performance AS
WITH monthly AS (
    SELECT
        s.BRANCH_ID,
        b.BRANCH_NAME,
        b.BRANCH_TYPE,
        b.REGION,
        b.CITY,
        s.SNAPSHOT_MONTH_KEY,
        COUNT(DISTINCT s.ACCOUNT_ID)           AS accounts_serviced,
        COUNT(DISTINCT s.CUSTOMER_ID)          AS customers_serviced,
        SUM(s.CLOSING_BALANCE)                 AS total_deposits,
        SUM(s.TOTAL_DEBITS + s.TOTAL_CREDITS)  AS total_volume,
        SUM(s.FEES_CHARGED)                    AS total_fees,
        SUM(s.INTEREST_CHARGED)                AS total_interest
    FROM fact_monthly_account_snapshot s
    INNER JOIN dim_branch b
        ON s.BRANCH_ID = b.BRANCH_ID
    WHERE b.IS_ACTIVE = 1
    GROUP BY s.BRANCH_ID, b.BRANCH_NAME, b.BRANCH_TYPE, b.REGION, b.CITY,
             s.SNAPSHOT_MONTH_KEY
)
SELECT
    BRANCH_ID,
    BRANCH_NAME,
    BRANCH_TYPE,
    REGION,
    CITY,
    SNAPSHOT_MONTH_KEY,
    accounts_serviced,
    customers_serviced,
    total_deposits,
    total_volume,
    total_fees,
    total_interest,
    SUM(total_fees) OVER (
        PARTITION BY BRANCH_ID
        ORDER BY SNAPSHOT_MONTH_KEY
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_fees,
    AVG(total_volume) OVER (
        PARTITION BY BRANCH_ID
        ORDER BY SNAPSHOT_MONTH_KEY
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS moving_avg_volume_3m,
    RANK() OVER (
        PARTITION BY REGION, SNAPSHOT_MONTH_KEY
        ORDER BY total_deposits DESC
    ) AS region_deposit_rank,
    total_deposits /
        NULLIF(SUM(total_deposits) OVER (PARTITION BY REGION, SNAPSHOT_MONTH_KEY), 0)
        * 100 AS pct_of_region_deposits
FROM monthly;
