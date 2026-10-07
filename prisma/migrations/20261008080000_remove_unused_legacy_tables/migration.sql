-- Remove legacy tables no longer used by the Bagels Beyond operations portal.
-- Retained application tables:
--   users, admin_action_logs, daily_records,
--   product_categories, menu_products, freshness_logs
--
-- CASCADE removes foreign-key constraints from legacy tables without removing
-- any retained table. This migration is intentionally destructive; production
-- data was backed up before migration.

DROP TABLE IF EXISTS "ingredient_categories" CASCADE;
DROP TABLE IF EXISTS "ingredients" CASCADE;
DROP TABLE IF EXISTS "ingredient_price_history" CASCADE;
DROP TABLE IF EXISTS "suppliers" CASCADE;
DROP TABLE IF EXISTS "supplier_api_credentials" CASCADE;
DROP TABLE IF EXISTS "supplier_scraper_credentials" CASCADE;
DROP TABLE IF EXISTS "supplier_sync_logs" CASCADE;
DROP TABLE IF EXISTS "supplier_sync_log_entries" CASCADE;
DROP TABLE IF EXISTS "ingredient_supplier_links" CASCADE;
DROP TABLE IF EXISTS "price_import_batches" CASCADE;
DROP TABLE IF EXISTS "price_import_rows" CASCADE;
DROP TABLE IF EXISTS "recipes" CASCADE;
DROP TABLE IF EXISTS "recipe_items" CASCADE;
DROP TABLE IF EXISTS "daily_external_factors" CASCADE;
DROP TABLE IF EXISTS "prediction_weights" CASCADE;
DROP TABLE IF EXISTS "weight_sets" CASCADE;
DROP TABLE IF EXISTS "weight_set_entries" CASCADE;
DROP TABLE IF EXISTS "app_settings" CASCADE;
DROP TABLE IF EXISTS "sales_predictions" CASCADE;
DROP TABLE IF EXISTS "prediction_factor_snapshots" CASCADE;
DROP TABLE IF EXISTS "import_jobs" CASCADE;
DROP TABLE IF EXISTS "import_rows" CASCADE;
DROP TABLE IF EXISTS "scheduled_tasks" CASCADE;
DROP TABLE IF EXISTS "task_logs" CASCADE;
DROP TABLE IF EXISTS "forecast_overrides" CASCADE;
DROP TABLE IF EXISTS "stores" CASCADE;
DROP TABLE IF EXISTS "menu_modifier_groups" CASCADE;
DROP TABLE IF EXISTS "menu_modifier_options" CASCADE;
DROP TABLE IF EXISTS "loyverse_sync_logs" CASCADE;
DROP TABLE IF EXISTS "customer_orders" CASCADE;
DROP TABLE IF EXISTS "customer_order_items" CASCADE;
DROP TABLE IF EXISTS "customer_order_item_modifiers" CASCADE;
