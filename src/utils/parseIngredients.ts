export type Ingredient = { name: string; qty?: string; unit?: string };

export function parseIngredients(raw: any): Ingredient[] {
  if (!raw) return [];

  // Handle if raw is an array of single-element arrays, each containing an Ingredient object
  if (
    Array.isArray(raw) &&
    raw.length > 0 &&
    Array.isArray(raw[0]) && 
    raw[0].length === 1 && 
    typeof raw[0][0] === 'object' && 
    raw[0][0] !== null &&
    'name' in raw[0][0] 
  ) {
    if (raw.every(item => Array.isArray(item) && item.length === 1 && typeof item[0] === 'object' && item[0] !== null && 'name' in item[0])) {
      return raw.map(innerArray => innerArray[0] as Ingredient);
    }
  }

  // Original check: if raw is already Ingredient[]
  if (Array.isArray(raw)) {
    if (raw.length === 0 || (typeof raw[0] === 'object' && raw[0] !== null && 'name' in raw[0])){
      return raw as Ingredient[];
    }
  }
  
  // Original check: if raw is { ingredients: Ingredient[] }
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as any).ingredients)) {
    return (raw as any).ingredients as Ingredient[];
  }
  
  return [];
} 