import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface ScanningLoadingOverlayProps {
  isVisible: boolean;
  isAnalyzing: boolean;
  isSaving: boolean;
  analysisMessage: string;
}

const ScanningLoadingOverlay: React.FC<ScanningLoadingOverlayProps> = ({
  isVisible,
  isAnalyzing,
  isSaving,
  analysisMessage,
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  // Start spinning animation when analyzing
  useEffect(() => {
    if (isAnalyzing) {
      startSpinAnimation();
    } else {
      spinValue.setValue(0);
    }
  }, [isAnalyzing, spinValue]);

  const startSpinAnimation = () => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isVisible) return null;

  return (
    <View style={styles.loadingOverlay} pointerEvents="none">
      {isAnalyzing ? (
        <View style={styles.analysisContainer}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MaterialCommunityIcons
              name="food-fork-drink"
              size={60}
              color="#fff"
            />
          </Animated.View>

          <Text style={styles.loadingTitle}>Analyzing Photo</Text>

          <Text style={styles.loadingText}>{analysisMessage}</Text>

          <View style={styles.progressDots}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View
              style={[
                styles.progressDot,
                isAnalyzing && analysisMessage.includes('Identifying')
                  ? styles.progressDotActive
                  : null,
              ]}
            />
            <View
              style={[
                styles.progressDot,
                isAnalyzing && analysisMessage.includes('Processing')
                  ? styles.progressDotActive
                  : null,
              ]}
            />
          </View>
        </View>
      ) : (
        <View style={styles.savingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingTitle}>Saving to Your Pantry</Text>
          <Text style={styles.loadingText}>Just a moment...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  analysisContainer: {
    padding: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    width: '80%',
    maxWidth: 350,
  },
  savingContainer: {
    alignItems: 'center',
  },
  loadingTitle: {
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  progressDots: {
    flexDirection: 'row',
    marginTop: 24,
    justifyContent: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 5,
  },
  progressDotActive: {
    backgroundColor: '#22c55e',
  },
});

export default ScanningLoadingOverlay;
