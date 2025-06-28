import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../../constants/theme';

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
      <View style={styles.progressBar}>
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
                {isCompleted && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
                {isActive && (
                  <View style={styles.activePulse} />
                )}
              </View>
              {stepNumber < totalSteps && (
                <View 
                  style={[
                    styles.connectorLine,
                    isCompleted && styles.completedConnectorLine,
                  ]} 
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
      
      <Text style={styles.progressText}>
        Step {currentStep} of {totalSteps}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  activeStepDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  completedStepDot: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  activePulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    top: -6,
    left: -6,
  },
  checkmark: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectorLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  completedConnectorLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  progressText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default OnboardingProgress;
