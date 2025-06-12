# INTELLIGENT UNIT NORMALIZATION STRATEGY
## Handling Edge Cases: "olive oil 1 unit" vs "olive oil 400 ml"

> **Goal**: Intelligently merge items with compatible units instead of creating duplicates

---

## 🔍 **PROBLEM ANALYSIS**

### **Current Behavior**
```
Existing: olive oil 400 ml
User adds: olive oil 1 unit
Result: TWO separate entries ❌
```

### **Expected Behavior**
```
Existing: olive oil 400 ml  
User adds: olive oil 1 unit
Result: olive oil 401 ml ✅ (assuming 1 unit = 1 ml for liquids)
```

---

## 🧠 **SOLUTION ARCHITECTURE**

### **Phase 1: Unit Intelligence Service**

#### **1. Create Unit Categories**
```typescript
// src/services/unitIntelligence.ts
export enum UnitCategory {
  LIQUID = 'liquid',
  WEIGHT = 'weight', 
  COUNT = 'count',
  VOLUME_DRY = 'volume_dry'
}

export const UNIT_CATEGORIES = {
  [UnitCategory.LIQUID]: ['ml', 'l', 'liter', 'litre', 'cup', 'tbsp', 'tsp', 'fl oz'],
  [UnitCategory.WEIGHT]: ['g', 'kg', 'gram', 'kilogram', 'lb', 'oz', 'pound'],
  [UnitCategory.COUNT]: ['units', 'pieces', 'items', 'pcs'],
  [UnitCategory.VOLUME_DRY]: ['cup', 'tbsp', 'tsp']
};
```

#### **2. Ingredient Intelligence Database**
```typescript
export const INGREDIENT_INTELLIGENCE = {
  // Liquids - default to ml
  'olive oil': { category: UnitCategory.LIQUID, defaultUnit: 'ml', unitAssumed: 'ml' },
  'milk': { category: UnitCategory.LIQUID, defaultUnit: 'ml', unitAssumed: 'ml' },
  'water': { category: UnitCategory.LIQUID, defaultUnit: 'ml', unitAssumed: 'ml' },
  'vinegar': { category: UnitCategory.LIQUID, defaultUnit: 'ml', unitAssumed: 'ml' },
  
  // Solids - default to grams
  'flour': { category: UnitCategory.WEIGHT, defaultUnit: 'g', unitAssumed: 'g' },
  'sugar': { category: UnitCategory.WEIGHT, defaultUnit: 'g', unitAssumed: 'g' },
  'salt': { category: UnitCategory.WEIGHT, defaultUnit: 'g', unitAssumed: 'g' },
  
  // Countable items
  'eggs': { category: UnitCategory.COUNT, defaultUnit: 'units', unitAssumed: 'units' },
  'apples': { category: UnitCategory.COUNT, defaultUnit: 'units', unitAssumed: 'units' },
  'onions': { category: UnitCategory.COUNT, defaultUnit: 'units', unitAssumed: 'units' }
};
```

