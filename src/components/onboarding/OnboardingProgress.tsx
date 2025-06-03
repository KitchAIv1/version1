import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  totalSteps,
}) => {
  return (
    <View style={styles.container}>
      {[...Array(totalSteps)].map((_, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        return (
          <React.Fragment key={stepNumber}>
            <View
              style={[
                styles.stepDot,
                isActive && styles.activeStepDot,
                isCompleted && styles.completedStepDot,
              ]}>
              <Text
                style={[
                  styles.stepText,
                  isActive && styles.activeStepText,
                  isCompleted && styles.completedStepText,
                ]}>
                {/* Optional: show step number or checkmark */}
                {/* {isCompleted ? '✓' : stepNumber} */}
              </Text>
            </View>
            {stepNumber < totalSteps && <View style={styles.connectorLine} />}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0', // Inactive/pending step
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  activeStepDot: {
    backgroundColor: '#fff',
    borderColor: '#22c55e',
  },
  completedStepDot: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  stepText: {
    color: '#a0a0a0',
    fontWeight: 'bold',
  },
  activeStepText: {
    color: '#22c55e',
  },
  completedStepText: {
    color: '#fff',
  },
  connectorLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: -2, // Slight overlap to connect dots visually
  },
});

export default OnboardingProgress;
