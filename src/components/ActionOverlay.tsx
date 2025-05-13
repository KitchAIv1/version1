import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import { RecipeItem } from '../types'; // Adjust path if necessary

// Define props more explicitly
interface ActionOverlayProps {
  item: RecipeItem & { likes?: number; saves?: number; liked?: boolean; saved?: boolean }; // Ensure needed fields exist
  onLike: () => void;
  onSave: () => void;
  onMorePress?: () => void; // Add optional prop for the more button
}

export default function ActionOverlay({ item, onLike, onSave, onMorePress }: ActionOverlayProps) {
  // Ensure boolean values for clarity, defaulting to false if undefined
  const isLiked = item.liked === true;
  const isSaved = item.saved === true;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onLike} style={styles.actionButton}>
        <View style={styles.iconContainer}>
          <AntDesign name={isLiked ? 'heart' : 'hearto'} size={30} color="#fff" />
        </View>
        {/* Ensure item.likes is a number before rendering and cast to string */}
        {typeof item.likes === 'number' && (
          <Text style={styles.countText}>{String(item.likes)}</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onSave} style={styles.actionButton}>
        <View style={styles.iconContainer}>
          <Feather
            name="bookmark"
            size={28}
            color="#fff" // Always white outline
            // The fill prop doesn't work with Feather directly, so we need a different approach
            style={isSaved ? styles.filledIcon : undefined}
          />
        </View>
        {/* Ensure item.saves is a number before rendering and cast to string */}
        {typeof item.saves === 'number' && (
          <Text style={styles.countText}>{String(item.saves)}</Text>
        )}
      </TouchableOpacity>
      
      {/* More Button (conditionally rendered) */}
      {onMorePress && (
        <TouchableOpacity onPress={onMorePress} style={styles.actionButton}>
          <View style={styles.iconContainer}>
            <Feather name="more-horizontal" size={28} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  filledIcon: {
    backgroundColor: '#fff',
    color: '#000',
    borderRadius: 2,
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  }
}); 