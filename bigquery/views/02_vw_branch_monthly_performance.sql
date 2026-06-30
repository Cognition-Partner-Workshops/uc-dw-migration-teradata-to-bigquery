-- Converted from BANKING_DW.VW_BRANCH_PERFORMANCE (Teradata).
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery notes:
--   CSUM(x, sortkey)     -> SUM(x) OVER (ORDER BY sortkey
--                               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
--   MAVG(x, n, sortkey)  -> AVG(x) OVER (ORDER BY sortkey
--                               ROWS BETWEEN (n-1) PRECEDING AND CURRENT ROW)
--                           MAVG(x, 3, ...) spans the current row + 2 preceding
--                           rows = 3 rows total. Translating to "3 PRECEDING"
--                           (4 rows) is the classic off-by-one the parity
--                           harness catches.
--   NULLIFZERO(x)        -> NULLIF(x, 0)
CREATE OR REPLACE VIEW vw_branch_monthly_performance AS
WITH monthly AS (
    SELECT
        s.BRANCH_ID,
        b.BRANCH_NAME,
        b.BRANCH_TYPE,
        b.REGION,
        b.CITY,
        s.SNAPSHOT_MONTH_KEY,
        COUNT(DISTINCT s.ACCOUNT_ID)              AS accounts_serviced,
        COUNT(DISTINCT s.CUSTOMER_ID)             AS customers_serviced,
        SUM(s.CLOSING_BALANCE)                    AS total_deposits,
        SUM(s.TOTAL_DEBITS + s.TOTAL_CREDITS)     AS total_volume,
        SUM(s.FEES_CHARGED)                       AS total_fees,
        SUM(s.INTEREST_CHARGED)                   AS total_interest
    FROM fact_monthly_account_snapshot s
    JOIN dim_branch b
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
    ) AS region_deposit_rank
FROM monthly;
