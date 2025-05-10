import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useRecipeDetails } from '../../hooks/useRecipeDetails';

export default function StepsTab() {
  const route = useRoute<any>();
  const recipeId = route.params?.id;
  const { data, isLoading, error } = useRecipeDetails(recipeId);

  if (isLoading) return <Text>Loading...</Text>;
  if (error || !data) return <Text>Error loading steps.</Text>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Preparation Steps</Text>
      {data.preparation_steps.map((step, idx) => (
        <Text key={idx} style={styles.step}>
          {idx + 1}. {step}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  step: { fontSize: 16, marginBottom: 8 },
}); 