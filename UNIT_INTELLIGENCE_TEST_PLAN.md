# 🧪 UNIT INTELLIGENCE TEST PLAN
## Testing Edge Cases: "olive oil 1 unit" vs "olive oil 400 ml"

> **Goal**: Verify that the Unit Intelligence Service correctly handles edge cases and prevents duplicate entries

---

## 🎯 **TEST SCENARIOS**

### **Test Case 1: Olive Oil Edge Case (Primary)**
```
SETUP:
- User has: "olive oil 400 ml" in pantry
- User manually adds: "olive oil 1 unit"

EXPECTED BEHAVIOR:
1. ✅ ManualAddSheet shows suggestion: "olive oil is typically measured in ml"
2. ✅ User can accept suggestion (changes to ml) or dismiss
3. ✅ If user keeps "units", smart merge dialog appears
4. ✅ Dialog offers: "Add Quantities", "Replace Entry", "Keep Separate", "Cancel"
5. ✅ If "Add Quantities" chosen: Results in "olive oil 401 ml"

VERIFICATION POINTS:
- No duplicate entries created
- Quantities properly merged
- Unit consistency maintained
- Debug logs show intelligence working
```

### **Test Case 2: Flour Weight Intelligence**
```
SETUP:
- User has: "flour 500 g" in pantry
- User manually adds: "flour 2 units"

EXPECTED BEHAVIOR:
1. ✅ Suggestion: "flour is typically measured in g"
2. ✅ Smart merge offers compatible unit merging
3. ✅ Result: "flour 502 g" (assuming 1 unit = 1g)
```

### **Test Case 3: Eggs Count Intelligence**
```
SETUP:
- User has: "eggs 6 units" in pantry
- User manually adds: "eggs 2 pieces"

EXPECTED BEHAVIOR:
1. ✅ Units are compatible (both COUNT category)
2. ✅ Smart merge dialog appears
3. ✅ Result: "eggs 8 units" (or "eggs 8 pieces")
```

### **Test Case 4: Incompatible Units**
```
SETUP:
- User has: "milk 500 ml" in pantry
- User manually adds: "milk 2 bottles"

EXPECTED BEHAVIOR:
1. ✅ Units are incompatible (ml vs bottles)
2. ✅ No smart merge offered
3. ✅ Standard UPSERT behavior (replaces entry)
4. ✅ Result: "milk 2 bottles"
```

### **Test Case 5: New Item (No Conflict)**
```
SETUP:
- User has: empty pantry
- User manually adds: "tomatoes 3 units"

EXPECTED BEHAVIOR:
1. ✅ No suggestion needed (tomatoes are countable)
2. ✅ No conflicts to resolve
3. ✅ Result: "tomatoes 3 units"
```

### **Test Case 6: Fuzzy Matching**
```
SETUP:
- User has: "olive oil 250 ml" in pantry
- User manually adds: "extra virgin olive oil 1 unit"

EXPECTED BEHAVIOR:
1. ✅ Fuzzy matching recognizes "olive oil" in the name
2. ✅ Suggestion: "extra virgin olive oil is typically measured in ml"
3. ✅ Smart merge available if units compatible
```

---

## 🔧 **TESTING PROCEDURE**

### **Phase 1: Unit Intelligence Service Testing**

#### **1. Test Ingredient Recognition**
```typescript
// Test in browser console or create test file
import UnitIntelligenceService from './src/services/unitIntelligence';

// Test direct matches
console.log(UnitIntelligenceService.getIngredientIntelligence('olive oil'));
// Expected: { category: 'liquid', defaultUnit: 'ml', confidence: 0.9 }

// Test fuzzy matching
console.log(UnitIntelligenceService.getIngredientIntelligence('extra virgin olive oil'));
// Expected: { category: 'liquid', defaultUnit: 'ml', confidence: 0.72 }

// Test unknown ingredient
console.log(UnitIntelligenceService.getIngredientIntelligence('unknown ingredient'));
// Expected: { category: 'count', defaultUnit: 'units', confidence: 0.3 }
```

#### **2. Test Unit Suggestions**
```typescript
// Test unit normalization suggestions
console.log(UnitIntelligenceService.shouldNormalizeUnit('olive oil', 'units'));
// Expected: { shouldNormalize: true, suggestedUnit: 'ml', reason: '...', confidence: 0.9 }

console.log(UnitIntelligenceService.shouldNormalizeUnit('eggs', 'units'));
// Expected: { shouldNormalize: false, suggestedUnit: 'units', reason: '', confidence: 1.0 }
```

#### **3. Test Unit Compatibility**
```typescript
// Test compatible units
console.log(UnitIntelligenceService.areUnitsCompatible('ml', 'l', 'olive oil'));
// Expected: true (both liquid)

console.log(UnitIntelligenceService.areUnitsCompatible('units', 'pieces', 'eggs'));
// Expected: true (both count)

// Test incompatible units
console.log(UnitIntelligenceService.areUnitsCompatible('ml', 'units', 'olive oil'));
// Expected: false (liquid vs count)
```

### **Phase 2: Manual Add Sheet Testing**

#### **1. Test Unit Suggestions UI**
1. Open manual add sheet
2. Type "olive oil"
3. Select "units" as unit
4. **Verify**: Blue suggestion box appears
5. **Verify**: Shows "olive oil is typically measured in ml"
6. **Verify**: "Use ml" and "Keep units" buttons work

