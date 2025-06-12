# 🔍 Debugging Plan - Quantity Tracking Issue

## ✅ **What We Know Works**
- ✅ Database migration applied successfully
- ✅ Trigger working: `tomato UPDATE` set `quantity_added: 3`, `previous_quantity: 17`
- ✅ Frontend fetching correct columns: `quantity_added`, `previous_quantity`
- ✅ UI logic looks correct

## ❓ **What We Need to Investigate**

### 1. **Data State Check**
Run `debug_current_data.sql` to see:
- Current state of tomato/olive oil records
- Whether `quantity_added` and `previous_quantity` are populated
- If there are still case-sensitive duplicates

### 2. **Frontend Data Flow**
Check console logs when opening Edit Item screen:
- Added debug logging to ManualAddSheet
- Will show exactly what data is received from the database
- Look for `[ManualAddSheet] Debug - initialItemData:` in console

### 3. **Cache Issues**
Possible React Query cache problems:
- Old data being shown before refresh
- Need to invalidate cache after updates

## 🎯 **Expected vs Actual**

### Expected (based on your test):
```
tomato: quantity=20, quantity_added=3, previous_quantity=17
```

**Should display:**
- Updated: `+3 units (new addition)` 
- Added: `17 units (original)`

### Actual (what you reported):
- Updated: `+27 units` (showing total instead of addition)
- Added: `27 units` (showing total instead of original)

## 🔍 **Debugging Steps**

### Step 1: Check Database State
```sql
-- Run debug_current_data.sql
-- Look for tomato/olive oil records
-- Verify quantity_added and previous_quantity values
```

### Step 2: Check Frontend Logs
1. Open app and go to Pantry
2. Tap on tomato item to edit
3. Check console for: `[ManualAddSheet] Debug - initialItemData:`
4. Verify the data matches database

### Step 3: Identify the Issue
Compare database values with frontend logs:
- If database has correct values but frontend shows wrong data → **Cache issue**
- If database has wrong values → **Trigger issue** 
- If frontend receives correct data but displays wrong → **UI logic issue**

## 🚨 **Possible Root Causes**

### A. **Cache Not Refreshing**
- React Query showing stale data
- Need to force refresh after updates

### B. **Multiple Records**
- Case-sensitive duplicates still exist
- Frontend showing wrong record

### C. **Timing Issue**
- UI showing data before trigger updates it
- Need to wait for database update to complete

### D. **Data Type Issue**
- Numbers being treated as strings
- Conditional logic failing

## 📋 **Next Actions**
1. **Run `debug_current_data.sql`** - See actual database state
2. **Check console logs** - See what frontend receives  
3. **Compare results** - Identify where the disconnect is
4. **Apply targeted fix** based on findings

The issue is definitely solvable - we just need to see where the data flow breaks! 🔧 