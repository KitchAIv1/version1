import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { StockItem } from '../../hooks/useStockManager';
import {
  formatStockTimestamp,
  getShortRelativeTime,
} from '../../utils/dateUtils';
import { getIconForPantryItem } from '../../utils/iconMapping';

interface StockListProps {
  data: StockItem[];
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const StockList: React.FC<StockListProps> = ({
  data,
  onEdit,
  onDelete,
  isLoading,
  error,
  onRefresh,
  isRefreshing = false,
}) => {
  const renderItem = ({ item }: { item: StockItem }) => {
    const lastUpdated = formatStockTimestamp(item.created_at);
    const shortTime = getShortRelativeTime(item.created_at);
    const iconName = getIconForPantryItem(item.item_name);

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => onEdit(item)}
        activeOpacity={0.7}>
        <View style={styles.itemIconContainer}>
          <Icon name={iconName} size={20} color="#4CAF50" />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>
              {item.item_name.charAt(0).toUpperCase() + item.item_name.slice(1)}
            </Text>
            {shortTime && <Text style={styles.timeChip}>{shortTime}</Text>}
          </View>
          <View style={styles.itemDetailsRow}>
            <View style={styles.quantityChip}>
              <Text style={styles.quantityChipText}>
                {`${item.quantity} ${item.unit || ''}`.trim()}
              </Text>
            </View>
            {lastUpdated && (
              <View style={styles.timestampContainer}>
                <Icon name="time-outline" size={12} color="#999" />
                <Text style={styles.timestampText}>{lastUpdated}</Text>
              </View>
            )}
          </View>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            onPress={() => onEdit(item)}
            style={styles.actionButton}>
            <Icon name="create-outline" size={22} color="#757575" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(item)}
            style={styles.actionButton}>
            <Icon name="trash-outline" size={24} color="#F44336" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && !data.length && !isRefreshing) {
    return (
      <View style={styles.centeredMessageContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading stock...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Icon name="alert-circle-outline" size={48} color="#F44336" />
        <Text style={styles.errorTitle}>Oops! Something went wrong.</Text>
        <Text style={styles.errorText}>{error}</Text>
        {onRefresh && (
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!data.length) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Icon name="restaurant-outline" size={48} color="#9E9E9E" />
        <Text style={styles.emptyTitle}>Pantry is Empty</Text>
        <Text style={styles.emptyText}>
          Tap "Scan Pantry" or "Add Manually" to add your first item.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={item => item.id?.toString() || item.item_name}
      style={styles.list}
      contentContainerStyle={styles.listContentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#22c55e']}
            tintColor="#22c55e"
          />
        ) : undefined
      }
      removeClippedSubviews
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={15}
      windowSize={10}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Light background for the list area
  },
  listContentContainer: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemIconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginRight: 6,
  },
  timeChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  itemDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  quantityChip: {
    backgroundColor: '#e0e0e0', // Neutral chip background
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  quantityChipText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  itemDescription: {
    fontSize: 13,
    color: '#777',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#D32F2F',
    marginTop: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#424242',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#424242',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 22,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  timestampText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 2,
  },
});

export default StockList;
