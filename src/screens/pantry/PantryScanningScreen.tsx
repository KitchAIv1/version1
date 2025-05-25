import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  StatusBar,
} from 'react-native';
import {
  CameraView,
  CameraCapturedPicture,
  useCameraPermissions,
} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Button } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';

import { 
  ScanningLoadingOverlay, 
  CameraInterface, 
  ItemConfirmationModal 
} from '../../components/pantry';
import {
  processImageWithAI,
  enforceMinimumDisplayTime,
  ScannedItem,
  ItemToUpsert,
} from '../../utils/pantryScanning';
import { supabase } from '../../services/supabase';

export default function PantryScanningScreen() {
  // ---------- refs & state ----------
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const nav = useNavigation();
  const queryClient = useQueryClient();
  
  // Enhanced state management for V1 features
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[] | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState('Analyzing your pantry...');
  
  // Analysis message cycling
  const analysisPhrases = [
    "Analyzing your pantry...",
    "Identifying items...",
    "Looking for ingredients...",
    "Processing labels...",
    "Almost done...",
    "AI is working its magic..."
  ];

  // Camera management functions
  const openCamera = () => setIsCameraVisible(true);
  const closeCamera = () => {
    setIsCameraVisible(false);
    nav.goBack(); // Navigate back to previous screen
  };
  
  const ensureCameraPermission = async (): Promise<boolean> => {
    if (!permission) return false;
    
    if (permission.granted) return true;
    
    if (permission.status === 'denied' && !permission.canAskAgain) {
      Alert.alert(
        'Permission Required',
        'Camera access was permanently denied. Please enable it in your device settings.'
      );
      return false;
    }
    
    const { granted } = await requestPermission();
    return granted;
  };

  // ---------- ask once on mount / manage camera visibility ----------
  useEffect(() => {
    const manageCamera = async () => {
      const hasPermission = await ensureCameraPermission();
      if (hasPermission) {
        openCamera();
      } else {
        if (permission && permission.status === 'denied' && !permission.canAskAgain) {
          // Handle permanent denial if needed
        }
      }
    };
    manageCamera();
  }, [permission, nav]);

  // Cycle through analysis messages
  useEffect(() => {
    if (isAnalyzing) {
      const messageInterval = setInterval(() => {
        setAnalysisMessage(prev => {
          const currentIndex = analysisPhrases.indexOf(prev);
          const nextIndex = (currentIndex + 1) % analysisPhrases.length;
          return analysisPhrases[nextIndex];
        });
      }, 2000);
      
      return () => clearInterval(messageInterval);
    }
  }, [isAnalyzing]);

  // ---------- Enhanced camera capture with V1 logic ----------
  const handleCameraCapture = async () => {
    if (!permission) {
      Alert.alert('Permission Required', 'Camera access is needed.');
      const { granted } = await requestPermission();
      if (!granted) return;
    }

    if (!cameraRef.current) {
      Alert.alert("Error", "Camera not ready.");
      return;
    }

    setIsAnalyzing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const analysisStartTime = Date.now();
      
      // Take picture with enhanced quality settings
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      // Process image with AI recognition
      const recognitionResult = await processImageWithAI(photo.base64!);
      
      // Enforce minimum display time for better UX
      await enforceMinimumDisplayTime(analysisStartTime, 4000);

      if (recognitionResult.items.length === 0) {
        setIsAnalyzing(false);
        Alert.alert('No Items Recognized', 'Could not detect items. Try a different angle or better lighting?');
      } else {
        setScannedItems(recognitionResult.items);
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('[PantryScanningScreen] Enhanced capture/analysis error:', error);
      setIsAnalyzing(false);
      Alert.alert('Error', `Failed to process image: ${(error as Error).message}`);
    }
  };

  // ---------- Enhanced confirmation handlers ----------
  const handleConfirmItems = async (itemsToUpsert: ItemToUpsert[]) => {
    setScannedItems(null); // Close confirmation modal
    setIsSaving(true);

    try {
      if (itemsToUpsert.length > 0) {
        // Use Supabase directly for upsert operation
        const { error } = await supabase
          .from('stock')
          .upsert(itemsToUpsert, { 
            onConflict: 'user_id, item_name'
          });
          
        if (error) {
          console.error('[PantryScanningScreen] Error saving items:', error);
          throw error;
        }
        
        // Invalidate React Query cache to refresh all pantry-related data
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        
        Alert.alert('Success', `${itemsToUpsert.length} items added to your pantry!`);
      }
    } catch (error) {
      console.error('[PantryScanningScreen] Error in handleConfirmItems:', error);
      Alert.alert('Error', `Failed to save items: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
      // Reopen camera for next scan
      if (!isCameraVisible) openCamera();
    }
  };

  const handleCancelConfirmation = () => {
    setScannedItems(null);
    // Reopen camera
    if (!isCameraVisible) openCamera();
  };

  // ---------- render states ----------
  if (!permission)
    return (
      <Centered>
        <ActivityIndicator size="large" />
        <Text style={styles.centeredText}>Initializing camera...</Text>
      </Centered>
    );

  if (!permission.granted)
    return (
      <Centered>
        <Text style={styles.centeredText}>
          We need camera access to scan your pantry items
        </Text>
        <Button mode="contained" onPress={requestPermission}>
          Grant permission
        </Button>
        {permission.status === 'denied' && !permission.canAskAgain && (
           <Text style={{textAlign: 'center', marginTop:10, color: 'grey'}}>
             Permission was denied. Please enable it in settings.
           </Text>
        )}
      </Centered>
    );

  return (
    <>
      {/* Status bar configuration */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true}
        hidden={isCameraVisible && !scannedItems} 
      />
      
      <View style={styles.container}>
        {/* Enhanced Camera Interface */}
        {isCameraVisible && !scannedItems && (
          <CameraInterface
            ref={cameraRef}
            onCapturePress={handleCameraCapture}
            onExitPress={closeCamera}
            isAnalyzing={isAnalyzing}
            showExitButton={true}
            instructionText="Position your pantry items clearly in the frame and tap to scan"
          />
        )}

        {/* Enhanced Item Confirmation Modal */}
        {scannedItems && (
          <ItemConfirmationModal
            isVisible={!!scannedItems}
            items={scannedItems}
            onConfirm={handleConfirmItems}
            onCancel={handleCancelConfirmation}
            isProcessing={isSaving}
          />
        )}

        {/* Enhanced Loading Overlay */}
        <ScanningLoadingOverlay
          isVisible={isAnalyzing || isSaving}
          isAnalyzing={isAnalyzing}
          isSaving={isSaving}
          analysisMessage={analysisMessage}
        />
      </View>
    </>
  );
}

/* ---------- helper component ---------- */
const Centered = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.center}>{children}</View>
);

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000',
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32, 
    backgroundColor: '#fff' 
  },
  centeredText: { 
    textAlign: 'center', 
    marginBottom: 16, 
    color: '#000', 
    fontSize: 16 
  },
});