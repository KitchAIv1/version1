import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform, Linking } from 'react-native'; 
import { supabase } from '../services/supabase'; 
import { CameraView, useCameraPermissions, PermissionStatus, PermissionResponse } from 'expo-camera'; 
import * as ImagePicker from 'expo-image-picker'; 
import { decode } from 'base64-arraybuffer'; 

export interface StockItem {
  id?: string | number; 
  item_name: string;
  quantity: number; 
  unit: string; 
  description?: string | null;
  user_id?: string; 
}

interface RawStockItem extends Omit<StockItem, 'quantity'> {
    quantity: string | number; 
}

export interface RecognizedItem {
    name: string;
    quantity: string; 
}

export interface PreparedItem {
    item_name: string;
    quantity: number;
    unit: string;
    description?: string | null;
}

export type UnitOption = { label: string; value: string };

export const DEFAULT_UNIT_OPTIONS: UnitOption[] = [
    { label: 'Units', value: 'units' },
    { label: 'Grams (g)', value: 'g' },
    { label: 'Kilograms (kg)', value: 'kg' },
    { label: 'Milliliters (ml)', value: 'ml' },
    { label: 'Liters (l)', value: 'l' },
    { label: 'Ounces (oz)', value: 'oz' },
    { label: 'Pounds (lbs)', value: 'lbs' },
    { label: 'Cups', value: 'cups' },
];

const parseRecognizedQuantity = (recognizedQty: string): { quantity: number, unit: string } => {
    if (!recognizedQty || typeof recognizedQty !== 'string') {
        return { quantity: 1, unit: 'units' }; 
    }
    const qLower = recognizedQty.toLowerCase().trim();
    const unitPatterns = [
        { unit: 'ml', regex: /(\d+(\.\d+)?)\s*ml/ },
        { unit: 'l', regex: /(\d+(\.\d+)?)\s*l/ },
        { unit: 'kg', regex: /(\d+(\.\d+)?)\s*kg/ },
        { unit: 'g', regex: /(\d+(\.\d+)?)\s*g/ },
        { unit: 'oz', regex: /(\d+(\.\d+)?)\s*oz/ },
        { unit: 'lbs', regex: /(\d+(\.\d+)?)\s*lbs/ },
        { unit: 'cups', regex: /(\d+(\.\d+)?)\s*cups?/ },
        { unit: 'units', regex: /(\d+(\.\d+)?)/ },
    ];
    for (const pattern of unitPatterns) {
        const match = qLower.match(pattern.regex);
        if (match && match[1]) {
            const num = parseFloat(match[1]);
            if (!isNaN(num)) {
                return { quantity: num, unit: pattern.unit };
            }
        }
    }
    return { quantity: 1, unit: 'units' }; 
};

