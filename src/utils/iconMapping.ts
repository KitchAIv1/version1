// Performance-optimized icon mapping for pantry items
// Uses memoization and efficient lookup to prevent latency issues
// Consistent with GroceryListScreen icon mapping

interface IconMapping {
  [key: string]: string;
}

// Pre-computed icon mappings using Ionicons (consistent with GroceryListScreen)
// Sorted by frequency of use (most common first)
const ICON_MAPPINGS: IconMapping = {
  // Most common pantry items first for faster lookup
  milk: 'pint-outline',
  bread: 'restaurant-outline',
  egg: 'egg-outline',
  eggs: 'egg-outline',
  cheese: 'cube-outline',
  butter: 'layers-outline',
  yogurt: 'ice-cream-outline',
  yoghurt: 'ice-cream-outline',

  // Fruits (using nutrition-outline for most fruits, leaf-outline for avocado like grocery list)
  apple: 'nutrition-outline',
  apples: 'nutrition-outline',
  banana: 'nutrition-outline',
  bananas: 'nutrition-outline',
  orange: 'nutrition-outline',
  oranges: 'nutrition-outline',
  lemon: 'nutrition-outline',
  lemons: 'nutrition-outline',
  lime: 'nutrition-outline',
  limes: 'nutrition-outline',
  strawberry: 'nutrition-outline',
  strawberries: 'nutrition-outline',
  grape: 'nutrition-outline',
  grapes: 'nutrition-outline',
  berry: 'nutrition-outline',
  berries: 'nutrition-outline',
  blueberry: 'nutrition-outline',
  blueberries: 'nutrition-outline',
  raspberry: 'nutrition-outline',
  raspberries: 'nutrition-outline',
  blackberry: 'nutrition-outline',
  blackberries: 'nutrition-outline',
  avocado: 'leaf-outline', // Consistent with grocery list
  avocados: 'leaf-outline',
  mango: 'nutrition-outline',
  mangos: 'nutrition-outline',
  mangoes: 'nutrition-outline',
  pineapple: 'nutrition-outline',
  pineapples: 'nutrition-outline',
  peach: 'nutrition-outline',
  peaches: 'nutrition-outline',
  pear: 'nutrition-outline',
  pears: 'nutrition-outline',
  cherry: 'nutrition-outline',
  cherries: 'nutrition-outline',
  kiwi: 'nutrition-outline',
  kiwis: 'nutrition-outline',
  watermelon: 'nutrition-outline',
  melon: 'nutrition-outline',
  cantaloupe: 'nutrition-outline',
  coconut: 'nutrition-outline',
  coconuts: 'nutrition-outline',

  // Vegetables (using leaf-outline consistent with grocery list)
  tomato: 'leaf-outline',
  tomatoes: 'leaf-outline',
  onion: 'leaf-outline',
  onions: 'leaf-outline',
  potato: 'leaf-outline',
  potatoes: 'leaf-outline',
  carrot: 'leaf-outline',
  carrots: 'leaf-outline',
  lettuce: 'leaf-outline',
  spinach: 'leaf-outline',
  pepper: 'leaf-outline',
  peppers: 'leaf-outline',
  'bell pepper': 'leaf-outline',
  'bell peppers': 'leaf-outline',
  bellpepper: 'leaf-outline',
  garlic: 'leaf-outline',
  ginger: 'leaf-outline',
  broccoli: 'leaf-outline',
  cauliflower: 'leaf-outline',
  cucumber: 'leaf-outline',
  cucumbers: 'leaf-outline',
  zucchini: 'leaf-outline',
  squash: 'leaf-outline',
  eggplant: 'leaf-outline',
  mushroom: 'leaf-outline',
  mushrooms: 'leaf-outline',
  celery: 'leaf-outline',
  cabbage: 'leaf-outline',
  kale: 'leaf-outline',
  arugula: 'leaf-outline',
  radish: 'leaf-outline',
  radishes: 'leaf-outline',
  beet: 'leaf-outline',
  beets: 'leaf-outline',
  turnip: 'leaf-outline',
  turnips: 'leaf-outline',
  'sweet potato': 'leaf-outline',
  'sweet potatoes': 'leaf-outline',
  corn: 'leaf-outline',
  peas: 'leaf-outline',
  'green beans': 'leaf-outline',
  beans: 'ellipse-outline',
  bean: 'ellipse-outline',

  // Proteins (consistent with grocery list)
  chicken: 'logo-twitter', // Consistent with grocery list
  'chicken breast': 'logo-twitter',
  'chicken thigh': 'logo-twitter',
  'chicken wing': 'logo-twitter',
  'chicken wings': 'logo-twitter',
  beef: 'restaurant-outline',
  'ground beef': 'restaurant-outline',
  steak: 'restaurant-outline',
  pork: 'restaurant-outline',
  'pork chop': 'restaurant-outline',
  'pork chops': 'restaurant-outline',
  fish: 'fish-outline',
  salmon: 'fish-outline',
  tuna: 'fish-outline',
  cod: 'fish-outline',
  tilapia: 'fish-outline',
  shrimp: 'fish-outline',
  crab: 'fish-outline',
  lobster: 'fish-outline',
  turkey: 'restaurant-outline',
  ham: 'restaurant-outline',
  bacon: 'remove-outline', // Consistent with grocery list
  sausage: 'restaurant-outline',
  tofu: 'square-outline',
  tempeh: 'square-outline',
  seitan: 'square-outline',

  // Grains & Pantry Staples (consistent with grocery list)
  rice: 'ellipse-outline',
  'brown rice': 'ellipse-outline',
  'white rice': 'ellipse-outline',
  'jasmine rice': 'ellipse-outline',
  'basmati rice': 'ellipse-outline',
  pasta: 'restaurant-outline',
  spaghetti: 'restaurant-outline',
  penne: 'restaurant-outline',
  macaroni: 'restaurant-outline',
  noodles: 'restaurant-outline',
  flour: 'folder-outline', // Consistent with grocery list
  'all-purpose flour': 'folder-outline',
  'whole wheat flour': 'folder-outline',
  oat: 'apps-outline',
  oats: 'apps-outline',
  oatmeal: 'apps-outline',
  cereal: 'apps-outline',
  quinoa: 'ellipse-outline',
  barley: 'ellipse-outline',
  wheat: 'ellipse-outline',
  bulgur: 'ellipse-outline',
  couscous: 'ellipse-outline',
  lentil: 'ellipse-outline',
  lentils: 'ellipse-outline',
  chickpea: 'ellipse-outline',
  chickpeas: 'ellipse-outline',
  'black beans': 'ellipse-outline',
  'kidney beans': 'ellipse-outline',
  'pinto beans': 'ellipse-outline',
  'navy beans': 'ellipse-outline',
  'lima beans': 'ellipse-outline',

  // Beverages (consistent with grocery list)
  juice: 'water-outline',
  'apple juice': 'water-outline',
  'orange juice': 'water-outline',
  'cranberry juice': 'water-outline',
  'grape juice': 'water-outline',
  water: 'water-outline',
  'sparkling water': 'water-outline',
  soda: 'beer-outline', // Consistent with grocery list
  cola: 'beer-outline',
  coffee: 'cafe-outline',
  tea: 'cafe-outline',
  'green tea': 'cafe-outline',
  'black tea': 'cafe-outline',
  'herbal tea': 'cafe-outline',
  wine: 'wine-outline',
  'red wine': 'wine-outline',
  'white wine': 'wine-outline',
  beer: 'beer-outline',
  'almond milk': 'pint-outline',
  'soy milk': 'pint-outline',
  'oat milk': 'pint-outline',
  'coconut milk': 'pint-outline',

  // Condiments & Oils (consistent with grocery list)
  oil: 'water-outline',
  'olive oil': 'water-outline', // Consistent with grocery list
  'vegetable oil': 'water-outline',
  'coconut oil': 'water-outline',
  'canola oil': 'water-outline',
  'sesame oil': 'water-outline',
  vinegar: 'water-outline',
  'balsamic vinegar': 'water-outline',
  'apple cider vinegar': 'water-outline',
  'white vinegar': 'water-outline',
  sauce: 'water-outline',
  'soy sauce': 'water-outline',
  'hot sauce': 'water-outline',
  'tomato sauce': 'water-outline',
  'pasta sauce': 'water-outline',
  'barbecue sauce': 'water-outline',
  ketchup: 'water-outline',
  mustard: 'water-outline',
  mayonnaise: 'water-outline',
  mayo: 'water-outline',
  salt: 'cube-outline',
  'sea salt': 'cube-outline',
  'kosher salt': 'cube-outline',
  sugar: 'cube-outline',
  'brown sugar': 'cube-outline',
  'white sugar': 'cube-outline',
  honey: 'water-outline',
  'maple syrup': 'water-outline',
  syrup: 'water-outline',
  jam: 'water-outline',
  jelly: 'water-outline',
  'peanut butter': 'water-outline',
  'almond butter': 'water-outline',
  nutella: 'water-outline',

  // Herbs & Spices (using leaf-outline for fresh herbs, cube-outline for dried spices)
  basil: 'leaf-outline',
  oregano: 'cube-outline',
  thyme: 'cube-outline',
  rosemary: 'leaf-outline',
  parsley: 'leaf-outline',
  cilantro: 'leaf-outline',
  mint: 'leaf-outline',
  sage: 'leaf-outline',
  dill: 'leaf-outline',
  chives: 'leaf-outline',
  spice: 'cube-outline',
  herb: 'leaf-outline',
  cinnamon: 'cube-outline',
  paprika: 'cube-outline',
  cumin: 'cube-outline',
  turmeric: 'cube-outline',
  'garam masala': 'cube-outline',
  'curry powder': 'cube-outline',
  'chili powder': 'cube-outline',
  'black pepper': 'ellipse-outline', // Consistent with grocery list
  cayenne: 'cube-outline',
  nutmeg: 'cube-outline',
  cloves: 'cube-outline',
  cardamom: 'cube-outline',
  'bay leaves': 'leaf-outline',
  vanilla: 'cube-outline',
  'vanilla extract': 'water-outline',

  // Dairy & Alternatives (consistent with grocery list)
  cheddar: 'cube-outline',
  mozzarella: 'ellipse-outline', // Consistent with grocery list
  parmesan: 'cube-outline',
  swiss: 'cube-outline',
  'goat cheese': 'cube-outline',
  'cream cheese': 'cube-outline',
  'cottage cheese': 'cube-outline',
  ricotta: 'ellipse-outline',
  feta: 'cube-outline',
  brie: 'ellipse-outline',
  camembert: 'ellipse-outline',
  'heavy cream': 'pint-outline',
  'whipping cream': 'pint-outline',
  'half and half': 'pint-outline',
  'sour cream': 'cube-outline',
  'greek yogurt': 'ice-cream-outline',
  'plain yogurt': 'ice-cream-outline',

  // Bakery (consistent with grocery list)
  'white bread': 'restaurant-outline',
  'whole wheat bread': 'restaurant-outline',
  bagel: 'ellipse-outline',
  croissant: 'restaurant-outline',

  // Nuts & Seeds
  almond: 'ellipse-outline',
  almonds: 'ellipse-outline',
  walnut: 'ellipse-outline',
  walnuts: 'ellipse-outline',
  pecan: 'ellipse-outline',
  pecans: 'ellipse-outline',
  cashew: 'ellipse-outline',
  cashews: 'ellipse-outline',
  pistachio: 'ellipse-outline',
  pistachios: 'ellipse-outline',
  peanut: 'ellipse-outline',
  peanuts: 'ellipse-outline',
  'sunflower seeds': 'ellipse-outline',
  'pumpkin seeds': 'ellipse-outline',
  'chia seeds': 'ellipse-outline',
  'flax seeds': 'ellipse-outline',
  'sesame seeds': 'ellipse-outline',

  // Baking & Dessert
  'baking powder': 'cube-outline',
  'baking soda': 'cube-outline',
  yeast: 'cube-outline',
  'cocoa powder': 'cube-outline',
  chocolate: 'square-outline',
  'dark chocolate': 'square-outline',
  'milk chocolate': 'square-outline',
  'white chocolate': 'square-outline',
  'chocolate chips': 'ellipse-outline',
  'powdered sugar': 'cube-outline',
  'confectioners sugar': 'cube-outline',

  // Default
  default: 'cube-outline',
};

