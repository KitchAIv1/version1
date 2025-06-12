-- Test Script: Verify Quantity Tracking Implementation
-- Run this in Supabase SQL Editor after applying the migration

SET search_path TO public;

-- Test 1: Insert new item (should set previous_quantity = 0, quantity_added = quantity)
INSERT INTO stock (user_id, item_name, quantity, unit, storage_location) 
VALUES (
  '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid, 
  'test_carrot', 
  5, 
  'units',
  'cupboard'
)
RETURNING id, item_name, quantity, previous_quantity, quantity_added, created_at, updated_at;

-- Test 2: Update existing item (should track quantity change)
UPDATE stock 
SET quantity = 8
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND item_name = 'test_carrot'
RETURNING id, item_name, quantity, previous_quantity, quantity_added, created_at, updated_at;

-- Test 3: UPSERT existing item (should work like update)
INSERT INTO stock (user_id, item_name, quantity, unit, storage_location) 
VALUES (
  '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid, 
  'test_carrot', 
  12, 
  'units',
  'cupboard'
)
ON CONFLICT (user_id, item_name) 
DO UPDATE SET 
  quantity = EXCLUDED.quantity,
  updated_at = NOW()
RETURNING id, item_name, quantity, previous_quantity, quantity_added, created_at, updated_at;

-- Test 4: UPSERT new item (should work like insert)
INSERT INTO stock (user_id, item_name, quantity, unit, storage_location) 
VALUES (
  '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid, 
  'test_banana', 
  3, 
  'units',
  'cupboard'
)
ON CONFLICT (user_id, item_name) 
DO UPDATE SET 
  quantity = EXCLUDED.quantity,
  updated_at = NOW()
RETURNING id, item_name, quantity, previous_quantity, quantity_added, created_at, updated_at;

-- Test 5: Verify all test items
SELECT 
  item_name,
  quantity,
  previous_quantity,
  quantity_added,
  created_at,
  updated_at,
  CASE 
    WHEN quantity_added > 0 THEN 'Recent Addition'
    WHEN quantity_added < 0 THEN 'Recent Reduction'
    ELSE 'No Change'
  END as change_type
FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND item_name LIKE 'test_%'
ORDER BY updated_at DESC;

-- Test 6: Verify frontend query compatibility
SELECT 
  id, 
  item_name, 
  quantity, 
  unit, 
  description, 
  created_at, 
  updated_at, 
  quantity_added, 
  previous_quantity
FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND item_name LIKE 'test_%'
ORDER BY created_at DESC;

-- Cleanup test data
DELETE FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND item_name LIKE 'test_%';

-- Final verification: Check if tomato is properly normalized
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at
FROM stock 
WHERE user_id = '75a26b47-9b41-490b-af01-d00926cb0bbb'::uuid 
  AND LOWER(item_name) = 'tomato'; 