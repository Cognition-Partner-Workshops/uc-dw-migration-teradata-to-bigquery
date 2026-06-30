-- Branch monthly performance parity.
-- Exercises the CSUM -> cumulative window and MAVG -> moving-average window
-- translations. The 3-month moving average is the classic divergence point:
-- Teradata MAVG(x, 3) averages the current month plus the two preceding months
-- (3 rows), i.e. ROWS BETWEEN 2 PRECEDING AND CURRENT ROW. A naive translation
-- to "3 PRECEDING" averages 4 rows and SUM(moving_avg_volume_3m) drifts.
SELECT
  COUNT(*)                              AS row_count,
  ROUND(SUM(cumulative_fees), 2)       AS sum_cumulative_fees,
  ROUND(SUM(moving_avg_volume_3m), 2)  AS sum_moving_avg_volume
FROM vw_branch_monthly_performance;
