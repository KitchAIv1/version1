-- Cleanup: Merge duplicate Tomato into normalized tomato
-- Run this in Supabase SQL Editor

SET search_path TO public;

-- First, let's see the current state
SELECT 
  id, 
  user_id, 
  item_name, 
  quantity, 
  quantity_added, 
  previous_quantity,
  created_at,
  updated_at
FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND (item_name = 'tomato' OR item_name = 'Tomato')
ORDER BY created_at;

-- Merge the duplicate Tomato into tomato
-- This will combine quantities and keep the older created_at
WITH duplicate_info AS (
  SELECT 
    id,
    item_name,
    quantity,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM stock 
  WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
    AND (item_name = 'tomato' OR item_name = 'Tomato')
),
merge_data AS (
  SELECT 
    SUM(quantity) as total_quantity,
    MIN(created_at) as earliest_created_at,
    COUNT(*) as duplicate_count
  FROM duplicate_info
)
-- Update the normalized record (tomato) with combined quantity
UPDATE stock 
SET 
  quantity = (SELECT total_quantity FROM merge_data),
  created_at = (SELECT earliest_created_at FROM merge_data),
  updated_at = NOW()
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND item_name = 'tomato';

-- Delete the duplicate Tomato record
DELETE FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND item_name = 'Tomato';

-- Verify the cleanup
SELECT 
  id, 
  user_id, 
  item_name, 
  quantity, 
  quantity_added, 
  previous_quantity,
  created_at,
  updated_at
FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND item_name = 'tomato';

-- Final verification: Check for any remaining case-sensitive duplicates
SELECT 
  LOWER(item_name) as normalized_name,
  COUNT(*) as count,
  STRING_AGG(item_name, ', ') as variations
FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid
GROUP BY LOWER(item_name)
HAVING COUNT(*) > 1; 