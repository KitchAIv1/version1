import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';

// TODO: Define navigation props
// type OnboardingStep2UserScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingStep2User'>;

const features = [
  { title: '📸 Pantry Scan', description: 'Quickly add ingredients by scanning them. Get 3 free scans to start!', icon: 'camera-outline' },
  { title: '🧠 AI Meal Plan', description: 'Let our AI generate personalized meal plans. Enjoy 10 free AI generations!', icon: 'bulb-outline' },
  { title: '🛒 Pantry to Grocery', description: 'Easily convert missing pantry items into your grocery list.', icon: 'cart-outline' },
  { title: '🍽 Discover Recipes', description: 'Explore a world of recipes from talented creators.', icon: 'search-outline' },
];

const OnboardingStep2UserScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList, 'OnboardingStep2User'>>();

  const handleNext = () => {
    console.log('Proceeding to OnboardingFinalScreen from User flow');
    navigation.navigate('OnboardingFinal');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>For Your Inner Chef!</Text>
      <Text style={styles.subHeader}>Discover amazing features tailored for you:</Text>

      {features.map((feature, index) => (
        <View key={index} style={styles.featureCard}>
          {/* TODO: Add Ionicons here if desired, e.g., <Ionicons name={feature.icon} size={24} /> */}
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureDescription}>{feature.description}</Text>
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
  featureCard: {
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
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 8,
  },
  featureDescription: {
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

export default OnboardingStep2UserScreen; 