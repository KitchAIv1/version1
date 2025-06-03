import React from 'react';
import { StyleSheet, View, Text, FlatList } from 'react-native';

// TODO: Define the actual structure of an activity item
interface ActivityItem {
  id: string;
  text: string;
  timestamp?: string;
  // e.g., type: 'like' | 'comment', postId?: string
}

interface ActivityListProps {
  data: ActivityItem[];
}

// Separator component function
function ItemSeparator() {
  return <View style={styles.separator} />;
}

export const ActivityList: React.FC<ActivityListProps> = ({ data }) => {
  const renderItem = ({ item }: { item: ActivityItem }) => (
    <View style={styles.itemContainer}>
      {/* TODO: Replace with actual content (e.g., Icon, formatted text) */}
      <Text style={styles.itemText}>{item.text || `Activity: ${item.id}`}</Text>
      {item.timestamp && (
        <Text style={styles.timestamp}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      )}
    </View>
  );

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No recent activity.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContainer}
      ItemSeparatorComponent={ItemSeparator}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: 8,
  },
  itemContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
  },
  itemText: { fontSize: 14, color: '#333' },
  timestamp: { fontSize: 10, color: '#888', marginTop: 4 },
  separator: { height: 1, backgroundColor: '#eee' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: { color: '#666' },
});

export default ActivityList;
