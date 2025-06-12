# PANTRY UNIQUE CONSTRAINT AUDIT & FIX STRATEGY
## Database Cleanup Impact Analysis

> **Issue**: Pantry manual add failing with error `23505: duplicate key value violates unique constraint "stock_user_item_unique"`

---

## 🔍 **ERROR ANALYSIS**

### **Error Details**
```
ERROR [PantryScreen] Error saving item: {
  "code": "23505", 
  "details": null, 
  "hint": null, 
  "message": "duplicate key value violates unique constraint \"stock_user_item_unique\""
}
```

### **Error Code 23505**: PostgreSQL unique constraint violation
- **Constraint Name**: `stock_user_item_unique`
- **Meaning**: Attempting to insert a duplicate `(user_id, item_name)` combination
- **Root Cause**: Frontend trying to INSERT instead of UPSERT for existing items

---

## 📊 **PANTRY SYSTEM ARCHITECTURE AUDIT**

### **Frontend Components Affected**
1. **`PantryScreen.tsx`**: Main pantry interface with manual add
2. **`ManualAddSheet`**: Modal for adding/editing items
3. **`useStockManager.ts`**: Core stock management hook
4. **`usePantry.ts`**: Legacy pantry operations
5. **`PantryScanningScreen.tsx`**: Camera-based item addition

### **Database Table Structure**
```sql
-- Expected stock table structure
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  description TEXT,
  storage_location TEXT DEFAULT 'cupboard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- The problematic constraint
  CONSTRAINT stock_user_item_unique UNIQUE (user_id, item_name)
);
```

### **Unique Constraint Purpose**
- **Prevents duplicate items** per user
- **Enforces one entry** per `(user_id, item_name)` combination
- **Requires UPSERT logic** instead of simple INSERT

---

## 🚨 **ROOT CAUSE ANALYSIS**

### **Problem 1: INSERT vs UPSERT Logic**

#### **❌ Current Broken Code (PantryScreen.tsx:418-430)**
```typescript
// This tries to INSERT, causing constraint violation
if (editingItem) {
  result = await supabase
    .from('stock')
    .update(payload)
    .eq('id', editingItem.id);
} else {
  result = await supabase.from('stock').insert(payload); // ❌ FAILS on duplicates
}
```

#### **✅ Correct UPSERT Code (useStockManager.ts:119)**
```typescript
// This properly handles duplicates
const { error } = await supabase
  .from('stock')
  .upsert(itemData, { onConflict: 'user_id, item_name' }); // ✅ WORKS
```

### **Problem 2: Inconsistent Item Name Handling**

#### **❌ Case Sensitivity Issues**
```typescript
// Some code lowercases, some doesn't
item_name: itemData.item_name.toLowerCase(),     // ✅ Consistent
item_name: itemData.item_name,                   // ❌ Inconsistent
```

### **Problem 3: Missing Constraint Awareness**
- **Frontend assumes** items can always be inserted
- **No duplicate checking** before operations
- **No graceful handling** of constraint violations

---

## 🔧 **COMPREHENSIVE FIX STRATEGY**

### **Strategy 1: Fix PantryScreen Manual Add (Immediate)**

#### **Step 1: Update PantryScreen.tsx**
```typescript
// Replace the broken handleSaveItemFromSheet function
const handleSaveItemFromSheet = useCallback(
  async (itemData: any) => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const payload = {
        user_id: currentUser.id,
        item_name: itemData.item_name.toLowerCase(), // ✅ Consistent casing
        quantity: itemData.quantity,
        unit: itemData.unit,
        description: itemData.description,
        storage_location: itemData.storage_location,
      };

      let result;
      if (editingItem) {
        // Update existing item by ID
        result = await supabase
          .from('stock')
          .update(payload)
          .eq('id', editingItem.id);
      } else {
        // ✅ Use UPSERT instead of INSERT
        result = await supabase
          .from('stock')
          .upsert(payload, { onConflict: 'user_id, item_name' });
      }

      if (result.error) throw result.error;

      await refetch();
      handleCloseSheet();

      Alert.alert(
        'Success',
        editingItem ? 'Item updated successfully' : 'Item added successfully',
      );
    } catch (error: any) {
      console.error('[PantryScreen] Error saving item:', error);
      Alert.alert('Error', error.message || 'Failed to save item');
    }
  },
  [editingItem, refetch, handleCloseSheet],
);
```

### **Strategy 2: Standardize All Stock Operations**

#### **Step 2: Create Unified Stock Service**
```typescript
// src/services/stockService.ts
export class StockService {
  static async upsertItem(userId: string, itemData: StockItemInput): Promise<void> {
    const payload = {
      user_id: userId,
      item_name: itemData.item_name.trim().toLowerCase(), // ✅ Always normalize
      quantity: Number(itemData.quantity),
      unit: itemData.unit || 'units',
      description: itemData.description?.trim() || null,
      storage_location: itemData.storage_location || 'cupboard',
    };

    const { error } = await supabase
      .from('stock')
      .upsert(payload, { onConflict: 'user_id, item_name' });

    if (error) throw error;
  }

  static async updateItem(itemId: string, userId: string, itemData: StockItemInput): Promise<void> {
    const payload = {
      item_name: itemData.item_name.trim().toLowerCase(),
      quantity: Number(itemData.quantity),
      unit: itemData.unit || 'units',
      description: itemData.description?.trim() || null,
      storage_location: itemData.storage_location || 'cupboard',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('stock')
      .update(payload)
      .eq('id', itemId)
      .eq('user_id', userId); // ✅ Security check

    if (error) throw error;
  }

  static async deleteItem(itemId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('stock')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId); // ✅ Security check

    if (error) throw error;
  }
}
```

