import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons'; // Add Feather icons for subtle enhancements
import { useNavigation } from '@react-navigation/native'; // Added useNavigation
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Added NativeStackNavigationProp
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Added for mutations
import { MainStackParamList } from '../navigation/types'; // Added MainStackParamList
import { COLORS } from '../constants/theme'; // Assuming you have a theme file
import { supabase } from '../services/supabase'; // Added for Supabase client
import { useAuth } from '../providers/AuthProvider'; // Added to get user ID

const PLACEHOLDER_IMAGE =
  'https://via.placeholder.com/150/D3D3D3/808080?text=No+Image';
const CARD_MARGIN = 8; // Spacing between cards
const NUM_COLUMNS = 2;
const screenWidth = Dimensions.get('window').width;
const CONTAINER_PADDING = 32; // 16px on each side
const cardWidth =
  (screenWidth - CONTAINER_PADDING - (NUM_COLUMNS - 1) * CARD_MARGIN) / NUM_COLUMNS;

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  cardWrapper: {
    width: cardWidth,
    marginBottom: 16,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: COLORS.white || '#fff',
    borderRadius: 12, // More rounded corners
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, // Slightly stronger shadow
    shadowRadius: 8, // More diffuse shadow
    elevation: 4, // Better elevation for Android
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#f0f0f0', // Light background for images while loading
  },
  thumbnail: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  infoContainer: {
    padding: 12, // More internal padding
    backgroundColor: COLORS.white || '#fff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text || '#333',
    marginBottom: 6,
    lineHeight: 18, // Better line height for readability
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  icon: {
    marginRight: 4,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary || '#777',
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', // Semi-transparent background for better visibility
    padding: 6,
    borderRadius: 15, // Circular background
  },
  // AI Badge styles
  aiBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.9)', // Green background with transparency
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
    letterSpacing: 0.5,
  },
});

interface ProfileRecipeCardProps {
  item: {
    recipe_id: string;
    recipe_name: string;
    thumbnail_url: string | null;
    created_at: string;
    creator_user_id: string; // Ensured creator_user_id is part of the item prop
    is_ai_generated?: boolean; // Added to detect AI-generated recipes
  };
  onPress?: () => void;
  context: 'myRecipes' | 'savedRecipes' | 'otherUserRecipes'; // Added otherUserRecipes context
}

// Simple date formatter (you might want to use a library like date-fns for more complex formatting)
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (e) {
    return 'Invalid date';
  }
};

