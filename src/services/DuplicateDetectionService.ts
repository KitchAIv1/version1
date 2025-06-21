import { supabase } from './supabase';

export interface DuplicateItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  storage_location: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  user_id?: string;
}

export interface DuplicateGroup {
  itemName: string;
  items: DuplicateItem[];
  totalCount: number;
  suggestedAction: 'merge' | 'review' | 'ignore';
}

export class DuplicateDetectionService {
  /**
   * Detects duplicates for a recently added item
   * @param userId - User ID
   * @param itemName - Name of the item to check
   * @returns Array of duplicate groups found
   */
  static async detectDuplicatesForItem(
    userId: string,
    itemName: string,
  ): Promise<DuplicateGroup[]> {
    try {
      console.log('[DuplicateDetectionService] 🔍 DETECTING DUPLICATES FOR:', {
        userId,
        itemName,
        normalizedItemName: this.normalizeItemName(itemName),
      });

      // Get all items for the user to perform fuzzy matching
      const { data: allItems, error } = await supabase
        .from('stock')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[DuplicateDetectionService] 📊 ALL ITEMS FROM DB:', {
        totalItems: allItems?.length || 0,
        sampleItems:
          allItems?.slice(0, 5).map(item => ({
            name: item.item_name,
            normalized: this.normalizeItemName(item.item_name),
            id: item.id,
          })) || [],
      });

      if (!allItems || allItems.length <= 1) {
        console.log(
          '[DuplicateDetectionService] ❌ Not enough items for duplicates',
        );
        return []; // No duplicates possible
      }

      // Find similar items using fuzzy matching
      const normalizedSearchName = this.normalizeItemName(itemName);
      console.log(
        '[DuplicateDetectionService] 🔍 SEARCHING FOR SIMILAR ITEMS:',
        {
          searchItem: itemName,
          normalizedSearch: normalizedSearchName,
        },
      );

      const similarItems = allItems.filter(item => {
        const normalizedItemName = this.normalizeItemName(item.item_name);
        const isSimilar = this.areItemNamesSimilar(
          normalizedSearchName,
          normalizedItemName,
        );

        console.log('[DuplicateDetectionService] 🔍 COMPARING:', {
          searchNormalized: normalizedSearchName,
          itemName: item.item_name,
          itemNormalized: normalizedItemName,
          isSimilar,
        });

        return isSimilar;
      });

      console.log('[DuplicateDetectionService] 📊 SIMILAR ITEMS FOUND:', {
        count: similarItems.length,
        items: similarItems.map(item => ({
          name: item.item_name,
          normalized: this.normalizeItemName(item.item_name),
          id: item.id,
        })),
      });

      if (similarItems.length === 0) {
        console.log(
          '[DuplicateDetectionService] ❌ No duplicates found (no similar items)',
        );
        return []; // No duplicates found
      }

      console.log('[DuplicateDetectionService] 🔍 FOUND DUPLICATES:', {
        searchItem: itemName,
        normalizedSearch: normalizedSearchName,
        duplicatesFound: similarItems.map(item => ({
          name: item.item_name,
          normalized: this.normalizeItemName(item.item_name),
          id: item.id,
        })),
      });

      // Group items and determine suggested action
      // Note: similarItems contains existing items that match the new item we're about to add
      const duplicateGroup: DuplicateGroup = {
        itemName,
        items: similarItems,
        totalCount: similarItems.length + 1, // +1 for the new item we're about to add
        suggestedAction: this.determineSuggestedAction([
          ...similarItems,
          {
            id: 'temp-new-item',
            item_name: itemName,
            quantity: 1,
            unit: 'units',
            storage_location: 'pantry',
            created_at: new Date().toISOString(),
          } as DuplicateItem,
        ]),
      };

