import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFeed } from '../../hooks/useFeed';
import RecipeCard from '../../components/RecipeCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RecipeItem } from '../../types';

export default function FeedScreen() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useFeed();

  // Flatten the pages array from react-query into a single list
  const items: RecipeItem[] = data?.pages.flat() || [];

  // Render Footer for loading indicator
  const renderListFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  };

  // Show loading indicator on initial fetch
  if (isLoading && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </SafeAreaView>
    );
  }

  // Show message if no items found (after loading)
  if (!isLoading && items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' }}>
        <Text style={{ color: 'white' }}>No recipes found.</Text>
      </SafeAreaView>
    );
  }

  return (
    // Use SafeAreaView to avoid notches/status bars
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <FlashList<RecipeItem>
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecipeCard item={item} />}
        estimatedItemSize={800}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderListFooter}
      />
    </SafeAreaView>
  );
} 