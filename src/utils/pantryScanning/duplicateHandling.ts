import { Alert } from 'react-native';
import { supabase } from '../../services/supabase';
import { convertToBackendUnit, parseQuantity } from './unitConversion';

export interface ProcessedItem {
  id: string;
  scannedName: string;
  scannedQuantity: string;
  currentName: string;
  currentQuantity: number;
  currentUnit: string;
}

export interface ExistingStockItem {
  item_name: string;
  quantity: number;
  unit: string;
}

export interface ItemToUpsert {
  user_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  description?: string | null;
  created_at?: string;
  storage_location?: string;
}

export interface DuplicateAction {
  item: ProcessedItem;
  existingDetails: ExistingStockItem;
  convertedQuantity: number;
  backendUnit: string;
}

/**
 * Fetches current stock from database for duplicate checking
 * @param userId - User ID to fetch stock for
 * @returns Array of existing stock items
 */
export const fetchCurrentStock = async (
  userId: string,
): Promise<ExistingStockItem[]> => {
  try {
    const { data, error } = await supabase
      .from('stock')
      .select('item_name, quantity, unit')
      .eq('user_id', userId);

    if (error) {
      console.error('[duplicateHandling] Error fetching stock:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[duplicateHandling] Exception fetching stock:', error);
    throw error;
  }
};

/**
 * Creates a map of existing stock items for quick lookup
 * @param stockItems - Array of existing stock items
 * @returns Map with item names as keys
 */
export const createStockMap = (
  stockItems: ExistingStockItem[],
): Map<string, ExistingStockItem> => {
  return new Map(stockItems.map(item => [item.item_name.toLowerCase(), item]));
};

/**
 * Processes items and separates new items from duplicates
 * @param processedItems - Array of processed items from scanning
 * @param userId - User ID for database operations
 * @returns Object containing items to upsert and duplicate actions
 */
export const processItemsForDuplicates = async (
  processedItems: ProcessedItem[],
  userId: string,
): Promise<{
  itemsToUpsert: ItemToUpsert[];
  duplicateActions: DuplicateAction[];
}> => {
  const currentStock = await fetchCurrentStock(userId);
  const stockMap = createStockMap(currentStock);

  const itemsToUpsert: ItemToUpsert[] = [];
  const duplicateActions: DuplicateAction[] = [];

  for (const item of processedItems) {
    const itemNameLower = item.currentName.toLowerCase();
    const existingItem = stockMap.get(itemNameLower);
    const { quantity: convertedQuantity, unit: backendUnit } =
      convertToBackendUnit(item.currentQuantity, item.currentUnit);

    if (existingItem) {
      // Item exists - add to duplicate actions for user decision
      duplicateActions.push({
        item,
        existingDetails: existingItem,
        convertedQuantity,
        backendUnit,
      });
    } else {
      // New item - add directly to upsert list
      const now = new Date().toISOString();
      itemsToUpsert.push({
        user_id: userId,
        item_name: itemNameLower,
        quantity: convertedQuantity,
        unit: backendUnit,
        description: null,
        created_at: now,
        storage_location: 'cupboard',
      });
    }
  }

  return { itemsToUpsert, duplicateActions };
};

/**
 * Handles user decision for duplicate items
 * @param duplicateAction - The duplicate action to process
 * @param userId - User ID for database operations
 * @returns Promise that resolves with the item to upsert or null if cancelled
 */
export const handleDuplicateUserDecision = (
  duplicateAction: DuplicateAction,
  userId: string,
): Promise<ItemToUpsert | null> => {
  return new Promise(resolve => {
    const { item, existingDetails, convertedQuantity, backendUnit } =
      duplicateAction;

    Alert.alert(
      'Item Exists',
      `"${item.currentName}" is already in your pantry (${existingDetails.quantity} ${existingDetails.unit}). Choose an action:`,
      [
        {
          text: 'Add Quantity',
          onPress: () => {
            const existingQty =
              parseFloat(String(existingDetails.quantity)) || 0;
            const newTotalQty = existingQty + convertedQuantity;

            resolve({
              user_id: userId,
              item_name: item.currentName.toLowerCase(),
              quantity: newTotalQty,
              unit: backendUnit,
              description: null,
              storage_location: 'cupboard',
            });
          },
        },
        {
          text: 'Replace Entry',
          onPress: () => {
            resolve({
              user_id: userId,
              item_name: item.currentName.toLowerCase(),
              quantity: convertedQuantity,
              unit: backendUnit,
              description: null,
              storage_location: 'cupboard',
            });
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            resolve(null);
          },
        },
      ],
      { cancelable: false },
    );
  });
};

/**
 * Processes all duplicate actions sequentially
 * @param duplicateActions - Array of duplicate actions to process
 * @param userId - User ID for database operations
 * @returns Promise that resolves with array of items to upsert
 */
export const processDuplicateActions = async (
  duplicateActions: DuplicateAction[],
  userId: string,
): Promise<ItemToUpsert[]> => {
  const additionalItemsToUpsert: ItemToUpsert[] = [];

  for (const duplicateAction of duplicateActions) {
    const result = await handleDuplicateUserDecision(duplicateAction, userId);
    if (result) {
      additionalItemsToUpsert.push(result);
    }
  }

  return additionalItemsToUpsert;
};

/**
 * Validates user session for database operations
 * @returns Promise that resolves with user ID or throws error
 */
export const validateUserSession = async (): Promise<string> => {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session?.user) {
      throw new Error(sessionError?.message || 'User session not found.');
    }

    return sessionData.session.user.id;
  } catch (error) {
    console.error('[duplicateHandling] Session validation error:', error);
    throw error;
  }
};
