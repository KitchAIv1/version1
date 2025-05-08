import React, { useState, useMemo } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Alert,
  Text,
} from 'react-native';
import { useStockManager, StockItem } from '../../hooks/useStockManager'; // Re-enabled hook import
import { StockHeader } from '../../components/stock/StockHeader'; // Use named import
import { StockList } from '../../components/stock/StockList'; // Use named import
import { CameraScannerModal } from '../../components/stock/CameraScannerModal'; // Uncommented component
import { ManualAddModal } from '../../components/stock/ManualAddModal'; // Uncommented component import
import { COLORS as ThemeColors } from '../../constants/theme'; // Import real COLORS, maybe alias

// const COLORS = { background: '#FFF' }; // Remove mock

export default function MyStockScreen() {
  // Re-enabled hook call and destructuring
  const {
    stockData, // Keep even if StockList is commented, hook fetches it
    isLoading,
    error,
    isSaving,
    isRecognizing,
    cameraRef, // Keep this if hook returns it, even if not passed to modal
    permissionStatus, 
    requestPermission, // Destructure this, it's now returned by the hook
    ensureCameraPermission, 
    isCameraVisible, // Not directly used yet
    openCamera,
    closeCamera, // Not directly used yet
    handleCaptureAndProcessImage, // Not directly used yet
    isManualModalVisible, // Needed for ManualAddModal
    openManualModal, 
    closeManualModal, // Needed for ManualAddModal
    editingItem,      
    prepareEditItem,  
    handleSaveItem,   
    deleteStockItem,  
    fetchStock,       
    unitOptions,      // Needed for ManualAddModal
  } = useStockManager(); 

  const [searchQuery, setSearchQuery] = useState(''); 

  // Re-enabled filtered data derivation
  const filteredStockData = useMemo(() => 
    stockData.filter((item: StockItem) => 
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [stockData, searchQuery]);

  const handleAttemptOpenScanner = async () => {
    // This now uses ensureCameraPermission from the hook
    const hasPermission = await ensureCameraPermission();
    if (hasPermission) {
      openCamera(); // Uses openCamera from the hook
    }
  };

  // Re-enabled delete handler
  const handleDeleteWithConfirmation = (item: StockItem) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete "${item.item_name}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => deleteStockItem(item),
          style: "destructive"
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Use ThemeColors from import */}
      <StatusBar barStyle="dark-content" backgroundColor={ThemeColors.background || '#FFF'} /> 
      
      <StockHeader 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onScanPress={handleAttemptOpenScanner} 
        onManualPress={() => openManualModal()} // Uses openManualModal from hook
        isScanning={isRecognizing} // Uses isRecognizing from hook
        isAddingManually={isSaving} // Uses isSaving from hook
      />

      <View style={styles.listContainer}>
        <StockList
          data={filteredStockData} 
          isLoading={isLoading}
          error={error}
          onEdit={prepareEditItem} 
          onDelete={handleDeleteWithConfirmation} 
          onRefresh={fetchStock} 
          isRefreshing={isLoading} 
        />
      </View>

      {/* Uncommented CameraScannerModal */}
      <CameraScannerModal 
        visible={isCameraVisible} 
        onClose={closeCamera} 
        onCapture={handleCaptureAndProcessImage} 
        permissionStatus={permissionStatus} 
        requestPermission={requestPermission} 
        isAnalyzing={isRecognizing} 
      />

      {/* Uncommented ManualAddModal */}
      <ManualAddModal
        visible={isManualModalVisible}
        onClose={closeManualModal}
        onSubmit={handleSaveItem}
        initialItem={editingItem} 
        isSaving={isSaving}
        unitOptions={unitOptions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ThemeColors.background || '#f8f9fa', // Use ThemeColors
  },
  container: { 
    flex: 1,
    // Adjust layout if header takes space - perhaps remove centering?
    // justifyContent: 'center',
    // alignItems: 'center',
    padding: 10, // Add some padding
  },
  listContainer: {
    flex: 1,
  },
}); 