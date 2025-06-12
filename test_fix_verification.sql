-- Test script to verify the quantity tracking fix
-- Run this AFTER updating the frontend code

-- 1. Check current state of onion (which was just updated in logs)
SELECT 
  id,
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at,
  CASE 
    WHEN quantity_added IS NOT NULL AND previous_quantity IS NOT NULL THEN 'Has tracking data'
    ELSE 'Missing tracking data'
  END as tracking_status
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'onion';

-- 2. Test the exact query that usePantryData now uses
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
  previous_quantity
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'onion';

-- 3. Test the exact query that useStockManager uses
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
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name = 'onion';

-- 4. Show items that should display "Updated" section in ManualAddSheet
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  updated_at,
  created_at,
  CASE 
    WHEN updated_at IS NOT NULL 
         AND updated_at != created_at 
         AND quantity_added IS NOT NULL 
         AND previous_quantity IS NOT NULL 
         AND quantity_added != 0
    THEN 'Should show Updated section'
    ELSE 'Should NOT show Updated section'
  END as ui_display_logic
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name IN ('onion', 'olive oil', 'tomatoes', 'spam', 'rice')
ORDER BY item_name; 