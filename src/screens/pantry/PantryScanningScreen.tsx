import React, { useRef, useState } from 'react';
import { View, ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { pantryScan } from '../../services/pantryScan';
import { usePantry } from '../../hooks/usePantry';
import { useNavigation } from '@react-navigation/native';
import { Button } from 'react-native-paper';

export default function PantryScanningScreen() {
  const camRef = useRef<CameraView>(null);
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { upsert } = usePantry();
  const nav = useNavigation();

  // Log permission status
  console.log("Camera Permission Status:", JSON.stringify(permission));

  const snap = async () => {
    if (!camRef.current) {
      Alert.alert("Error", "Camera component is not ready.");
      return;
    }
    try {
      setLoading(true);
      const photo: CameraCapturedPicture | undefined = await camRef.current.takePictureAsync({
         base64: true, 
         quality: 0.5 
      });
      
      if (!photo || !photo.base64) {
        throw new Error("Failed to capture photo or get base64 data.");
      }

      const items = await pantryScan(photo.base64);
      if (items && items.length > 0) {
        await upsert.mutateAsync(items);
        Alert.alert('Scan complete', `Added ${items.length} item(s) to your pantry.`);
      } else {
        Alert.alert('Scan complete', 'No items were detected or added.');
      }
      nav.goBack();
    } catch (e: any) {
      console.error("Error during pantry scan process:", e);
      Alert.alert('Error scanning items', e.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Check permission status from the hook
  if (!permission) {
    // Permissions are still loading - Add Yellow BG
    console.log("Rendering: Permission loading state");
    return <View style={[styles.centered, { backgroundColor: 'yellow' }]}><ActivityIndicator size="large" /><Text>Loading Permissions...</Text></View>;
  }

  if (!permission.granted) {
    // Permissions are not granted - Add Red BG
    console.log("Rendering: Permission denied state");
    return (
      <View style={[styles.centered, { backgroundColor: 'red' }]}>
        <Text style={styles.permissionText}>Camera permission is needed to scan items.</Text>
        <Button onPress={requestPermission} mode="outlined" style={{marginTop: 10}}>
            Grant Permission
        </Button>
      </View>
    );
  }

  // Permissions are granted - Add Green BG to container (CameraView should cover it)
  console.log("Rendering: Permission granted state (CameraView)");
  return (
    <View style={[styles.container, { backgroundColor: 'lightgreen' }]}>
      <CameraView 
        ref={camRef}
        style={styles.camera} 
        facing='back'
      />
      <Button
        mode="contained"
        onPress={snap}
        disabled={loading}
        style={styles.button}
        labelStyle={styles.buttonLabel}
        contentStyle={styles.buttonContent}
        icon={loading ? undefined : "camera"}
      >
        {loading ? <ActivityIndicator color="#fff" size="small" /> : 'Scan Pantry'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  button: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    borderRadius: 30,
    paddingVertical: 8,
    backgroundColor: '#22c55e', 
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonContent: {
    height: 50,
    paddingHorizontal: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // backgroundColor: '#fff', // BG set inline for debugging
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: '#fff', // Make text visible on red bg
  }
}); 