#### **2. Test Suggestion Dismissal**
1. Follow steps above
2. Click "Keep units"
3. **Verify**: Suggestion disappears
4. Change unit to something else and back to "units"
5. **Verify**: Suggestion doesn't reappear (dismissed)

#### **3. Test Debug Logging**
1. Open browser console
2. Add item with suggestion
3. **Verify**: Debug logs show:
   - `[ManualAddSheet] 💡 UNIT INTELLIGENCE SUGGESTION`
   - `[ManualAddSheet] ✅ APPLIED UNIT SUGGESTION` (if applied)
   - `[ManualAddSheet] ❌ DISMISSED UNIT SUGGESTION` (if dismissed)

### **Phase 3: Smart Merge Testing**

#### **1. Setup Test Data**
```sql
-- Add test item to database
INSERT INTO stock (user_id, item_name, quantity, unit, storage_location)
VALUES ('your-user-id', 'olive oil', 400, 'ml', 'cupboard');
```

#### **2. Test Smart Merge Dialog**
1. Try to add "olive oil 1 unit" manually
2. **Verify**: Smart merge dialog appears
3. **Verify**: Shows existing quantity (400 ml)
4. **Verify**: Offers 4 options: Add, Replace, Keep Separate, Cancel

#### **3. Test Add Quantities**
1. Choose "Add Quantities"
2. **Verify**: Results in "olive oil 401 ml"
3. **Verify**: No duplicate entries
4. **Verify**: Debug log shows merge completion

#### **4. Test Replace Entry**
1. Reset to "olive oil 400 ml"
2. Add "olive oil 50 units" and choose "Replace Entry"
3. **Verify**: Results in "olive oil 50 units"
4. **Verify**: Original entry replaced

#### **5. Test Keep Separate**
1. Reset to "olive oil 400 ml"
2. Add "olive oil 1 unit" and choose "Keep Separate"
3. **Verify**: Two entries exist:
   - "olive oil 400 ml"
   - "olive oil (units) 1 units"

### **Phase 4: Integration Testing**

#### **1. Test with AI Scanning**
1. Scan items that include olive oil
2. **Verify**: AI correctly identifies "olive oil 250 ml"
3. Manually add "olive oil 1 unit"
4. **Verify**: Smart merge works with scanned items

#### **2. Test Cross-Screen Consistency**
1. Add items via manual add
2. Navigate to different screens
3. **Verify**: Items appear correctly everywhere
4. **Verify**: No duplicate entries in any view

---

## 📊 **SUCCESS CRITERIA**

### **✅ Unit Intelligence Service**
- [x] Correctly identifies ingredient categories
- [x] Provides appropriate unit suggestions
- [x] Handles fuzzy matching for variations
- [x] Determines unit compatibility accurately

### **✅ Manual Add Enhancement**
- [x] Shows intelligent unit suggestions
- [x] Allows users to accept or dismiss suggestions
- [x] Remembers dismissed suggestions per session
- [x] Provides comprehensive debug logging

### **✅ Smart Merge Functionality**
- [x] Detects compatible unit conflicts
- [x] Offers intelligent merge options
- [x] Properly merges quantities
- [x] Maintains data consistency
- [x] Handles edge cases gracefully

### **✅ User Experience**
- [x] Intuitive suggestion interface
- [x] Clear merge dialog options
- [x] No unexpected duplicate entries
- [x] Consistent behavior across features

---

## 🐛 **POTENTIAL ISSUES TO WATCH**

### **1. Performance**
- Unit intelligence checks on every keystroke
- Database queries for duplicate detection
- **Mitigation**: Debouncing, caching, optimized queries

### **2. User Confusion**
- Too many suggestions might overwhelm users
- Complex merge dialogs might confuse users
- **Mitigation**: Clear messaging, confidence thresholds

### **3. Edge Cases**
- Very long ingredient names
- Special characters in names
- Network failures during merge
- **Mitigation**: Robust error handling, fallbacks

### **4. Data Consistency**
- Race conditions in merge operations
- Concurrent user actions
- **Mitigation**: Proper transaction handling, optimistic updates

---

## 🚀 **DEPLOYMENT CHECKLIST**

### **Pre-Deployment**
- [ ] All test cases pass
- [ ] Debug logging works correctly
- [ ] No TypeScript errors
- [ ] Performance acceptable
- [ ] User testing completed

### **Post-Deployment Monitoring**
- [ ] Monitor error rates
- [ ] Check suggestion acceptance rates
- [ ] Verify merge success rates
- [ ] Watch for duplicate entry reports
- [ ] Collect user feedback

---

## 📈 **METRICS TO TRACK**

### **Intelligence Metrics**
- Suggestion acceptance rate
- Suggestion dismissal rate
- Fuzzy match accuracy
- Unit compatibility accuracy

### **User Experience Metrics**
- Duplicate entry reduction
- Manual add completion rate
- User satisfaction scores
- Support ticket reduction

### **Technical Metrics**
- Response time for suggestions
- Database query performance
- Error rates in merge operations
- Cache hit rates

---

This comprehensive test plan ensures the Unit Intelligence Service solves the olive oil edge case while maintaining excellent user experience and system reliability. 