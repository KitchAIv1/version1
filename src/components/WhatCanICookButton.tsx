import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

interface WhatCanICookButtonProps {
  pantryItemCount: number;
  onPress: () => void;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'text';
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#10b981',
  },
  secondaryButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  textButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  disabledButton: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#10b981',
  },
  textText: {
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  disabledText: {
    color: '#9ca3af',
  },
  requirementText: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 4,
    fontStyle: 'italic',
  },
});

function WhatCanICookButton({
  pantryItemCount,
  onPress,
  style,
  variant = 'primary',
}: WhatCanICookButtonProps) {
  const isEnabled = pantryItemCount >= 3;

  // Extract nested ternary to helper function
  const getButtonVariantStyle = () => {
    if (variant === 'primary') return styles.primaryButton;
    if (variant === 'secondary') return styles.secondaryButton;
    return styles.textButton;
  };

  // Extract nested ternary to helper function
  const getTextVariantStyle = () => {
    if (variant === 'primary') return styles.primaryText;
    if (variant === 'secondary') return styles.secondaryText;
    return styles.textText;
  };

  const buttonStyle = [
    styles.button,
    getButtonVariantStyle(),
    !isEnabled && styles.disabledButton,
    style,
  ];

  const textStyle = [
    styles.buttonText,
    getTextVariantStyle(),
    !isEnabled && styles.disabledText,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={!isEnabled}
      activeOpacity={0.8}>
      <Text style={textStyle}>What Can I Cook?</Text>
      {!isEnabled && (
        <Text style={styles.requirementText}>(Need 3+ items)</Text>
      )}
    </TouchableOpacity>
  );
}

// Add default props to fix require-default-props linter errors
WhatCanICookButton.defaultProps = {
  style: undefined,
  variant: 'primary',
};

export default WhatCanICookButton;
