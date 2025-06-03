import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

interface StepsTabProps {
  steps: string[] | undefined | null;
}

export default function StepsTab({ steps }: StepsTabProps) {
  if (!steps || steps.length === 0) {
    return (
      <View style={[styles.container, styles.centeredFeedback]}>
        <Text style={styles.infoText}>
          No preparation steps available for this recipe.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stepsListContainer}>
        {steps.map((step, idx) => (
          <View
            key={`step-${idx}-${step.substring(0, 10)}`}
            style={styles.stepContainer}>
            <Text style={styles.stepNumber}>{`${idx + 1}.`}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white || '#fff',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
    flex: 1,
  },
  stepsListContainer: {
    paddingBottom: 24,
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
  },
  infoText: {
    fontSize: 16,
    color: COLORS.textSecondary || '#666',
    textAlign: 'center',
  },
});