export const useStockManager = () => {
  const [stockData, setStockData] = useState<StockItem[]>([]); 
  const [userId, setUserId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false); 
  const [isSaving, setIsSaving] = useState(false); 
  const [isDeleting, setIsDeleting] = useState(false); 
  const [isRecognizing, setIsRecognizing] = useState(false);

  const [error, setError] = useState<string | null>(null); 
  const [saveError, setSaveError] = useState<string | null>(null); 
  const [deleteError, setDeleteError] = useState<string | null>(null); 
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const [permission, requestPermission] = useCameraPermissions(); 
  const cameraRef = useRef<CameraView | null>(null); 

  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);

  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error fetching session:', sessionError.message);
        setError('Failed to initialize user session.'); 
        return;
      }
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        console.warn('No active user session.');
        setError('No active user session. Please login.'); 
      }
    };
    fetchUser();
  }, []);

  const fetchStock = useCallback(async (currentUserId?: string | null) => {
    const idToUse = currentUserId || userId;
    if (!idToUse) {
      setError("User ID not available. Cannot fetch stock.");
      console.warn("[useStockManager] fetchStock aborted: No user ID.");
      return;
    }
    console.log([useStockManager] Fetching stock for user: ${idToUse});
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('stock') 
        .select('id, item_name, quantity, unit, description') 
        .eq('user_id', idToUse)
        .order('item_name', { ascending: true });
      if (dbError) throw dbError;
      const formattedData = data?.map((item: RawStockItem) => ({ 
          ...item, 
          quantity: Number(item.quantity) 
        })) || [];
      setStockData(formattedData);
    } catch (err: any) {
      console.error("[useStockManager] Error fetching stock:", err);
      setError(err.message || "Failed to load stock data.");
      setStockData([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchStock(userId);
    }
  }, [userId, fetchStock]);

  const openCamera = () => setIsCameraVisible(true);
  const closeCamera = () => setIsCameraVisible(false);
  const openManualModal = (itemToEdit?: StockItem) => {
    setEditingItem(itemToEdit || null);
    setIsManualModalVisible(true);
  };
  const closeManualModal = () => {
    setIsManualModalVisible(false);
    setEditingItem(null); 
  };

  const prepareEditItem = (item: StockItem) => {
    setEditingItem(item);
    setIsManualModalVisible(true);
  };

  const handleSaveItem = async (itemToSave: StockItem, originalItemName?: string): Promise<boolean> => {
    if (!userId) {
      setSaveError("User ID not available. Cannot save item.");
      Alert.alert("Error", "User session not found. Cannot save item.");
      return false;
    }
    setIsSaving(true);
    setSaveError(null);
    console.log('[useStockManager] Saving item:', itemToSave, 'Original name:', originalItemName);
    try {
      const itemPayload: Omit<StockItem, 'id'> & { user_id: string } = {
        user_id: userId,
        item_name: itemToSave.item_name,
        quantity: Number(itemToSave.quantity), 
        unit: itemToSave.unit,
        description: itemToSave.description || null,
      };
      let response;
      if (originalItemName && originalItemName !== itemToSave.item_name) {
        console.log([useStockManager] Updating item by matching old name: ${originalItemName} to ${itemToSave.item_name});
        response = await supabase
            .from('stock')
            .update(itemPayload)
            .match({ user_id: userId, item_name: originalItemName });
      } else if (itemToSave.id) { 
         console.log([useStockManager] Updating item by ID: ${itemToSave.id});
        response = await supabase
            .from('stock')
            .update(itemPayload)
            .match({ id: itemToSave.id, user_id: userId });
      } else { 
        console.log('[useStockManager] Upserting new item:', itemPayload.item_name);
        response = await supabase
          .from('stock')
          .upsert({ ...itemPayload }, { onConflict: 'user_id,item_name' }); 
      }
      const { error: saveDbError } = response;
      if (saveDbError) throw saveDbError;
      console.log('[useStockManager] Item saved successfully. Refreshing stock...');
      await fetchStock(userId);
      setIsSaving(false);
      closeManualModal(); 
      return true;
    } catch (err: any) {
      console.error('[useStockManager] Error saving item:', err);
      setSaveError(err.message || 'Failed to save item.');
      Alert.alert("Error saving item", err.message);
      setIsSaving(false);
      return false;
    }
  };
  
  const saveScannedItems = async (items: PreparedItem[]): Promise<boolean> => {
    if (!userId) {
        setSaveError("User ID not available. Cannot save items.");
        Alert.alert("Error", "User session not found. Cannot save items.");
        return false;
    }
    if (!items || items.length === 0) {
        console.log("[useStockManager] No items to save from scanner.");
        return true; 
    }
    setIsSaving(true); 
    setSaveError(null);
    const itemsToUpsert = items.map(item => ({
        user_id: userId,
        item_name: item.item_name,
        quantity: Number(item.quantity), 
        unit: item.unit,
        description: item.description || null,
    }));
    try {
        const { error: upsertDbError } = await supabase
            .from('stock')
            .upsert(itemsToUpsert, { onConflict: 'user_id,item_name' }); 
        if (upsertDbError) {
            console.error('[useStockManager] Supabase upsert error for scanned items:', upsertDbError);
            throw upsertDbError;
        }
        console.log('[useStockManager] Scanned items saved successfully. Refreshing stock...');
        await fetchStock(userId); 
        setIsSaving(false);
        return true;
    } catch (err: any) {
        console.error('[useStockManager] Error saving scanned items:', err);
        setSaveError(err.message || 'Failed to save scanned items.');
        Alert.alert("Error saving scanned items", err.message);
        setIsSaving(false);
        return false;
    }
  };

  const deleteStockItem = async (itemToDelete: StockItem) => {
    if (!userId || !itemToDelete.id && !itemToDelete.item_name) {
      setDeleteError("User or Item ID/Name not available. Cannot delete item.");
      Alert.alert("Error", "User session or item identifier not found. Cannot delete item.");
      return false;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      let query = supabase.from('stock').delete().eq('user_id', userId);
      if (itemToDelete.id) {
        console.log([useStockManager] Deleting item by ID: ${itemToDelete.id});
        query = query.eq('id', itemToDelete.id); 
      } else {
        console.log([useStockManager] Deleting item by name: ${itemToDelete.item_name});
        query = query.eq('item_name', itemToDelete.item_name);
      }
      const { error: deleteDbError } = await query;
      if (deleteDbError) throw deleteDbError;
      console.log('[useStockManager] Item deleted successfully. Refreshing stock...');
      await fetchStock(userId);
      setIsDeleting(false);
      return true;
    } catch (err: any) {
      console.error('[useStockManager] Error deleting item:', err);
      setDeleteError(err.message || 'Failed to delete item.');
      Alert.alert("Error deleting item", err.message);
      setIsDeleting(false);
      return false;
    }
  };

  const recognizeItemsFromImage = async (base64Image: string): Promise<PreparedItem[] | null> => {
    if (!base64Image) {
      setRecognitionError("No image data provided.");
      return null;
    }
    setIsRecognizing(true);
    setRecognitionError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-stock', {
        body: { image: base64Image }, 
      });
      if (functionError) throw functionError;
      if (!data || !Array.isArray(data.items)) {
        console.error('[useStockManager] Invalid data format from recognition service:', data);
        throw new Error('Invalid data format from recognition service.');
      }
      const preparedItems: PreparedItem[] = data.items.map((item: RecognizedItem) => {
        const { quantity, unit } = parseRecognizedQuantity(item.quantity);
        return {
            item_name: item.name,
            quantity: quantity,
            unit: unit,
        };
      });
      setIsRecognizing(false);
      return preparedItems;
    } catch (error: any) {
      console.error('[useStockManager] Image recognition error:', error);
      setRecognitionError(error.message || 'Failed to recognize items from image.');
      Alert.alert('Recognition Failed', error.message || 'Could not process image.');
      setIsRecognizing(false);
      return null;
    }
  };
  
  const handleCaptureAndProcessImage = async (base64Image: string) => {
    closeCamera(); 
    const recognizedItems = await recognizeItemsFromImage(base64Image);
    if (recognizedItems && recognizedItems.length > 0) {
      const success = await saveScannedItems(recognizedItems);
      if (success) {
        Alert.alert("Success", "Scanned items added to your stock!");
      } 
    } else if (recognizedItems === null) {
      // Error already handled
    } else {
      Alert.alert("No Items Recognized", "Could not find any items in the image. Try again?");
    }
  };

  const ensureCameraPermission = async (): Promise<boolean> => {
    if (!permission) { 
        const { status } = await requestPermission();
        return status === PermissionStatus.GRANTED;
    }
    if (permission.status === PermissionStatus.GRANTED) {
        return true;
    }
    if (permission.canAskAgain) {
        const { status } = await requestPermission();
        return status === PermissionStatus.GRANTED;
    } else {
        Alert.alert(
            'Permission Required',
            'Camera access was permanently denied. Please enable it in app settings.',
            [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() } 
            ]
        );
        return false;
    }
  };

  // Corrected Return Object Structure
  return {
    stockData,
    isLoading,
    error,
    isSaving,
    isDeleting,
    isRecognizing,
    userId, 
    saveError, 
    deleteError,
    recognitionError,
    
    cameraRef,
    permissionStatus: permission?.status,
    requestPermission, 
    ensureCameraPermission,
    isCameraVisible,
    openCamera,
    closeCamera,
    handleCaptureAndProcessImage, 

    isManualModalVisible,
    openManualModal, 
    closeManualModal,
    editingItem,
    setEditingItem, 
    handleSaveItem, 
    prepareEditItem, 

    unitOptions: DEFAULT_UNIT_OPTIONS,
    deleteStockItem, 
    fetchStock, 
  };
}; // End of useStockManager hook