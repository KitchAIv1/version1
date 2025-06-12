-- Debug Script: Check Current Data State
-- Run this to see exactly what data exists for your user

SET search_path TO public;

-- Check current user's data
SELECT 
  id,
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  unit,
  created_at,
  updated_at,
  CASE 
    WHEN quantity_added IS NULL THEN 'Missing quantity_added'
    WHEN previous_quantity IS NULL THEN 'Missing previous_quantity'
    WHEN quantity_added > 0 THEN 'Has recent addition'
    WHEN quantity_added < 0 THEN 'Has recent reduction'
    WHEN quantity_added = 0 THEN 'No recent change'
    ELSE 'Unknown state'
  END as tracking_status
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name IN ('olive oil', 'tomato', 'tomatoes', 'spam', 'rice')
ORDER BY item_name, updated_at DESC;

-- Check for any items that were recently updated
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at,
  (updated_at > created_at) as was_updated
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND updated_at IS NOT NULL
  AND updated_at > created_at
ORDER BY updated_at DESC
LIMIT 10;

-- Check the specific tomato record that was mentioned in tests
SELECT 
  id,
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  unit,
  created_at,
  updated_at,
  (quantity_added + previous_quantity) as calculated_total
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND (item_name = 'tomato' OR item_name = 'tomatoes')
ORDER BY updated_at DESC;

-- Check if there are any case-sensitive duplicates still
SELECT 
  LOWER(item_name) as normalized_name,
  COUNT(*) as count,
  STRING_AGG(item_name, ', ') as variations,
  STRING_AGG(quantity::text, ', ') as quantities,
  STRING_AGG(COALESCE(quantity_added::text, 'NULL'), ', ') as quantity_added_values
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
GROUP BY LOWER(item_name)
HAVING COUNT(*) > 1;

-- Show the most recent 5 items to see their tracking data
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
ORDER BY COALESCE(updated_at, created_at) DESC
LIMIT 5; 