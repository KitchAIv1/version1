import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// TODO: Define props to receive steps data
interface StepsTabProps {
  // steps?: string[];
}

const StepsTab: React.FC<StepsTabProps> = (/* { steps } */) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Steps</Text>
      {/* TODO: Map over steps and display them */}
      <Text style={styles.placeholder}>Recipe steps will appear here.</Text>
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

export default StepsTab; 