-- Fix recipe_uploads RLS policies for edge function compatibility (Simple Version)
-- This allows the video-processor edge function (running with service role) to insert recipes

-- First, check if policies already exist and drop them if they do
DROP POLICY IF EXISTS "Service role can insert recipes for edge functions" ON recipe_uploads;
DROP POLICY IF EXISTS "Service role full access for edge functions" ON recipe_uploads;

-- Add service role policy for INSERT operations
CREATE POLICY "Service role can insert recipes for edge functions" 
ON recipe_uploads 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Add service role policy for full access (needed for edge function operations)
CREATE POLICY "Service role full access for edge functions" 
ON recipe_uploads 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Grant necessary permissions to service role (ignore if already granted)
GRANT ALL ON recipe_uploads TO service_role; 