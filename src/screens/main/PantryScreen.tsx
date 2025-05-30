import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useAccessControl } from '../../hooks/useAccessControl';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { getShortRelativeTime } from '../../utils/dateUtils';
import ManualAddSheet from '../../components/ManualAddSheet';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import optimized hooks and components
import { usePantryData, useRefreshPantryData, usePantryMutations, PantryItem, groupItemsByStorageLocation, StorageLocation } from '../../hooks/usePantryData';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PantryItemComponent } from '../../components/PantryItemComponent';
import SearchInput from '../../components/SearchInput';
import { StorageLocationTabs } from '../../components/StorageLocationTabs';
import { useStorageLocationPreference } from '../../hooks/useStorageLocationPreference';

// Import "What Can I Cook?" components
import WhatCanICookButton from '../../components/WhatCanICookButton';
import InsufficientItemsModal from '../../components/modals/InsufficientItemsModal';
import { useWhatCanICook } from '../../hooks/useWhatCanICook';

// Navigation type
type PantryNavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Constants
const ACTIVE_COLOR = '#10b981'; // Same as ProfileScreen and GroceryListScreen

interface UnitOption {
  label: string;
  value: string;
}

export default function PantryScreen() {
  const navigation = useNavigation<PantryNavigationProp>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { 
    performPantryScan, 
    canPerformScan, 
    isProcessing, 
    getUsageDisplay,
    FREEMIUM_SCAN_LIMIT 
  } = useAccessControl();
  
  // Use optimized React Query hook for data fetching
  const { 
    data: pantryItems = [], 
    isLoading, 
    error: fetchError, 
    refetch 
  } = usePantryData(user?.id);
  
  // Use optimized hooks for cache management
  const refreshPantryData = useRefreshPantryData();
  const { invalidatePantryCache } = usePantryMutations(user?.id);
  
  // Storage location preference hook
  const { lastUsedLocation } = useStorageLocationPreference();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeStorageLocation, setActiveStorageLocation] = useState<StorageLocation>(lastUsedLocation);
  
  // Stable search handler to prevent re-renders
  const handleSearchChange = useCallback((text: string) => {
    console.log('[PantryScreen] Search input changed:', text);
    setSearchQuery(text);
  }, []);
  
  // Stable clear handler
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);
  
  // Debounced search for better performance
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  
  // Add debugging for pantry items count
  useEffect(() => {
    console.log('[PantryScreen] Pantry items loaded:', {
      totalCount: pantryItems.length,
      isLoading,
      hasError: !!fetchError,
      sampleItems: pantryItems.slice(0, 5).map(item => ({
        id: item.id,
        name: item.item_name,
        quantity: item.quantity,
        unit: item.unit
      }))
    });
  }, [pantryItems, isLoading, fetchError]);
  
  // Memoized grouped items by storage location for better performance
  const groupedItems = useMemo(() => {
    console.log('[PantryScreen] Grouping items by storage location:', {
      totalItems: pantryItems.length,
      sampleItems: pantryItems.slice(0, 3).map(item => ({
        name: item.item_name,
        location: item.storage_location || 'cupboard'
      }))
    });
    
    return groupItemsByStorageLocation(pantryItems);
  }, [pantryItems]);

  // Memoized item counts for tabs
  const itemCounts = useMemo(() => {
    const counts = {
      refrigerator: groupedItems.refrigerator.length,
      freezer: groupedItems.freezer.length,
      cupboard: groupedItems.cupboard.length,
      condiments: groupedItems.condiments.length,
    };
    
    console.log('[PantryScreen] Item counts by location:', counts);
    return counts;
  }, [groupedItems]);
  
  // Memoized filtered items for better performance (now supports both storage location and search)
  const filteredItems = useMemo(() => {
    console.log('[PantryScreen] Filtering items:', {
      searchQuery,
      debouncedSearchQuery,
      activeStorageLocation,
      totalItems: pantryItems.length
    });
    
    // Start with items from the active storage location
    const locationItems = groupedItems[activeStorageLocation] || [];
    
    // If no search query, return all items from active location
    if (!debouncedSearchQuery.trim()) {
      console.log('[PantryScreen] No search query, returning location items:', {
        location: activeStorageLocation,
        itemCount: locationItems.length
      });
      return locationItems;
    }
    
    // Apply search filter to location items
    const lowerQuery = debouncedSearchQuery.toLowerCase().trim();
    const filtered = locationItems.filter(item => {
      const itemName = item.item_name.toLowerCase();
      const matches = itemName.includes(lowerQuery);
      if (matches) {
        console.log('[PantryScreen] Item matches search in location:', {
          item: item.item_name,
          location: activeStorageLocation
        });
      }
      return matches;
    });
    
    console.log('[PantryScreen] Filtered results:', {
      query: lowerQuery,
      location: activeStorageLocation,
      locationItems: locationItems.length,
      filteredCount: filtered.length,
      filteredItems: filtered.map(item => item.item_name)
    });
    
    return filtered;
  }, [debouncedSearchQuery, groupedItems, activeStorageLocation]);
  
  // Manual Add Sheet state
  const [isManualAddSheetVisible, setIsManualAddSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  
  // Upgrade Modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Animation values
  const scanButtonScale = useRef(new Animated.Value(1)).current;
  const addButtonScale = useRef(new Animated.Value(1)).current;

  // Memoize usage data to prevent unnecessary recalculations
  const usageData = useMemo(() => getUsageDisplay(), [getUsageDisplay]);

  // Unit options
  const unitOptions: UnitOption[] = [
    { label: 'Units', value: 'units' },
    { label: 'Grams', value: 'grams' },
    { label: 'Cups', value: 'cups' },
    { label: 'Milliliters', value: 'ml' },
    { label: 'Liters', value: 'l' },
    { label: 'Kilograms', value: 'kg' },
    { label: 'Ounces', value: 'oz' },
    { label: 'Pounds', value: 'lbs' }
  ];

  // Legacy fetch function for backward compatibility (now uses React Query internally)
  const fetchPantryData = useCallback(async () => {
    // This now triggers React Query refetch
    await refetch();
  }, [refetch]);

  // Refresh handler - now uses React Query
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error('[PantryScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Animation helper
  const animateButtonPress = (animatedValue: Animated.Value, toValue: number) => {
    Animated.spring(animatedValue, {
      toValue,
      useNativeDriver: true,
      friction: 7,
      tension: 40
    }).start();
  };

  // Camera handlers with access control
  const handleScanPress = async () => {
    // Check access before navigating to scanning screen
    if (!canPerformScan()) {
      setShowUpgradeModal(true);
      return;
    }

    // Navigate to dedicated scanning screen
    navigation.navigate('PantryScan');
  };

  const handleManualAddPress = () => {
    setEditingItem(null);
    setIsManualAddSheetVisible(true);
  };

  // Memoized event handlers for better performance
  const handleEditItem = useCallback((item: PantryItem) => {
    setEditingItem(item);
    setIsManualAddSheetVisible(true);
  }, []);

  const handleDeleteItem = useCallback((item: PantryItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${item.item_name}" from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('stock')
                .delete()
                .eq('id', item.id);
              
              if (error) throw error;
              
              // Invalidate cache to refresh data
              invalidatePantryCache();
            } catch (err: any) {
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  }, [invalidatePantryCache]);

  // Handle manual add sheet submission
  const handleSaveItemFromSheet = async (submittedItem: any) => {
    if (!user?.id) {
      Alert.alert("Error", "User session not found. Cannot save item.");
      return;
    }

    try {
      let result;
      
      if (submittedItem.original_item_name) {
        // Edit mode - include storage_location in update
        const { error: updateError } = await supabase
          .from('stock')
          .update({ 
            item_name: submittedItem.item_name, 
            quantity: submittedItem.quantity, 
            unit: submittedItem.unit,
            description: submittedItem.description,
            storage_location: submittedItem.storage_location || 'cupboard'
          })
          .eq('user_id', user.id)
          .eq('item_name', submittedItem.original_item_name);
        
        if (updateError) throw updateError;
        result = 'updated';
      } else {
        // Add mode - include storage_location in insert
        const { error: insertError } = await supabase
          .from('stock')
          .insert({
            user_id: user.id,
            item_name: submittedItem.item_name,
            quantity: submittedItem.quantity,
            unit: submittedItem.unit,
            description: submittedItem.description,
            storage_location: submittedItem.storage_location || 'cupboard'
          });
        
        if (insertError) throw insertError;
        result = 'added';
      }

      // Close the sheet first for immediate feedback
      setIsManualAddSheetVisible(false);
      setEditingItem(null);
      
      // Immediately invalidate and refetch pantry data
      invalidatePantryCache();
      await refetch();
      
      // Also invalidate feed cache to refresh recipe matches
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      
      // CRITICAL: Invalidate recipe details and pantry match caches
      // This ensures ingredients tabs update immediately
      queryClient.invalidateQueries({ queryKey: ['recipeDetails'] });
      queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
      
      // Show success feedback
      Alert.alert(
        'Success!', 
        `Item ${result} successfully. ${result === 'added' ? 'Checking for recipe matches...' : ''}`,
        [{ text: 'OK', style: 'default' }]
      );
      
    } catch (err: any) {
      console.error('Error saving item:', err);
      Alert.alert('Error', `Failed to save item: ${err.message}`);
    }
  };

  const handleCloseSheet = () => {
    setIsManualAddSheetVisible(false);
    setEditingItem(null);
  };

  // Convert error to string for display
  const error = fetchError ? (fetchError as any).message || 'Failed to load pantry data' : null;

  // "What Can I Cook?" feature hook - moved before memoized components
  const {
    pantryItemCount,
    showInsufficientModal,
    handleWhatCanICookPress,
    handleCloseModal,
    handleNavigateToPantry,
  } = useWhatCanICook();

  // Header component
  const renderPantryHeader = useCallback(() => (
    <View style={styles.pantryHeaderContainer}>
      {/* Action Buttons Section - Award-Winning Design */}
      <View style={styles.actionButtonsSection}>
        {/* Primary Action - What Can I Cook? (Hero Button) */}
        <View style={styles.heroButtonContainer}>
          <WhatCanICookButton
            pantryItemCount={pantryItemCount}
            onPress={handleWhatCanICookPress}
            style={styles.heroButton}
            variant="primary"
          />
        </View>

        {/* Secondary Actions - Scan & Add (Side by Side) */}
        <View style={styles.secondaryActionsContainer}>
          <Pressable
            style={[
              styles.secondaryActionButton, 
              styles.scanButton, 
              (isProcessing || !canPerformScan()) && styles.disabledButton
            ]}
            onPress={handleScanPress}
            onPressIn={() => !(isProcessing) && animateButtonPress(scanButtonScale, 0.95)}
            onPressOut={() => !(isProcessing) && animateButtonPress(scanButtonScale, 1)}
            disabled={isProcessing}
          >
            <Animated.View style={[styles.secondaryButtonContent, { transform: [{ scale: scanButtonScale }] }]}>
              <View style={styles.secondaryButtonIconContainer}>
                {(isProcessing) ? (
                  <ActivityIndicator size={24} color={ACTIVE_COLOR} />
                ) : (
                  <Ionicons 
                    name="camera" 
                    size={24} 
                    color={canPerformScan() ? ACTIVE_COLOR : '#9ca3af'} 
                  />
                )}
              </View>
              <View style={styles.secondaryButtonTextContainer}>
                <Text style={[
                  styles.secondaryButtonTitle, 
                  !canPerformScan() && styles.disabledButtonText
                ]}>
                  {(isProcessing) ? 'Processing...' : 'Scan'}
                </Text>
                <Text style={[
                  styles.secondaryButtonSubtitle, 
                  !canPerformScan() && styles.disabledButtonText
                ]}>
                  Use camera
                </Text>
                {/* Scan Counter Badge */}
                {usageData.showUsage && (
                  <View style={[
                    styles.modernScanBadge, 
                    !canPerformScan() && styles.modernScanBadgeWarning
                  ]}>
                    <Text style={[
                      styles.modernScanBadgeText, 
                      !canPerformScan() && styles.modernScanBadgeTextWarning
                    ]}>
                      {(() => {
                        const [used, total] = usageData.scanUsage.split('/').map(Number);
                        const remaining = total - used;
                        return `${remaining} left`;
                      })()}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </Pressable>

          <Pressable
            style={[styles.secondaryActionButton, styles.addButton]}
            onPress={handleManualAddPress}
            onPressIn={() => animateButtonPress(addButtonScale, 0.95)}
            onPressOut={() => animateButtonPress(addButtonScale, 1)}
          >
            <Animated.View style={[styles.secondaryButtonContent, { transform: [{ scale: addButtonScale }] }]}>
              <View style={[styles.secondaryButtonIconContainer, styles.addButtonIconContainer]}>
                <Ionicons name="add-circle" size={24} color={ACTIVE_COLOR} />
              </View>
              <View style={styles.secondaryButtonTextContainer}>
                <Text style={styles.secondaryButtonTitleWhite}>Add</Text>
                <Text style={styles.secondaryButtonSubtitleWhite}>Manually</Text>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  ), [pantryItemCount, handleWhatCanICookPress, isProcessing, canPerformScan, usageData, handleScanPress, scanButtonScale, handleManualAddPress, addButtonScale]);

  // Optimized render function using memoized component
  const renderPantryItem = useCallback(({ item }: { item: PantryItem }) => {
    return (
      <PantryItemComponent 
        item={item} 
        onEdit={handleEditItem} 
        onDelete={handleDeleteItem} 
      />
    );
  }, [handleEditItem, handleDeleteItem]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: PantryItem) => item.id, []);

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="archive-outline" size={48} color="#cbd5e1" />
      <Text style={styles.emptyStateTitle}>Your pantry is empty</Text>
      <Text style={styles.emptyStateText}>
        Add ingredients by scanning with camera or adding manually
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Fixed Green Header - covers status bar area and stays fixed */}
      <View style={styles.fixedGreenHeader}>
        <SafeAreaView edges={['top']} />
      </View>
      
      {/* Content below green header */}
      <View style={[styles.contentBelowHeader, { marginTop: insets.top }]}>
        {/* Fixed Search Bar - completely isolated from list */}
        <View style={styles.fixedSearchContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.pantryTitle}>My Pantry</Text>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{pantryItems.length}</Text>
            </View>
          </View>
          
          <SearchInput
            placeholder="Search your pantry..."
            onSearchChange={handleSearchChange}
            onClear={handleClearSearch}
          />
        </View>
        
        {/* NEW: Storage Location Tabs */}
        <StorageLocationTabs
          activeLocation={activeStorageLocation}
          onLocationChange={setActiveStorageLocation}
          itemCounts={itemCounts}
        />
        
        {/* Main Content - Now using optimized FlatList */}
        <View style={styles.mainContent}>
          <FlatList
            data={filteredItems}
            renderItem={renderPantryItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={renderPantryHeader}
            ListHeaderComponentStyle={styles.listHeader}
            ListEmptyComponent={
              isLoading && pantryItems.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={ACTIVE_COLOR} />
                  <Text style={styles.loadingText}>Loading your pantry...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                  <Text style={styles.errorTitle}>Something went wrong</Text>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={fetchPantryData}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : searchQuery ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyStateTitle}>No items found</Text>
                  <Text style={styles.emptyStateText}>
                    Try a different search term or add new items to your pantry
                  </Text>
                </View>
              ) : (
                renderEmptyState()
              )
            }
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[ACTIVE_COLOR]}
                tintColor={ACTIVE_COLOR}
              />
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            maxToRenderPerBatch={20}
            windowSize={21}
            initialNumToRender={15}
            updateCellsBatchingPeriod={50}
            getItemLayout={undefined}
            contentContainerStyle={styles.listContentContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            scrollEventThrottle={16}
          />
        </View>
      </View>

      {/* Manual Add/Edit Sheet */}
      <ManualAddSheet 
        isVisible={isManualAddSheetVisible}
        onClose={handleCloseSheet}
        onSubmit={handleSaveItemFromSheet}
        mode={editingItem ? 'edit' : 'add'}
        initialItemData={editingItem}
        unitOptions={unitOptions}
      />

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="camera-outline" size={48} color="#ef4444" />
              <Text style={styles.modalTitle}>Scan Limit Reached!</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              You've used your <Text style={styles.modalHighlight}>3 free pantry scans</Text> this month! 
            </Text>
            
            <Text style={styles.modalSubMessage}>
              Go Premium for unlimited smart scans + AI recipe matching.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowUpgradeModal(false)}
              >
                <Text style={styles.modalCancelText}>Maybe Later</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalUpgradeButton}
                onPress={() => {
                  setShowUpgradeModal(false);
                  navigation.navigate('UpgradeScreen');
                }}
              >
                <Ionicons name="arrow-up-circle" size={20} color="#fff" />
                <Text style={styles.modalUpgradeText}>Upgrade Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* "What Can I Cook?" Insufficient Items Modal */}
      <InsufficientItemsModal
        visible={showInsufficientModal}
        onClose={handleCloseModal}
        onNavigateToPantry={handleNavigateToPantry}
        currentItemCount={pantryItemCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedGreenHeader: {
    backgroundColor: ACTIVE_COLOR,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  contentBelowHeader: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    paddingTop: 0, // No padding needed since search is now above
  },
  scrollContainer: {
    flex: 1,
  },
  pantryHeaderContainer: {
    backgroundColor: '#fff',
  },
  scrollableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scrollableHeaderTitle: {
    color: '#1f2937',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'flex-end',
  },
  itemCountBadge: {
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 4,
  },
  actionButtonsSection: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 16,
  },
  heroButtonContainer: {
    width: '100%',
  },
  heroButton: {
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  secondaryActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryActionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  scanButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  addButton: {
    backgroundColor: ACTIVE_COLOR,
  },
  secondaryButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonTextContainer: {
    alignItems: 'center',
  },
  secondaryButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  secondaryButtonSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
  },
  secondaryButtonTitleWhite: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  secondaryButtonSubtitleWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  list: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalHighlight: {
    fontWeight: 'bold',
    color: '#ef4444',
  },
  modalSubMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalUpgradeButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalUpgradeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  listContentContainer: {
    paddingHorizontal: 16,
  },
  whatCanICookContainer: {
    flex: 1,
    marginRight: 8,
  },
  whatCanICookButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modernScanBadge: {
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'center',
  },
  modernScanBadgeWarning: {
    backgroundColor: '#ef4444',
  },
  modernScanBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  modernScanBadgeTextWarning: {
    color: '#fff',
  },
  addButtonIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  listHeader: {
    paddingHorizontal: 16,
  },
  fixedSearchContainer: {
    backgroundColor: '#fff',
    paddingTop: 20, // Add space below green header
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'column',
    gap: 12,
  },
  pantryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  safeAreaContent: {
    flex: 1,
  },
}); 