### **Strategy 3: Add Duplicate Detection UI**

#### **Step 3: Enhanced Manual Add with Duplicate Handling**
```typescript
// Enhanced ManualAddSheet with duplicate detection
const checkForDuplicate = async (itemName: string, userId: string): Promise<StockItem | null> => {
  const { data, error } = await supabase
    .from('stock')
    .select('*')
    .eq('user_id', userId)
    .eq('item_name', itemName.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data || null;
};

const handleSubmitWithDuplicateCheck = async (itemData: StockItemInput) => {
  const existingItem = await checkForDuplicate(itemData.item_name, userId);
  
  if (existingItem && !isEditMode) {
    // Show duplicate dialog
    Alert.alert(
      'Item Already Exists',
      `"${itemData.item_name}" is already in your pantry (${existingItem.quantity} ${existingItem.unit}). What would you like to do?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Quantity',
          onPress: () => {
            const newQuantity = existingItem.quantity + itemData.quantity;
            StockService.upsertItem(userId, { ...itemData, quantity: newQuantity });
          },
        },
        {
          text: 'Replace',
          onPress: () => {
            StockService.upsertItem(userId, itemData);
          },
        },
      ],
    );
  } else {
    // No duplicate or in edit mode
    if (isEditMode) {
      await StockService.updateItem(existingItem.id, userId, itemData);
    } else {
      await StockService.upsertItem(userId, itemData);
    }
  }
};
```

---

## 🎯 **IMMEDIATE FIXES NEEDED**

### **Priority 1: Fix PantryScreen (5 minutes)**
Replace `INSERT` with `UPSERT` in `handleSaveItemFromSheet`

### **Priority 2: Standardize Item Names (10 minutes)**
Ensure all item names are `.toLowerCase()` before database operations

### **Priority 3: Update All Stock Hooks (15 minutes)**
Apply UPSERT pattern to:
- `useStockManager.ts`
- `usePantry.ts` 
- `PantryScanningScreen.tsx`

### **Priority 4: Add Error Handling (10 minutes)**
Graceful handling of constraint violations with user-friendly messages

---

## 🧪 **VERIFICATION STEPS**

### **Test Case 1: Manual Add Existing Item**
1. Add item "tomato" manually
2. Try to add "tomato" again
3. **Expected**: Should update quantity or show duplicate dialog
4. **Current**: Fails with constraint error

### **Test Case 2: Case Sensitivity**
1. Add item "Tomato" (capital T)
2. Try to add "tomato" (lowercase t)
3. **Expected**: Should be treated as same item
4. **Current**: May create duplicates

### **Test Case 3: Scanning Duplicates**
1. Scan items including existing pantry items
2. **Expected**: Should show duplicate handling options
3. **Current**: May fail with constraint error

---

## 🔄 **ALTERNATIVE APPROACHES**

### **Option A: Remove Unique Constraint (Not Recommended)**
```sql
-- DON'T DO THIS - Allows actual duplicates
ALTER TABLE stock DROP CONSTRAINT stock_user_item_unique;
```

### **Option B: Change Constraint to Include ID**
```sql
-- Better: Allow same name with different IDs for quantity tracking
ALTER TABLE stock DROP CONSTRAINT stock_user_item_unique;
ALTER TABLE stock ADD CONSTRAINT stock_user_item_id_unique UNIQUE (user_id, item_name, id);
```

### **Option C: Frontend-Only Duplicate Prevention**
- Check for duplicates before database operations
- Handle merging in application logic
- Keep database constraint for data integrity

---

## 📋 **BACKEND VERIFICATION CHECKLIST**

### **✅ Database Structure to Verify**
- [ ] `stock` table exists with correct schema
- [ ] `stock_user_item_unique` constraint exists on `(user_id, item_name)`
- [ ] All required columns present (`storage_location`, timestamps)
- [ ] Proper indexes for performance

### **✅ Constraint Details to Check**
```sql
-- Check constraint details
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'stock' 
  AND tc.constraint_type = 'UNIQUE';
```

### **✅ Sample Data to Test**
```sql
-- Test UPSERT behavior
INSERT INTO stock (user_id, item_name, quantity, unit) 
VALUES ('test-user', 'test-item', 1, 'units')
ON CONFLICT (user_id, item_name) 
DO UPDATE SET quantity = EXCLUDED.quantity + stock.quantity;
```

---

## 🎯 **SUCCESS METRICS**

### **✅ Pantry Fixed When:**
1. **Manual add works** for new items
2. **Manual add works** for existing items (updates quantity)
3. **No constraint violation errors** in logs
4. **Consistent item naming** (all lowercase)
5. **Duplicate handling** works gracefully

### **📊 Expected Behavior After Fix:**
- Adding existing item updates quantity or shows options
- Case-insensitive item matching works
- Scanning handles duplicates gracefully
- No database constraint errors
- Smooth user experience

---

## 📞 **IMMEDIATE ACTION PLAN**

1. **Frontend Team**: Apply Priority 1 fix to PantryScreen immediately
2. **Test**: Try adding duplicate items manually
3. **Frontend Team**: Apply remaining priority fixes
4. **Backend Team**: Verify constraint structure is correct
5. **Test**: Full pantry workflow including scanning

**Timeline**: 30-45 minutes total
**Risk**: Low (isolated to pantry add functionality)
**Priority**: High (core pantry feature broken) 