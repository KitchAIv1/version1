import React from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { usePantry, PantryItem } from '../../hooks/usePantry';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainStackParamList } from '../../navigation/types';

type MyStockScreenNavigationProp = NavigationProp<MainStackParamList>;

export default function MyStockScreen() {
  const { data = [], isLoading, error, remove } = usePantry();
  const nav = useNavigation<MyStockScreenNavigationProp>();

  const handleRemoveItem = (id: string, itemName: string) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to remove ${itemName} from your pantry?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", onPress: () => remove.mutate(id), style: "destructive" },
      ]
    );
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    // It's good practice to check if error is an instance of Error
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return <View style={styles.centered}><Text style={styles.errorText}>Error loading pantry: {errorMessage}</Text></View>;
  }

  const renderEmpty = () => (
    <View style={styles.centeredEmptyList}>
      <Feather name="archive" size={40} color="#cbd5e1" />
      <Text style={styles.emptyText}>Your pantry is empty.</Text>
      <Text style={styles.emptySubText}>Scan items using the camera button.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={data as PantryItem[]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemName}>{item.item_name}</Text>
            </View>
            <Text style={styles.itemQty}>×{item.qty}</Text>
            <TouchableOpacity onPress={() => handleRemoveItem(item.id, item.item_name)} style={styles.trashButton}>
              <Feather name="trash-2" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={renderEmpty}
        // Apply different container styles based on whether the list is empty
        contentContainerStyle={data.length === 0 ? styles.emptyListContainer : styles.listContainer}
      />

      {/* FAB (Floating Action Button) */}
      <TouchableOpacity
        // Ensure 'PantryScan' is a valid route name in MainStackParamList
        onPress={() => nav.navigate('PantryScan')} 
        style={styles.fab}
        activeOpacity={0.8}
      >
        <Feather name="camera" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  centeredEmptyList: { 
    flexGrow: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center'
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    color: '#4b5563',
    fontWeight: '600',
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 80, // Space for FAB
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 16,
    color: '#1f2937',
  },
  itemQty: {
    fontSize: 15,
    color: '#6b7280',
    marginRight: 16,
  },
  trashButton: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#22c55e', 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
}); 