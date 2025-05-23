-- Migration: Add timestamp columns to stock table
-- Run this in your Supabase SQL editor

-- Add created_at column (with default value for existing records)
ALTER TABLE stock 
ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at column (with default value for existing records)
ALTER TABLE stock 
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a trigger to automatically update updated_at when records are modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to the stock table
CREATE TRIGGER update_stock_updated_at 
    BEFORE UPDATE ON stock 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing records to have proper timestamps
-- (This sets created_at to current time for existing records)
UPDATE stock 
SET created_at = NOW(), updated_at = NOW() 
WHERE created_at IS NULL OR updated_at IS NULL; 