import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { OptimizedCollapsibleCard } from './OptimizedCollapsibleCard';

interface EditPreparationStepsSectionProps {
  preparationSteps: string[];
  stepCount: number;
  onStepChange: (index: number, value: string) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
}

const StepRow: React.FC<{
  step: string;
  index: number;
  onStepChange: (index: number, value: string) => void;
  onRemoveStep: (index: number) => void;
  canRemove: boolean;
}> = React.memo(({ step, index, onStepChange, onRemoveStep, canRemove }) => (
  <View style={styles.stepRow}>
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{index + 1}</Text>
    </View>

    <TextInput
      placeholder={`Step ${index + 1} instructions`}
      value={step}
      onChangeText={value => onStepChange(index, value)}
      style={styles.stepInput}
      multiline
      numberOfLines={3}
      placeholderTextColor="#9ca3af"
      maxLength={500}
      textAlignVertical="top"
    />

    <TouchableOpacity
      onPress={() => onRemoveStep(index)}
      style={[styles.removeButton, !canRemove && styles.removeButtonDisabled]}
      disabled={!canRemove}
      activeOpacity={0.7}>
      <Feather
        name="trash-2"
        size={18}
        color={canRemove ? '#ef4444' : '#d1d5db'}
      />
    </TouchableOpacity>
  </View>
));

StepRow.displayName = 'StepRow';

export const EditPreparationStepsSection: React.FC<EditPreparationStepsSectionProps> =
  React.memo(
    ({
      preparationSteps,
      stepCount,
      onStepChange,
      onAddStep,
      onRemoveStep,
    }) => {
      const canRemoveSteps = preparationSteps.length > 1;

      return (
        <OptimizedCollapsibleCard
          title={`Preparation Steps (${stepCount})`}
          icon="list-ordered">
          <View style={styles.stepsContainer}>
            {preparationSteps.map((step, index) => (
              <StepRow
                key={index}
                step={step}
                index={index}
                onStepChange={onStepChange}
                onRemoveStep={onRemoveStep}
                canRemove={canRemoveSteps}
              />
            ))}

            <TouchableOpacity
              style={styles.addButton}
              onPress={onAddStep}
              activeOpacity={0.8}>
              <Feather name="plus-circle" size={20} color="#10B981" />
              <Text style={styles.addButtonText}>Add Step</Text>
            </TouchableOpacity>

            <View style={styles.helpContainer}>
              <Feather name="info" size={14} color="#6b7280" />
              <Text style={styles.helpText}>
                Write clear, detailed instructions for each step
              </Text>
            </View>
          </View>
        </OptimizedCollapsibleCard>
      );
    },
  );

EditPreparationStepsSection.displayName = 'EditPreparationStepsSection';

const styles = StyleSheet.create({
  stepsContainer: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  removeButton: {
    padding: 8,
    marginTop: 4,
  },
  removeButtonDisabled: {
    opacity: 0.3,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: '#f0fdf4',
    marginTop: 8,
  },
  addButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
    flex: 1,
    fontStyle: 'italic',
  },
});

export default EditPreparationStepsSection;
