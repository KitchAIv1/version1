import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Optimized imports
import { useAuth } from '../../providers/AuthProvider';
import { useOptimizedSearch } from '../../hooks/useDebouncedValue';
import {
  useScreenLoadTracking,
  useSearchPerformanceTracking,
} from '../../hooks/usePerformanceMonitoring';
import { PantryItemSkeleton } from '../../components/skeletons';
import { OptimizedFlatList } from '../../components/optimized/OptimizedFlatList';
import { useStockRealtime } from '../../hooks/useStockRealtime';
import { usePantryData, PantryItem } from '../../hooks/usePantryData';
import { getIconForPantryItem } from '../../utils/iconMapping';

type StorageLocation = 'refrigerator' | 'freezer' | 'cupboard' | 'condiments';

// Constants - moved outside component to prevent recreation
const ACTIVE_COLOR = '#10b981';
const STORAGE_LOCATIONS: StorageLocation[] = [
  'refrigerator',
  'freezer',
  'cupboard',
  'condiments',
];

// Memoized components
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

const SearchEmptyState = React.memo(() => (
  <View style={styles.emptyStateContainer}>
    <Ionicons name="search-outline" size={48} color="#cbd5e1" />
    <Text style={styles.emptyStateTitle}>No items found</Text>
    <Text style={styles.emptyStateText}>
      Try adjusting your search criteria
    </Text>
  </View>
));
SearchEmptyState.displayName = 'SearchEmptyState';

// Optimized PantryItem component
const OptimizedPantryItem = React.memo<{
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (id: string) => void;
}>(({ item, onEdit, onDelete }) => {
  const handleEdit = useCallback(() => onEdit(item), [item, onEdit]);
  const handleDelete = useCallback(
    () => onDelete(item.id),
    [item.id, onDelete],
  );

  const iconName = useMemo(
    () => getIconForPantryItem(item.item_name),
    [item.item_name],
  );

  const itemStyle = useMemo(
    () => ({
      ...styles.itemContainer,
      opacity: item.quantity === 0 ? 0.6 : 1,
    }),
    [item.quantity],
  );

  return (
    <TouchableOpacity
      style={itemStyle}
      onPress={handleEdit}
      activeOpacity={0.7}>
      <View style={styles.itemIcon}>
        <Ionicons name={iconName as any} size={24} color={ACTIVE_COLOR} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.item_name}
        </Text>
        <Text style={styles.itemDetails} numberOfLines={1}>
          {item.quantity} {item.unit}
        </Text>
      </View>
      <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});
OptimizedPantryItem.displayName = 'OptimizedPantryItem';

// Optimized Header component
const PantryHeader = React.memo<{
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching: boolean;
  activeLocation: StorageLocation;
  onLocationChange: (location: StorageLocation) => void;
  itemCounts: Record<StorageLocation, number>;
}>(
  ({
    searchQuery,
    onSearchChange,
    isSearching,
    activeLocation,
    onLocationChange,
    itemCounts,
  }) => {
    const renderLocationTab = useCallback(
      (location: StorageLocation) => {
        const isActive = location === activeLocation;
        const count = itemCounts[location] || 0;

        return (
          <TouchableOpacity
            key={location}
            style={[styles.locationTab, isActive && styles.activeLocationTab]}
            onPress={() => onLocationChange(location)}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.locationTabText,
                isActive && styles.activeLocationTabText,
              ]}>
              {location.charAt(0).toUpperCase() + location.slice(1)}
            </Text>
            {count > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      },
      [activeLocation, onLocationChange, itemCounts],
    );

    return (
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pantry items..."
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholderTextColor="#9ca3af"
          />
          {isSearching && (
            <ActivityIndicator size="small" color={ACTIVE_COLOR} />
          )}
        </View>

        <View style={styles.locationTabs}>
          {STORAGE_LOCATIONS.map(renderLocationTab)}
        </View>
      </View>
    );
  },
);
PantryHeader.displayName = 'PantryHeader';

