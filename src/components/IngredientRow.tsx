import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import clsx from 'clsx';

type Props = {
  ing: { name: string; qty?: string; unit?: string };
  matched: boolean;
  missing: boolean;
};

export default function IngredientRow({ ing, matched, missing }: Props) {
  return (
    <View className="flex-row items-center mb-2">
      {matched && <Feather name="check-circle" size={18} color="#22c55e" />}
      {missing && <Feather name="x-circle" size={18} color="#dc2626" />}
      <Text
        className={clsx(
          'ml-2',
          missing && 'text-gray-400',
          matched && 'text-black'
        )}
      >
        {ing.qty ? `${ing.qty} ` : ''}
        {ing.unit ? `${ing.unit} ` : ''}
        {ing.name}
      </Text>
      {missing && (
        <View className="ml-auto rounded-full bg-amber-500 px-2 py-0.5">
          <Text className="text-white text-xs">ADD</Text>
        </View>
      )}
    </View>
  );
} 