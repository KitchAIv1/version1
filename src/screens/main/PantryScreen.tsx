import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { MainStackParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useAccessControl } from '../../hooks/useAccessControl';
import { getShortRelativeTime } from '../../utils/dateUtils';
import ManualAddSheet from '../../components/ManualAddSheet';

// Import NEW aging-related hooks and components
import {
  useStockAging,
  useAgingStatistics,
  useFilteredAgingItems,
  StockAgingItem,
  AgeGroup,
} from '../../hooks/useStockAging';
import {
  useAgingNotifications,
  useUnreadNotificationsCount,
} from '../../hooks/useAgingNotifications';
import { PantryItemWithAging } from '../../components/PantryItemWithAging';
import { AgeFilterTabs } from '../../components/AgeFilterTabs';
import { AgingNotificationsPanel } from '../../components/AgingNotificationsPanel';

// Import RESTORED original hooks and components
import {
  usePantryData,
  usePantryMutations,
  PantryItem,
  groupItemsByStorageLocation,
  StorageLocation,
} from '../../hooks/usePantryData';
import { PantryItemComponent } from '../../components/PantryItemComponent';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import SearchInput from '../../components/SearchInput';
import { StorageLocationTabs } from '../../components/StorageLocationTabs';
import { useStorageLocationPreference } from '../../hooks/useStorageLocationPreference';

// Import "What Can I Cook?" components
import WhatCanICookButton from '../../components/WhatCanICookButton';
import InsufficientItemsModal from '../../components/modals/InsufficientItemsModal';
import { useWhatCanICook } from '../../hooks/useWhatCanICook';

// Import real-time subscription hook
import { useStockRealtime } from '../../hooks/useStockRealtime';

// Navigation type
type PantryNavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Constants - OPTIMIZED: Move outside component to prevent recreation
const ACTIVE_COLOR = '#10b981';
const DEBOUNCE_DELAY = 300;

// OPTIMIZED: Pre-define unit options to prevent recreation
const UNIT_OPTIONS = [
  { label: 'Units', value: 'units' },
  { label: 'Grams', value: 'grams' },
  { label: 'Cups', value: 'cups' },
  { label: 'Milliliters', value: 'ml' },
  { label: 'Liters', value: 'l' },
  { label: 'Kilograms', value: 'kg' },
  { label: 'Ounces', value: 'oz' },
  { label: 'Pounds', value: 'lbs' },
];

// OPTIMIZED: Memoized empty state component
const EmptyState = React.memo(() => (
  <View style={styles.emptyStateContainer}>
    <Ionicons name="archive-outline" size={48} color="#cbd5e1" />
    <Text style={styles.emptyStateTitle}>Your pantry is empty</Text>
    <Text style={styles.emptyStateText}>
      Add ingredients by scanning with camera or adding manually
    </Text>
  </View>
));
EmptyState.displayName = 'EmptyState';

// OPTIMIZED: Memoized loading state component
const LoadingState = React.memo(() => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={ACTIVE_COLOR} />
    <Text style={styles.loadingText}>Loading your pantry...</Text>
  </View>
));
LoadingState.displayName = 'LoadingState';

