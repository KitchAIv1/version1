import React, { useState } from 'react';
import { View, Button, Text, Pressable, Alert } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { useNavigation } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define navigation prop type
type Nav = NativeStackNavigationProp<AuthStackParamList, 'DietPrefs'>;

const TAGS = ['Vegan','Vegetarian', 'Keto', 'Paleo', 'Gluten-Free', 'Dairy-Free', 'Nut-Free'];

export default function DietPrefsScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<Nav>();
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (tag: string) =>
    setSelected(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );

  const save = async () => {
    if (!session?.user?.id) {
        Alert.alert('Error', 'User session not found. Cannot save preferences.');
        return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ diet_tags: selected })
        .eq('id', session.user.id);

      if (error) {
        throw error;
      }
      
      console.log('Diet preferences saved');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' as never }] });

    } catch (error: any) {
        Alert.alert('Error Saving Preferences', error.message || 'An unknown error occurred.');
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 p-6 pt-16 bg-white items-center"> 
      <Text className="text-2xl font-bold mb-6">Dietary Preferences</Text>
      <Text className="text-gray-600 mb-8 text-center">Select any tags that apply to you.</Text>
      
      <View className="flex-row flex-wrap justify-center mb-10">
        {TAGS.map(tag => (
          <Pressable key={tag} onPress={() => toggle(tag)} className="m-1">
            <Text 
              className={`px-4 py-2 border rounded-full text-center ${ 
                selected.includes(tag) 
                  ? 'bg-brand-green text-white border-brand-green' 
                  : 'bg-white text-gray-700 border-gray-300'
              }`}>
              {tag}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button 
        title={isSaving ? "Saving..." : "Save & Continue"} 
        onPress={save} 
        disabled={isSaving}
        color="#00B388"
      />
    </View>
  );
} 