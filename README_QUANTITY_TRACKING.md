# Quantity Tracking Enhancement

## Problem
The Edit Item screen was showing the total current quantity (27) instead of breaking down:
- **New addition**: +10 units (what was just added)
- **Original**: 17 units (what was there before)

## Solution
Added two new columns to the `stock` table to track quantity changes:

### New Database Columns
- `quantity_added`: Amount added in the most recent update (can be negative for reductions)
- `previous_quantity`: Quantity before the most recent update

### Database Migration
Run the SQL in `database_migration_add_quantity_tracking.sql` in your Supabase SQL editor.

### How It Works
1. **New Items**: `previous_quantity = 0`, `quantity_added = full quantity`
2. **Updated Items**: `previous_quantity = old quantity`, `quantity_added = difference`
3. **Database Trigger**: Automatically calculates these values on INSERT/UPDATE

### UI Enhancement
The Edit Item screen now shows:
- **Updated**: `+10 units (new addition)` with FRESH status
- **Added**: `17 units (original)` with actual aging status

### Example
If you had 17 olive oil and added 10 more:
- Total quantity: 27
- Previous quantity: 17  
- Quantity added: +10

Display:
```
Updated: Dec 12, 2024 at 2:15 PM
+10 units (new addition)        FRESH

Added: Dec 11, 2024 at 3:35 PM  
17 units (original)             USE SOON
```

## Files Modified
- `database_migration_add_quantity_tracking.sql` - Database migration
- `src/hooks/useStockManager.ts` - Updated StockItem interface and queries
- `src/hooks/usePantry.ts` - Updated PantryItem interface  
- `src/components/ManualAddSheet.tsx` - Updated UI logic and interface 