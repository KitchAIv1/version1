import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../constants/theme'; // Assuming you have a theme file

interface ProfileRecipeCardProps {
  item: {
    recipe_id: string;
    recipe_name: string;
    thumbnail_url: string | null;
    created_at: string;
  };
}

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/150/D3D3D3/808080?text=No+Image';
const CARD_MARGIN = 8;
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

const ProfileRecipeCard: React.FC<ProfileRecipeCardProps> = ({ item }) => {
  // Keep this log for now to confirm URLs
  console.log(`[ProfileRecipeCard] Rendering card for "${item.recipe_name}", thumbnail_url: "${item.thumbnail_url}"`);

  const thumbnailHeight = cardWidth * 0.75;

  return (
    <View style={styles.cardContainer}>
      <Image 
        source={{ uri: item.thumbnail_url || PLACEHOLDER_IMAGE }}
        style={[styles.thumbnail, { height: thumbnailHeight }]} 
        resizeMode="cover"
        onError={(e) => console.error(`[ProfileRecipeCard] Image load error for ${item.recipe_name} (URL: ${item.thumbnail_url}):`, e.nativeEvent.error)}
      />
      <View style={styles.infoContainer}>
        <Text style={styles.recipeName} numberOfLines={2} ellipsizeMode="tail">
          {item.recipe_name}
        </Text>
        <Text style={styles.dateText}>
          Uploaded: {formatDate(item.created_at)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: cardWidth,
    backgroundColor: COLORS.white || '#fff',
    borderRadius: 8,
    margin: CARD_MARGIN,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    // Height is set dynamically via inline style
  },
  infoContainer: {
    padding: 10,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text || '#333',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary || '#777',
  },
});

export default ProfileRecipeCard; 