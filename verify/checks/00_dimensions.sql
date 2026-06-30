-- Dimension load parity. Reads the seed tables directly, so this check passes
-- even before the conversion exists (it validates the source/seed contract).
SELECT
  (SELECT COUNT(*) FROM dim_customer) AS dim_customer_rows,
  (SELECT COUNT(*) FROM dim_account)  AS dim_account_rows,
  (SELECT COUNT(*) FROM dim_product)  AS dim_product_rows,
  (SELECT COUNT(*) FROM dim_branch)   AS dim_branch_rows;
