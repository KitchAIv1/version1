-- Analysis script to assess backup tables before cleanup
-- This helps determine which backups are safe to remove

-- Check if backup tables still contain data
SELECT 
  schemaname,
  tablename,
  n_tup_ins as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_stat_user_tables 
WHERE tablename LIKE '%backup%' 
ORDER BY tablename, n_tup_ins DESC;

-- Check creation dates of backup tables
SELECT 
  table_name,
  table_schema,
  table_type
FROM information_schema.tables 
WHERE table_name LIKE '%backup%' 
  AND table_schema = 'public'
ORDER BY table_name;

-- Analyze debug_logs table usage
SELECT 
  schemaname,
  tablename,
  n_tup_ins as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_stat_user_tables 
WHERE tablename = 'debug_logs';

-- Check if main tables exist and are healthy
SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_name IN ('recipe_uploads', 'recipe_ingredients', 'recipe_views', 'recipe_comments', 'user_activity_log')
  AND table_schema = 'public'
ORDER BY table_name; 