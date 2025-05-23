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
  isAnalyzing: boolean;
  showSkipButton?: boolean;
  instructionText?: string;
}

const CameraInterface = forwardRef<CameraView, CameraInterfaceProps>(({
  onCapturePress,
  onSkipPress,
  isAnalyzing,
  showSkipButton = false,
  instructionText = "Position your pantry items clearly in the frame.",
}, ref) => {
  return (
    <CameraView
      ref={ref}
      style={styles.camera}
      facing="back"
    >
      <View style={styles.overlay}>
        {/* Instructions */}
        <Text style={styles.instructions}>
          {instructionText}
        </Text>

        {/* Bottom Controls */}
        <View style={styles.bottomBar}>
          {showSkipButton ? (
            <TouchableOpacity 
              style={styles.skipButtonTouch} 
              onPress={onSkipPress}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.spacer} />
          )}

          <TouchableOpacity 
            style={[
              styles.captureButton,
              isAnalyzing && styles.captureButtonDisabled
            ]} 
            onPress={onCapturePress} 
            disabled={isAnalyzing}
          >
            <Ionicons 
              name="camera" 
              size={40} 
              color={isAnalyzing ? "#ccc" : "#22c55e"} 
            />
          </TouchableOpacity>

          {/* Placeholder for symmetry */}
          <View style={styles.spacer} />
        </View>
      </View>
    </CameraView>
  );
});

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  instructions: {
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    marginTop: 32 + (Platform.OS === 'ios' ? 20 : 0),
    marginHorizontal: 16,
    borderRadius: 8,
    fontSize: 14,
  },
  bottomBar: {
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  captureButtonDisabled: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  skipButtonTouch: {
    padding: 8,
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    width: 50,
  },
});

CameraInterface.displayName = 'CameraInterface';

export default CameraInterface; 