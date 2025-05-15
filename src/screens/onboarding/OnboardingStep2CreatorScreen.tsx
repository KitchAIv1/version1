import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';

// TODO: Define navigation props
// type OnboardingStep2CreatorScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingStep2Creator'>;

const tools = [
  { title: '🎥 Upload Recipe Videos', description: 'Share your culinary masterpieces with high-quality video uploads.', icon: 'videocam-outline' },
  { title: '🧂 Tag Ingredients & Diets', description: 'Make your recipes discoverable by tagging ingredients, dietary restrictions, and more.', icon: 'pricetag-outline' },
  { title: '💸 Monetize Your Content', description: 'Engage with your audience and enable tips or follower subscriptions (coming soon!).', icon: 'cash-outline' },
  { title: '📊 Performance Analytics', description: 'Track your recipe views, engagement, and follower growth (coming soon!).', icon: 'bar-chart-outline' },
];

const OnboardingStep2CreatorScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList, 'OnboardingStep2Creator'>>();

  const handleNext = () => {
    console.log('Proceeding to OnboardingFinalScreen from Creator flow');
    navigation.navigate('OnboardingFinal');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Empowering Creators!</Text>
      <Text style={styles.subHeader}>Tools to help you share and shine:</Text>

      {tools.map((tool, index) => (
        <View key={index} style={styles.toolCard}>
          {/* TODO: Add Ionicons here if desired, e.g., <Ionicons name={tool.icon} size={24} /> */}
          <Text style={styles.toolTitle}>{tool.title}</Text>
          <Text style={styles.toolDescription}>{tool.description}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f7f7f7',
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 30,
    textAlign: 'center',
  },
  toolCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    width: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  toolTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 8,
  },
  toolDescription: {
    fontSize: 14,
    color: '#555',
  },
  nextButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 20,
    width: '90%',
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingStep2CreatorScreen; 