#### **3. Smart Unit Conversion**
```typescript
export class UnitIntelligenceService {
  
  static getIngredientIntelligence(itemName: string) {
    const normalized = itemName.toLowerCase().trim();
    
    // Direct match
    if (INGREDIENT_INTELLIGENCE[normalized]) {
      return INGREDIENT_INTELLIGENCE[normalized];
    }
    
    // Fuzzy matching for variations
    for (const [key, value] of Object.entries(INGREDIENT_INTELLIGENCE)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    
    // Default fallback
    return { category: UnitCategory.COUNT, defaultUnit: 'units', unitAssumed: 'units' };
  }
  
  static shouldNormalizeUnit(itemName: string, currentUnit: string): {
    shouldNormalize: boolean;
    suggestedUnit: string;
    reason: string;
  } {
    const intelligence = this.getIngredientIntelligence(itemName);
    
    // If user used "units" but ingredient has a specific category
    if (currentUnit === 'units' && intelligence.defaultUnit !== 'units') {
      return {
        shouldNormalize: true,
        suggestedUnit: intelligence.defaultUnit,
        reason: `"${itemName}" is typically measured in ${intelligence.defaultUnit}`
      };
    }
    
    return { shouldNormalize: false, suggestedUnit: currentUnit, reason: '' };
  }
  
  static areUnitsCompatible(unit1: string, unit2: string, itemName: string): boolean {
    const intelligence = this.getIngredientIntelligence(itemName);
    const category = intelligence.category;
    
    const unit1Category = this.getUnitCategory(unit1);
    const unit2Category = this.getUnitCategory(unit2);
    
    // Same category = compatible
    return unit1Category === unit2Category;
  }
  
  static getUnitCategory(unit: string): UnitCategory {
    for (const [category, units] of Object.entries(UNIT_CATEGORIES)) {
      if (units.includes(unit.toLowerCase())) {
        return category as UnitCategory;
      }
    }
    return UnitCategory.COUNT; // Default
  }
}
```

### **Phase 2: Enhanced Manual Add with Intelligence**

#### **1. Smart Unit Suggestion in ManualAddSheet**
```typescript
// In ManualAddSheet.tsx - add unit intelligence
const [unitSuggestion, setUnitSuggestion] = useState<{
  suggested: string;
  reason: string;
} | null>(null);

// When item name changes, check for unit suggestions
useEffect(() => {
  if (itemName.trim()) {
    const suggestion = UnitIntelligenceService.shouldNormalizeUnit(itemName, unit);
    if (suggestion.shouldNormalize) {
      setUnitSuggestion({
        suggested: suggestion.suggestedUnit,
        reason: suggestion.reason
      });
    } else {
      setUnitSuggestion(null);
    }
  }
}, [itemName, unit]);

// Show suggestion UI
{unitSuggestion && (
  <View style={styles.suggestionContainer}>
    <Text style={styles.suggestionText}>
      💡 Suggestion: Use "{unitSuggestion.suggested}" instead of "{unit}"
    </Text>
    <Text style={styles.suggestionReason}>{unitSuggestion.reason}</Text>
    <TouchableOpacity 
      onPress={() => {
        setUnit(unitSuggestion.suggested);
        setUnitSuggestion(null);
      }}
      style={styles.applySuggestionButton}
    >
      <Text>Apply Suggestion</Text>
    </TouchableOpacity>
  </View>
)}
```

#### **2. Enhanced Duplicate Detection**
```typescript
// Enhanced duplicate checking in ManualAddSheet
const checkForIntelligentDuplicates = async (itemName: string, unit: string, userId: string) => {
  const { data: existingItems } = await supabase
    .from('stock')
    .select('*')
    .eq('user_id', userId)
    .eq('item_name', itemName.toLowerCase());

  if (!existingItems?.length) return null;

  // Check for compatible units
  for (const existing of existingItems) {
    const areCompatible = UnitIntelligenceService.areUnitsCompatible(
      unit, 
      existing.unit, 
      itemName
    );
    
    if (areCompatible) {
      return {
        existing,
        compatible: true,
        suggestedAction: 'merge'
      };
    }
  }

  return {
    existing: existingItems[0],
    compatible: false,
    suggestedAction: 'separate'
  };
};
```

#### **3. Smart Merge Dialog**
```typescript
const showIntelligentMergeDialog = (itemData: any, duplicateInfo: any) => {
  const { existing, compatible } = duplicateInfo;
  
  if (compatible) {
    Alert.alert(
      'Smart Merge Detected',
      `Found "${existing.item_name}" (${existing.quantity} ${existing.unit}). 
      
