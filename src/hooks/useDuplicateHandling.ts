import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { 
  DuplicateDetectionService, 
  DuplicateGroup, 
  DuplicateItem 
} from '../services/DuplicateDetectionService';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../services/supabase';

export interface DuplicateHandlingState {
  // Merge Dialog (now the primary interface)
  showMergeDialog: boolean;
  currentDuplicateGroup: DuplicateGroup | null;
  
  // Review Duplicates Modal (for bulk management only)
  showReviewModal: boolean;
  allDuplicateGroups: DuplicateGroup[];
  
  // Loading states
  isDetecting: boolean;
  isMerging: boolean;

  // Pending item data for pre-save duplicate checking
  pendingItemData: any | null;
}

export const useDuplicateHandling = (onRefreshPantry: () => Promise<void>) => {
  const { user } = useAuth();
  
  const [state, setState] = useState<DuplicateHandlingState>({
    showMergeDialog: false,
    currentDuplicateGroup: null,
    showReviewModal: false,
    allDuplicateGroups: [],
    isDetecting: false,
    isMerging: false,
    pendingItemData: null,
  });

  // NEW: Check for duplicates before saving (pre-save check)
  const checkBeforeSave = useCallback(async (itemData: any): Promise<boolean> => {
    if (!user?.id) return false;

    console.log('[useDuplicateHandling] 🔍 PRE-SAVE duplicate check for:', itemData.item_name);
    setState(prev => ({ ...prev, isDetecting: true }));
    
    try {
      const duplicateGroups = await DuplicateDetectionService.detectDuplicatesForItem(
        user.id, 
        itemData.item_name
      );

      console.log('[useDuplicateHandling] 📊 PRE-SAVE duplicate check result:', {
        itemName: itemData.item_name,
        duplicateGroupsFound: duplicateGroups.length,
        firstGroup: duplicateGroups[0] ? {
          itemName: duplicateGroups[0].itemName,
          totalCount: duplicateGroups[0].totalCount,
          suggestedAction: duplicateGroups[0].suggestedAction
        } : null
      });

      if (duplicateGroups.length > 0) {
        console.log('[useDuplicateHandling] ✅ PRE-SAVE: Found duplicates, showing merge modal');
        setState(prev => ({
          ...prev,
          showMergeDialog: true,
          currentDuplicateGroup: duplicateGroups[0],
          pendingItemData: itemData,
          isDetecting: false,
        }));
        return true; // Duplicates found, don't save yet
      } else {
        console.log('[useDuplicateHandling] ❌ PRE-SAVE: No duplicates found, can proceed with save');
        setState(prev => ({ ...prev, isDetecting: false }));
        return false; // No duplicates, safe to save
      }
    } catch (error) {
      console.error('[useDuplicateHandling] Error in pre-save duplicate check:', error);
      setState(prev => ({ ...prev, isDetecting: false }));
      return false; // Error, allow save to proceed
    }
  }, [user?.id]);

  // Check for duplicates after adding an item (post-save check - for existing functionality)
  const checkForDuplicates = useCallback(async (itemName: string) => {
    if (!user?.id) return;

    console.log('[useDuplicateHandling] 🔍 POST-SAVE duplicate check for:', itemName);
    setState(prev => ({ ...prev, isDetecting: true }));
    
    try {
      const duplicateGroups = await DuplicateDetectionService.detectDuplicatesForItem(
        user.id, 
        itemName
      );

      console.log('[useDuplicateHandling] 📊 POST-SAVE duplicate check result:', {
        itemName,
        duplicateGroupsFound: duplicateGroups.length,
        firstGroup: duplicateGroups[0] ? {
          itemName: duplicateGroups[0].itemName,
          totalCount: duplicateGroups[0].totalCount,
          suggestedAction: duplicateGroups[0].suggestedAction
        } : null
      });

      if (duplicateGroups.length > 0) {
        console.log('[useDuplicateHandling] ✅ POST-SAVE: Setting showMergeDialog to TRUE');
        setState(prev => ({
          ...prev,
          showMergeDialog: true,
          currentDuplicateGroup: duplicateGroups[0],
          isDetecting: false,
        }));
      } else {
        console.log('[useDuplicateHandling] ❌ POST-SAVE: No duplicates found, not showing merge modal');
        setState(prev => ({ ...prev, isDetecting: false }));
      }
    } catch (error) {
      console.error('[useDuplicateHandling] Error checking duplicates:', error);
      setState(prev => ({ ...prev, isDetecting: false }));
    }
  }, [user?.id]);

  // Load all duplicate groups for review
  const loadAllDuplicates = useCallback(async () => {
    if (!user?.id) return;

    try {
      const allGroups = await DuplicateDetectionService.getAllDuplicateGroups(user.id);
      setState(prev => ({
        ...prev,
        allDuplicateGroups: allGroups,
        showReviewModal: true,
      }));
    } catch (error) {
      console.error('[useDuplicateHandling] Error loading all duplicates:', error);
      Alert.alert('Error', 'Failed to load duplicate items');
    }
  }, [user?.id]);

  // NEW: Save the pending item to database
  const savePendingItem = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!state.pendingItemData || !user?.id) {
      return { success: false, error: 'No pending item data' };
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const payload = {
        user_id: currentUser.id,
        item_name: state.pendingItemData.item_name.trim().toLowerCase(),
        quantity: state.pendingItemData.quantity,
        unit: state.pendingItemData.unit,
        description: state.pendingItemData.description,
        storage_location: state.pendingItemData.storage_location,
      };

      const result = await supabase
        .from('stock')
        .upsert(payload, { onConflict: 'user_id, item_name' });

      if (result.error) throw result.error;

      console.log('[useDuplicateHandling] ✅ Successfully saved pending item:', state.pendingItemData.item_name);
      
      // Clear pending data
      setState(prev => ({ ...prev, pendingItemData: null }));
      
      return { success: true };
    } catch (error: any) {
      console.error('[useDuplicateHandling] Error saving pending item:', error);
      return { success: false, error: error.message };
    }
  }, [state.pendingItemData, user?.id]);

  // Smart Suggestion Bar Actions (updated for pre-save flow)
  const handleMergeFromSuggestion = useCallback(() => {
    if (state.currentDuplicateGroup) {
      setState(prev => ({
        ...prev,
        showMergeDialog: true,
        currentDuplicateGroup: null,
      }));
    }
  }, [state.currentDuplicateGroup]);

  const handleEditFromSuggestion = useCallback(() => {
    // TODO: Implement edit functionality
    // This would reopen the ManualAddSheet with the pending item data
    setState(prev => ({ 
      ...prev, 
      showMergeDialog: false,
      pendingItemData: null // Clear pending data
    }));
    Alert.alert('Edit', 'Edit functionality to be implemented');
  }, []);

  const handleDeleteFromSuggestion = useCallback(async () => {
    if (!state.currentDuplicateGroup) return;

    const items = state.currentDuplicateGroup.items;
    const mostRecentItem = items[0]; // Items are sorted by created_at desc

    Alert.alert(
      'Delete Item',
      `Delete the most recent "${mostRecentItem.item_name}" entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await DuplicateDetectionService.deleteItem(mostRecentItem.id);
            if (result.success) {
              setState(prev => ({ 
                ...prev, 
                showMergeDialog: false,
                pendingItemData: null // Clear pending data
              }));
              await onRefreshPantry();
              Alert.alert('Success', 'Item deleted successfully');
            } else {
              Alert.alert('Error', result.error || 'Failed to delete item');
            }
          },
        },
      ]
    );
  }, [state.currentDuplicateGroup, onRefreshPantry]);

  const handleKeepBothFromSuggestion = useCallback(async () => {
    console.log('[useDuplicateHandling] 💾 User chose "Keep Both" - saving pending item');
    
    const result = await savePendingItem();
    if (result.success) {
      setState(prev => ({ ...prev, showMergeDialog: false }));
      await onRefreshPantry();
      Alert.alert('Success', 'Item added successfully');
    } else {
      Alert.alert('Error', result.error || 'Failed to save item');
    }
  }, [savePendingItem, onRefreshPantry]);

  const handleReviewFromSuggestion = useCallback(() => {
    setState(prev => ({ ...prev, showMergeDialog: false }));
    loadAllDuplicates();
  }, [loadAllDuplicates]);

  const handleDismissSuggestion = useCallback(() => {
    setState(prev => ({
      ...prev,
      showMergeDialog: false,
      currentDuplicateGroup: null,
      pendingItemData: null, // Clear pending data
    }));
  }, []);

  // Review Modal Actions
  const handleMergeFromReview = useCallback((items: DuplicateItem[]) => {
    if (items.length < 2) {
      Alert.alert('Error', 'Please select at least 2 items to merge');
      return;
    }

    // Create a temporary duplicate group for the selected items
    const tempGroup: DuplicateGroup = {
      itemName: items[0].item_name,
      items: items,
      totalCount: items.length,
      suggestedAction: 'merge'
    };

    setState(prev => ({
      ...prev,
      showReviewModal: false,
      showMergeDialog: true,
      currentDuplicateGroup: tempGroup,
    }));
  }, []);

  const handleEditFromReview = useCallback((item: DuplicateItem) => {
    // TODO: Implement edit functionality
    Alert.alert('Edit', `Edit functionality for ${item.item_name} to be implemented`);
  }, []);

  const handleDeleteFromReview = useCallback(async (item: DuplicateItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.item_name}" (${item.quantity} ${item.unit})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await DuplicateDetectionService.deleteItem(item.id);
            if (result.success) {
              await onRefreshPantry();
              // Refresh the duplicate groups
              await loadAllDuplicates();
              Alert.alert('Success', 'Item deleted successfully');
            } else {
              Alert.alert('Error', result.error || 'Failed to delete item');
            }
          },
        },
      ]
    );
  }, [onRefreshPantry, loadAllDuplicates]);

  const handleCloseReviewModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      showReviewModal: false,
      allDuplicateGroups: [],
    }));
  }, []);

  // Merge Dialog Actions
  const handleConfirmMerge = useCallback(async (targetUnit: string, targetLocation: string) => {
    console.log('[useDuplicateHandling] 🔄 MERGE STARTED:', {
      targetUnit,
      targetLocation,
      hasPendingData: !!state.pendingItemData,
      currentGroup: state.currentDuplicateGroup ? {
        itemName: state.currentDuplicateGroup.itemName,
        itemCount: state.currentDuplicateGroup.items.length
      } : null
    });

    setState(prev => ({ ...prev, isMerging: true }));

    try {
      // Get items to merge from currentDuplicateGroup
      let itemsToMerge = state.currentDuplicateGroup?.items || [];
      
      console.log('[useDuplicateHandling] 📋 Initial items to merge:', {
        count: itemsToMerge.length,
        items: itemsToMerge.map(item => ({
          id: item.id,
          name: item.item_name,
          quantity: item.quantity,
          unit: item.unit
        }))
      });
      
      if (state.pendingItemData && itemsToMerge.length > 0) {
        console.log('[useDuplicateHandling] 🔄 Including pending item in merge');
        
        // Create a temporary DuplicateItem for the pending item
        const pendingItem: DuplicateItem = {
          id: 'temp-pending-item',
          item_name: state.pendingItemData.item_name,
          quantity: state.pendingItemData.quantity,
          unit: state.pendingItemData.unit,
          storage_location: state.pendingItemData.storage_location,
          description: state.pendingItemData.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: user?.id
        };
        
        // Add the pending item to the items to merge
        itemsToMerge = [...itemsToMerge, pendingItem];
        
        console.log('[useDuplicateHandling] 🔄 Updated items to merge with pending item:', {
          count: itemsToMerge.length,
          items: itemsToMerge.map(item => ({
            id: item.id,
            name: item.item_name,
            quantity: item.quantity,
            unit: item.unit
          }))
        });
      }

      if (itemsToMerge.length < 2) {
        console.log('[useDuplicateHandling] ❌ MERGE FAILED: Not enough items to merge');
        setState(prev => ({ ...prev, isMerging: false }));
        Alert.alert('Error', 'Need at least 2 items to merge');
        return;
      }

      console.log('[useDuplicateHandling] 🔄 Calling DuplicateDetectionService.mergeItems...');
      const result = await DuplicateDetectionService.mergeItems(
        itemsToMerge,
        targetUnit,
        targetLocation
      );

      console.log('[useDuplicateHandling] 📊 Merge result:', result);

      if (result.success) {
        console.log('[useDuplicateHandling] ✅ MERGE SUCCESSFUL - Refreshing pantry...');
        setState(prev => ({
          ...prev,
          showMergeDialog: false,
          currentDuplicateGroup: null,
          pendingItemData: null, // Clear pending data
          isMerging: false,
        }));
        
        await onRefreshPantry();
        console.log('[useDuplicateHandling] ✅ Pantry refreshed after merge');
        Alert.alert('Success', 'Items merged successfully');
      } else {
        console.log('[useDuplicateHandling] ❌ MERGE FAILED:', result.error);
        setState(prev => ({ ...prev, isMerging: false }));
        Alert.alert('Error', result.error || 'Failed to merge items');
      }
    } catch (error: any) {
      console.error('[useDuplicateHandling] ❌ MERGE ERROR:', error);
      setState(prev => ({ ...prev, isMerging: false }));
      Alert.alert('Error', error.message || 'Failed to merge items');
    }
  }, [state.currentDuplicateGroup, state.pendingItemData, user?.id, savePendingItem, onRefreshPantry]);

  const handleCancelMerge = useCallback(() => {
    setState(prev => ({
      ...prev,
      showMergeDialog: false,
      currentDuplicateGroup: null,
      pendingItemData: null, // Clear pending data
      isMerging: false,
    }));
  }, []);

  return {
    // State
    isDetecting: state.isDetecting,
    isMerging: state.isMerging,
    
    // Merge Dialog (Primary Interface)
    showMergeDialog: state.showMergeDialog,
    currentDuplicateGroup: state.currentDuplicateGroup,
    
    // Review Modal (Bulk Management)
    showReviewModal: state.showReviewModal,
    allDuplicateGroups: state.allDuplicateGroups,
    
    // Actions
    checkBeforeSave,
    checkForDuplicates,
    
    // Merge Dialog Actions
    handleConfirmMerge,
    handleCancelMerge,
    handleKeepBoth: handleKeepBothFromSuggestion,
    
    // Review Modal Actions
    loadAllDuplicates,
    handleMergeFromReview,
    handleDeleteFromReview,
    handleCloseReview: handleCloseReviewModal,
  };
}; 