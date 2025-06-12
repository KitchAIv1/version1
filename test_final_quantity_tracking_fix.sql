-- Final test script for quantity tracking fix
-- Run this to verify the fix works

-- 1. Check current state of Catsup (which was just merged in the logs)
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
  AND item_name = 'Catsup';

-- Expected result:
-- item_name: Catsup
-- quantity: 4
-- quantity_added: 3  
-- previous_quantity: 1
-- tracking_status: ✅ TRACKING: +3 (from 1 to 4)

-- 2. After the fix, when you edit "Catsup" in the app, you should see:
-- ✅ "Updated: +3 units (new addition)" section
-- ✅ "Added: 4 units" section
-- Instead of just the "Added" section 