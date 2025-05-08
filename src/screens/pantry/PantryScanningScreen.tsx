import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  CameraCapturedPicture,
} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { pantryScan } from '../../services/pantryScan';
import { usePantry } from '../../hooks/usePantry';
import { useNavigation } from '@react-navigation/native';
import { Button, Snackbar } from 'react-native-paper';

export default function PantryScanningScreen() {
  // ---------- refs & state ----------
  const camRef = useRef<CameraView>(null);
  const [loading, setLoading] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();
  const [snack, setSnack] = useState<string | null>(null);

  const { upsert } = usePantry();
  const nav = useNavigation();

  // ---------- ask once on mount ----------
  useEffect(() => {
    if (perm?.status === 'undetermined') requestPerm();
  }, [perm]);

  // ---------- helpers ----------
  const showError = (msg: string) => Alert.alert('Scan error', msg);

  const snap = async () => {
    try {
      if (!camRef.current) {
        return showError('Camera not ready');
      }
      setLoading(true);

      const photo: CameraCapturedPicture | undefined = await camRef.current.takePictureAsync({ base64: true });
      
      if (!photo || !photo.uri) {
        throw new Error('Failed to capture photo or URI is missing.');
      }

      const manip = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 512 } }],
        { base64: true }
      );

      if (!manip.base64) throw new Error('No base64 data from manipulation');

      const items = await pantryScan(manip.base64);

      if (items.length) {
        const transformedItems = items.map(item => ({
          name: item.name,
          quantity: parseInt(item.quantity, 10) || 1, // Changed from qty to quantity
        }));
        await upsert.mutateAsync(transformedItems);
        setSnack(`Added ${transformedItems.length} item${transformedItems.length > 1 ? 's' : ''}`);
      } else {
        setSnack('No items recognised');
      }
      nav.goBack();
    } catch (e: any) {
      console.error('[pantry-scan]', e);
      showError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ---------- render states ----------
  if (!perm)
    return (
      <Centered>
        <ActivityIndicator size="large" />
        <Text style={styles.centeredText}>Requesting permission…</Text>
      </Centered>
    );

  if (!perm.granted)
    return (
      <Centered>
        <Text style={styles.centeredText}>
          We need camera access to scan pantry items.
        </Text>
        <Button mode="contained" onPress={requestPerm}>
          Grant permission
        </Button>
      </Centered>
    );

  return (
    <View style={styles.container}>
      <CameraView
        ref={camRef}
        style={styles.camera}
        facing='back'
      />

      {/* Shutter */}
      <Button
        mode="contained"
        icon="camera"
        onPress={snap}
        disabled={loading}
        style={styles.fab}
        contentStyle={{ height: 54 }}
        children={null}
      />

      {/* HUD */}
      {loading && (
        <View style={styles.hud}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.hudText}>Scanning…</Text>
        </View>
      )}

      {/* Toast */}
      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={2500}
      >
        {snack}
      </Snackbar>
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
    backgroundColor: '#0009',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hudText: { marginTop: 12, color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  centeredText: { textAlign: 'center', marginBottom: 16, color: '#000' },
});