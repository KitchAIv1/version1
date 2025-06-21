/**
 * Unit Intelligence Service
 *
 * Provides intelligent unit suggestions and compatibility checking for pantry items.
 * This service bridges the gap between AI scanning intelligence and manual add functionality.
 *
 * FEATURES:
 * - Ingredient-specific unit suggestions (olive oil → ml, flour → g)
 * - Unit compatibility checking for duplicate detection
 * - Learning from AI scanning patterns
 * - Fuzzy matching for ingredient variations
 *
 * @module UnitIntelligenceService
 */

export enum UnitCategory {
  LIQUID = 'liquid',
  WEIGHT = 'weight',
  COUNT = 'count',
  VOLUME_DRY = 'volume_dry',
}

export const UNIT_CATEGORIES = {
  [UnitCategory.LIQUID]: [
    'ml',
    'l',
    'liter',
    'litre',
    'cup',
    'tbsp',
    'tsp',
    'fl oz',
  ],
  [UnitCategory.WEIGHT]: [
    'g',
    'kg',
    'gram',
    'kilogram',
    'lb',
    'oz',
    'pound',
    'lbs',
  ],
  [UnitCategory.COUNT]: ['units', 'pieces', 'items', 'pcs', 'piece'],
  [UnitCategory.VOLUME_DRY]: ['cup', 'tbsp', 'tsp', 'cups'],
};

export interface IngredientIntelligence {
  category: UnitCategory;
  defaultUnit: string;
  unitAssumed: string;
  confidence: number;
}

export const INGREDIENT_INTELLIGENCE: Record<string, IngredientIntelligence> = {
  // LIQUIDS - default to ml
  'olive oil': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  'vegetable oil': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  'coconut oil': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  'sesame oil': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  milk: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  water: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  vinegar: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  'soy sauce': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  wine: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  beer: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  juice: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  broth: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  stock: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  cream: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  yogurt: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.8,
  },

  // SOLIDS - default to grams
  flour: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  sugar: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  salt: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  rice: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  pasta: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  spaghetti: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  cheese: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  butter: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  chicken: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  beef: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  pork: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  fish: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  salmon: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  'ground beef': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  'tomato sauce': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.7,
  },

  // COUNTABLE ITEMS
  eggs: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  apples: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  oranges: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  bananas: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  onions: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  garlic: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.8,
  },
  tomatoes: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.8,
  },
  potatoes: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  carrots: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.8,
  },
  lemons: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  limes: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },

  // HERBS & SPICES - default to grams
  rosemary: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  thyme: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  basil: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  oregano: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  parsley: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  cilantro: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  dill: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  sage: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  mint: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  paprika: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  'smoked paprika': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  cumin: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  coriander: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  turmeric: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  ginger: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  cinnamon: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  nutmeg: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  cloves: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  cardamom: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  'bay leaves': {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.9,
  },
  vanilla: {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.8,
  },
  'vanilla extract': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },

  // CONDIMENTS & SAUCES - mostly weight/liquid
  ketchup: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  catsup: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  mustard: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  mayonnaise: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  'hot sauce': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.8,
  },
  'worcestershire sauce': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  'fish sauce': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  'oyster sauce': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
  'hoisin sauce': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },

  // BAKING INGREDIENTS
  'baking powder': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  'baking soda': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  yeast: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  cornstarch: {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },
  'cocoa powder': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.9,
  },

  // COMMON PANTRY ITEMS
  bread: {
    category: UnitCategory.COUNT,
    defaultUnit: 'units',
    unitAssumed: 'units',
    confidence: 0.8,
  },
  'ice cream': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.7,
  },
  'heavy cream': {
    category: UnitCategory.LIQUID,
    defaultUnit: 'ml',
    unitAssumed: 'ml',
    confidence: 0.9,
  },
  'sour cream': {
    category: UnitCategory.WEIGHT,
    defaultUnit: 'g',
    unitAssumed: 'g',
    confidence: 0.8,
  },
};

export interface UnitSuggestion {
  shouldNormalize: boolean;
  suggestedUnit: string;
  reason: string;
  confidence: number;
}

export class UnitIntelligenceService {
  /**
   * Gets ingredient intelligence for a given item name
   * @param itemName - Name of the ingredient
   * @returns Intelligence data or default fallback
   */
  static getIngredientIntelligence(itemName: string): IngredientIntelligence {
    const normalized = itemName.toLowerCase().trim();

    // Direct match
    if (INGREDIENT_INTELLIGENCE[normalized]) {
      return INGREDIENT_INTELLIGENCE[normalized];
    }

    // Fuzzy matching for variations (improved)
    for (const [key, value] of Object.entries(INGREDIENT_INTELLIGENCE)) {
      // Check if normalized name contains the key or vice versa
      if (normalized.includes(key) || key.includes(normalized)) {
        return { ...value, confidence: value.confidence * 0.8 }; // Reduce confidence for fuzzy match
      }
    }

    // Default fallback
    return {
      category: UnitCategory.COUNT,
      defaultUnit: 'units',
      unitAssumed: 'units',
      confidence: 0.3,
    };
  }