Since both are ${UnitIntelligenceService.getIngredientIntelligence(itemData.item_name).category} measurements, would you like to:`,
      [
        {
          text: 'Convert & Merge',
          onPress: () => {
            // Convert user input to existing unit and merge
            const convertedQuantity = convertUnits(itemData.quantity, itemData.unit, existing.unit);
            const newQuantity = existing.quantity + convertedQuantity;
            
            updateExistingItem(existing.id, { quantity: newQuantity });
          }
        },
        {
          text: 'Keep Separate',
          onPress: () => {
            // Add as separate item
            addNewItem(itemData);
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  } else {
    // Show regular duplicate dialog
    showRegularDuplicateDialog(itemData, existing);
  }
};
```

### **Phase 3: AI Integration Enhancement**

#### **1. Learn from AI Scanning**
```typescript
// Extract intelligence from AI scanning results
export const learnFromAIScanning = (scannedItems: ProcessedItem[]) => {
  const learnings: Record<string, { unit: string, confidence: number }> = {};
  
  scannedItems.forEach(item => {
    const itemName = item.currentName.toLowerCase();
    const unit = item.currentUnit;
    
    // AI is usually smart about units, so learn from it
    if (!INGREDIENT_INTELLIGENCE[itemName]) {
      learnings[itemName] = { unit, confidence: 0.8 };
    }
  });
  
  // Store learnings for future manual adds
  return learnings;
};
```

---

## 🎯 **IMPLEMENTATION PHASES**

### **Phase 1: Core Intelligence (Week 1)**
- ✅ Create `UnitIntelligenceService`
- ✅ Build ingredient intelligence database
- ✅ Add unit compatibility checking

### **Phase 2: Manual Add Enhancement (Week 2)**  
- ✅ Integrate intelligence into `ManualAddSheet`
- ✅ Add smart unit suggestions
- ✅ Enhanced duplicate detection with unit awareness

### **Phase 3: AI Learning (Week 3)**
- ✅ Extract patterns from AI scanning
- ✅ Auto-update ingredient intelligence
- ✅ Improve suggestions over time

---

## 🧪 **TEST CASES**

### **Test Case 1: Liquid Intelligence**
```
Existing: olive oil 400 ml
Add: olive oil 1 unit
Expected: Suggest "ml", offer to merge as 401 ml
```

### **Test Case 2: Weight Intelligence**  
```
Existing: flour 500 g
Add: flour 2 units  
Expected: Suggest "g", offer to merge (assuming 1 unit = 100g)
```

### **Test Case 3: Count Intelligence**
```
Existing: eggs 6 units
Add: eggs 2 pieces
Expected: Recognize compatibility, merge as 8 units
```

### **Test Case 4: Incompatible Units**
```
Existing: milk 500 ml
Add: milk 2 bottles
Expected: Keep separate (can't convert bottles to ml without knowing bottle size)
```

---

## 🎨 **USER EXPERIENCE FLOW**

### **Smart Suggestion Flow**
1. User types "olive oil"
2. App suggests "ml" instead of "units"
3. User accepts suggestion
4. App checks for existing olive oil
5. Finds compatible unit, offers merge
6. User confirms merge
7. Single consolidated entry

### **Learning Flow**
1. User scans items with AI
2. AI correctly identifies "olive oil 250 ml"
3. App learns: olive oil → ml
4. Next manual add suggests ml automatically
5. Intelligence improves over time

---

## 📊 **BENEFITS**

### **User Benefits**
- ✅ No more duplicate entries
- ✅ Consistent unit usage
- ✅ Smarter suggestions
- ✅ Better pantry organization

### **Technical Benefits**
- ✅ Cleaner database
- ✅ Better pantry matching
- ✅ Improved recipe suggestions
- ✅ Enhanced user experience

---

## 🚀 **QUICK WIN IMPLEMENTATION**

For immediate improvement, start with:

1. **Basic Intelligence Database** (30 common ingredients)
2. **Simple Unit Suggestions** (liquid → ml, solid → g)
3. **Enhanced Duplicate Detection** (check unit compatibility)
4. **Smart Merge Dialog** (offer conversion when possible)

This covers 80% of edge cases with minimal complexity! 