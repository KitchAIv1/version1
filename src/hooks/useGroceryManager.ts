import { useContext } from 'react';
import {
  GroceryContextValues,
  useGroceryContext,
} from '../providers/GroceryProvider';

// Re-export interfaces if they are still needed by components directly from this file
// Or components can import them from GroceryProvider.tsx
export type {
  GroceryItem,
  GroceryItemInput,
} from '../providers/GroceryProvider';

// The new useGroceryManager hook simply consumes the context
export const useGroceryManager = (): GroceryContextValues => {
  return useGroceryContext();
};
