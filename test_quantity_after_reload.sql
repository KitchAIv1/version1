-- Test script to verify quantity tracking after app reload
-- Run this AFTER reloading your app to test the functionality

-- First, let's see current state of a few items
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at
FROM pantry_items 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name IN ('tomatoes', 'olive oil', 'garlic')
ORDER BY item_name;

-- Test 1: Add to an existing item (should show Updated section)
-- Go to your app and add 5 units to "tomatoes"
-- Then run this to see the result:
/*
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at
FROM pantry_items 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'tomatoes';
*/

-- Test 2: Add a completely new item (should NOT show Updated section)
-- Go to your app and add a new item like "test_new_item"
-- Then run this to see the result:
/*
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at
FROM pantry_items 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'test_new_item';
*/ 