      return [duplicateGroup];
    } catch (error) {
      console.error(
        '[DuplicateDetectionService] Error detecting duplicates:',
        error,
      );
      return [];
    }
  }

  /**
   * Normalizes item names for comparison
   * @param itemName - Raw item name
   * @returns Normalized item name
   */
  private static normalizeItemName(itemName: string): string {
    return (
      itemName
        .toLowerCase()
        .trim()
        // Remove common suffixes/prefixes that don't change the core item
        .replace(/\s*\(.*\)\s*/g, '') // Remove parenthetical content like "(units)"
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
    );
  }

  /**
   * Determines if two normalized item names are similar enough to be duplicates
   * @param name1 - First normalized name
   * @param name2 - Second normalized name
   * @returns True if items should be considered duplicates
   */
  private static areItemNamesSimilar(name1: string, name2: string): boolean {
    // Exact match after normalization
    if (name1 === name2) {
      return true;
    }

    // Check if one is a substring of the other (for cases like "oil" vs "olive oil")
    if (name1.includes(name2) || name2.includes(name1)) {
      // Only consider it a match if the shorter name is at least 3 characters
      // to avoid false positives like "a" matching "apple"
      const shorterLength = Math.min(name1.length, name2.length);
      return shorterLength >= 3;
    }

    // Could add more sophisticated matching here (Levenshtein distance, etc.)
    return false;
  }

  /**
   * Gets all duplicate groups for a user
   * @param userId - User ID
   * @returns Array of all duplicate groups
   */
  static async getAllDuplicateGroups(
    userId: string,
  ): Promise<DuplicateGroup[]> {
    try {
      const { data: items, error } = await supabase
        .from('stock')
        .select('*')
        .eq('user_id', userId)
        .order('item_name', { ascending: true });

      if (error) throw error;

      if (!items) return [];

      // Group items by normalized name for fuzzy matching
      const groupedItems: Record<string, DuplicateItem[]> = {};
      const processedItems = new Set<string>(); // Track which items we've already grouped

      for (const item of items) {
        if (processedItems.has(item.id)) continue;

        const normalizedName = this.normalizeItemName(item.item_name);
        const similarItems = items.filter(otherItem => {
          if (processedItems.has(otherItem.id)) return false;
          const otherNormalizedName = this.normalizeItemName(
            otherItem.item_name,
          );
          return this.areItemNamesSimilar(normalizedName, otherNormalizedName);
        });

        if (similarItems.length > 1) {
          // Use the first item's name as the group key
          groupedItems[item.item_name] = similarItems.map(
            item => item as DuplicateItem,
          );
          // Mark all these items as processed
          similarItems.forEach(similarItem =>
            processedItems.add(similarItem.id),
          );
        }
      }

      // Convert to duplicate groups
      const duplicateGroups: DuplicateGroup[] = [];

      for (const [itemName, itemList] of Object.entries(groupedItems)) {
        duplicateGroups.push({
          itemName,
          items: itemList,
          totalCount: itemList.length,
          suggestedAction: this.determineSuggestedAction(itemList),
        });
      }

      return duplicateGroups;
    } catch (error) {
      console.error(
        '[DuplicateDetectionService] Error getting all duplicates:',
        error,
      );
      return [];
    }
  }

  /**
   * Determines the suggested action for a group of duplicate items
   * @param items - Array of duplicate items
   * @returns Suggested action
   */
  private static determineSuggestedAction(
    items: DuplicateItem[],
  ): 'merge' | 'review' | 'ignore' {
    if (items.length === 2) {
      // For 2 items, suggest merge if units are similar
      const units = items.map(item => item.unit);
      const uniqueUnits = [...new Set(units)];

      if (uniqueUnits.length === 1) {
        return 'merge'; // Same units, easy merge
      }

      // Check if units are compatible (basic check)
      if (this.areUnitsCompatible(uniqueUnits)) {
        return 'merge';
      }

      return 'review';
    }

    if (items.length > 2) {
      return 'review'; // Multiple items need review
    }

    return 'ignore';
  }

  /**
   * Basic unit compatibility check
   * @param units - Array of unit strings
   * @returns True if units are compatible
   */
  private static areUnitsCompatible(units: string[]): boolean {
    const liquidUnits = ['ml', 'l', 'liter', 'litre'];
    const weightUnits = ['g', 'kg', 'gram', 'kilogram'];
    const countUnits = ['units', 'pieces', 'items'];

    const categories = [liquidUnits, weightUnits, countUnits];

    return categories.some(category =>
      units.every(unit => category.includes(unit.toLowerCase())),
    );
  }

  /**
   * Merges duplicate items into a single item
   * @param items - Items to merge
   * @param targetUnit - Unit to use for merged item
   * @param targetLocation - Storage location for merged item
   * @returns Success status
   */
  static async mergeItems(
    items: DuplicateItem[],
    targetUnit: string,
    targetLocation: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[DuplicateDetectionService] 🔄 MERGE ITEMS CALLED:', {
        itemCount: items.length,
        targetUnit,
        targetLocation,
        items: items.map(item => ({
          id: item.id,
          name: item.item_name,
          quantity: item.quantity,
          unit: item.unit,
          location: item.storage_location,
          created_at: item.created_at,
        })),
      });

      if (items.length < 2) {
        console.log(
          '[DuplicateDetectionService] ❌ MERGE FAILED: Not enough items',
        );
        return { success: false, error: 'Need at least 2 items to merge' };
      }

      // Check if there's a pending item (temp ID)
      const pendingItem = items.find(item => item.id.startsWith('temp-'));
      const existingItems = items.filter(item => !item.id.startsWith('temp-'));

      // Calculate total quantity (assuming 1:1 conversion for now)
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const currentTime = new Date().toISOString();

      console.log('[DuplicateDetectionService] 🔄 MERGE DETAILS:', {
        hasPendingItem: !!pendingItem,
        existingItemsCount: existingItems.length,
        totalItems: items.length,
        totalQuantity,
        mergeTime: currentTime,
      });

      let itemsToDelete: DuplicateItem[] = [];

      if (pendingItem) {
        console.log(
          '[DuplicateDetectionService] 🔄 Merging pending item with existing items...',
        );

        // When we have a pending item, update the most recent existing item
        // and delete the rest (if any)
        const sortedExistingItems = [...existingItems].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        const baseItem = sortedExistingItems[0];

        console.log(
          '[DuplicateDetectionService] 🔄 Updating existing item with merged data...',
        );
        console.log('[DuplicateDetectionService] 📊 QUANTITY TRACKING INFO:', {
          baseItemId: baseItem.id,
          baseItemName: baseItem.item_name,
          oldQuantity: baseItem.quantity,
          newQuantity: totalQuantity,
          quantityChange: totalQuantity - baseItem.quantity,
          pendingItemQuantity: pendingItem?.quantity,
        });

        // Update the base item with merged data and current timestamp
        // This should trigger the quantity tracking trigger
        const { error: updateError } = await supabase
          .from('stock')
          .update({
            quantity: totalQuantity,
            unit: targetUnit,
            storage_location: targetLocation,
            updated_at: currentTime,
          })
          .eq('id', baseItem.id);

        if (updateError) {
          console.error(
            '[DuplicateDetectionService] ❌ UPDATE ERROR:',
            updateError,
          );
          throw updateError;
        }

        console.log(
          '[DuplicateDetectionService] ✅ Existing item updated with pending data - trigger should have fired',
        );
        itemsToDelete = sortedExistingItems.slice(1); // Delete other existing items (if any)
      } else {
        console.log(
          '[DuplicateDetectionService] 🔄 Using existing item as base...',
        );

        // Sort existing items by created_at to get the most recent one
        const sortedItems = [...existingItems].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        const baseItem = sortedItems[0];

        console.log(
          '[DuplicateDetectionService] 📊 QUANTITY TRACKING INFO (existing only):',
          {
            baseItemId: baseItem.id,
            baseItemName: baseItem.item_name,
            oldQuantity: baseItem.quantity,
            newQuantity: totalQuantity,
            quantityChange: totalQuantity - baseItem.quantity,
            itemsBeingMerged: sortedItems.length,
          },
        );

        // Update the base item with merged data and current timestamp
        // This should trigger the quantity tracking trigger
        const { error: updateError } = await supabase
          .from('stock')
          .update({
            quantity: totalQuantity,
            unit: targetUnit,
            storage_location: targetLocation,
            updated_at: currentTime,
          })
          .eq('id', baseItem.id);

        if (updateError) {
          console.error(
            '[DuplicateDetectionService] ❌ UPDATE ERROR:',
            updateError,
          );
          throw updateError;
        }

        console.log(
          '[DuplicateDetectionService] ✅ Base item updated successfully - trigger should have fired',
        );
        itemsToDelete = sortedItems.slice(1);
      }

      // Delete the items that need to be removed
      if (itemsToDelete.length > 0) {
        console.log('[DuplicateDetectionService] 🗑️ Deleting other items:', {
          count: itemsToDelete.length,
          items: itemsToDelete.map(item => ({
            id: item.id,
            name: item.item_name,
          })),
        });

        const deletePromises = itemsToDelete.map(
          async (item: DuplicateItem) => {
            console.log(
              `[DuplicateDetectionService] 🗑️ Deleting item: ${item.id} (${item.item_name})`,
            );
            const result = await supabase
              .from('stock')
              .delete()
              .eq('id', item.id);
            if (result.error) {
              console.error(
                `[DuplicateDetectionService] ❌ Delete error for ${item.id}:`,
                result.error,
              );
            } else {
              console.log(
                `[DuplicateDetectionService] ✅ Successfully deleted item: ${item.id}`,
              );
            }
            return result;
          },
        );

        const deleteResults = await Promise.all(deletePromises);

        // Check if any deletes failed
        const failedDeletes = deleteResults.filter(
          (result: any) => result.error,
        );
        if (failedDeletes.length > 0) {
          console.error(
            '[DuplicateDetectionService] ❌ Some deletes failed:',
            failedDeletes,
          );
          throw new Error(`Failed to delete ${failedDeletes.length} items`);
        }
      }

      console.log('[DuplicateDetectionService] ✅ MERGE COMPLETED:', {
        merged_items: items.length,
        total_quantity: totalQuantity,
        target_unit: targetUnit,
        target_location: targetLocation,
        merge_timestamp: currentTime,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[DuplicateDetectionService] ❌ MERGE ERROR:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deletes a specific duplicate item
   * @param itemId - ID of item to delete
   * @returns Success status
   */
  static async deleteItem(
    itemId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('stock').delete().eq('id', itemId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('[DuplicateDetectionService] Error deleting item:', error);
      return { success: false, error: error.message };
    }
  }
}
