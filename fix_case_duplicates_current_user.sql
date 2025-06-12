-- Fix Case-Sensitive Duplicates for Current User
-- Run this in Supabase SQL Editor AFTER applying the quantity tracking migration

SET search_path TO public;

-- Current user ID from logs
DO $$
DECLARE
    target_user_id UUID := '9b84ff89-f9e5-4ddb-9de8-9797d272da59';
BEGIN
    RAISE NOTICE 'Fixing duplicates for user: %', target_user_id;
    
    -- 1. Fix Olive Oil / olive oil
    RAISE NOTICE 'Fixing Olive Oil duplicates...';
    
    -- Merge quantities and keep the newer record (olive oil)
    UPDATE stock 
    SET quantity = (
        SELECT SUM(quantity) 
        FROM stock 
        WHERE user_id = target_user_id 
          AND LOWER(item_name) = 'olive oil'
    ),
    created_at = (
        SELECT MIN(created_at) 
        FROM stock 
        WHERE user_id = target_user_id 
          AND LOWER(item_name) = 'olive oil'
    )
    WHERE user_id = target_user_id 
      AND item_name = 'olive oil';
    
    -- Delete the capitalized version
    DELETE FROM stock 
    WHERE user_id = target_user_id 
      AND item_name = 'Olive Oil';
    
    -- 2. Fix Garlic / garlic
    RAISE NOTICE 'Fixing Garlic duplicates...';
    
    UPDATE stock 
    SET quantity = (
        SELECT SUM(quantity) 
        FROM stock 
        WHERE user_id = target_user_id 
          AND LOWER(item_name) = 'garlic'
    ),
    created_at = (
        SELECT MIN(created_at) 
        FROM stock 
        WHERE user_id = target_user_id 
          AND LOWER(item_name) = 'garlic'
    )
    WHERE user_id = target_user_id 
      AND item_name = 'garlic';
    
    DELETE FROM stock 
    WHERE user_id = target_user_id 
      AND item_name = 'Garlic';
    
    -- 3. Fix Flour / flour
    RAISE NOTICE 'Fixing Flour duplicates...';
    
    UPDATE stock 
    SET quantity = (
        SELECT SUM(quantity) 
        FROM stock 
        WHERE user_id = target_user_id 
          AND LOWER(item_name) = 'flour'
    ),
    created_at = (
        SELECT MIN(created_at) 
        FROM stock 
        WHERE user_id = target_user_id 
          AND LOWER(item_name) = 'flour'
    )
    WHERE user_id = target_user_id 
      AND item_name = 'flour';
    
    DELETE FROM stock 
    WHERE user_id = target_user_id 
      AND item_name = 'Flour';
    
    -- 4. Normalize Tomatoes to tomatoes
    RAISE NOTICE 'Normalizing Tomatoes...';
    
    UPDATE stock 
    SET item_name = 'tomatoes'
    WHERE user_id = target_user_id 
      AND item_name = 'Tomatoes';
    
    -- 5. Fix any other capitalized items
    RAISE NOTICE 'Normalizing other capitalized items...';
    
    UPDATE stock 
    SET item_name = LOWER(item_name)
    WHERE user_id = target_user_id 
      AND item_name != LOWER(item_name);
    
END $$;

-- Verify the cleanup
SELECT 
  LOWER(item_name) as normalized_name,
  COUNT(*) as count,
  STRING_AGG(item_name, ', ') as variations,
  STRING_AGG(id::text, ', ') as ids
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
GROUP BY LOWER(item_name)
HAVING COUNT(*) > 1;

-- Show sample of normalized items
SELECT 
  item_name,
  quantity,
  quantity_added,
  previous_quantity,
  created_at,
  updated_at
FROM stock 
WHERE user_id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
  AND item_name IN ('olive oil', 'garlic', 'flour', 'tomatoes')
ORDER BY item_name; 