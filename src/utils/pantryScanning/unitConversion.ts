export interface UnitOption {
  label: string;
  value: string;
}

export interface BackendUnitInfo {
  unit: string;
  multiplier: number;
}

// Unit options for frontend display
export const unitOptions: UnitOption[] = [
  { label: 'Carton', value: 'carton' },
  { label: 'Bottle', value: 'bottle' },
  { label: 'Units', value: 'units' },
  { label: 'Grams', value: 'g' },
  { label: 'Kilograms', value: 'kg' },
  { label: 'Milliliters', value: 'ml' },
  { label: 'Liters', value: 'l' },
  { label: 'Ounces', value: 'oz' },
  { label: 'Pounds', value: 'lbs' },
  { label: 'Cups', value: 'cups' }
];

// Frontend to backend unit conversion mapping
export const unitToBackend: Record<string, BackendUnitInfo> = {
  carton: { unit: 'ml', multiplier: 946 },
  bottle: { unit: 'ml', multiplier: 750 },
  units: { unit: 'unit', multiplier: 1 },
  g: { unit: 'g', multiplier: 1 },
  kg: { unit: 'g', multiplier: 1000 },
  ml: { unit: 'ml', multiplier: 1 },
  l: { unit: 'ml', multiplier: 1000 },
  oz: { unit: 'oz', multiplier: 1 },
  lbs: { unit: 'g', multiplier: 453.592 },
  cups: { unit: 'ml', multiplier: 240 }
};

/**
 * Parses quantity string to number, handling decimals and invalid inputs
 * @param quantity - Quantity as string or number
 * @returns Parsed quantity as number, defaults to 1 if invalid
 */
export const parseQuantity = (quantity: string | number): number => {
  if (typeof quantity === 'number') return quantity;
  if (typeof quantity !== 'string') return 1;
  
  const cleaned = quantity.replace(/[^\d.]/g, '');
  const match = cleaned.match(/^(\d*\.?\d*)/);
  const parsed = match ? parseFloat(match[0]) : NaN;
  
  return !isNaN(parsed) && parsed >= 0 ? parsed : 1;
};

/**
 * Maps scanned quantity string to appropriate frontend unit
 * @param quantityString - Raw quantity string from scanning
 * @returns Frontend unit value
 */
export const getFrontendUnit = (quantityString: string | undefined): string => {
  const qLower = String(quantityString || '').toLowerCase();
  
  if (qLower.includes('carton')) return 'carton';
  if (qLower.includes('bottle')) return 'bottle';
  if (qLower.includes('ml') || qLower.includes('milliliter')) return 'ml';
  if (qLower.includes('l') || qLower.includes('liter') || qLower.includes('quart')) return 'l';
  if (qLower.includes('kg') || qLower.includes('kilogram')) return 'kg';
  if (qLower.includes('g') || qLower.includes('gram')) return 'g';
  if (qLower.includes('oz') || qLower.includes('ounce')) return 'oz';
  if (qLower.includes('lb') || qLower.includes('pound')) return 'lbs';
  if (qLower.includes('cup')) return 'cups';
  if (/^\d+(\.\d+)?$/.test(qLower.trim())) return 'units';
  
  return 'units';
};

/**
 * Converts frontend quantity and unit to backend format
 * @param quantity - Quantity as number
 * @param frontendUnit - Frontend unit string
 * @returns Object with converted quantity and backend unit
 */
export const convertToBackendUnit = (quantity: number, frontendUnit: string): { quantity: number; unit: string } => {
  const backendUnitInfo = unitToBackend[frontendUnit] || unitToBackend.units;
  const convertedQuantity = quantity * backendUnitInfo.multiplier;
  
  return {
    quantity: convertedQuantity,
    unit: backendUnitInfo.unit
  };
};

/**
 * Gets backend unit info for a frontend unit
 * @param frontendUnit - Frontend unit string
 * @returns Backend unit information
 */
export const getBackendUnitInfo = (frontendUnit: string): BackendUnitInfo => {
  return unitToBackend[frontendUnit] || unitToBackend.units;
}; 