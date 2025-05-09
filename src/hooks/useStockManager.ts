import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform, Linking } from 'react-native';
import { supabase } from '../services/supabase'; // Assuming supabase client is here
import { Camera, CameraView, useCameraPermissions, PermissionStatus } from 'expo-camera'; // Corrected Camera imports
import * as ImagePicker from 'expo-image-picker'; // For image picking if needed for testing or other features
import { decode } from 'base64-arraybuffer'; // For handling base64 for Supabase storage if applicable
// import { StockItem, UnitOption } from '../types'; // Assuming types are defined elsewhere

// Define basic types within the hook for now, can be moved to a types file later
export interface StockItem {
  id?: string | number; // Allow number if your DB uses auto-incrementing int PKs
  item_name: string;
  quantity: number; // Store quantity as number internally
  unit: string; // e.g., 'units', 'kg', 'g', 'ml', 'l'
  description?: string | null;
  user_id?: string; // Important for RLS
  // Add other fields like created_at, expiry_date if needed
}

// Type for raw item from Supabase before quantity conversion if needed
interface RawStockItem extends Omit<StockItem, 'quantity'> {
    quantity: string | number; // Supabase might return number as string sometimes
}

// Type for items coming from the recognition function
export interface RecognizedItem {
    name: string;
    quantity: string; // Typically a string like "1 piece", "200g"
}

// Type for the items after parsing/preparing for confirmation/upsert
export interface PreparedItem {
    item_name: string;
    quantity: number;
    unit: string;
    description?: string | null;
}

// Type for data coming from the modal on confirmation - ENSURE THIS IS EXPORTED
export type ConfirmedStockItemFromModal = { item_name: string; quantity: number; unit: string; description?: string | null };

// Type for items to be passed to the StockConfirmation component (from components/stock/StockConfirmation.tsx)
interface ScannedItemForConfirmation { // Renamed to avoid conflict if StockConfirmation itself exports a ScannedItem type
    name?: string;
    quantity?: string;
}

export type UnitOption = { label: string; value: string };

// Default unit options, similar to v1
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

