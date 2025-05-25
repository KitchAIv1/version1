import React, { useState, useMemo } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStockManager, StockItem } from '../../hooks/useStockManager';
import { StockHeader } from '../../components/stock/StockHeader';
import { StockList } from '../../components/stock/StockList';
import { ManualAddModal } from '../../components/stock/ManualAddModal';
import { COLORS as ThemeColors } from '../../constants/theme';

export default function MyStockScreen() {
  const navigation = useNavigation();
  
  const {
    stockData,
    isLoading,
    error,
    isSaving,
    isManualModalVisible,
    openManualModal, 
    closeManualModal,
    editingItem,      
    prepareEditItem,  
    handleSaveItem,   
    deleteStockItem,  
    fetchStock,       
    unitOptions,
  } = useStockManager(); 

  const [searchQuery, setSearchQuery] = useState(''); 

  // Enhanced filtered data with better performance
  const filteredStockData = useMemo(() => {
    if (!searchQuery.trim()) return stockData;
    
    const query = searchQuery.toLowerCase();
    return stockData.filter((item: StockItem) => 
      item.item_name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [stockData, searchQuery]);

  const handleNavigateToScanner = () => {
    navigation.navigate('PantryScan' as never);
  };

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
      <StatusBar barStyle="dark-content" backgroundColor={ThemeColors.background || '#FFF'} /> 
      
      <StockHeader 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onScanPress={handleNavigateToScanner} 
        onManualPress={() => openManualModal()}
        isScanning={false}
        isAddingManually={isSaving}
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
    backgroundColor: ThemeColors.background || '#f8f9fa',
  },
  listContainer: {
    flex: 1,
  },
}); 