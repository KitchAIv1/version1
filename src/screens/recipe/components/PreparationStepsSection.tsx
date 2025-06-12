import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { OptimizedCollapsibleCard } from './OptimizedCollapsibleCard';

const BRAND_PRIMARY = '#10B981';

interface PreparationStepsSectionProps {
  preparationSteps: string[];
  stepCount: number;
  onStepChange: (index: number, value: string) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
}

// Optimized Step Item Component
const OptimizedStepItem = React.memo<{
  step: string;
  index: number;
  onStepChange: (index: number, value: string) => void;
  onRemoveStep: (index: number) => void;
}>(({ step, index, onStepChange, onRemoveStep }) => {
  const handleStepChange = useCallback((value: string) => {
    onStepChange(index, value);
  }, [index, onStepChange]);

  const handleRemove = useCallback(() => {
    onRemoveStep(index);
  }, [index, onRemoveStep]);

  const stepNumber = index + 1;

  return (
    <View style={styles.listItemContainer}>
      <View style={styles.stepNumberBadge}>
        <Text style={styles.stepNumberText}>{stepNumber}</Text>
      </View>
      <TextInput
        placeholder="Describe this step in detail..."
        value={step}
        onChangeText={handleStepChange}
        style={styles.inputFlexMulti}
        multiline
        placeholderTextColor="#999"
      />
      <TouchableOpacity
        onPress={handleRemove}
        style={styles.removeButtonPadding}>
        <Feather name="x-circle" size={24} color="#ff6347" />
      </TouchableOpacity>
    </View>
  );
});
OptimizedStepItem.displayName = 'OptimizedStepItem';

// Optimized Add Step Button Component
const OptimizedAddStepButton = React.memo<{
  onAddStep: () => void;
}>(({ onAddStep }) => (
  <TouchableOpacity
    style={styles.addButton}
    onPress={onAddStep}
    activeOpacity={0.8}>
    <Feather
      name="plus-circle"
      size={20}
      color={BRAND_PRIMARY}
      style={styles.addButtonIcon}
    />
    <Text style={styles.addButtonText}>Add Step</Text>
  </TouchableOpacity>
));
OptimizedAddStepButton.displayName = 'OptimizedAddStepButton';

// Main PreparationStepsSection Component
export const PreparationStepsSection = React.memo<PreparationStepsSectionProps>(({
  preparationSteps,
  stepCount,
  onStepChange,
  onAddStep,
  onRemoveStep,
}) => {
  // Memoize the steps list to prevent unnecessary re-renders
  const memoizedSteps = useMemo(() => 
    preparationSteps.map((step, index) => (
      <OptimizedStepItem
        key={`step-${index}`}
        step={step}
        index={index}
        onStepChange={onStepChange}
        onRemoveStep={onRemoveStep}
      />
    )), [preparationSteps, onStepChange, onRemoveStep]);

  const cardTitle = useMemo(() => 
    `Preparation Steps (${stepCount})`, [stepCount]);

  return (
    <OptimizedCollapsibleCard
      title={cardTitle}
      icon="list">
      {memoizedSteps}
      <OptimizedAddStepButton onAddStep={onAddStep} />
    </OptimizedCollapsibleCard>
  );
});

PreparationStepsSection.displayName = 'PreparationStepsSection';

const styles = StyleSheet.create({
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputFlexMulti: {
    flex: 1,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#111827',
  },
  removeButtonPadding: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_PRIMARY,
    backgroundColor: '#f0fdf4',
  },
  addButtonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: BRAND_PRIMARY,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default PreparationStepsSection; 