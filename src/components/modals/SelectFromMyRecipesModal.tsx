import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Matching the structure from ProfileScreen.tsx's VideoPostData
export interface RecipeForModal {
  recipe_id: string;
  recipe_name: string;
  thumbnail_url: string | null;
  // Add other fields if needed for display or selection
}

interface SelectFromMyRecipesModalProps {
  isVisible: boolean;
  onClose: () => void;
  // Send back id, name, and thumbnail for optimistic update in meal planner
  onRecipeSelect: (recipe: {
    recipe_id: string;
    recipe_name: string;
    thumbnail_url: string | null;
  }) => void;
  recipes: RecipeForModal[]; // User's own recipes
  isLoading?: boolean; // To show a loader if recipes are being fetched by parent
}

const SelectFromMyRecipesModal: React.FC<SelectFromMyRecipesModalProps> = ({
  isVisible,
  onClose,
  onRecipeSelect,
  recipes,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecipes = useMemo(() => {
    if (!searchTerm) {
      return recipes;
    }
    return recipes.filter(recipe =>
      recipe.recipe_name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [recipes, searchTerm]);

  const handleSelect = (recipe: RecipeForModal) => {
    onRecipeSelect({
      recipe_id: recipe.recipe_id,
      recipe_name: recipe.recipe_name,
      thumbnail_url: recipe.thumbnail_url,
    });
    onClose(); // Close modal after selection
  };

  const renderRecipeItem = ({ item }: { item: RecipeForModal }) => (
    <TouchableOpacity
      style={styles.recipeItem}
      onPress={() => handleSelect(item)}>
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
      ) : (
        <View style={styles.placeholderThumbnailModal}>
          <Icon name="image-off-outline" size={24} color="#adb5bd" />
        </View>
      )}
      <Text style={styles.recipeName} numberOfLines={2}>
        {item.recipe_name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isVisible}
      onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>Select a Recipe</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeIconContainer}>
              <Icon name="close-circle" size={28} color="#495057" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search your recipes..."
            placeholderTextColor="#868e96"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color="#22c55e"
              style={styles.loader}
            />
          ) : filteredRecipes.length === 0 ? (
            <Text style={styles.noRecipesText}>
              {searchTerm
                ? 'No recipes match your search.'
                : 'You have no recipes to select from.'}
            </Text>
          ) : (
            <FlatList
              data={filteredRecipes}
              renderItem={renderRecipeItem}
              keyExtractor={item => item.recipe_id}
              style={styles.list}
              numColumns={2} // Display as a 2-column grid
              columnWrapperStyle={styles.columnWrapper}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end', // Modal comes from bottom
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 15,
    width: '100%',
    maxHeight: '85%', // Limit height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 }, // Shadow for top
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10, // Added padding for title and close icon
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#343a40',
  },
  closeIconContainer: {
    padding: 5, // Make it easier to tap
  },
  searchInput: {
    height: 45,
    borderColor: '#ced4da',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 10, // Added horizontal margin
  },
  list: {
    width: '100%',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 5, // Padding for items within the columns
  },
  recipeItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    width: '48%', // For 2 columns with a bit of space
    minHeight: 150, // Give items a decent height
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  placeholderThumbnailModal: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center',
  },
  noRecipesText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#868e96',
  },
  loader: {
    marginTop: 30,
  },
  // Removed old closeButton styles as we are using an icon now
});

export default SelectFromMyRecipesModal;
