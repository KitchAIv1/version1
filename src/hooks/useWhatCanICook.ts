import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../navigation/types';
import { usePantryData } from './usePantryData';
import { useAuth } from '../providers/AuthProvider';

type WhatCanICookNavigation = NativeStackNavigationProp<MainStackParamList>;

interface PantryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
}

export const useWhatCanICook = () => {
  const navigation = useNavigation<WhatCanICookNavigation>();
  const { user } = useAuth();
  const { data: pantryItems = [], isLoading } = usePantryData(user?.id);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);

  // Calculate pantry item count
  const pantryItemCount = pantryItems.length;
  const hasEnoughItems = pantryItemCount >= 3;

  // Handle button press
  const handleWhatCanICookPress = useCallback(() => {
    if (hasEnoughItems) {
      // Navigate to ingredient selection with pantry items
      navigation.navigate('IngredientSelection', {
        pantryItems: pantryItems as PantryItem[],
      });
    } else {
      // Show insufficient items modal
      setShowInsufficientModal(true);
    }
  }, [hasEnoughItems, pantryItems, navigation]);

  // Handle modal actions
  const handleCloseModal = useCallback(() => {
    setShowInsufficientModal(false);
  }, []);

  const handleNavigateToPantry = useCallback(() => {
    setShowInsufficientModal(false);
    // Navigate to Pantry tab
    navigation.navigate('MainTabs', { screen: 'Pantry' });
  }, [navigation]);

  return {
    // State
    pantryItemCount,
    hasEnoughItems,
    isLoading,
    showInsufficientModal,

    // Actions
    handleWhatCanICookPress,
    handleCloseModal,
    handleNavigateToPantry,

    // Data
    pantryItems,
  };
};

export default useWhatCanICook;
