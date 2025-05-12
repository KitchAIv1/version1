import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useRecipeDetails } from '../../hooks/useRecipeDetails';
import { COLORS } from '../../constants/theme';

export default function StepsTab() {
  const route = useRoute<any>();
  const recipeId = route.params?.id;
  const { data: recipeDetails, isLoading, error } = useRecipeDetails(recipeId);

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (error || !recipeDetails || !recipeDetails.preparation_steps) {
    return <View style={styles.centered}><Text style={styles.errorText}>Could not load preparation steps.</Text></View>;
  }

  const cleanedSteps = recipeDetails.preparation_steps.map(step => 
    step.replace(/^\s*\d+[.)]*\s*/, '')
  );

  return (
    <ScrollView 
      style={styles.scrollViewStyle}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {cleanedSteps.length > 0 ? (
        <View style={styles.stepsListContainer}>
          {cleanedSteps.map((step, idx) => (
            <View key={idx} style={styles.stepContainer}>
              <Text style={styles.stepNumber}>{`${idx + 1}.`}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.centeredFeedback}>
          <Text style={styles.infoText}>No preparation steps available for this recipe.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollViewStyle: {
    flex: 1,
    backgroundColor: COLORS.white || '#fff',
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  stepsListContainer: {
    paddingBottom: 24, 
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white || '#fff',
  },
  errorText: {
    color: COLORS.error || 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary || '#00796b',
    marginRight: 10,
    minWidth: 25,
  },
  stepText: {
    fontSize: 15,
    color: COLORS.text || '#333',
    flex: 1,
    lineHeight: 22,
  },
  centeredFeedback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  infoText: {
    fontSize: 16,
    color: COLORS.textSecondary || '#666',
    textAlign: 'center',
  },
}); 