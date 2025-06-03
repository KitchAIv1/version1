import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';

// TODO: Define navigation props
// type OnboardingFinalScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingFinal'>;

function OnboardingFinalScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'OnboardingFinal'>
    >();

  const handleProceedToApp = () => {
    console.log('Proceeding to app (MainTabs) by resetting navigation stack.');
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're All Set!</Text>
      <Text style={styles.text}>
        A quick note on AI generations: As a new user, you get complimentary AI
        meal plans and pantry scans to get you started.
      </Text>
      <Text style={styles.text}>
        Users receive{' '}
        <Text style={styles.highlight}>10 free AI meal plan generations</Text>{' '}
        and <Text style={styles.highlight}>3 free pantry scans</Text> per month.
        Creators receive enhanced limits upon meeting engagement milestones.
      </Text>
      <Text style={styles.text}>Enjoy exploring Kitch Hub!</Text>

      <TouchableOpacity style={styles.button} onPress={handleProceedToApp}>
        <Text style={styles.buttonText}>Let's Go!</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 24,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#22c55e',
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginTop: 20,
    width: '90%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default OnboardingFinalScreen;
