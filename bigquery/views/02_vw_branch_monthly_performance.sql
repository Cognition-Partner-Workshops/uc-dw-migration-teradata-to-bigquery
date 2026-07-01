-- ============================================================================
-- vw_branch_monthly_performance
-- Converted from Teradata BANKING_DW.VW_BRANCH_PERFORMANCE.
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery mappings applied:
--   SEL                        -> SELECT
--   LOCKING ROW FOR ACCESS     -> dropped
--   CSUM(x, key)               -> SUM(x) OVER (ORDER BY key
--                                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
--   MAVG(x, 3, key)            -> AVG(x) OVER (ORDER BY key
--                                   ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
--                                 NOTE: MAVG(x,3) = current + 2 preceding = 3 rows.
--                                 "3 PRECEDING" (4 rows) is the classic off-by-one
--                                 the parity harness catches.
--   NULLIFZERO(x)              -> NULLIF(x, 0)
--   col (FORMAT '...')         -> dropped (format on read with FORMAT() if needed)
--   ADD_MONTHS(CURRENT_DATE,-24) window + DIM_DATE join -> dropped (see note below)
--
-- Partitioning note: Teradata's legacy CSUM/MAVG take only a sort key (no
-- explicit PARTITION BY). Since each output row is a (branch, month) grain and
-- the measures are per-branch running aggregates ("...YTD", "3M moving avg"),
-- the faithful business intent partitions the window by BRANCH_ID. The parity
-- golden was generated with per-branch windows.
--
-- Scope note: the production view also filters
-- snap.SNAPSHOT_DATE >= ADD_MONTHS(CURRENT_DATE, -24) and joins DIM_DATE for a
-- MONTH_LABEL. The seed/parity model has no DIM_DATE and no CURRENT_DATE
-- relativity, so those are dropped here to keep the signature deterministic.
-- ============================================================================
CREATE OR REPLACE VIEW vw_branch_monthly_performance AS
WITH monthly AS (
    SELECT
        snap.BRANCH_ID,
        b.BRANCH_NAME,
        b.BRANCH_TYPE,
        b.REGION,
        b.CITY,
        snap.SNAPSHOT_MONTH_KEY,
        COUNT(DISTINCT snap.ACCOUNT_ID)          AS accounts_serviced,
        COUNT(DISTINCT snap.CUSTOMER_ID)         AS customers_serviced,
        SUM(snap.CLOSING_BALANCE)                AS total_deposits,
        SUM(snap.TOTAL_DEBITS + snap.TOTAL_CREDITS) AS total_volume,
        SUM(snap.FEES_CHARGED)                   AS total_fees_earned,
        SUM(snap.INTEREST_CHARGED)               AS total_interest_income,
        AVG(snap.CLOSING_BALANCE)                AS avg_account_balance
    FROM fact_monthly_account_snapshot snap
    INNER JOIN dim_branch b
        ON snap.BRANCH_ID = b.BRANCH_ID
    WHERE b.IS_ACTIVE = 1
    GROUP BY snap.BRANCH_ID, b.BRANCH_NAME, b.BRANCH_TYPE, b.REGION, b.CITY,
             snap.SNAPSHOT_MONTH_KEY
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
    total_fees_earned,
    total_interest_income,
    avg_account_balance,
    -- CSUM(SUM(FEES_CHARGED), SNAPSHOT_MONTH_KEY)
    SUM(total_fees_earned) OVER (
        PARTITION BY BRANCH_ID
        ORDER BY SNAPSHOT_MONTH_KEY
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_fees,
    -- MAVG(SUM(TOTAL_DEBITS + TOTAL_CREDITS), 3, SNAPSHOT_MONTH_KEY)
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
        NULLIF(SUM(total_deposits) OVER (
            PARTITION BY REGION, SNAPSHOT_MONTH_KEY
        ), 0) * 100 AS pct_of_region_deposits
FROM monthly;
