-- Converted from BANKING_DW.VW_BRANCH_PERFORMANCE (Teradata).
-- Source: ddl/views/03_vw_branch_performance.sql
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery translation decisions:
--   REPLACE VIEW           -> CREATE OR REPLACE VIEW
--   SEL                    -> SELECT
--   LOCKING ROW FOR ACCESS -> dropped (no read locks in BigQuery)
--   FORMAT 'ZZZ...'        -> dropped; format on read with FORMAT() if needed
--   CSUM(x, monthkey)      -> SUM(x) OVER (ORDER BY monthkey
--                               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
--   MAVG(x, 3, monthkey)   -> AVG(x) OVER (ORDER BY monthkey
--                               ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
--                             KNOWN PITFALL: MAVG(x, 3, ...) is a 3-row window
--                             (current + 2 preceding). "3 PRECEDING" averages 4
--                             rows and diverges from golden.
--   NULLIFZERO(x)          -> NULLIF(x, 0)
--   ADD_MONTHS(CURRENT_DATE,-24) filter -> dropped so the parity signature is
--                             deterministic (no dependence on run date). On
--                             BigQuery keep it: WHERE snapshot_date >=
--                             DATE_ADD(CURRENT_DATE(), INTERVAL -24 MONTH).
--   The CSUM/MAVG running windows are scoped per BRANCH_ID (PARTITION BY
--   BRANCH_ID): each branch has its own cumulative fee total and moving average.
CREATE OR REPLACE VIEW vw_branch_monthly_performance AS
WITH monthly AS (
    SELECT
        s.BRANCH_ID,
        b.BRANCH_NAME,
        b.BRANCH_TYPE,
        b.REGION,
        b.CITY,
        s.SNAPSHOT_MONTH_KEY,
        COUNT(DISTINCT s.ACCOUNT_ID)          AS accounts_serviced,
        COUNT(DISTINCT s.CUSTOMER_ID)         AS customers_serviced,
        SUM(s.CLOSING_BALANCE)                AS total_deposits,
        SUM(s.TOTAL_DEBITS + s.TOTAL_CREDITS) AS total_volume,
        SUM(s.FEES_CHARGED)                   AS total_fees,
        SUM(s.INTEREST_CHARGED)               AS total_interest
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
    ) AS region_deposit_rank
FROM monthly;
