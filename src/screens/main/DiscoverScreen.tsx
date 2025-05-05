import React, { useState } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Image, Text, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';

// Dummy data for placeholder
const dummy = Array.from({ length: 12 }).map((_, i) => ({
  id: String(i),
  title: `Recipe ${i + 1}`,
  thumb: `https://picsum.photos/seed/${i+1}/300/300`, // Use picsum for varied images
}));

// Define navigation prop type specifically for this screen's context
type DiscoverNavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function DiscoverScreen() {
  const nav = useNavigation<DiscoverNavigationProp>();
  const [query, setQuery] = useState('');

  const onSubmit = () => {
    if (query.trim()) {
      nav.navigate('SearchResults', { query: query.trim() }); // Use correct typing
      setQuery(''); // Clear search bar after submit
    }
  };

  const renderItem = ({ item }: { item: typeof dummy[0] }) => (
    <TouchableOpacity
      className="w-1/2 p-1" // Use Tailwind for padding
      onPress={() => nav.navigate('RecipeDetail', { id: item.id })} // Use correct typing
    >
      <Image source={{ uri: item.thumb }} className="w-full h-40 rounded-lg bg-gray-200" /> {/* Added placeholder bg */}
      <Text numberOfLines={1} className="mt-1 text-sm font-medium text-gray-800">
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  return (
    // Use SafeAreaView for top area
    <SafeAreaView className="flex-1 bg-white">
      <View className="p-4"> 
        <TextInput
          placeholder="Search recipes or ingredients"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          className="p-3 border border-gray-300 rounded-lg bg-gray-50"
        />
      </View>
      {/* TODO: Add "Trending" and "For You" sections later */}
      <FlatList
        data={dummy} // Use dummy data for now
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }} // Add horizontal padding to list container
      />
    </SafeAreaView>
  );
} 