// OPTIMIZED: Memoized search empty state
const SearchEmptyState = React.memo(() => (
  <View style={styles.emptyStateContainer}>
    <Ionicons name="search-outline" size={48} color="#cbd5e1" />
    <Text style={styles.emptyStateTitle}>No items found</Text>
    <Text style={styles.emptyStateText}>
      Try adjusting your search or filter criteria
    </Text>
  </View>
));
SearchEmptyState.displayName = 'SearchEmptyState';

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
    FREEMIUM_SCAN_LIMIT,
  } = useAccessControl();

  // HYBRID APPROACH: Try aging data first, fallback to regular pantry data
  const {
    data: agingItems = [],
    isLoading: agingLoading,
    error: agingError,
    refetch: refetchAging,
  } = useStockAging(user?.id);

  // OPTIMIZED: Only fetch pantry data if aging data is not available
  const shouldFetchPantryData = useMemo(
    () => agingItems.length === 0 && !agingLoading && !agingError,
    [agingItems.length, agingLoading, agingError],
  );

  const {
    data: pantryItems = [],
    isLoading: pantryLoading,
    error: pantryError,
    refetch: refetchPantry,
  } = usePantryData(shouldFetchPantryData ? user?.id : undefined);

  // OPTIMIZED: Smart data selection with memoization
  const { displayItems, isLoading, fetchError, refetch, hasAgingFeatures } =
    useMemo(() => {
      const hasAging = agingItems.length > 0;
      return {
        displayItems: hasAging ? agingItems : pantryItems,
        isLoading: hasAging ? agingLoading : pantryLoading,
        fetchError: hasAging ? agingError : pantryError,
        refetch: hasAging ? refetchAging : refetchPantry,
        hasAgingFeatures: hasAging,
      };
    }, [
      agingItems,
      pantryItems,
      agingLoading,
      pantryLoading,
      agingError,
      pantryError,
      refetchAging,
      refetchPantry,
    ]);

  // OPTIMIZED: Memoize aging features
  const agingStatistics = useAgingStatistics(agingItems);
  const { notifications = [] } = useAgingNotifications(user?.id);
  
  // Since we don't have is_read functionality, use total count for badge
  const unreadCount = notifications.length;

  // RESTORED: Original pantry functionality - optimized
  const { invalidatePantryCache } = usePantryMutations(user?.id);
  const { lastUsedLocation } = useStorageLocationPreference();

  // REAL-TIME: Set up real-time subscription for stock changes
  useStockRealtime(user?.id);

  // State - OPTIMIZED: Use stable initial values
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeStorageLocation, setActiveStorageLocation] =
    useState<StorageLocation>(lastUsedLocation);
  const [ageFilter, setAgeFilter] = useState<AgeGroup | 'all'>('all');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isManualAddSheetVisible, setIsManualAddSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<
    StockAgingItem | PantryItem | null
  >(null);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

  // OPTIMIZED: Debounced search with proper memoization
  const debouncedSearchQuery = useDebouncedValue(searchQuery, DEBOUNCE_DELAY);

  // OPTIMIZED: Grouped items with dependency optimization
  const groupedItems = useMemo(() => {
    if (hasAgingFeatures) {
      const convertedItems: PantryItem[] = agingItems.map(item => ({
        id: item.id,
        user_id: item.user_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit: item.unit,
        description: item.description,
        created_at: item.created_at,
        updated_at: item.updated_at,
        storage_location:
          (item.storage_location as StorageLocation) || 'cupboard',
      }));
      return groupItemsByStorageLocation(convertedItems);
    }
    return groupItemsByStorageLocation(pantryItems);
  }, [agingItems, pantryItems, hasAgingFeatures]);

  // OPTIMIZED: Item counts with shallow comparison
  const itemCounts = useMemo(
    () => ({
      refrigerator: groupedItems.refrigerator?.length || 0,
      freezer: groupedItems.freezer?.length || 0,
      cupboard: groupedItems.cupboard?.length || 0,
      condiments: groupedItems.condiments?.length || 0,
    }),
    [groupedItems],
  );

  // OPTIMIZED: Filtered items with efficient filtering
  const filteredItems = useMemo(() => {
    const locationItems = groupedItems[activeStorageLocation] || [];

    if (hasAgingFeatures && ageFilter !== 'all') {
      const agingItemsForLocation = agingItems.filter(
        item =>
          ((item.storage_location as StorageLocation) || 'cupboard') ===
          activeStorageLocation,
      );
      const filteredByAge = useFilteredAgingItems(
        agingItemsForLocation,
        ageFilter,
      );

      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase();
        return filteredByAge.filter(item =>
          item.item_name.toLowerCase().includes(query),
        );
      }
      return filteredByAge;
    }

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      return locationItems.filter(item =>
        item.item_name.toLowerCase().includes(query),
      );
    }

    return locationItems;
  }, [
    groupedItems,
    activeStorageLocation,
    hasAgingFeatures,
    ageFilter,
    agingItems,
    debouncedSearchQuery,
  ]);

  // OPTIMIZED: Pantry item count
  const pantryItemCount = displayItems.length;

  // "What Can I Cook?" feature hook - OPTIMIZED: Only load when needed
  const {
    handleWhatCanICookPress,
    handleCloseModal,
    handleNavigateToPantry,
    showInsufficientModal,
  } = useWhatCanICook();

  // OPTIMIZED: Stable animation values
  const scanButtonScale = useRef(new Animated.Value(1)).current;
  const addButtonScale = useRef(new Animated.Value(1)).current;

  // OPTIMIZED: Memoized usage data
  const usageData = useMemo(() => getUsageDisplay(), [getUsageDisplay]);

  // OPTIMIZED: Stable event handlers
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

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

  // OPTIMIZED: Animation helper
  const animateButtonPress = useCallback(
    (animatedValue: Animated.Value, toValue: number) => {
      Animated.spring(animatedValue, {
        toValue,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }).start();
    },
    [],
  );

  const handleScanPress = useCallback(async () => {
    if (!canPerformScan()) {
      setShowUpgradeModal(true);
      return;
    }
    navigation.navigate('PantryScan');
  }, [canPerformScan, navigation]);

  const handleManualAddPress = useCallback(() => {
    setEditingItem(null);
    setIsManualAddSheetVisible(true);
  }, []);

  const handleEditItem = useCallback((item: StockAgingItem | PantryItem) => {
    setEditingItem(item);
    setIsManualAddSheetVisible(true);
  }, []);

  const handleDeleteItem = useCallback(
    (item: StockAgingItem | PantryItem) => {
      Alert.alert(
        'Delete Item',
        `Are you sure you want to delete "${item.item_name}" from your pantry?`,
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

                await refetch();
                Alert.alert('Success', 'Item deleted successfully');
              } catch (error: any) {
                console.error('[PantryScreen] Error deleting item:', error);
                Alert.alert('Error', error.message || 'Failed to delete item');
              }
            },
          },
        ],
      );
    },
    [refetch],
  );

  const handleCloseSheet = useCallback(() => {
    setIsManualAddSheetVisible(false);
    setEditingItem(null);
  }, []);

  const handleToggleNotifications = useCallback(() => {
    setShowNotificationsPanel(prev => !prev);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setShowNotificationsPanel(false);
  }, []);

  const handleViewItemFromNotification = useCallback(
    (itemId: string) => {
      const item = displayItems.find(item => item.id === itemId);
      if (item) {
        setEditingItem(item);
        setIsManualAddSheetVisible(true);
      }
      setShowNotificationsPanel(false);
    },
    [displayItems],
  );

  const handleSaveItemFromSheet = useCallback(
    async (itemData: any) => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (!currentUser?.id) {
          throw new Error('User not authenticated');
        }

        const payload = {
          user_id: currentUser.id,
          item_name: itemData.item_name.toLowerCase(),
          quantity: itemData.quantity,
          unit: itemData.unit,
          description: itemData.description,
          storage_location: itemData.storage_location,
        };

        let result;
        if (editingItem) {
          result = await supabase
            .from('stock')
            .update(payload)
            .eq('id', editingItem.id);
        } else {
          result = await supabase.from('stock').insert(payload);
        }

        if (result.error) throw result.error;

        await refetch();
        handleCloseSheet();

        Alert.alert(
          'Success',
          editingItem ? 'Item updated successfully' : 'Item added successfully',
        );
      } catch (error: any) {
        console.error('[PantryScreen] Error saving item:', error);
        Alert.alert('Error', error.message || 'Failed to save item');
      }
    },
    [editingItem, refetch, handleCloseSheet],
  );

  // OPTIMIZED: Memoized header component with stable dependencies
  const renderPantryHeader = useCallback(
    () => (
      <View style={styles.pantryHeaderContainer}>
        <View style={styles.actionButtonsSection}>
          <View style={styles.heroButtonContainer}>
            <WhatCanICookButton
              pantryItemCount={pantryItemCount}
              onPress={handleWhatCanICookPress}
              style={styles.heroButton}
              variant="primary"
            />
          </View>

          <View style={styles.secondaryActionsContainer}>
            <Pressable
              style={[
                styles.secondaryActionButton,
                styles.scanButton,
                (isProcessing || !canPerformScan()) && styles.disabledButton,
              ]}
              onPress={handleScanPress}
              onPressIn={() =>
                !isProcessing && animateButtonPress(scanButtonScale, 0.95)
              }
              onPressOut={() =>
                !isProcessing && animateButtonPress(scanButtonScale, 1)
              }
              disabled={isProcessing}>
              <Animated.View
                style={[
                  styles.secondaryButtonContent,
                  { transform: [{ scale: scanButtonScale }] },
                ]}>
                <View
                  style={[
                    styles.secondaryButtonIconContainer,
                    styles.scanButtonIconContainer,
                  ]}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
                <View style={styles.secondaryButtonTextContainer}>
                  <Text style={styles.secondaryButtonTitle}>Scan</Text>
                  <Text style={styles.secondaryButtonSubtitle}>
                    {usageData.scanUsage}
                  </Text>
                </View>
              </Animated.View>
            </Pressable>

            <Pressable
              style={[styles.secondaryActionButton, styles.addButton]}
              onPress={handleManualAddPress}
              onPressIn={() => animateButtonPress(addButtonScale, 0.95)}
              onPressOut={() => animateButtonPress(addButtonScale, 1)}>
              <Animated.View
                style={[
                  styles.secondaryButtonContent,
                  { transform: [{ scale: addButtonScale }] },
                ]}>
                <View
                  style={[
                    styles.secondaryButtonIconContainer,
                    styles.addButtonIconContainer,
                  ]}>
                  <Ionicons name="add-circle" size={24} color={ACTIVE_COLOR} />
                </View>
                <View style={styles.secondaryButtonTextContainer}>
                  <Text style={styles.secondaryButtonTitleWhite}>Add</Text>
                  <Text style={styles.secondaryButtonSubtitleWhite}>
                    Manually
                  </Text>
                </View>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [
      pantryItemCount,
      handleWhatCanICookPress,
      isProcessing,
      canPerformScan,
      usageData,
      handleScanPress,
      scanButtonScale,
      handleManualAddPress,
      addButtonScale,
      animateButtonPress,
    ],
  );

  // OPTIMIZED: Render item function with stable dependencies
  const renderPantryItem = useCallback(
    ({ item }: { item: StockAgingItem | PantryItem }) => {
      if (hasAgingFeatures && 'age_group' in item) {
        return (
          <PantryItemWithAging
            item={item as StockAgingItem}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
          />
        );
      }
      return (
        <PantryItemComponent
          item={item as PantryItem}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
        />
      );
    },
    [hasAgingFeatures, handleEditItem, handleDeleteItem],
  );

  // OPTIMIZED: Stable key extractor
  const keyExtractor = useCallback(
    (item: StockAgingItem | PantryItem) => item.id,
    [],
  );

  // OPTIMIZED: Get item layout for better performance (assuming fixed height)
  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: 80, // Approximate item height
      offset: 80 * index,
      index,
    }),
    [],
  );

  // OPTIMIZED: Memoized error state
  const renderErrorState = useCallback(
    () => (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{fetchError?.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    ),
    [fetchError?.message, onRefresh],
  );

  // OPTIMIZED: Memoized list empty component based on state
  const listEmptyComponent = useMemo(() => {
    if (isLoading && displayItems.length === 0) {
      return <LoadingState />;
    }
    if (fetchError) {
      return renderErrorState();
    }
    if (searchQuery || ageFilter !== 'all') {
      return <SearchEmptyState />;
    }
    return <EmptyState />;
  }, [
    isLoading,
    displayItems.length,
    fetchError,
    searchQuery,
    ageFilter,
    renderErrorState,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.fixedGreenHeader}>
        <SafeAreaView edges={['top']} />
      </View>

      <View style={[styles.contentBelowHeader, { paddingTop: insets.top }]}>
        {/* RESTORED: Header Section */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>My Pantry</Text>
            <Text style={styles.headerSubtitle}>
              {pantryItemCount} items •{' '}
              {hasAgingFeatures
                ? `${agingStatistics.red} need attention`
                : 'Smart aging enabled'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {hasAgingFeatures && (
              <TouchableOpacity
                style={[styles.notificationButton, styles.notificationBellHeader]}
                onPress={handleToggleNotifications}
                accessibilityLabel={`Aging alerts, ${unreadCount} unread`}
                accessibilityHint="Open aging notifications panel">
                <Ionicons
                  name={
                    unreadCount > 0 ? 'notifications' : 'notifications-outline'
                  }
                  size={24}
                  color={unreadCount > 0 ? '#ef4444' : '#6b7280'}
                />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{pantryItemCount}</Text>
            </View>
          </View>
        </View>

        {/* Search Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <SearchInput
                onSearchChange={handleSearchChange}
                onClear={handleClearSearch}
                placeholder="Search your pantry..."
              />
            </View>
          </View>
        </View>

        {/* RESTORED: Storage Location Tabs */}
        <StorageLocationTabs
          activeLocation={activeStorageLocation}
          onLocationChange={setActiveStorageLocation}
          itemCounts={itemCounts}
        />

        {hasAgingFeatures && (
          <AgeFilterTabs
            selectedFilter={ageFilter}
            onFilterChange={setAgeFilter}
            statistics={agingStatistics}
          />
        )}

        {!hasAgingFeatures &&
          agingItems.length === 0 &&
          pantryItems.length > 0 && (
            <View style={styles.fallbackModeContainer}>
              <Text style={styles.fallbackModeText}>
                💡 Smart aging features will be available when the backend is
                ready
              </Text>
            </View>
          )}

        <View style={styles.mainContent}>
          <FlatList
            data={filteredItems}
            renderItem={renderPantryItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={renderPantryHeader}
            ListHeaderComponentStyle={styles.listHeader}
            ListEmptyComponent={listEmptyComponent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[ACTIVE_COLOR]}
                tintColor={ACTIVE_COLOR}
              />
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={8}
            updateCellsBatchingPeriod={100}
            getItemLayout={getItemLayout}
            contentContainerStyle={styles.listContentContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
        initialItemData={
          editingItem
            ? {
                id: editingItem.id,
                user_id: editingItem.user_id,
                item_name: editingItem.item_name,
                quantity: editingItem.quantity || 1,
                unit: editingItem.unit || 'units',
                description: editingItem.description || '',
                created_at: editingItem.created_at,
                updated_at: editingItem.updated_at || editingItem.created_at,
                storage_location: (editingItem as any)
                  .storage_location as StorageLocation || 'cupboard',
              }
            : null
        }
        unitOptions={UNIT_OPTIONS}
      />

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgradeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upgrade Required</Text>
              <TouchableOpacity onPress={() => setShowUpgradeModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>
              You've reached your scanning limit. Upgrade to Premium for
              unlimited scans and more features!
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setShowUpgradeModal(false)}>
                <Text style={styles.modalSecondaryButtonText}>Maybe Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                onPress={() => {
                  setShowUpgradeModal(false);
                  // Navigate to subscription/upgrade screen
                }}>
                <Text style={styles.modalPrimaryButtonText}>Upgrade Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Insufficient Items Modal */}
      <InsufficientItemsModal
        visible={showInsufficientModal}
        onClose={handleCloseModal}
        onNavigateToPantry={handleNavigateToPantry}
        currentItemCount={pantryItemCount}
      />

      {hasAgingFeatures && (
        <AgingNotificationsPanel
          isVisible={showNotificationsPanel}
          onClose={handleCloseNotifications}
          onViewItem={handleViewItemFromNotification}
          notifications={notifications}
          unreadCount={unreadCount}
        />
      )}
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
    justifyContent: 'flex-end',
  },
  itemCountBadge: {
    backgroundColor: '#374151',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  itemCountText: {
    fontSize: 14,
    fontWeight: '700',
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
  },
  notificationButton: {
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  notificationBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  listHeader: {
    marginBottom: 0,
  },
  actionButtonsSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  heroButtonContainer: {
    marginBottom: 16,
  },
  heroButton: {
    backgroundColor: ACTIVE_COLOR,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scanButton: {
    backgroundColor: ACTIVE_COLOR,
  },
  addButton: {
    backgroundColor: '#374151',
  },
  secondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonIconContainer: {
    borderRadius: 8,
    padding: 6,
  },
  scanButtonIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  addButtonIconContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  secondaryButtonTextContainer: {
    alignItems: 'center',
  },
  secondaryButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  secondaryButtonTitleWhite: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  secondaryButtonSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  secondaryButtonSubtitleWhite: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
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
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  modalSecondaryButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalSecondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalPrimaryButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  pantryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  safeAreaContent: {
    flex: 1,
  },
  fallbackModeContainer: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  fallbackModeText: {
    fontSize: 13,
    color: '#0c4a6e',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  notificationBellHeader: {
    marginRight: 8,
  },
});
