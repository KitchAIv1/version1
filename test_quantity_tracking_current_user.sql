-- Test Script: Verify Quantity Tracking for Current User
-- Run this AFTER applying the migration and fixing duplicates

SET search_path TO public;

-- Current user from logs
\set target_user '9b84ff89-f9e5-4ddb-9de8-9797d272da59'

-- Test 1: Check if migration columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'stock' 
  AND column_name IN ('quantity_added', 'previous_quantity')
ORDER BY column_name;

-- Test 2: Check current state of olive oil (should be normalized)
SELECT 
  id,
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND LOWER(item_name) = 'olive oil'
ORDER BY created_at;

-- Test 3: Update olive oil quantity to test trigger
UPDATE stock 
SET quantity = quantity + 5
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'olive oil'
RETURNING 
  id,
  item_name,
  quantity,
  previous_quantity,
  quantity_added,
  created_at,
  updated_at;

-- Test 4: Insert a new test item
INSERT INTO stock (user_id, item_name, quantity, unit, storage_location) 
VALUES (
  '9b84ff89-f9e5-4ddb-9de8-9797d272da59'::uuid, 
  'test_new_item', 
  3, 
  'units',
  'cupboard'
)
RETURNING 
  id,
  item_name,
  quantity,
  previous_quantity,
  quantity_added,
  created_at,
  updated_at;

-- Test 5: UPSERT existing item (should trigger UPDATE path)
INSERT INTO stock (user_id, item_name, quantity, unit, storage_location) 
VALUES (
  '9b84ff89-f9e5-4ddb-9de8-9797d272da59'::uuid, 
  'test_new_item', 
  7, 
  'units',
  'cupboard'
)
ON CONFLICT (user_id, item_name) 
DO UPDATE SET 
  quantity = EXCLUDED.quantity,
  updated_at = NOW()
RETURNING 
  id,
  item_name,
  quantity,
  previous_quantity,
  quantity_added,
  created_at,
  updated_at;

-- Test 6: Verify all changes
SELECT 
  item_name,
  quantity,
  previous_quantity,
  quantity_added,
  created_at,
  updated_at,
  CASE 
    WHEN quantity_added > 0 THEN 'Addition'
    WHEN quantity_added < 0 THEN 'Reduction'
    WHEN quantity_added = 0 THEN 'No Change'
    ELSE 'Unknown'
  END as change_type
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND (item_name = 'olive oil' OR item_name = 'test_new_item')
ORDER BY item_name, updated_at DESC;

-- Test 7: Check for any remaining duplicates
SELECT 
  LOWER(item_name) as normalized_name,
  COUNT(*) as count,
  STRING_AGG(item_name, ', ') as variations
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
GROUP BY LOWER(item_name)
HAVING COUNT(*) > 1;

-- Cleanup test data
DELETE FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'test_new_item';

-- Final verification: Show items with quantity tracking data
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  CASE 
    WHEN quantity_added IS NOT NULL AND quantity_added > 0 THEN 'Has Recent Addition'
    WHEN quantity_added IS NOT NULL AND quantity_added < 0 THEN 'Has Recent Reduction'
    WHEN quantity_added IS NOT NULL AND quantity_added = 0 THEN 'No Recent Change'
    ELSE 'No Tracking Data'
  END as tracking_status
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name IN ('olive oil', 'garlic', 'flour', 'tomatoes', 'spam', 'rice')
ORDER BY item_name; 