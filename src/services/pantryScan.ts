import { supabase } from './supabase';

export async function pantryScan(base64: string) {
  const { data, error } = await supabase.functions.invoke('pantry_scan', {
    body: { image: base64 },
  });
  if (error) throw error;
  return data.items as { name: string; qty: number }[];
} 