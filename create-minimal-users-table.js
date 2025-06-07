const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://btpmaqffdmxhugvybgfn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0cG1hcWZmZG14aHVndnliZ2ZuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDE0NDk2MCwiZXhwIjoyMDU5NzIwOTYwfQ.l6xnToOXnDID-RRtwyy9qjL7n9imJlN03mcV9U4hTAo'
);

async function createMinimalUsersTable() {
  console.log('🔧 Creating minimal users table to fix trigger issues...');
  
  try {
    // First, let's try to create the users table using an RPC function
    // We'll create a minimal table that satisfies whatever trigger is expecting
    
    console.log('📝 Attempting to create users table via RPC...');
    
    // Try using an existing RPC function that might allow us to execute SQL
    const createUsersSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Insert the test user that we know exists in profiles
      INSERT INTO users (id, email, created_at) 
      SELECT id, 'testuser@example.com', created_at 
      FROM profiles 
      WHERE id = '9b84ff89-f9e5-4ddb-9de8-9797d272da59'
      ON CONFLICT (id) DO NOTHING;
      
      -- Grant necessary permissions
      GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon;
    `;
    
    // Since we can't execute raw SQL directly through the client,
    // let's try a different approach - create the table by inserting data
    
    console.log('📝 Attempting to create users table by inserting test data...');
    
    // Try to insert directly into users table (this might create it if it doesn't exist)
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: '9b84ff89-f9e5-4ddb-9de8-9797d272da59',
        email: 'testuser@example.com',
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.log('❌ Direct insert failed:', error.message);
      
      if (error.code === '42P01') {
        console.log('   Table does not exist, need to create it via SQL');
        console.log('   You will need to run this SQL in Supabase SQL Editor:');
        console.log('');
        console.log(createUsersSQL);
        console.log('');
      }
    } else {
      console.log('✅ Users table created/updated successfully');
    }
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function testStockInsertAfterFix() {
  console.log('\n🔍 Testing stock insert after users table fix...');
  
  try {
    const testItem = {
      user_id: '9b84ff89-f9e5-4ddb-9de8-9797d272da59',
      item_name: 'test_after_fix',
      quantity: 1,
      unit: 'jar',
      description: null,
      storage_location: 'cupboard',
      created_at: new Date().toISOString()
    };
    
    console.log('📝 Testing stock insert after fix:', testItem);
    
    const { data, error } = await supabase
      .from('stock')
      .insert(testItem);
    
    if (error) {
      console.log('❌ Still failing:');
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
    } else {
      console.log('✅ Stock insert successful after fix!');
      
      // Clean up
      await supabase
        .from('stock')
        .delete()
        .eq('user_id', '9b84ff89-f9e5-4ddb-9de8-9797d272da59')
        .eq('item_name', 'test_after_fix');
      
      console.log('🧹 Test item cleaned up');
    }
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
}

async function main() {
  await createMinimalUsersTable();
  await testStockInsertAfterFix();
}

main(); 