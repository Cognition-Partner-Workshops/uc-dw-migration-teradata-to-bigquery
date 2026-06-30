-- Customer 360 parity (deterministic: lifetime aggregates, no CURRENT_DATE
-- windowing). Exercises ZEROIFNULL -> IFNULL/COALESCE and multi-join shaping.
SELECT
  COUNT(*)                              AS row_count,
  ROUND(SUM(total_accounts), 0)        AS sum_total_accounts,
  ROUND(SUM(lifetime_txn_amount), 2)   AS sum_lifetime_txn_amount
FROM vw_customer_360;
