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
    <View className="items-center">
      <TouchableOpacity onPress={onLike} className="items-center mb-6">
        <AntDesign name={isLiked ? 'heart' : 'hearto'} size={38} color="#fff" />
        {/* Ensure item.likes is a number before rendering and cast to string */}
        {typeof item.likes === 'number' && (
          <Text className="text-white mt-1 font-semibold">{String(item.likes)}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onSave} className="items-center mb-6">
        {/* Use fill prop for Feather bookmark when saved */}
        <Feather
          name="bookmark"
          size={34}
          color="#fff" // Always white outline
          fill={isSaved ? '#fff' : 'none'} // Fill white when saved
        />
        {/* Ensure item.saves is a number before rendering and cast to string */}
        {typeof item.saves === 'number' && (
          <Text className="text-white mt-1 font-semibold">{String(item.saves)}</Text>
        )}
      </TouchableOpacity>
      
      {/* More Button (conditionally rendered) */}
      {onMorePress && (
        <TouchableOpacity onPress={onMorePress} className="items-center">
          <Feather name="more-horizontal" size={34} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Remove StyleSheet for positioning
// const styles = StyleSheet.create({ ... }); 