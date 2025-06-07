import React from 'react';
import { StyleSheet, View, Text, FlatList, Dimensions } from 'react-native';

const numColumns = 3;
const itemMargin = 1.5;

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  listContainer: {
    padding: itemMargin,
  },
  itemContainer: {
    flex: 1 / numColumns,
    aspectRatio: 1,
    margin: itemMargin,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  itemText: { fontSize: 10, textAlign: 'center' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: { color: '#666' },
});

// TODO: Define the actual structure of a saved item
interface SavedItem {
  id: string;
  // e.g., name: string, imageUrl?: string
}

interface SavedGridProps {
  data: SavedItem[];
}

export const SavedGrid: React.FC<SavedGridProps> = ({ data }) => {
  const renderItem = ({ item }: { item: SavedItem }) => (
    <View style={styles.itemContainer}>
      {/* TODO: Replace with actual content (e.g., Image) */}
      <Text style={styles.itemText}>Saved: {item.id}</Text>
    </View>
  );

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No saved items yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      numColumns={numColumns}
      contentContainerStyle={styles.listContainer}
    />
  );
};

export default SavedGrid;
