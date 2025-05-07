import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';
import { RecipeItem } from '../types'; // Adjust path if necessary

// Define props more explicitly
interface ActionOverlayProps {
  item: RecipeItem & { likes?: number; saves?: number; liked?: boolean; saved?: boolean }; // Ensure needed fields exist
  onLike: () => void;
  onSave: () => void;
}

export default function ActionOverlay({ item, onLike, onSave }: ActionOverlayProps) {
  // Ensure boolean values for clarity, defaulting to false if undefined
  const isLiked = item.liked === true;
  const isSaved = item.saved === true;

  return (
    <View className="absolute right-4 bottom-24 items-center z-10"> // Added z-index
      <TouchableOpacity onPress={onLike} className="items-center mb-6">
        <AntDesign name={isLiked ? 'heart' : 'hearto'} size={38} color="#fff" />
        {/* Ensure item.likes is a number before rendering and cast to string */}
        {typeof item.likes === 'number' && (
          <Text className="text-white mt-1 font-semibold">{String(item.likes)}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onSave} className="items-center">
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
    </View>
  );
} 