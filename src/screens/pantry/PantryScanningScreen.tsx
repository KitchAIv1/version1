import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  Modal as RNModal,
} from 'react-native';
import {
  CameraView,
  CameraCapturedPicture,
} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { Button } from 'react-native-paper';

import { useStockManager, PreparedItem, ConfirmedStockItemFromModal } from '../../hooks/useStockManager';
// import StockConfirmation from '../../../components/stock/StockConfirmation'; // Temporarily disable StockConfirmation

export default function PantryScanningScreen() {
  console.log('[PantryScanningScreen] Component RENDERED or RE-RENDERED - JULY_22_DIAGNOSTIC');

  // ---------- refs & state ----------
  const {
    cameraRef,
    permissionStatus: perm,
    requestPermission: requestPerm,
    isCameraVisible,
    openCamera,
    closeStockConfirmationModal,
    ensureCameraPermission,
  } = useStockManager();

  const nav = useNavigation();
  const [showTestModalDirectly, setShowTestModalDirectly] = useState(false);
  console.log('[PantryScanningScreen] current showTestModalDirectly state:', showTestModalDirectly);

  // ---------- ask once on mount / manage camera visibility ----------
  useEffect(() => {
    console.log('[PantryScanningScreen] useEffect for manageCamera RUNNING');
    const manageCamera = async () => {
      const hasPermission = await ensureCameraPermission();
      if (hasPermission) {
        openCamera();
      } else {
        // Potentially navigate back or show persistent message if no permission
        // This is important if perm.canAskAgain becomes false
        if (perm && perm.status === 'denied' && !perm.canAskAgain) {
            // Alert.alert("Camera Access Required", "Please enable camera permissions in your device settings to use this feature.");
            // nav.goBack(); // Example: go back if permission permanently denied
        }
      }
    };
    manageCamera();
  }, [ensureCameraPermission, openCamera, perm, nav]);

  // ---------- helpers ----------
  const handleSnapPress = () => {
    console.log('[PantryScanningScreen] handleSnapPress CALLED. Current showTestModalDirectly:', showTestModalDirectly);
    setShowTestModalDirectly(true);
    console.log('[PantryScanningScreen] handleSnapPress: setShowTestModalDirectly(true) has been CALLED.');
  };

  // ---------- render states ----------
  if (!perm)
    return (
      <Centered>
        <ActivityIndicator size="large" />
        <Text style={styles.centeredText}>Initializing camera... JULY_22_VISIBLE_TEST</Text>
      </Centered>
    );

  if (!perm.granted)
    return (
      <Centered>
        <Text style={styles.centeredText}>
          We need camera access... JULY_22_VISIBLE_TEST
        </Text>
        <Button mode="contained" onPress={requestPerm}>
          Grant permission
        </Button>
        {perm.status === 'denied' && !perm.canAskAgain && (
           <Text style={{textAlign: 'center', marginTop:10, color: 'grey'}}>Permission was denied. Please enable it in settings.</Text>
        )}
      </Centered>
    );

  return (
    <View style={styles.container}>
      {isCameraVisible && !showTestModalDirectly && (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing='back'
        />
      )}

      {isCameraVisible && !showTestModalDirectly && (
        <Button
          mode="contained"
          icon="camera"
          onPress={handleSnapPress}
          style={styles.fab}
          contentStyle={{ height: 54 }}
          children={null}
        />
      )}

      {showTestModalDirectly && (
        <RNModal visible={showTestModalDirectly} transparent={false} animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'magenta', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 30, color: 'black' }}>IMMEDIATE TEST MODAL</Text>
            <Button 
              mode="contained" 
              onPress={() => {
                setShowTestModalDirectly(false);
                closeStockConfirmationModal();
                if (!isCameraVisible) openCamera();
              }}
              style={{ marginTop: 20 }}
            >
              Close Immediate Test Modal
            </Button>
          </View>
        </RNModal>
      )}
      
      {/* {isStockConfirmationVisible && scannedItemsForConfirmation && Array.isArray(scannedItemsForConfirmation) && (
        <StockConfirmation
          isVisible={isStockConfirmationVisible} 
          items={scannedItemsForConfirmation} 
          isProcessing={isSaving} 
          onConfirm={(confirmedItems: ConfirmedStockItemFromModal[]) => { 
            handleConfirmStockItems(confirmedItems);
          }}
          onCancel={() => { 
            closeStockConfirmationModal();
            if (!isCameraVisible) openCamera();
          }}
        />
      )} */}
    </View>
  );
}

/* ---------- helper component ---------- */
const Centered = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.center}>{children}</View>
);

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: '#22c55e',
  },
  hud: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  hudText: { marginTop: 12, color: '#fff', fontSize: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  centeredText: { textAlign: 'center', marginBottom: 16, color: '#000', fontSize: 16 },
});