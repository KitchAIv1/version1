import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { COLORS } from '../constants/theme'; // Assuming you have a theme file
import { Feather } from '@expo/vector-icons'; // Add Feather icons for subtle enhancements

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
});

export default ProfileRecipeCard; 