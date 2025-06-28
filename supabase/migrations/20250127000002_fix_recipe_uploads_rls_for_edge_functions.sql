-- Fix recipe_uploads RLS policies for edge function compatibility
-- This allows the video-processor edge function (running with service role) to insert recipes
-- while maintaining security for regular user operations

-- Add service role policy for recipe_uploads table
-- This is safe because the edge function already authenticates users via JWT
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

-- Grant necessary permissions to service role
GRANT ALL ON recipe_uploads TO service_role;

-- Add comment for documentation
COMMENT ON POLICY "Service role can insert recipes for edge functions" ON recipe_uploads IS 
'Allows video-processor edge function to insert recipes. Safe because edge function validates user JWT before insertion.';

COMMENT ON POLICY "Service role full access for edge functions" ON recipe_uploads IS 
'Allows service role full access for edge function operations while maintaining user-level RLS for regular operations.';
