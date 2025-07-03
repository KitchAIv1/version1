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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { MainStackParamList, MainTabsParamList } from '../../navigation/types';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useAccessControl } from '../../hooks/useAccessControl';
import { getShortRelativeTime } from '../../utils/dateUtils';
import ManualAddSheet from '../../components/ManualAddSheet';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

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
import SearchInput from '../../components/SearchInput';
import { StorageLocationTabs } from '../../components/StorageLocationTabs';
import { useStorageLocationPreference } from '../../hooks/useStorageLocationPreference';

// Import "What Can I Cook?" components
import WhatCanICookButton from '../../components/WhatCanICookButton';
import InsufficientItemsModal from '../../components/modals/InsufficientItemsModal';
import { LimitReachedModal } from '../../components/modals/LimitReachedModal';
import { useWhatCanICook } from '../../hooks/useWhatCanICook';

// Import real-time subscription hook
import { useStockRealtime } from '../../hooks/useStockRealtime';

// Import NEW duplicate handling system
import { useDuplicateHandling } from '../../hooks/useDuplicateHandling';
import SmartSuggestionBar from '../../components/SmartSuggestionBar';
import ReviewDuplicatesModal from '../../components/ReviewDuplicatesModal';
import MergeDialog from '../../components/MergeDialog';

// Import performance tracking wrapper
import { usePerformanceTracking } from '../../utils/performanceWrapper';
import { LoadingEnhancement, SearchLoadingWrapper } from '../../components/LoadingEnhancement';

// Navigation type
type PantryNavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Constants - OPTIMIZED: Move outside component to prevent recreation
const ACTIVE_COLOR = '#10b981';
const DEBOUNCE_DELAY = 300;

