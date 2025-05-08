import React, { useRef, useEffect, useState } from 'react';
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
  Linking,
  Alert,
} from 'react-native';
import { CameraView, PermissionStatus } from 'expo-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { COLORS as ThemeColors } from '../../constants/theme';

interface CameraScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (photoBase64: string) => Promise<void>;
  permissionStatus: { granted: boolean; canAskAgain: boolean; status: PermissionStatus } | null;
  requestPermission: () => Promise<{ granted: boolean; canAskAgain: boolean; status: PermissionStatus }>;
  isAnalyzing: boolean;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onCapture,
  permissionStatus,
  requestPermission,
  isAnalyzing,
}) => {
  const internalCameraRef = useRef<CameraView>(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const [analysisMessage, setAnalysisMessage] = useState('Analyzing your photo...');
  
  const analysisPhrases = [
    "Analyzing your photo...",
    "Identifying items...",
    "Checking for details...",
    "Processing...",
    "Almost complete...",
  ];

  useEffect(() => {
    if (isAnalyzing) {
      startSpinAnimation();
      const messageInterval = setInterval(() => {
        setAnalysisMessage(prev => {
          const currentIndex = analysisPhrases.indexOf(prev);
          const nextIndex = (currentIndex + 1) % analysisPhrases.length;
          return analysisPhrases[nextIndex];
        });
      }, 2000);
      return () => clearInterval(messageInterval);
    } else {
      spinValue.stopAnimation();
      setAnalysisMessage('Analyzing your photo...');
    }
  }, [isAnalyzing]);

  const startSpinAnimation = () => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleInternalCapture = async () => {
    if (!internalCameraRef.current || isAnalyzing) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await internalCameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (photo && photo.base64) {
        await onCapture(photo.base64);
      } else {
        throw new Error("Failed to capture image or get base64 data.");
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Capture Error', 'Could not take picture. Please try again.');
    }
  };

  const renderContent = () => {
    if (!permissionStatus) {
      return (
        <View style={styles.permissionDeniedView}>
          <ActivityIndicator size="large" color={ThemeColors.primary || '#007AFF'} />
          <Text style={styles.permissionText}>Checking camera permissions...</Text>
        </View>
      );
    }

    if (!permissionStatus.granted) {
      return (
        <View style={styles.permissionDeniedView}>
          <Icon name="no-photography" size={50} color="#777" />
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            To scan items, please grant camera permission.
          </Text>
          {permissionStatus.canAskAgain ? (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.permissionButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.permissionButton, styles.closeTextButton]} onPress={onClose}>
             <Text style={[styles.permissionButtonText, styles.closeTextButtonText]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <CameraView
        ref={internalCameraRef}
        style={styles.cameraPreview}
        facing={'back'}
      >
        <View style={styles.cameraOverlayTop}>
            <Text style={styles.cameraInstructions}>
                Position items clearly in the frame. Good lighting helps!
            </Text>
        </View>

        <View style={styles.cameraControlsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, styles.closeButton, isAnalyzing && styles.disabledButton]}
            onPress={onClose}
            disabled={isAnalyzing}
          >
            <Ionicons name="close-circle" size={40} color="#FFF" />
          </TouchableOpacity>

          {!isAnalyzing && (
            <TouchableOpacity 
                style={[styles.controlButton, styles.captureButton]} 
                onPress={handleInternalCapture}
                disabled={isAnalyzing}
            >
              <Ionicons name="radio-button-on-outline" size={70} color="white" />
            </TouchableOpacity>
          )}

           {/* Placeholder for other controls like flash, could be on the right */}
          <View style={{width: 40}} /> 

        </View>

        {isAnalyzing && (
          <View style={styles.analysisOverlay}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <MaterialCommunityIcons name="radar" size={60} color="#FFF" />
            </Animated.View>
            <Text style={styles.analysisTitle}>Analyzing...</Text>
            <Text style={styles.analysisText}>{analysisMessage}</Text>
          </View>
        )}
      </CameraView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => !isAnalyzing && onClose()}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        {renderContent()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#000', // Black background for camera view
  },
  cameraPreview: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraOverlayTop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  cameraInstructions: {
    color: '#FFF',
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cameraControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    // Style for the main capture button (center)
  },
  closeButton: {
    // Style for the close button (left or right)
  },
  disabledButton: {
    opacity: 0.5,
  },
  analysisOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analysisTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
  },
  analysisText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 10,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  permissionDeniedView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF', // White background for permission screen
    padding: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 25,
  },
  permissionButton: {
    backgroundColor: ThemeColors.primary || '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 15,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeTextButton: {
      backgroundColor: 'transparent',
      marginTop: 5,
  },
  closeTextButtonText: {
      color: ThemeColors.primary || '#007AFF',
      fontWeight: 'normal',
  }
});

export default CameraScannerModal;
