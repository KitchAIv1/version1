import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../navigation/types';
import { ActivityItem } from '../hooks/useUserActivityFeed';
import { COLORS } from '../constants/theme';

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  listContainer: {
    backgroundColor: '#ffffff',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 20,
  },
  activityTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  recipeThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 12,
    textAlign: 'center',
  },
  errorSubText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

interface ActivityFeedProps {
  data: ActivityItem[] | null;
  isLoading: boolean;
  error: string | null;
}

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  data,
  isLoading,
  error,
}) => {
  const navigation = useNavigation<NavigationProp>();

  // Helper function to get relative time
  const getRelativeTime = (timestamp: string): string => {
    try {
      const now = new Date();
      const activityTime = new Date(timestamp);

      // Check if date is valid
      if (isNaN(activityTime.getTime())) {
        console.warn('[ActivityFeed] Invalid timestamp:', timestamp);
        return 'Recently';
      }

      const diffInMs = now.getTime() - activityTime.getTime();
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m`;
      }
      if (diffInHours < 24) {
        return `${diffInHours}h`;
      }
      if (diffInDays < 7) {
        return `${diffInDays}d`;
      }
      return activityTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error(
        '[ActivityFeed] Error parsing timestamp:',
        timestamp,
        error,
      );
      return 'Recently';
    }
  };

  // Helper function to get activity icon
  const getActivityIcon = (activityType: string): string => {
    switch (activityType) {
      case 'saved_recipe':
        return 'bookmark';
      case 'planned_meal':
        return 'add-circle';
      case 'generated_recipe':
        return 'sparkles';
      case 'added_to_grocery':
        return 'checkmark-circle';
      case 'cooked_recipe':
        return 'checkmark-circle';
      case 'manual_pantry_add':
        return 'cube';
      case 'successful_scan':
        return 'scan';
      case 'pantry_update':
        return 'refresh';
      default:
        return 'information-circle';
    }
  };

  // Helper function to get activity color
  const getActivityColor = (activityType: string): string => {
    switch (activityType) {
      case 'saved_recipe':
        return COLORS.primary || '#10b981';
      case 'planned_meal':
        return COLORS.primary || '#10b981';
      case 'generated_recipe':
        return '#f59e0b';
      case 'added_to_grocery':
        return COLORS.primary || '#10b981';
      case 'cooked_recipe':
        return '#10b981';
      case 'manual_pantry_add':
        return '#8b5cf6';
      case 'successful_scan':
        return '#06b6d4';
      case 'pantry_update':
        return '#f97316';
      default:
        return '#6b7280';
    }
  };

  // Helper function to get activity description
  const getActivityDescription = (item: ActivityItem): string => {
    const { activity_type, metadata } = item;

    switch (activity_type) {
      case 'saved_recipe':
        return `You saved a recipe: ${metadata?.recipe_title || metadata?.recipe_name || 'Unknown Recipe'}`;
      case 'planned_meal':
        const slot = metadata?.slot || metadata?.meal_slot;
        const planDate = metadata?.plan_date || metadata?.meal_date;
        let description = `You added a recipe to your planner: ${metadata?.recipe_title || metadata?.recipe_name || 'Unknown Recipe'}`;
        if (slot) {
          description += ` (${slot})`;
        }
        return description;
      case 'generated_recipe':
        return `You generated a new recipe: ${metadata?.recipe_title || metadata?.recipe_name || 'AI Generated Recipe'}`;
      case 'added_to_grocery':
        return `You added "${metadata?.grocery_item || metadata?.item_name || 'Unknown Item'}" to your grocery list`;
      case 'cooked_recipe':
        return `You cooked: ${metadata?.recipe_title || metadata?.recipe_name || 'Unknown Recipe'}`;
      case 'manual_pantry_add':
        const groupedActivitiesManual = metadata?.grouped_activities;
        const totalItemsManual = metadata?.total_items;
        const itemNamesManual = metadata?.item_names;

        // Handle grouped manual pantry activities
        if (groupedActivitiesManual && totalItemsManual > 1) {
          if (itemNamesManual && itemNamesManual.length > 0) {
            const displayNames = itemNamesManual.slice(0, 3);
            if (totalItemsManual <= 3) {
              return `You added ${displayNames.join(', ')} to your pantry`;
            }
            return `You added ${displayNames.join(', ')} and ${totalItemsManual - 3} more items to your pantry`;
          }
          return `You added ${totalItemsManual} items to your pantry`;
        }

        // Handle single manual add (existing logic)
        return `You added "${metadata?.item_name || 'Unknown Item'}" to your pantry`;
      case 'successful_scan':
        const itemsCount = metadata?.items_count;
        const scanType = metadata?.scan_type;
        const scannedItems = metadata?.scanned_items || metadata?.items;
        const groupedActivities = metadata?.grouped_activities;
        const totalItems = metadata?.total_items;
        const itemNames = metadata?.item_names;

        // Handle grouped scanning activities
        if (groupedActivities && totalItems > 1) {
          if (itemNames && itemNames.length > 0) {
            const displayNames = itemNames.slice(0, 3);
            if (totalItems <= 3) {
              return `You added ${displayNames.join(', ')} to your pantry`;
            }
            return `You added ${displayNames.join(', ')} and ${totalItems - 3} more items to your pantry`;
          }
          return `You added ${totalItems} items to your pantry`;
        }

        // Handle single scanning activity (existing logic)
        let scanDescription = '';
        if (
          scannedItems &&
          Array.isArray(scannedItems) &&
          scannedItems.length > 0
        ) {
          const itemNames = scannedItems
            .slice(0, 3)
            .map(item =>
              typeof item === 'string'
                ? item
                : item?.name || item?.item_name || 'Unknown',
            );
          if (scannedItems.length <= 3) {
            scanDescription = `You scanned: ${itemNames.join(', ')}`;
          } else {
            scanDescription = `You scanned: ${itemNames.join(', ')} and ${scannedItems.length - 3} more items`;
          }
        } else if (itemsCount && itemsCount > 1) {
          scanDescription = `You scanned ${itemsCount} pantry items`;
        } else {
          scanDescription = `You successfully scanned pantry items`;
        }

        // Add scan type if available
        if (scanType) {
          scanDescription += ` via ${scanType}`;
        }

        return scanDescription;
      case 'pantry_update':
        const itemName = metadata?.item_name || 'Unknown Item';
        const newQty = metadata?.new_quantity;
        const oldQty = metadata?.old_quantity;
        if (newQty !== undefined) {
          return `You updated "${itemName}" quantity${oldQty !== undefined ? ` from ${oldQty} to ${newQty}` : ` to ${newQty}`}`;
        }
        return `You updated "${itemName}" in your pantry`;
      default:
        console.warn('[ActivityFeed] Unknown activity type:', activity_type);
        return `Unknown activity: ${activity_type}`;
    }
  };

  // Handle activity item press
  const handleActivityPress = (item: ActivityItem) => {
    const recipeId = item.metadata?.recipe_id || item.metadata?.recipe_id;
    if (
      recipeId &&
      (item.activity_type === 'saved_recipe' ||
        item.activity_type === 'planned_meal' ||
        item.activity_type === 'generated_recipe' ||
        item.activity_type === 'cooked_recipe')
    ) {
      navigation.navigate('RecipeDetail', { id: recipeId });
    }
  };

  const renderActivityItem = ({ item }: { item: ActivityItem }) => {
    const icon = getActivityIcon(item.activity_type);
    const description = getActivityDescription(item);
    const relativeTime = getRelativeTime(item.created_at);
    const recipeId = item.metadata?.recipe_id || item.metadata?.recipe_id;
    const isClickable =
      [
        'saved_recipe',
        'planned_meal',
        'generated_recipe',
        'cooked_recipe',
      ].includes(item.activity_type) &&
      (item.metadata?.recipe_id ||
        item.metadata?.recipe_title ||
        item.metadata?.recipe_name);

    const content = (
      <View style={styles.activityItem}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${getActivityColor(item.activity_type)}15` },
          ]}>
          <Ionicons
            name={icon as any}
            size={20}
            color={getActivityColor(item.activity_type)}
          />
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityDescription}>{description}</Text>
          <Text style={styles.activityTime}>{relativeTime}</Text>
        </View>
        {(item.metadata?.recipe_thumbnail || item.metadata?.thumbnail_url) && (
          <Image
            source={{
              uri:
                item.metadata.recipe_thumbnail || item.metadata.thumbnail_url,
            }}
            style={styles.recipeThumbnail}
          />
        )}
      </View>
    );

    if (isClickable) {
      return (
        <TouchableOpacity onPress={() => handleActivityPress(item)}>
          {content}
        </TouchableOpacity>
      );
    }

    return content;
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary || '#10b981'} />
        <Text style={styles.loadingText}>Loading your activity...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load activity</Text>
        <Text style={styles.errorSubText}>{error}</Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="time-outline" size={48} color="#9ca3af" />
        <Text style={styles.emptyText}>No recent activity</Text>
        <Text style={styles.emptySubText}>
          Your cooking activities will appear here as you use the app.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer}>
      {data.map((item, index) => {
        // Always generate a unique key with index to avoid backend ID duplicates
        const uniqueKey = `activity-${index}-${item.activity_type}-${item.created_at?.replace(/[:.]/g, '')}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('[ActivityFeed] Generated key:', uniqueKey);
        console.log('[ActivityFeed] Item details:', {
          id: item.id,
          activity_type: item.activity_type,
          created_at: item.created_at,
          index,
        });
        return <View key={uniqueKey}>{renderActivityItem({ item })}</View>;
      })}
    </View>
  );
};

export default ActivityFeed;
