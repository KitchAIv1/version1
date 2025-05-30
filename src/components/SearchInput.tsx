import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchInputProps {
  placeholder?: string;
  onSearchChange: (query: string) => void;
  onClear?: () => void;
  style?: any;
}

export default function SearchInput({ 
  placeholder = "Search...", 
  onSearchChange, 
  onClear,
  style 
}: SearchInputProps) {
  const [localQuery, setLocalQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleTextChange = useCallback((text: string) => {
    setLocalQuery(text);
    onSearchChange(text);
  }, [onSearchChange]);

  const handleClear = useCallback(() => {
    setLocalQuery('');
    onSearchChange('');
    onClear?.();
    inputRef.current?.focus();
  }, [onSearchChange, onClear]);

  return (
    <View style={[styles.container, style]}>
      <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={localQuery}
        onChangeText={handleTextChange}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        blurOnSubmit={false}
        selectTextOnFocus={false}
        autoFocus={false}
        clearButtonMode="never"
        enablesReturnKeyAutomatically={false}
        keyboardType="default"
        textContentType="none"
        autoComplete="off"
        spellCheck={false}
      />
      {localQuery.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color="#9ca3af" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
}); 