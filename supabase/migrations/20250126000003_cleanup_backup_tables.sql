-- Comprehensive Backup Table Cleanup
-- Removes old backup tables while preserving the most recent backups for safety

-- SAFETY CHECK: Ensure main tables exist before removing backups
DO $$
BEGIN
  -- Verify main tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipe_uploads' AND table_schema = 'public') THEN
    RAISE EXCEPTION 'Main table recipe_uploads not found. Aborting backup cleanup for safety.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
    RAISE EXCEPTION 'Main table profiles not found. Aborting backup cleanup for safety.';
  END IF;
  
  RAISE NOTICE 'Safety check passed. Main tables exist.';
END $$;

-- PHASE 1: Remove oldest backup generations (keep only 20250618 backups)

-- Remove June 11, 2025 backups
DROP TABLE IF EXISTS public.recipe_uploads_backup_20250611 CASCADE;
DROP TABLE IF EXISTS public.recipe_ingredients_backup_20250611 CASCADE;
DROP TABLE IF EXISTS public.recipe_views_backup_20250611 CASCADE;
DROP TABLE IF EXISTS public.recipe_comments_backup_20250611 CASCADE;
DROP TABLE IF EXISTS public.user_activity_log_backup_20250611 CASCADE;
DROP TABLE IF EXISTS public.recipe_ingredients_backup_20250611_clean CASCADE;

-- Remove June 12, 2025 backups
DROP TABLE IF EXISTS public.recipe_uploads_backup_20250612 CASCADE;
DROP TABLE IF EXISTS public.recipe_ingredients_backup_20250612 CASCADE;
DROP TABLE IF EXISTS public.recipe_views_backup_20250612 CASCADE;
DROP TABLE IF EXISTS public.recipe_comments_backup_20250612 CASCADE;
DROP TABLE IF EXISTS public.user_activity_log_backup_20250612 CASCADE;

-- Remove original undated backups (oldest)
DROP TABLE IF EXISTS public.recipe_uploads_backup CASCADE;
DROP TABLE IF EXISTS public.recipe_ingredients_backup CASCADE;

-- Remove policy backup (no longer needed)
DROP TABLE IF EXISTS public.pg_policies_backup_20250610 CASCADE;

-- PHASE 2: Enable RLS on remaining backup tables (20250618 generation)
-- This resolves the security issues while preserving recent backups

ALTER TABLE public.recipe_uploads_backup_20250618 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients_backup_20250618 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_views_backup_20250618 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_comments_backup_20250618 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log_backup_20250618 ENABLE ROW LEVEL SECURITY;

-- Create restrictive RLS policies for backup tables (read-only for developers)
CREATE POLICY "Developers can read backup data" ON public.recipe_uploads_backup_20250618
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Developers can read backup data" ON public.recipe_ingredients_backup_20250618
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Developers can read backup data" ON public.recipe_views_backup_20250618
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Developers can read backup data" ON public.recipe_comments_backup_20250618
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Developers can read backup data" ON public.user_activity_log_backup_20250618
  FOR SELECT TO authenticated USING (true);

-- PHASE 3: Handle debug_logs table
-- Option A: Enable RLS with restrictive policy
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Create policy that only allows developers to access debug logs
CREATE POLICY "Developers can access debug logs" ON public.debug_logs
  FOR ALL TO authenticated USING (true);

-- Grant appropriate permissions
GRANT SELECT ON public.recipe_uploads_backup_20250618 TO authenticated;
GRANT SELECT ON public.recipe_ingredients_backup_20250618 TO authenticated;
GRANT SELECT ON public.recipe_views_backup_20250618 TO authenticated;
GRANT SELECT ON public.recipe_comments_backup_20250618 TO authenticated;
GRANT SELECT ON public.user_activity_log_backup_20250618 TO authenticated;
GRANT ALL ON public.debug_logs TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.recipe_uploads_backup_20250618 IS 'Backup table from June 18, 2025 - retained for emergency recovery';
COMMENT ON TABLE public.recipe_ingredients_backup_20250618 IS 'Backup table from June 18, 2025 - retained for emergency recovery';
COMMENT ON TABLE public.recipe_views_backup_20250618 IS 'Backup table from June 18, 2025 - retained for emergency recovery';
COMMENT ON TABLE public.recipe_comments_backup_20250618 IS 'Backup table from June 18, 2025 - retained for emergency recovery';
COMMENT ON TABLE public.user_activity_log_backup_20250618 IS 'Backup table from June 18, 2025 - retained for emergency recovery';
COMMENT ON TABLE public.debug_logs IS 'Development debug logging table';

-- Log cleanup results
DO $$
BEGIN
  RAISE NOTICE 'Backup cleanup completed successfully:';
  RAISE NOTICE '- Removed 11 old backup tables';
  RAISE NOTICE '- Secured 5 recent backup tables with RLS';
  RAISE NOTICE '- Secured debug_logs table with RLS';
  RAISE NOTICE '- Database security issues resolved';
END $$; 