const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0NzI4NzQsImV4cCI6MjA1MDA0ODg3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStockInsert() {
  console.log('Testing stock insertion...');
  
  try {
    // First, let's check if we can read from stock table
    console.log('1. Testing SELECT from stock table...');
    const { data: selectData, error: selectError } = await supabase
      .from('stock')
      .select('*')
      .limit(1);
    
    if (selectError) {
      console.error('SELECT error:', selectError);
    } else {
      console.log('SELECT successful, sample data:', selectData);
    }

    // Now let's try to insert a test item
    console.log('2. Testing INSERT to stock table...');
    const testItem = {
      user_id: 'test-user-id',
      item_name: 'test-item-' + Date.now(),
      quantity: 1,
      unit: 'units',
      description: 'Test item for debugging',
      storage_location: 'cupboard',
      created_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('stock')
      .insert([testItem]);

    if (insertError) {
      console.error('INSERT error:', insertError);
      console.error('Full error details:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('INSERT successful:', insertData);
    }

    // Test UPSERT as well
    console.log('3. Testing UPSERT to stock table...');
    const upsertItem = {
      user_id: 'test-user-id-2',
      item_name: 'test-upsert-item-' + Date.now(),
      quantity: 2,
      unit: 'units',
      description: 'Test upsert item',
      storage_location: 'cupboard'
    };

    const { data: upsertData, error: upsertError } = await supabase
      .from('stock')
      .upsert([upsertItem], { onConflict: 'user_id, item_name' });

    if (upsertError) {
      console.error('UPSERT error:', upsertError);
      console.error('Full error details:', JSON.stringify(upsertError, null, 2));
    } else {
      console.log('UPSERT successful:', upsertData);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testStockInsert(); 