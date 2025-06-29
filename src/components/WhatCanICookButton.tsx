import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, View } from 'react-native';
import { useAccessControl } from '../hooks/useAccessControl';
import { useAuth } from '../providers/AuthProvider';
import { useFocusEffect } from '@react-navigation/native';

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
    backgroundColor: '#10b981',
    opacity: 0.7,
    borderColor: '#10b981',
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
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  requirementText: {
    fontSize: 11,
    color: '#ffffff',
    marginLeft: 4,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  usageText: {
    fontSize: 11,
    color: '#ffffff',
    marginLeft: 4,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

function WhatCanICookButton({
  pantryItemCount,
  onPress,
  style,
  variant = 'primary',
}: WhatCanICookButtonProps) {
  const isEnabled = pantryItemCount >= 3;
  const { getAIRecipeUsageDisplay, getUsageDisplay } = useAccessControl();
  const { user } = useAuth();
  
  // State for AI recipe usage display
  const [aiUsageText, setAiUsageText] = useState('Loading...');
  const [showUsage, setShowUsage] = useState(false);

  // Check if we should show usage (FREEMIUM users only)
  useEffect(() => {
    const usageData = getUsageDisplay();
    setShowUsage(usageData.showUsage);
  }, [getUsageDisplay]);

  // Function to fetch and update usage display
  const fetchUsageDisplay = React.useCallback(async () => {
    if (!showUsage || !user?.id) {
      setAiUsageText('');
      return;
    }

    try {
      console.log('[WhatCanICookButton] Fetching AI usage display...');
      const usage = await getAIRecipeUsageDisplay();
      console.log('[WhatCanICookButton] AI usage display result:', usage);
      setAiUsageText(usage);
    } catch (error) {
      console.error('[WhatCanICookButton] Error fetching AI usage:', error);
      setAiUsageText('Error');
    }
  }, [showUsage, user?.id, getAIRecipeUsageDisplay]);

  // Initial fetch on mount
  useEffect(() => {
    fetchUsageDisplay();
  }, [fetchUsageDisplay]);

  // 🔧 CRITICAL FIX: Refresh usage when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('[WhatCanICookButton] Screen focused - refreshing AI usage display');
      fetchUsageDisplay();
    }, [fetchUsageDisplay])
  );

  // 🔧 PERFORMANCE: Refresh usage every 30 seconds while component is mounted
  useEffect(() => {
    if (!showUsage || !user?.id) return;
    
    const interval = setInterval(() => {
      console.log('[WhatCanICookButton] Periodic refresh of AI usage display');
      fetchUsageDisplay();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [showUsage, user?.id, fetchUsageDisplay]);

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
      {!isEnabled ? (
        <Text style={styles.requirementText}>(Need 3+ items)</Text>
      ) : (
        showUsage && aiUsageText && aiUsageText !== 'Unlimited' && (
          <Text style={styles.usageText}>{aiUsageText} AI recipes</Text>
        )
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
