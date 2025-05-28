import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';

type IngredientSelectionScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList,
  'IngredientSelection'
>;
type IngredientSelectionScreenRouteProp = RouteProp<
  MainStackParamList,
  'IngredientSelection'
>;

interface PantryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    textAlign: 'center',
    marginBottom: 20,
  },
  itemsList: {
    flex: 1,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#6b7280',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  continueButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#f3f4f6',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  requirementText: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default function IngredientSelectionScreen() {
  const navigation = useNavigation<IngredientSelectionScreenNavigationProp>();
  const route = useRoute<IngredientSelectionScreenRouteProp>();

  const { pantryItems } = route.params;

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleContinue = () => {
    // Phase 1 Demo: Show what would happen in Phase 2
    const selectedIngredients = pantryItems
      .map(item => item.item_name)
      .slice(0, 5); // Show first 5 for demo

    Alert.alert(
      '🎉 Phase 1 Working!',
      `Great! You've selected ${pantryItems.length} ingredients:\n\n${selectedIngredients.join(', ')}${pantryItems.length > 5 ? '...' : ''}\n\nPhase 2 will:\n• Call the backend API\n• Show recipe matches\n• Offer AI recipe generation\n\nBackend is ready and waiting!`,
      [
        {
          text: 'Back to Pantry',
          onPress: () => navigation.navigate('MainTabs', { screen: 'Pantry' }),
          style: 'cancel',
        },
        {
          text: 'Got it!',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  };

  const renderPantryItem = ({ item }: { item: PantryItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.item_name}</Text>
        <Text style={styles.itemQuantity}>
          {item.quantity} {item.unit}
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={24} color="#10b981" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Ingredients</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Your pantry items are pre-selected. Tap to deselect or add more.
        </Text>

        <Text style={styles.itemCount}>
          {pantryItems.length} ingredients selected
        </Text>

        <FlatList
          data={pantryItems}
          renderItem={renderPantryItem}
          keyExtractor={item => item.id}
          style={styles.itemsList}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            pantryItems.length < 3 && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={pantryItems.length < 3}>
          <Text
            style={[
              styles.continueButtonText,
              pantryItems.length < 3 && styles.disabledButtonText,
            ]}>
            Find Recipes
          </Text>
        </TouchableOpacity>

        {pantryItems.length < 3 && (
          <Text style={styles.requirementText}>
            Select at least 3 ingredients to continue
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
