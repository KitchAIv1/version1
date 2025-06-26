-- MINIMAL SAFE FIX: Handle unique constraint on user_id while fixing RLS policy
-- This addresses the duplicate key error: unique constraint "unique_user_id"

-- Step 1: SAFELY fix data inconsistency - avoid duplicates
-- Only update profiles where user_id is NULL AND the target id doesn't already exist as user_id
UPDATE profiles 
SET user_id = id 
WHERE user_id IS NULL 
  AND id NOT IN (SELECT user_id FROM profiles WHERE user_id IS NOT NULL);

-- Step 2: For any remaining profiles with user_id = NULL (duplicates), 
-- generate new UUIDs to avoid constraint violation
UPDATE profiles 
SET user_id = gen_random_uuid()
WHERE user_id IS NULL;

-- Step 3: Fix the RLS UPDATE policy to match what functions expect
-- Current policy: (id = auth.uid()) 
-- Functions expect: (user_id = auth.uid())

DROP POLICY IF EXISTS "Authenticated users update own profile" ON public.profiles;

CREATE POLICY "Authenticated users update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Step 4: Verify the fix worked
SELECT 'Fixed RLS policy - verification:' as status;
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'UPDATE';

-- Step 5: Check for remaining issues
SELECT 'Data consistency check:' as status;
SELECT 
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_ids,
  COUNT(*) FILTER (WHERE user_id = id) as matching_ids,
  COUNT(DISTINCT user_id) as unique_user_ids
FROM profiles;

-- SUMMARY:
-- 1. Safely sets user_id = id where possible (no conflicts)
-- 2. Generates new UUIDs for any remaining NULL user_ids (avoids duplicates)  
-- 3. RLS policy now matches what functions expect (user_id = auth.uid())
-- 4. No more silent UPDATE failures blocking PREMIUM upgrades 