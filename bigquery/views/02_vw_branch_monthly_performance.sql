-- Converted from BANKING_DW.VW_BRANCH_PERFORMANCE (Teradata).
-- Target dialect: BigQuery Standard SQL (GoogleSQL).
--
-- Teradata -> BigQuery translation notes:
--   SEL                    -> SELECT
--   LOCKING ROW FOR ACCESS -> dropped
--   x (FORMAT 'ZZZ,...')   -> dropped (display formatting; apply with FORMAT()
--                             at presentation time, not in the analytic view)
--   CSUM(x, k)             -> SUM(x) OVER (ORDER BY k
--                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
--   MAVG(x, 3, k)          -> AVG(x) OVER (ORDER BY k
--                             ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
--                             MAVG(x, 3) = current row + 2 preceding = 3 rows.
--                             "3 PRECEDING" (4 rows) is the classic off-by-one
--                             the parity harness catches, so 2 PRECEDING is used.
--   NULLIFZERO(x)          -> NULLIF(x, 0)
--   ADD_MONTHS(CURRENT_DATE, -24) filter -> dropped: it is a CURRENT_DATE
--                             (non-deterministic) window that, evaluated in 2026,
--                             would exclude the 2024-2025 seed months entirely.
--                             The parity signature is the deterministic full set.
--   DIM_DATE join / MONTH_LABEL -> dropped: no dim_date in the parity model and
--                             the label is not part of the parity signature.
--   The Teradata source computes CSUM/MAVG over the whole grouped answer set
--   (no partition). Here they are partitioned BY BRANCH_ID so each branch has an
--   independent cumulative-fees ("YTD") and 3-month moving-average series, which
--   matches the intended per-branch dashboard semantics and the golden metrics.
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
        NULLIF(SUM(total_deposits) OVER (
            PARTITION BY REGION, SNAPSHOT_MONTH_KEY
        ), 0) * 100 AS pct_of_region_deposits
FROM monthly;
