import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CommentsTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comments</Text>
      <Text style={styles.placeholder}>Comments are not available for this recipe.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  placeholder: { fontSize: 16, color: '#888' },
}); 