const ProfileRecipeCard: React.FC<ProfileRecipeCardProps> = React.memo(
  ({ item, onPress, context }) => {
    const { user } = useAuth(); // Moved user declaration earlier

    const thumbnailHeight = cardWidth * 0.8; // Slightly taller ratio for better visibility

    // Add animation for card press feedback - memoized to prevent recreation
    const scaleAnim = React.useMemo(() => new Animated.Value(1), []);

    // Initialize navigation
    const navigation =
      useNavigation<NativeStackNavigationProp<MainStackParamList>>();
    const queryClient = useQueryClient(); // Added queryClient

    // FIXED: Memoize mutation functions to prevent infinite re-renders
    const deleteRecipeMut = useMutation({
      mutationFn: React.useCallback(async (recipeIdToDelete: string) => {
        // This is for hard deleting user's own recipe
        const { error } = await supabase.rpc('delete_recipe', {
          p_recipe_id: recipeIdToDelete,
        });
        if (error) {
          console.error('Error deleting recipe:', error);
          throw new Error(error.message || 'Failed to delete recipe.');
        }
        return recipeIdToDelete;
      }, []),
      onSuccess: React.useCallback((deletedRecipeId: string) => {
        Alert.alert(
          'Success',
          `Recipe "${item.recipe_name}" has been deleted.`,
        );
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        }
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        console.log(
          `Recipe ${deletedRecipeId} deleted, invalidated profile query for user ${user?.id} and feed query.`,
        );
      }, [item.recipe_name, user?.id, queryClient]),
      onError: React.useCallback((error: Error) => {
        Alert.alert(
          'Error',
          error.message || 'Could not delete the recipe. Please try again.',
        );
      }, []),
    });

    const unsaveRecipeMut = useMutation({
      mutationFn: React.useCallback(async (recipeIdToUnsave: string) => {
        if (!user?.id) {
          throw new Error('User not authenticated to unsave recipe.');
        }
        const { error } = await supabase.rpc('unsave_recipe', {
          recipe_id_param: recipeIdToUnsave,
          user_id_param: user.id,
        });
        if (error) {
          console.error('Error unsaving recipe:', error);
          throw new Error(error.message || 'Failed to unsave recipe.');
        }
        return recipeIdToUnsave;
      }, [user?.id]),
      onSuccess: React.useCallback((unsavedRecipeId: string) => {
        Alert.alert(
          'Success',
          `Recipe "${item.recipe_name}" has been unsaved.`,
        );
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['profile', user.id] }); // Refreshes saved list
        }
        console.log(
          `Recipe ${unsavedRecipeId} unsaved, invalidated profile query for user ${user?.id}.`,
        );
      }, [item.recipe_name, user?.id, queryClient]),
      onError: React.useCallback((error: Error) => {
        Alert.alert(
          'Error',
          error.message || 'Could not unsave the recipe. Please try again.',
        );
      }, []),
    });

    const handlePressIn = React.useCallback(() => {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, [scaleAnim]);

    const handlePressOut = React.useCallback(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, [scaleAnim]);

    const handleMenuPress = React.useCallback(() => {
      const isMyRecipeContext = context === 'myRecipes';
      const isOwner = item.creator_user_id === user?.id;

      const options: Array<any> = []; // Initialize options array

      // Add "Edit Recipe" option conditionally
      if (isMyRecipeContext || (context === 'savedRecipes' && isOwner)) {
        options.push({
          text: 'Edit Recipe',
          onPress: () => {
            navigation.navigate('EditRecipe', { recipeId: item.recipe_id });
          },
        });
      }

      // Add "Delete Recipe" or "Unsave Recipe" option
      options.push({
        text: isMyRecipeContext ? 'Delete Recipe' : 'Unsave Recipe',
        onPress: () => {
          if (isMyRecipeContext) {
            // Optionally, add another confirmation for permanent deletion
            Alert.alert(
              'Confirm Delete',
              `Are you sure you want to permanently delete "${item.recipe_name}"? This action cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteRecipeMut.mutate(item.recipe_id),
                },
              ],
            );
          } else {
            unsaveRecipeMut.mutate(item.recipe_id);
          }
        },
        style: 'destructive' as 'destructive' | 'default' | 'cancel', // Ensure type correctness
      });

      // Add "Cancel" option
      options.push({
        text: 'Cancel',
        style: 'cancel' as 'destructive' | 'default' | 'cancel',
      });

      Alert.alert(
        `Options for "${item.recipe_name}"`,
        'What would you like to do?',
        options,
        { cancelable: true },
      );
    }, [context, item.creator_user_id, item.recipe_id, item.recipe_name, user?.id, navigation, deleteRecipeMut, unsaveRecipeMut]);

    return (
      <TouchableOpacity
        style={styles.cardWrapper}
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}>
        <Animated.View
          style={[styles.cardContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.thumbnail_url || PLACEHOLDER_IMAGE }}
              style={[styles.thumbnail, { height: thumbnailHeight }]}
              resizeMode="cover"
              onError={e => {
                console.error(
                  `[ProfileRecipeCard] Image load error for ${item.recipe_name}:`,
                  e.nativeEvent.error,
                );
                // For AI recipes, try to use the default AI recipe image as fallback
                // This helps when the saved thumbnail_url is broken or inaccessible
              }}
              defaultSource={{
                uri: 'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/porkstirfry.jpeg',
              }}
            />
            {/* AI Badge for AI-generated recipes */}
            {item.is_ai_generated && (
              <View style={styles.aiBadge}>
                <Feather name="zap" size={12} color="#fff" />
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
            {/* Optional overlay gradient could go here */}
            {context !== 'otherUserRecipes' && (
              <TouchableOpacity
                onPress={handleMenuPress}
                style={styles.menuButton}>
                <Feather
                  name="more-vertical"
                  size={22}
                  color={COLORS.white || '#fff'}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text
              style={styles.recipeName}
              numberOfLines={2}
              ellipsizeMode="tail">
              {item.recipe_name}
            </Text>

            <View style={styles.metaContainer}>
              <Feather
                name="calendar"
                size={12}
                color={COLORS.textSecondary || '#777'}
                style={styles.icon}
              />
              <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  },
  // CRITICAL: Add comparison function to prevent infinite re-renders
  (prevProps, nextProps) => {
    // Only re-render if the actual item data, context, or onPress function changes
    return (
      prevProps.item.recipe_id === nextProps.item.recipe_id &&
      prevProps.item.recipe_name === nextProps.item.recipe_name &&
      prevProps.item.thumbnail_url === nextProps.item.thumbnail_url &&
      prevProps.item.created_at === nextProps.item.created_at &&
      prevProps.item.creator_user_id === nextProps.item.creator_user_id &&
      prevProps.item.is_ai_generated === nextProps.item.is_ai_generated &&
      prevProps.context === nextProps.context &&
      prevProps.onPress === nextProps.onPress
    );
  }
);

export default ProfileRecipeCard;
