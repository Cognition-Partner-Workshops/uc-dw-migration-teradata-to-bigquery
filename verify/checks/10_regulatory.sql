-- Regulatory large-transaction reporting parity.
-- Exercises threshold logic + QUALIFY dedup in the converted view.
SELECT
  COUNT(*)                                AS row_count,
  ROUND(SUM(base_currency_amount), 2)     AS sum_base_amount,
  COUNT(DISTINCT reporting_category)      AS n_categories
FROM vw_regulatory_large_transactions;
