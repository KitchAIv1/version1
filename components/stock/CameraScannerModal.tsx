import React, { useRef, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { CameraView } from 'expo-camera'; // CameraView for preview
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { PermissionStatus, PermissionResponse } from 'expo-camera'; // Assuming these are correctly available

interface CameraScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (base64: string) => Promise<void>; // Expects a promise to handle analysis state
  cameraRef: React.RefObject<CameraView>; // Pass the ref from useStockManager
  permissionStatus: PermissionStatus | null;
  requestPermission: () => Promise<PermissionResponse>; // from useCameraPermissions
  isAnalyzing: boolean; // To show analysis overlay
}

const ANALYSIS_PHRASES = [
  'Analyzing your pantry...',
  'Identifying items...',
  'Checking barcodes & labels...',
  'Cross-referencing ingredients...',
  'Almost there...',
  'AI is working its magic!',
];

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onCapture,
  cameraRef,
  permissionStatus,
  requestPermission,
  isAnalyzing,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const [analysisMessage, setAnalysisMessage] = useState(ANALYSIS_PHRASES[0]);

  useEffect(() => {
    if (visible) {
      setHasPermission(permissionStatus === PermissionStatus.GRANTED);
    }
  }, [visible, permissionStatus]);

  useEffect(() => {
    let messageInterval: NodeJS.Timeout | undefined; // Initialize to undefined
    if (isAnalyzing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
      messageInterval = setInterval(() => {
        setAnalysisMessage(prev => {
          const currentIndex = ANALYSIS_PHRASES.indexOf(prev);
          return ANALYSIS_PHRASES[(currentIndex + 1) % ANALYSIS_PHRASES.length];
        });
      }, 2500);
    } else {
      spinValue.setValue(0); // Reset spin
      if (messageInterval) clearInterval(messageInterval);
      setAnalysisMessage(ANALYSIS_PHRASES[0]); // Reset message
    }
    return () => {
      if (messageInterval) clearInterval(messageInterval); // Ensure cleanup
    };
  }, [isAnalyzing, spinValue]);

  const handleRequestPermission = async () => {
    const response = await requestPermission();
    setHasPermission(response.status === PermissionStatus.GRANTED);
  };

  const takePicture = async () => {
    if (cameraRef.current && !isAnalyzing) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
        });
        if (photo && photo.base64) {
          await onCapture(photo.base64); // Let the hook handle setting isAnalyzing
        }
      } catch (error) {
        console.error('Failed to take picture:', error);
        // Optionally, show an alert to the user
        onClose(); // Close modal on error to prevent being stuck
      }
    }
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderContent = () => {
    if (hasPermission === null && visible) {
      // Still checking or just opened
      return (
        <View style={styles.centeredMessageContainer}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      );
    }
    if (hasPermission === false) {
      return (
        <View style={styles.centeredMessageContainer}>
          <Icon name="no-photography" size={60} color="#ffc107" />
          <Text style={styles.permissionText}>
            Camera access is required to scan items.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handleRequestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.permissionButton, styles.closeTextButton]}
            onPress={onClose}>
            <Text style={styles.permissionButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back">
        <SafeAreaView style={styles.cameraOverlay}>
          <TouchableOpacity
            style={[styles.overlayButton, styles.closeIcon]}
            onPress={onClose}
            disabled={isAnalyzing}>
            <Ionicons name="close-circle" size={36} color="white" />
          </TouchableOpacity>

          {!isAnalyzing && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                Position items clearly in the frame. Good lighting helps!
              </Text>
            </View>
          )}

          <View style={styles.bottomControlsContainer}>
            {!isAnalyzing && (
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}>
                <Ionicons name="scan-circle-outline" size={80} color="white" />
              </TouchableOpacity>
            )}
          </View>

          {isAnalyzing && (
            <View style={styles.analysisOverlay} pointerEvents="none">
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <MaterialCommunityIcons name="radar" size={70} color="#FFF" />
              </Animated.View>
              <Text style={styles.analysisTitle}>Scanning Pantry</Text>
              <Text style={styles.analysisText}>{analysisMessage}</Text>
            </View>
          )}
        </SafeAreaView>
      </CameraView>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={() => !isAnalyzing && onClose()} // Prevent closing while analyzing
    >
      <View style={styles.modalContainer}>{renderContent()}</View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: Platform.OS === 'ios' ? 20 : 15,
  },
  overlayButton: {
    padding: 10,
  },
  closeIcon: {
    alignSelf: 'flex-start',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    zIndex: 10,
  },
  instructionsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 80 : 70,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#FFF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'white',
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#212121', // Darker background for permission screen
    padding: 30,
  },
  permissionText: {
    color: '#E0E0E0',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#22c55e', // Green
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 15,
    minWidth: '70%',
    alignItems: 'center',
  },
  closeTextButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#757575',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  analysisOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20, // Ensure it's on top
  },
  analysisTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 10,
  },
  analysisText: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default CameraScannerModal;
