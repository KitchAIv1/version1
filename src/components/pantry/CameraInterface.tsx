import React, { forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { CameraView } from 'expo-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface CameraInterfaceProps {
  onCapturePress: () => void;
  onSkipPress?: () => void;
  onExitPress?: () => void;
  isAnalyzing: boolean;
  showSkipButton?: boolean;
  showExitButton?: boolean;
  instructionText?: string;
}

const CameraInterface = forwardRef<CameraView, CameraInterfaceProps>(
  (
    {
      onCapturePress,
      onSkipPress,
      onExitPress,
      isAnalyzing,
      showSkipButton = false,
      showExitButton = true,
      instructionText = 'Position your pantry items clearly in the frame.',
    },
    ref,
  ) => {
    return (
      <View style={styles.container}>
        {/* Camera View - No children allowed */}
        <CameraView ref={ref} style={styles.camera} facing="back" />

        {/* Overlay with absolute positioning */}
        <View style={styles.overlay}>
          {/* Top Bar with Exit Button */}
          <View style={styles.topBar}>
            {showExitButton && (
              <TouchableOpacity style={styles.exitButton} onPress={onExitPress}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructions}>{instructionText}</Text>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomBar}>
            {showSkipButton ? (
              <TouchableOpacity
                style={styles.skipButtonTouch}
                onPress={onSkipPress}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.spacer} />
            )}

            <TouchableOpacity
              style={[
                styles.captureButton,
                isAnalyzing && styles.captureButtonDisabled,
              ]}
              onPress={onCapturePress}
              disabled={isAnalyzing}>
              <Ionicons
                name="camera"
                size={40}
                color={isAnalyzing ? '#ccc' : '#22c55e'}
              />
            </TouchableOpacity>

            {/* Placeholder for symmetry */}
            <View style={styles.spacer} />
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    pointerEvents: 'box-none', // Allow touches to pass through to camera except for buttons
  },
  topBar: {
    height: 80 + (Platform.OS === 'ios' ? 44 : 24), // Increased height for better coverage
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 24, // Add top padding for status bar
    pointerEvents: 'box-none',
  },
  exitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    pointerEvents: 'auto',
  },
  instructionsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 40, // Increased padding to avoid overlap with top bar
    pointerEvents: 'none',
  },
  instructions: {
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  bottomBar: {
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    pointerEvents: 'box-none',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#22c55e',
    pointerEvents: 'auto',
  },
  captureButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
    opacity: 0.6,
  },
  skipButtonTouch: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    pointerEvents: 'auto',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    width: 60,
    pointerEvents: 'none',
  },
});

CameraInterface.displayName = 'CameraInterface';

export default CameraInterface;