  /**
   * Determines if a unit should be normalized and suggests a better unit
   * @param itemName - Name of the ingredient
   * @param currentUnit - Current unit being used
   * @returns Suggestion object with normalization recommendation
   */
  static shouldNormalizeUnit(
    itemName: string,
    currentUnit: string,
  ): UnitSuggestion {
    const intelligence = this.getIngredientIntelligence(itemName);

    // If user used "units" but ingredient has a specific category
    if (currentUnit === 'units' && intelligence.defaultUnit !== 'units') {
      return {
        shouldNormalize: true,
        suggestedUnit: intelligence.defaultUnit,
        reason: `"${itemName}" is typically measured in ${intelligence.defaultUnit}`,
        confidence: intelligence.confidence,
      };
    }

    // If user used incompatible unit for the ingredient category
    const currentUnitCategory = this.getUnitCategory(currentUnit);
    if (
      currentUnitCategory !== intelligence.category &&
      intelligence.confidence > 0.7
    ) {
      return {
        shouldNormalize: true,
        suggestedUnit: intelligence.defaultUnit,
        reason: `"${itemName}" is a ${intelligence.category} ingredient, better measured in ${intelligence.defaultUnit}`,
        confidence: intelligence.confidence,
      };
    }

    return {
      shouldNormalize: false,
      suggestedUnit: currentUnit,
      reason: '',
      confidence: 1.0,
    };
  }

  /**
   * Checks if two units are compatible for the same ingredient
   * @param unit1 - First unit
   * @param unit2 - Second unit
   * @param itemName - Name of the ingredient
   * @returns True if units are compatible
   */
  static areUnitsCompatible(
    unit1: string,
    unit2: string,
    itemName: string,
  ): boolean {
    const intelligence = this.getIngredientIntelligence(itemName);

    const unit1Category = this.getUnitCategory(unit1);
    const unit2Category = this.getUnitCategory(unit2);

    // Same category = compatible
    return unit1Category === unit2Category;
  }

  /**
   * Gets the category of a unit
   * @param unit - Unit string
   * @returns Unit category
   */
  static getUnitCategory(unit: string): UnitCategory {
    const unitLower = unit.toLowerCase();

    for (const [category, units] of Object.entries(UNIT_CATEGORIES)) {
      if (units.includes(unitLower)) {
        return category as UnitCategory;
      }
    }

    return UnitCategory.COUNT; // Default
  }

  /**
   * Gets a human-readable description of a unit category
   * @param category - Unit category
   * @returns Human-readable description
   */
  static getCategoryDescription(category: UnitCategory): string {
    switch (category) {
      case UnitCategory.LIQUID:
        return 'liquid';
      case UnitCategory.WEIGHT:
        return 'weight-based';
      case UnitCategory.COUNT:
        return 'countable';
      case UnitCategory.VOLUME_DRY:
        return 'volume-based';
      default:
        return 'general';
    }
  }

  /**
   * Learns from AI scanning results to improve intelligence
   * @param scannedItems - Items from AI scanning
   * @returns Learning insights
   */
  static learnFromAIScanning(
    scannedItems: Array<{ name: string; unit: string }>,
  ): Record<string, IngredientIntelligence> {
    const learnings: Record<string, IngredientIntelligence> = {};

    scannedItems.forEach(item => {
      const itemName = item.name.toLowerCase();
      const { unit } = item;

      // AI is usually smart about units, so learn from it
      if (!INGREDIENT_INTELLIGENCE[itemName]) {
        const category = this.getUnitCategory(unit);
        learnings[itemName] = {
          category,
          defaultUnit: unit,
          unitAssumed: unit,
          confidence: 0.8, // High confidence in AI decisions
        };
      }
    });

    return learnings;
  }

  /**
   * Gets the most appropriate unit for an ingredient based on intelligence
   * @param itemName - Name of the ingredient
   * @returns Recommended unit
   */
  static getRecommendedUnit(itemName: string): string {
    const intelligence = this.getIngredientIntelligence(itemName);
    return intelligence.defaultUnit;
  }

  /**
   * Validates if a unit is reasonable for an ingredient
   * @param itemName - Name of the ingredient
   * @param unit - Unit to validate
   * @returns Validation result with warnings
   */
  static validateUnit(
    itemName: string,
    unit: string,
  ): {
    isValid: boolean;
    warning?: string;
    suggestion?: string;
  } {
    const intelligence = this.getIngredientIntelligence(itemName);
    const unitCategory = this.getUnitCategory(unit);

    if (unitCategory === intelligence.category) {
      return { isValid: true };
    }

    if (intelligence.confidence > 0.7) {
      return {
        isValid: false,
        warning: `"${itemName}" is typically a ${this.getCategoryDescription(intelligence.category)} ingredient`,
        suggestion: intelligence.defaultUnit,
      };
    }

    return { isValid: true }; // Low confidence, allow user choice
  }
}

export default UnitIntelligenceService;
