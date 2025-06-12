-- Test script to verify merge operation triggers quantity tracking correctly
-- Run this to test the merge functionality with quantity tracking

-- 1. Check current state of Cheese (which was just merged in logs)
SELECT 
  id,
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at,
  CASE 
    WHEN quantity_added IS NOT NULL AND previous_quantity IS NOT NULL 
    THEN CONCAT('Change: +', quantity_added, ' (from ', previous_quantity, ' to ', quantity, ')')
    ELSE 'No tracking data'
  END as tracking_summary
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'Cheese';

-- 2. Test the trigger manually to see if it works
-- Create a test item
INSERT INTO stock (user_id, item_name, quantity, unit, storage_location)
VALUES ('9b84ff89-f9e5-4ddb-9de8-9797d272da59', 'test_merge_item', 5, 'units', 'cupboard');

-- Check the initial state (should have quantity_added=5, previous_quantity=0)
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  'After INSERT' as operation
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'test_merge_item';

-- Update the quantity (simulating a merge operation)
UPDATE stock 
SET quantity = 8, updated_at = NOW()
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'test_merge_item';

-- Check the state after update (should have quantity_added=3, previous_quantity=5)
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  'After UPDATE' as operation,
  CASE 
    WHEN quantity_added = 3 AND previous_quantity = 5 
    THEN '✅ TRIGGER WORKING'
    ELSE '❌ TRIGGER NOT WORKING'
  END as trigger_status
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'test_merge_item';

-- Clean up test item
DELETE FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'test_merge_item';

-- 3. Check if there are any items that should show quantity tracking but don't
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at,
  CASE 
    WHEN updated_at != created_at AND (quantity_added IS NULL OR previous_quantity IS NULL)
    THEN '⚠️ MISSING TRACKING DATA'
    WHEN updated_at != created_at AND quantity_added IS NOT NULL AND previous_quantity IS NOT NULL
    THEN '✅ HAS TRACKING DATA'
    ELSE '➖ NO UPDATES YET'
  END as tracking_status
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name IN ('Cheese', 'olive oil', 'onion', 'rice', 'spam')
ORDER BY updated_at DESC; 