import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity, Animated, Alert } from 'react-native';
import { COLORS } from '../constants/theme'; // Assuming you have a theme file
import { Feather } from '@expo/vector-icons'; // Add Feather icons for subtle enhancements
import { useNavigation } from '@react-navigation/native'; // Added useNavigation
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Added NativeStackNavigationProp
import { MainStackParamList } from '../navigation/types'; // Added MainStackParamList

interface ProfileRecipeCardProps {
  item: {
    recipe_id: string;
    recipe_name: string;
    thumbnail_url: string | null;
    created_at: string;
  };
  onPress?: () => void;
}

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/150/D3D3D3/808080?text=No+Image';
const CARD_MARGIN = 6; // Slightly reduced for tighter grid
const NUM_COLUMNS = 2;
const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - (NUM_COLUMNS + 1) * CARD_MARGIN * 2) / NUM_COLUMNS;

// Simple date formatter (you might want to use a library like date-fns for more complex formatting)
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'Invalid date';
  }
};

const ProfileRecipeCard: React.FC<ProfileRecipeCardProps> = ({ item, onPress }) => {
  // Keep this log for now to confirm URLs
  console.log(`[ProfileRecipeCard] Rendering card for "${item.recipe_name}", thumbnail_url: "${item.thumbnail_url}"`);

  const thumbnailHeight = cardWidth * 0.8; // Slightly taller ratio for better visibility
  
  // Add animation for card press feedback
  const [scaleAnim] = useState(new Animated.Value(1));
  
  // Initialize navigation
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 7,
      tension: 40,
      useNativeDriver: true
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true
    }).start();
  };

  const handleMenuPress = () => {
    Alert.alert(
      `Options for "${item.recipe_name}"`,
      'What would you like to do?',
      [
        {
          text: 'Edit Recipe',
          onPress: () => {
            navigation.navigate('EditRecipe', { recipeId: item.recipe_id });
          },
        },
        {
          text: 'Delete Recipe',
          onPress: () => {
            Alert.alert(
              'Confirm Delete',
              `Are you sure you want to delete "${item.recipe_name}"? This action cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  onPress: () => console.log(`TODO: Implement delete for recipe ID: ${item.recipe_id}`),
                  style: 'destructive',
                },
              ]
            );
          },
          style: 'default', // Or 'destructive' if you want it red
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity 
      style={styles.cardWrapper}
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[
        styles.cardContainer,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.thumbnail_url || PLACEHOLDER_IMAGE }}
            style={[styles.thumbnail, { height: thumbnailHeight }]} 
            resizeMode="cover"
            onError={(e) => console.error(`[ProfileRecipeCard] Image load error for ${item.recipe_name}:`, e.nativeEvent.error)}
          />
          {/* Optional overlay gradient could go here */}
          <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
            <Feather name="more-vertical" size={22} color={COLORS.white || '#fff'} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.recipeName} numberOfLines={2} ellipsizeMode="tail">
            {item.recipe_name}
          </Text>
          
          <View style={styles.metaContainer}>
            <Feather name="calendar" size={12} color={COLORS.textSecondary || '#777'} style={styles.icon} />
            <Text style={styles.dateText}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    width: cardWidth,
    margin: CARD_MARGIN,
    marginBottom: 12,
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
  }
});

export default ProfileRecipeCard; 