// Helper to parse quantity and unit from a string like "200g" or "1 piece"
// This will be more robust than v1's getUnitFromString
const parseRecognizedQuantity = (recognizedQty: string): { quantity: number, unit: string } => {
    if (!recognizedQty || typeof recognizedQty !== 'string') {
        return { quantity: 1, unit: 'units' }; // Default
    }

    const qLower = recognizedQty.toLowerCase().trim();

    // Attempt to match common units
    const unitPatterns = [
        { unit: 'ml', regex: /(\d+(\.\d+)?)\s*ml/ },
        { unit: 'l', regex: /(\d+(\.\d+)?)\s*l/ },
        { unit: 'kg', regex: /(\d+(\.\d+)?)\s*kg/ },
        { unit: 'g', regex: /(\d+(\.\d+)?)\s*g/ },
        { unit: 'oz', regex: /(\d+(\.\d+)?)\s*oz/ },
        { unit: 'lbs', regex: /(\d+(\.\d+)?)\s*lbs/ },
        { unit: 'cups', regex: /(\d+(\.\d+)?)\s*cups?/ },
        // Generic number pattern (could be units, pieces, etc.)
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
    
    // Fallback if no number or specific unit is found
    return { quantity: 1, unit: 'units' }; 
};


export const useStockManager = () => {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  // Camera
  const [permission, requestCameraPermissionHookFn] = useCameraPermissions(); // Renamed to avoid conflict
  const cameraRef = useRef<CameraView | null>(null); // Use CameraView type for the ref

  // Modal Visibility States
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [isStockConfirmationVisible, setIsStockConfirmationVisible] = useState(false); // ADDED

  // Data for confirmation modal
  const [scannedItemsForConfirmation, setScannedItemsForConfirmation] = useState<ScannedItemForConfirmation[]>([]); // ADDED

  // Editing State
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Fetch user ID on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error fetching session:', sessionError.message);
        setError('Failed to initialize user session.'); // Generic error for UI
        return;
      }
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        console.warn('No active user session.');
        setError('No active user session. Please login.'); // Error for UI
      }
    };
    fetchUser();
  }, []);

  // Fetch Stock Data
  const fetchStock = useCallback(async (currentUserId?: string | null) => {
    const idToUse = currentUserId || userId;
    if (!idToUse) {
      setError("User ID not available. Cannot fetch stock.");
      console.warn("[useStockManager] fetchStock aborted: No user ID.");
      return;
    }

    console.log(`[useStockManager] Fetching stock for user: ${idToUse}`);
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('stock') // Your stock table name
        .select('id, item_name, quantity, unit, description') // Adjust columns as needed
        .eq('user_id', idToUse)
        .order('item_name', { ascending: true });

      if (dbError) throw dbError;

      console.log("[useStockManager] Raw stock data received:", data);
      // Ensure quantity is number if it's coming as string from DB (should be number)
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

  // Effect to fetch stock when userId is set
  useEffect(() => {
    if (userId) {
      fetchStock(userId);
    }
  }, [userId, fetchStock]);

  // Modal Handlers
  const openCamera = () => setIsCameraVisible(true);
  const closeCamera = () => setIsCameraVisible(false);
  const openManualModal = (itemToEdit?: StockItem) => {
    setEditingItem(itemToEdit || null);
    setIsManualModalVisible(true);
  };
  const closeManualModal = () => {
    setIsManualModalVisible(false);
    setEditingItem(null); // Clear editing item on close
  };

  // Prepare item for editing (alternative to passing item directly to openManualModal)
  const prepareEditItem = (item: StockItem) => {
    setEditingItem(item);
    setIsManualModalVisible(true);
  };

  // Save Stock Item (for ManualAddModal)
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
        quantity: Number(itemToSave.quantity), // Ensure quantity is a number
        unit: itemToSave.unit,
        description: itemToSave.description || null,
      };
      let response;
      if (originalItemName && originalItemName !== itemToSave.item_name) {
        console.log(`[useStockManager] Updating item by matching old name: ${originalItemName} to ${itemToSave.item_name}`);
        response = await supabase
            .from('stock')
            .update(itemPayload)
            .match({ user_id: userId, item_name: originalItemName });
      } else if (itemToSave.id) { 
         console.log(`[useStockManager] Updating item by ID: ${itemToSave.id}`);
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
      closeManualModal(); // Close modal on successful save
      return true;
    } catch (err: any) {
      console.error('[useStockManager] Error saving item:', err);
      setSaveError(err.message || 'Failed to save item.');
      Alert.alert("Error saving item", err.message);
      setIsSaving(false);
      return false;
    }
  };
  
  // Upsert multiple items (typically from scanner)
  const saveScannedItems = async (items: PreparedItem[]): Promise<boolean> => {
    if (!userId) {
        setSaveError("User ID not available. Cannot save items.");
        Alert.alert("Error", "User session not found. Cannot save items.");
        return false;
    }
    if (!items || items.length === 0) {
        console.log("[useStockManager] No items to save from scanner.");
        return true; // No items, so technically successful
    }

    setIsSaving(true);
    setSaveError(null);
    console.log('[useStockManager] Saving scanned items:', items);

    const itemsToUpsert = items.map(item => ({
        user_id: userId,
        item_name: item.item_name,
        quantity: Number(item.quantity), // Ensure quantity is a number
        unit: item.unit,
        description: item.description || null,
    }));

    try {
        const { error: upsertDbError } = await supabase
            .from('stock')
            .upsert(itemsToUpsert, { onConflict: 'user_id,item_name' }); // Assumes unique constraint on user_id, item_name

        if (upsertDbError) {
            console.error('[useStockManager] Supabase upsert error for scanned items:', upsertDbError);
            throw upsertDbError;
        }

        console.log('[useStockManager] Scanned items saved successfully. Refreshing stock...');
        await fetchStock(userId); // Refresh stock
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


  // Delete Stock Item
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
      // Prefer ID for deletion if available
      if (itemToDelete.id) {
        console.log(`[useStockManager] Deleting item by ID: ${itemToDelete.id}`);
        query = query.eq('id', itemToDelete.id); 
      } else {
        console.log(`[useStockManager] Deleting item by name: ${itemToDelete.item_name}`);
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

  // Recognize Items from Image (using Supabase Edge Function)
  const recognizeItemsFromImage = async (base64Image: string): Promise<PreparedItem[] | null> => {
    if (!base64Image) {
      setRecognitionError("No image data provided.");
      return null;
    }
    setIsRecognizing(true);
    setRecognitionError(null);
    console.log('[useStockManager] Calling recognize-stock function...');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-stock', {
        body: { image: base64Image }, // V1 sent { image: photo.base64 }
      });

      if (functionError) throw functionError;
      
      // V1 expected { items: [{ name: string, quantity: string }] }
      // Let's assume the new function returns { items: [{ name: string, quantity: string }] }
      if (!data || !Array.isArray(data.items)) {
        console.error('[useStockManager] Invalid data format from recognition service:', data);
        throw new Error('Invalid data format from recognition service.');
      }
      
      console.log('[useStockManager] Items recognized raw:', data.items);

      // Parse and prepare items
      const preparedItems: PreparedItem[] = data.items.map((item: RecognizedItem) => {
        const { quantity, unit } = parseRecognizedQuantity(item.quantity);
        return {
            item_name: item.name,
            quantity: quantity,
            unit: unit,
            // description: null // or some default
        };
      });
      
      console.log('[useStockManager] Items prepared after parsing:', preparedItems);
      setIsRecognizing(false);
      return preparedItems;

    } catch (error: any) {
      console.error('[useStockManager] Image recognition error:', error);
      setRecognitionError(error.message || 'Failed to recognize items from image.');
      setIsRecognizing(false);
      Alert.alert('Recognition Failed', error.message || 'Could not process image.');
      return null;
    }
  };
  
  // Stock Confirmation Modal Handlers
  const openStockConfirmationModal = (preparedItems: PreparedItem[]) => {
    console.log("[useStockManager] Opening stock confirmation for prepared items:", preparedItems);
    const itemsToConfirm: ScannedItemForConfirmation[] = preparedItems.map(item => ({
        name: item.item_name,
        quantity: `${item.quantity} ${item.unit || 'units'}` 
    }));
    setScannedItemsForConfirmation(itemsToConfirm);
    setIsStockConfirmationVisible(true);
  };

  const closeStockConfirmationModal = () => {
    setIsStockConfirmationVisible(false);
    setScannedItemsForConfirmation([]);
    closeCamera();
  };

  const handleConfirmStockItems = async (itemsToSave: ConfirmedStockItemFromModal[]) => {
    console.log("[useStockManager] User confirmed stock items:", itemsToSave);
    setIsStockConfirmationVisible(false);    
    const preparedItemsToSave: PreparedItem[] = itemsToSave.map(item => ({
      item_name: item.item_name,
      quantity: item.quantity,
      unit: item.unit,
      description: item.description || null
    }));
    // saveScannedItems MUST be defined before this point for this to work
    const success = await saveScannedItems(preparedItemsToSave); 
    if (success) {
      Alert.alert("Success", "Items added to your stock!");
    } 
    setScannedItemsForConfirmation([]);
    closeCamera();
  };

  // Combined handler for camera capture, recognition, and showing confirmation
  const handleCaptureAndProcessImage = async (base64Image: string) => {
    console.log('!!!!!! [useStockManager] DIAGNOSTIC: handleCaptureAndProcessImage WAS CALLED! base64Image present:', !!base64Image);
    Alert.alert(
      'DIAGNOSTIC ALERT FROM useStockManager',
      'handleCaptureAndProcessImage was unexpectedly called. This means old code is running or there is an unexpected trigger.'
    );
    // Temporarily disable the entire function to see if it's being called
    if (true) { // Ensure this path is taken
        setIsRecognizing(false); // Make sure any loading state is turned off
        setRecognitionError('Diagnostic: handleCaptureAndProcessImage was called but then aborted.');
        return; 
    }

    // Original logic (now effectively disabled by the return above):
    // console.log('[useStockManager] handleCaptureAndProcessImage: Closing camera first.');
    // closeCamera(); // Call this at the beginning as per user's new structure

    const recognizedPreparedItems = await recognizeItemsFromImage(base64Image);

    if (recognizedPreparedItems && recognizedPreparedItems.length > 0) {
      // console.log('[useStockManager] Items recognized, opening confirmation modal:', recognizedPreparedItems);
      openStockConfirmationModal(recognizedPreparedItems);
      closeCamera(); // Added this back as per one of the prior states that seemed logical
    } else if (recognizedPreparedItems === null) {
      // Error supposedly handled and alerted by recognizeItemsFromImage.
      // console.log('[useStockManager] Recognition returned null (error expected to be handled in recognizeItemsFromImage).');
      closeCamera();
    } else { // recognizedItems is an empty array
      // console.log('[useStockManager] No items recognized by recognizeItemsFromImage.');
      Alert.alert("No Items Recognized", "Could not find any items in the image. Try again?");
      closeCamera();
    }
  };

  // Camera Permission Handling
  const ensureCameraPermission = async (): Promise<boolean> => {
    if (!permission) return false; // Should not happen if hook is used correctly

    if (permission.status === PermissionStatus.GRANTED) {
      return true;
    }

    if (permission.status === PermissionStatus.DENIED && !permission.canAskAgain) {
      Alert.alert(
        'Permission Required',
        'Camera access was permanently denied. Please enable it in your device settings.',
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }

    // If undetermined or can ask again
    const { status: newStatus } = await requestCameraPermissionHookFn();
    if (newStatus === PermissionStatus.GRANTED) {
        return true;
    }
    
    Alert.alert('Permission Denied', 'Camera access is needed to scan items.');
    return false;
  };

  // --- RETURN OBJECT (ensure all new exports are here) ---
  return {
    stockData,
    userId,
    isLoading,
    isSaving,
    isDeleting,
    isRecognizing,
    error,
    saveError,
    deleteError,
    recognitionError,

    // Camera related
    cameraRef, // Ensure this is defined (e.g., const cameraRef = useRef<CameraView>(null);)
    isCameraVisible, // Ensure this is defined (e.g., const [isCameraVisible, setIsCameraVisible] = useState(false);)
    permissionStatus: permission, // permission comes from useCameraPermissions()
    requestPermission: requestCameraPermissionHookFn, // Export the hook's request function
    openCamera, // Ensure this is defined (e.g., const openCamera = () => setIsCameraVisible(true);)
    closeCamera, // Ensure this is defined (e.g., const closeCamera = () => setIsCameraVisible(false);)
    ensureCameraPermission, // This function itself
    handleCaptureAndProcessImage, // This function itself

    // Manual Add Modal related
    isManualModalVisible,
    openManualModal,
    closeManualModal,
    editingItem,
    prepareEditItem,
    handleSaveItem,

    // Item Operations
    deleteStockItem,
    saveScannedItems, 
    fetchStock, 
    
    unitOptions: DEFAULT_UNIT_OPTIONS,

    // Stock Confirmation related
    isStockConfirmationVisible,
    scannedItemsForConfirmation,
    openStockConfirmationModal,
    closeStockConfirmationModal,
    handleConfirmStockItems,
  };
};

