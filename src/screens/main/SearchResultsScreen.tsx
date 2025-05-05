// SearchResultsScreen implementation will go here
import React from 'react';
import { View, Text } from 'react-native';

export default function SearchResultsScreen(/* { route } */) {
  // const { query } = route.params;
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text>Search Results</Text>
      {/* <Text>Query: {query}</Text> */}
    </View>
  );
}; 