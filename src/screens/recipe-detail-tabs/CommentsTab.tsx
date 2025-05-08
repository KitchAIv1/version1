import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  // RefreshControl, // Removed as FlatList will be non-scrollable
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useRecipeComments, RecipeComment } from '../../hooks/useRecipeComments'; // Adjust path as needed
import { MainStackParamList } from '../../navigation/types'; // For route params type

// Define route prop type to access recipeId passed to the tab
type CommentsTabRouteProp = RouteProp<MainStackParamList, 'RecipeDetail'>; // Assuming CommentsTab is used in context of RecipeDetail that has `id`

// Helper to format date (very basic, consider a library like date-fns for more complex needs)
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

const CommentsTab: React.FC = () => {
  const route = useRoute<CommentsTabRouteProp>();
  // The RecipeDetailScreen passes `id` as `recipeId` in initialParams.
  // However, the route params for the screen itself would be route.params.id
  // Let's ensure we are consistent. The initialParams of a tab screen are accessed via route.params directly.
  const recipeId = route.params?.id; // This should be the recipe ID

  const {
    data: comments,
    isLoading,
    isError,
    error,
    refetch, // Retain refetch if needed for a manual refresh button, but RefreshControl is gone
    // isRefetching, // Related to RefreshControl
  } = useRecipeComments({ recipeId });

  // console.log('CommentsTab data:', comments); // Removed debugging line

  if (isLoading && !comments) {
    return (
      <View style={styles.centeredMessageContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading comments...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={styles.errorText}>
          Error loading comments: {error?.message || 'Unknown error'}
        </Text>
      </View>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <View style={styles.centeredMessageContainer}>
        <Text style={styles.placeholder}>No comments yet. Be the first to comment!</Text>
        {/* TODO: Add comment input field here */}
      </View>
    );
  }

  const renderComment = ({ item }: { item: RecipeComment }) => (
    <View style={styles.commentContainer}>
      <View style={styles.commentHeader}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder} /> // Placeholder for avatar
        )}
        <Text style={styles.username}>{item.username}</Text>
      </View>
      <Text style={styles.commentText}>{item.comment_text}</Text>
      <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
    </View>
  );

  return (
    <FlatList
      data={comments}
      renderItem={renderComment}
      keyExtractor={(item) => item.comment_id.toString()} // Use comment_id as key
      style={styles.container} // This style will no longer have flex: 1
      contentContainerStyle={styles.listContentContainer}
      ListHeaderComponent={<Text style={styles.title}>Comments ({comments.length})</Text>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      scrollEnabled={false} // Make the FlatList non-scrollable
      // RefreshControl no longer used here
    />
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1, // Removed: Let content determine height, parent ScrollView handles scrolling
    backgroundColor: '#fff',
  },
  listContentContainer: {
    padding: 16,
  },
  centeredMessageContainer: {
    flex: 1, // This can remain to center loading/error/empty messages within the tab's allocated space
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  placeholder: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  commentContainer: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: '#e0e0e0', // Background for image loading
  },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: '#ccc', // Simple grey placeholder
  },
  username: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#444',
  },
  commentText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
    marginTop: 8,
    textAlign: 'right',
  },
  separator: {
    height: 10, // Space between comment items
  },
});

export default CommentsTab; 