// Memoization cache - stores computed results to avoid repeated calculations
const iconCache = new Map<string, string>();

// Default icon for unmatched items
const DEFAULT_ICON = 'cube-outline'; // Consistent with grocery list

/**
 * Gets the appropriate icon for a pantry item with performance optimization
 * Uses memoization and efficient string matching to prevent latency
 *
 * @param itemName - The name of the pantry item
 * @returns Ionicons icon name (consistent with GroceryListScreen)
 */
export const getIconForPantryItem = (itemName: string): string => {
  if (!itemName || typeof itemName !== 'string') {
    return DEFAULT_ICON;
  }

  // Check cache first - O(1) lookup
  const cacheKey = itemName.toLowerCase().trim();
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  // Efficient single-pass lookup with early termination
  const lowerItemName = cacheKey;
  let matchedIcon = DEFAULT_ICON;

  // Check for exact matches first (fastest)
  if (ICON_MAPPINGS[lowerItemName]) {
    matchedIcon = ICON_MAPPINGS[lowerItemName];
  } else {
    // Check for partial matches - sorted by length (longest first) for better matching
    const sortedKeys = Object.keys(ICON_MAPPINGS).sort(
      (a, b) => b.length - a.length,
    );

    for (const key of sortedKeys) {
      if (lowerItemName.includes(key)) {
        matchedIcon = ICON_MAPPINGS[key];
        break; // Early termination on first match
      }
    }
  }

  // Cache the result for future lookups
  iconCache.set(cacheKey, matchedIcon);

  return matchedIcon;
};

/**
 * Clears the icon cache (useful for memory management in long-running apps)
 */
export const clearIconCache = (): void => {
  iconCache.clear();
};

/**
 * Gets cache statistics for debugging/monitoring
 */
export const getIconCacheStats = () => ({
  size: iconCache.size,
  keys: Array.from(iconCache.keys()),
});
