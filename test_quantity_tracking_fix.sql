-- Test script to verify quantity tracking fix works
-- Run this AFTER the frontend fix is deployed

-- 1. Check current state of Cheese (which was just merged)
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
    THEN CONCAT('✅ TRACKING: +', quantity_added, ' (from ', previous_quantity, ' to ', quantity, ')')
    ELSE '❌ NO TRACKING DATA'
  END as tracking_status
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'Cheese';

-- 2. Test the exact query that ManualAddSheet should now receive
-- This simulates what the frontend will fetch after the fix
SELECT 
  id, 
  item_name, 
  quantity, 
  unit, 
  description, 
  created_at, 
  updated_at, 
  user_id, 
  storage_location, 
  quantity_added, 
  previous_quantity,
  CASE 
    WHEN updated_at IS NOT NULL 
         AND updated_at != created_at 
         AND quantity_added IS NOT NULL 
         AND previous_quantity IS NOT NULL 
         AND quantity_added != 0
    THEN '✅ SHOULD SHOW UPDATED SECTION'
    ELSE '❌ SHOULD NOT SHOW UPDATED SECTION'
  END as ui_display_logic
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'Cheese';

-- 3. Expected result after fix:
-- The frontend should now show:
-- - "Updated: +30 units (new addition)" 
-- - "Added: 32 units on [date]"
-- Instead of just:
-- - "Added: 32 units on [date]" 