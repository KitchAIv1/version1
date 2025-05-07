import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// TODO: Define props to receive macro data
interface MacrosTabProps {
  // macros?: { calories: number; protein: number; carbs: number; fat: number };
}

const MacrosTab: React.FC<MacrosTabProps> = (/* { macros } */) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Macros</Text>
      {/* TODO: Display macro data */}
      <Text style={styles.placeholder}>Nutritional information will appear here.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  placeholder: {
    fontSize: 14,
    color: '#666',
  },
});

export default MacrosTab; 