// Unit options for the manual add sheet
const UNIT_OPTIONS = [
  { label: 'Units', value: 'units' },
  { label: 'Grams', value: 'g' },
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
  const route = useRoute<BottomTabScreenProps<MainTabsParamList, 'Pantry'>['route']>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  
  // PERFORMANCE TRACKING: Non-intrusive monitoring wrapper
  const { trackSearch } = usePerformanceTracking('PantryScreen');
  const {
    performPantryScan,
    canPerformScan,
    checkScanAvailability,
    isProcessing,
    getUsageDisplay,
    getScanUsageDisplay,
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
      // Enable aging features if aging data is available OR if there are items to age
      const hasAgingDataAvailable = !agingError && agingItems.length >= 0;
      const hasItemsToAge = pantryItems.length > 0;
      const shouldUseAging = hasAgingDataAvailable && (agingItems.length > 0 || hasItemsToAge);
      
      return {
        displayItems: shouldUseAging ? agingItems : pantryItems,
        isLoading: shouldUseAging ? agingLoading : pantryLoading,
        fetchError: shouldUseAging ? agingError : pantryError,
        refetch: shouldUseAging ? refetchAging : refetchPantry,
        hasAgingFeatures: hasAgingDataAvailable, // Enable if backend works, regardless of item count
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

  // NEW: Duplicate handling system
  const duplicateHandling = useDuplicateHandling(async () => {
    console.log('[PantryScreen] 🔄 Refreshing pantry data after merge...');
    await refetch();

    // QUANTITY TRACKING FIX: Update editingItem with fresh data after merge
    if (editingItem) {
      console.log(
        '[PantryScreen] 🔄 Updating editingItem with fresh data after merge...',
      );

      // Wait a bit for the data to be updated, then fetch fresh item data
      setTimeout(async () => {
        try {
          const { data: freshItemData, error } = await supabase
            .from('stock')
            .select(
              'id, item_name, quantity, unit, description, created_at, updated_at, user_id, storage_location, quantity_added, previous_quantity',
            )
            .eq('id', editingItem.id)
            .single();

          if (error) {
            console.error(
              '[PantryScreen] ❌ Error fetching fresh item data:',
              error,
            );
            return;
          }

          if (freshItemData) {
            console.log(
              '[PantryScreen] ✅ Found fresh item data, updating editingItem:',
              {
                itemName: freshItemData.item_name,
                oldQuantity: editingItem.quantity,
                newQuantity: freshItemData.quantity,
                quantityAdded: freshItemData.quantity_added,
                previousQuantity: freshItemData.previous_quantity,
              },
            );
            setEditingItem(freshItemData);
          }
        } catch (error) {
          console.error('[PantryScreen] ❌ Error updating editingItem:', error);
        }
      }, 500); // Wait 500ms for the cache to be updated
    }
  });

  // State - OPTIMIZED: Use stable initial values
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeStorageLocation, setActiveStorageLocation] =
    useState<StorageLocation>(lastUsedLocation);
  const [ageFilter, setAgeFilter] = useState<AgeGroup | 'all'>('all');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [isManualAddSheetVisible, setIsManualAddSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<
    StockAgingItem | PantryItem | null
  >(null);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

  // Handle route parameters to trigger manual add modal
  useEffect(() => {
    if (route.params?.showManualAdd) {
      setIsManualAddSheetVisible(true);
      // Clear the parameter to prevent reopening on re-renders
      navigation.setParams({ showManualAdd: undefined });
    }
  }, [route.params?.showManualAdd, navigation]);

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
        // Include quantity tracking fields for mixed batches detection
        quantity_added: item.quantity_added,
        previous_quantity: item.previous_quantity,
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

  // OPTIMIZED: Filtered items with efficient filtering + performance tracking
  const filteredItems = useMemo(() => {
    const startTime = Date.now(); // PERFORMANCE: Track search time
    const locationItems = groupedItems[activeStorageLocation] || [];
    let results: (StockAgingItem | PantryItem)[];

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
        results = filteredByAge.filter(item =>
          item.item_name.toLowerCase().includes(query),
        );
      } else {
        results = filteredByAge;
      }
    } else if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      results = locationItems.filter(item =>
        item.item_name.toLowerCase().includes(query),
      );
    } else {
      results = locationItems;
    }

    // PERFORMANCE: Track search performance (non-intrusive)
    if (debouncedSearchQuery.trim()) {
      trackSearch(debouncedSearchQuery, results.length, startTime);
    }

    return results;
  }, [
    groupedItems,
    activeStorageLocation,
    hasAgingFeatures,
    ageFilter,
    agingItems,
    debouncedSearchQuery,
    trackSearch, // PERFORMANCE: Add to dependencies
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
  
  // State for real scan usage display
  const [scanUsageText, setScanUsageText] = useState('Loading...');

  // Refresh scan usage function
  const refreshScanUsage = useCallback(async () => {
    console.log('[PantryScreen] refreshScanUsage called');
    try {
      console.log('[PantryScreen] Calling getScanUsageDisplay...');
      const usage = await getScanUsageDisplay();
      console.log('[PantryScreen] Got usage result:', usage);
      setScanUsageText(usage);
    } catch (error) {
      console.error('[PantryScreen] Error refreshing scan usage:', error);
      setScanUsageText('Error');
    }
  }, [getScanUsageDisplay]);

  // Fetch real scan usage on mount and when screen focuses
  useEffect(() => {
    refreshScanUsage();
  }, [refreshScanUsage]);

  // Refresh scan usage when screen gains focus (user returns from scanning)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshScanUsage);
    return unsubscribe;
  }, [navigation, refreshScanUsage]);

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
    console.log('[PantryScreen] handleScanPress called - checking scan availability...');
    
    const scanCheck = await checkScanAvailability();
    console.log('[PantryScreen] Scan availability check result:', scanCheck);
    
    if (!scanCheck.canScan || scanCheck.limitReached) {
      console.log('[PantryScreen] Scan limit reached - showing limit modal');
      setShowLimitModal(true);
      return;
    }
    
    console.log('[PantryScreen] Scan allowed - navigating to camera');
    navigation.navigate('PantryScan');
  }, [checkScanAvailability, navigation]);

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
        // NEW: For new items, check for duplicates BEFORE saving
        if (!editingItem) {
          console.log(
            '[PantryScreen] 🔍 Checking for duplicates before save...',
          );

          // Close the manual add sheet first
          setIsManualAddSheetVisible(false);

          const hasDuplicates =
            await duplicateHandling.checkBeforeSave(itemData);

          if (hasDuplicates) {
            console.log(
              '[PantryScreen] ⚠️ Duplicates found - merge modal will appear',
            );
            // Don't save yet, let user decide what to do via the merge modal
            // The merge modal will be shown by the duplicate handling hook
            return;
          }

          console.log(
            '[PantryScreen] ✅ No duplicates found - proceeding with save',
          );
        }

        // For editing existing items OR no duplicates found, proceed with normal save
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (!currentUser?.id) {
          throw new Error('User not authenticated');
        }

        const payload = {
          user_id: currentUser.id,
          item_name: itemData.item_name.trim().toLowerCase(),
          quantity: itemData.quantity,
          unit: itemData.unit,
          description: itemData.description,
          storage_location: itemData.storage_location || 'cupboard',
        };

        if (editingItem) {
          // Update existing item
          const { error } = await supabase
            .from('stock')
            .update(payload)
            .eq('id', editingItem.id);

          if (error) throw error;
          console.log('[PantryScreen] ✅ Item updated successfully');
        } else {
          // Add new item
          const { error } = await supabase.from('stock').insert([payload]);
          if (error) throw error;
          console.log('[PantryScreen] ✅ Item added successfully');
        }

        // Refresh data and close sheet
        await refetch();
        setIsManualAddSheetVisible(false);
        setEditingItem(null);

        // Show success message
        Alert.alert(
          'Success',
          editingItem ? 'Item updated successfully' : 'Item added successfully',
        );
      } catch (error: any) {
        console.error('[PantryScreen] Error saving item:', error);
        Alert.alert('Error', error.message || 'Failed to save item');
      }
    },
    [editingItem, duplicateHandling, refetch],
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
                    {scanUsageText}
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
      scanUsageText,
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
                style={[
                  styles.notificationButton,
                  styles.notificationBellHeader,
                ]}
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
          <LoadingEnhancement
            isLoading={isLoading && displayItems.length === 0}
            loadingText="Loading your pantry..."
            skeletonCount={6}
            showProgress={true}>
            <SearchLoadingWrapper isSearching={searchQuery !== debouncedSearchQuery}>
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
            </SearchLoadingWrapper>
          </LoadingEnhancement>
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
                storage_location:
                  ((editingItem as any).storage_location as StorageLocation) ||
                  'cupboard',
              }
            : null
        }
        unitOptions={UNIT_OPTIONS}
        onDelete={handleDeleteItem}
      />

      {/* Scan Limit Reached Modal */}
      <LimitReachedModal
        visible={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="scan"
        onUpgradeSuccess={() => {
          setShowLimitModal(false);
          // Refresh scan usage after upgrade
          refreshScanUsage();
        }}
        username={user?.user_metadata?.username || 'Chef'}
      />

      {/* Insufficient Items Modal */}
      <InsufficientItemsModal
        visible={showInsufficientModal}
        onClose={handleCloseModal}
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

      {/* Duplicate Handling Components */}
      <MergeDialog
        isVisible={duplicateHandling.showMergeDialog}
        duplicateGroup={duplicateHandling.currentDuplicateGroup}
        onConfirm={duplicateHandling.handleConfirmMerge}
        onCancel={duplicateHandling.handleCancelMerge}
        onKeepBoth={duplicateHandling.handleKeepBoth}
        isLoading={duplicateHandling.isMerging}
      />

      <ReviewDuplicatesModal
        isVisible={duplicateHandling.showReviewModal}
        duplicateGroups={duplicateHandling.allDuplicateGroups}
        onMergeItems={duplicateHandling.handleMergeFromReview}
        onEditItem={() => {}} // TODO: Implement if needed
        onDeleteItem={duplicateHandling.handleDeleteFromReview}
        onClose={duplicateHandling.handleCloseReview}
        onRefresh={duplicateHandling.loadAllDuplicates}
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
