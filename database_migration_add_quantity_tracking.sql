-- Migration: Add quantity tracking to stock table
-- Run this in your Supabase SQL editor

-- Add quantity_added column to track newly added amounts
ALTER TABLE stock 
ADD COLUMN quantity_added NUMERIC DEFAULT 0;

-- Add previous_quantity column to track quantity before last update
ALTER TABLE stock 
ADD COLUMN previous_quantity NUMERIC DEFAULT 0;

-- Update existing records to set sensible defaults
-- For existing items, assume current quantity was the original amount
UPDATE stock 
SET previous_quantity = quantity, quantity_added = 0
WHERE quantity_added IS NULL OR previous_quantity IS NULL;

-- Create or replace the trigger function to track quantity changes
CREATE OR REPLACE FUNCTION track_quantity_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is an UPDATE and quantity changed
    IF TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity THEN
        -- Store the previous quantity
        NEW.previous_quantity = OLD.quantity;
        -- Calculate how much was added (can be negative for reductions)
        NEW.quantity_added = NEW.quantity - OLD.quantity;
        -- Update the updated_at timestamp
        NEW.updated_at = NOW();
    END IF;
    
    -- If this is an INSERT (new item)
    IF TG_OP = 'INSERT' THEN
        -- For new items, previous_quantity is 0 and quantity_added is the full amount
        NEW.previous_quantity = 0;
        NEW.quantity_added = NEW.quantity;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to the stock table
DROP TRIGGER IF EXISTS track_stock_quantity_changes ON stock;
CREATE TRIGGER track_stock_quantity_changes
    BEFORE INSERT OR UPDATE ON stock 
    FOR EACH ROW 
    EXECUTE FUNCTION track_quantity_changes();

-- Add helpful comments
COMMENT ON COLUMN stock.quantity_added IS 'Amount added in the most recent update (can be negative for reductions)';
COMMENT ON COLUMN stock.previous_quantity IS 'Quantity before the most recent update'; 