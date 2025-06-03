import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Or any icon library you prefer

interface StockHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onScanPress: () => void;
  onManualPress: () => void;
  // Optional: add props for styling or button states if needed
  isScanning?: boolean;
  isAddingManually?: boolean;
}

export const StockHeader: React.FC<StockHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onScanPress,
  onManualPress,
  isScanning,
  isAddingManually,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={22} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your stock..."
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.scanButton,
            (isScanning || isAddingManually) && styles.disabledButton,
          ]}
          onPress={onScanPress}
          disabled={isScanning || isAddingManually}>
          <Icon
            name="camera-alt"
            size={20}
            color="#FFF"
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>Scan Pantry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.manualButton,
            (isScanning || isAddingManually) && styles.disabledButton,
          ]}
          onPress={onManualPress}
          disabled={isScanning || isAddingManually}>
          <Icon name="add" size={20} color="#FFF" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Add Manually</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8, // Adjust padding for OS
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 25,
    flex: 1, // Each button takes roughly half the space
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  scanButton: {
    backgroundColor: '#22c55e', // Green color
    marginRight: 7, // Space between buttons
  },
  manualButton: {
    backgroundColor: '#3b82f6', // Blue color
    marginLeft: 7, // Space between buttons
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    // Style for disabled state
    opacity: 0.6,
    backgroundColor: '#bdc3c7', // Example disabled color
  },
});

export default StockHeader;