export const PantryScreenOptimized = React.memo(() => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Performance tracking
  useScreenLoadTracking('PantryScreen');
  const { startSearch, endSearch } = useSearchPerformanceTracking();

  // Real-time updates
  useStockRealtime(user?.id);

  // Optimized data fetching
  const {
    data: pantryItems = [],
    isLoading,
    error,
    refetch,
  } = usePantryData(user?.id);

  // State
  const [activeStorageLocation, setActiveStorageLocation] =
    useState<StorageLocation>('cupboard');
  const [refreshing, setRefreshing] = useState(false);

  // Optimized search with performance tracking
  const {
    searchQuery,
    setSearchQuery,
    filteredItems,
    isSearching,
    resultCount,
  } = useOptimizedSearch(pantryItems, 'item_name', 150);

  // Track search performance
  const handleSearchChange = useCallback(
    (query: string) => {
      if (query.length > 0 && searchQuery.length === 0) {
        startSearch();
      }
      setSearchQuery(query);

      if (query.length === 0 || (query.length > 2 && !isSearching)) {
        endSearch(query, resultCount);
      }
    },
    [
      searchQuery,
      setSearchQuery,
      startSearch,
      endSearch,
      isSearching,
      resultCount,
    ],
  );

  // Memoized grouped items
  const groupedItems = useMemo(() => {
    const groups: Record<StorageLocation, PantryItem[]> = {
      refrigerator: [],
      freezer: [],
      cupboard: [],
      condiments: [],
    };

    filteredItems.forEach(item => {
      const location = (item.storage_location as StorageLocation) || 'cupboard';
      if (groups[location]) {
        groups[location].push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  // Memoized item counts
  const itemCounts = useMemo(
    () => ({
      refrigerator: groupedItems.refrigerator.length,
      freezer: groupedItems.freezer.length,
      cupboard: groupedItems.cupboard.length,
      condiments: groupedItems.condiments.length,
    }),
    [groupedItems],
  );

  // Current location items
  const currentLocationItems = useMemo(
    () => groupedItems[activeStorageLocation] || [],
    [groupedItems, activeStorageLocation],
  );

  // Optimized handlers
  const handleEditItem = useCallback((item: PantryItem) => {
    // Navigate to edit screen
    console.log('Edit item:', item.item_name);
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    // Delete item logic
    console.log('Delete item:', id);
  }, []);

  const handleScanPress = useCallback(() => {
    navigation.navigate('PantryScan' as never);
  }, [navigation]);

  const handleAddPress = useCallback(() => {
    // Open add modal
    console.log('Add new item');
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

  // Optimized render item
  const renderPantryItem = useCallback(
    ({ item }: { item: PantryItem }) => (
      <OptimizedPantryItem
        item={item}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
      />
    ),
    [handleEditItem, handleDeleteItem],
  );

  // Loading state with skeleton
  if (isLoading && pantryItems.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonSearchBar} />
          <View style={styles.skeletonTabs} />
        </View>
        <View style={styles.content}>
          {Array(6)
            .fill(null)
            .map((_, index) => (
              <PantryItemSkeleton key={`skeleton-${index}`} />
            ))}
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <PantryHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        isSearching={isSearching}
        activeLocation={activeStorageLocation}
        onLocationChange={setActiveStorageLocation}
        itemCounts={itemCounts}
      />

      <View style={styles.content}>
        <OptimizedFlatList
          data={currentLocationItems}
          renderItem={renderPantryItem}
          keyExtractor={item => item.id}
          itemHeight={80}
          ListEmptyComponent={
            searchQuery ? <SearchEmptyState /> : <EmptyState />
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
        />
      </View>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={handleAddPress}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.scanFab]}
          onPress={handleScanPress}>
          <Ionicons name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
});

PantryScreenOptimized.displayName = 'PantryScreenOptimized';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#374151',
  },
  locationTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  locationTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  activeLocationTab: {
    backgroundColor: ACTIVE_COLOR,
  },
  locationTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeLocationTabText: {
    color: '#fff',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  deleteButton: {
    padding: 8,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skeletonHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  skeletonSearchBar: {
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'column',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACTIVE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scanFab: {
    backgroundColor: '#3b82f6',
  },
});

export default PantryScreenOptimized;
