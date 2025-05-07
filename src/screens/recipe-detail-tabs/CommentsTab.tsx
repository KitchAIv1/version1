import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// TODO: Define props to receive comments data
interface CommentsTabProps {
  // comments?: Array<{ userId: string; text: string; createdAt: string }>;
}

const CommentsTab: React.FC<CommentsTabProps> = (/* { comments } */) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comments</Text>
      {/* TODO: Display comments list and potentially add comment input */}
      <Text style={styles.placeholder}>Comments will appear here.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 14,
    color: '#666',
  },
});

export default CommentsTab; 