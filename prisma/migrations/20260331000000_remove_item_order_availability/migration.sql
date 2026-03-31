-- Drop availability sync jobs and related tables
DROP TABLE IF EXISTS "availability_sync_jobs" CASCADE;
DROP TABLE IF EXISTS "availability_audit_logs" CASCADE;
DROP TABLE IF EXISTS "channel_bagel_mappings" CASCADE;
DROP TABLE IF EXISTS "channel_sync_statuses" CASCADE;
DROP TABLE IF EXISTS "bagel_availability_states" CASCADE;
DROP TABLE IF EXISTS "bagel_types" CASCADE;

-- Drop order/subscription tables
DROP TABLE IF EXISTS "order_line_modifiers" CASCADE;
DROP TABLE IF EXISTS "order_lines" CASCADE;
DROP TABLE IF EXISTS "orders" CASCADE;
DROP TABLE IF EXISTS "subscription_items" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;

-- Drop sync job tables
DROP TABLE IF EXISTS "sync_job_logs" CASCADE;
DROP TABLE IF EXISTS "sync_jobs" CASCADE;

-- Drop Loyverse receipt tables
DROP TABLE IF EXISTS "channel_receipt_payments" CASCADE;
DROP TABLE IF EXISTS "channel_receipt_line_item_modifiers" CASCADE;
DROP TABLE IF EXISTS "channel_receipt_line_item_taxes" CASCADE;
DROP TABLE IF EXISTS "channel_receipt_line_item_discounts" CASCADE;
DROP TABLE IF EXISTS "channel_receipt_line_items" CASCADE;
DROP TABLE IF EXISTS "channel_receipt_discounts" CASCADE;
DROP TABLE IF EXISTS "channel_receipts" CASCADE;

-- Drop catalog channel mapping tables
DROP TABLE IF EXISTS "modifier_option_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "modifier_group_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "item_variant_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "item_channel_mappings" CASCADE;
DROP TABLE IF EXISTS "category_channel_mappings" CASCADE;

-- Drop Loyverse channel mirror tables
DROP TABLE IF EXISTS "channel_modifier_options" CASCADE;
DROP TABLE IF EXISTS "channel_modifier_group_store_links" CASCADE;
DROP TABLE IF EXISTS "channel_modifier_groups" CASCADE;
DROP TABLE IF EXISTS "channel_payment_type_store_links" CASCADE;
DROP TABLE IF EXISTS "channel_payment_types" CASCADE;
DROP TABLE IF EXISTS "channel_variant_store_data" CASCADE;
DROP TABLE IF EXISTS "channel_variants" CASCADE;
DROP TABLE IF EXISTS "channel_item_modifier_group_links" CASCADE;
DROP TABLE IF EXISTS "channel_item_tax_links" CASCADE;
DROP TABLE IF EXISTS "channel_item_components" CASCADE;
DROP TABLE IF EXISTS "channel_items" CASCADE;
DROP TABLE IF EXISTS "channel_categories" CASCADE;

-- Drop canonical catalog tables
DROP TABLE IF EXISTS "item_modifier_groups" CASCADE;
DROP TABLE IF EXISTS "modifier_options" CASCADE;
DROP TABLE IF EXISTS "modifier_groups" CASCADE;
DROP TABLE IF EXISTS "item_variants" CASCADE;
DROP TABLE IF EXISTS "items" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "availability_channel";
DROP TYPE IF EXISTS "bagel_change_source";
DROP TYPE IF EXISTS "channel_sync_result";
DROP TYPE IF EXISTS "availability_audit_action";
DROP TYPE IF EXISTS "remote_entity_type";
DROP TYPE IF EXISTS "sync_job_status";
DROP TYPE IF EXISTS "Channel";
DROP TYPE IF EXISTS "MappingStatus";
DROP TYPE IF EXISTS "OrderStatus";
DROP TYPE IF EXISTS "OrderOrigin";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "SubscriptionFrequency";
