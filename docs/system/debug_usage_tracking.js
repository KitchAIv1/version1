const { createClient } = require('@supabase/supabase-js');

// Use environment variables instead of hardcoded keys
const supabaseUrl = process.env.SUPABASE_URL || 'https://btpmaqffdmxhugvybgfn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Use environment variable

if (!supabaseKey) {
  console.error('❌ SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUsageTracking() {
  console.log('🔍 DEBUGGING AI RECIPE USAGE TRACKING');
  console.log('=====================================\n');

  // Test user ID (ChefTitan)
  const testUserId = '9b84ff89-f9e5-4ddb-9de8-9797d272da59';

  try {
    // 1. Check if user exists and get tier
    console.log('1️⃣ Checking user profile and tier...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username, tier')
      .eq('user_id', testUserId)
      .single();

    if (profileError) {
      console.error('❌ Profile error:', profileError);
      return;
    }

    console.log('✅ User profile:', profileData);

    // 2. Check current usage status
    console.log('\n2️⃣ Getting current usage status...');
    const { data: usageData, error: usageError } = await supabase.rpc('get_user_usage_status', {
      p_user_id: testUserId,
    });

    if (usageError) {
      console.error('❌ Usage status error:', usageError);
      return;
    }

    console.log('✅ Current usage status:', usageData);

    // 3. Check user_usage_limits table directly
    console.log('\n3️⃣ Checking user_usage_limits table directly...');
    const { data: directData, error: directError } = await supabase
      .from('user_usage_limits')
      .select('*')
      .eq('user_id', testUserId);

    if (directError) {
      console.error('❌ Direct table error:', directError);
    } else {
      console.log('✅ Direct table data:', directData);
    }

    // 4. Test logging AI recipe generation
    console.log('\n4️⃣ Testing log_ai_recipe_generation...');
    const { data: logData, error: logError } = await supabase.rpc('log_ai_recipe_generation', {
      p_user_id: testUserId,
    });

    if (logError) {
      console.error('❌ Log AI recipe error:', logError);
    } else {
      console.log('✅ Log AI recipe success:', logData);
    }

    // 5. Check usage status again after logging
    console.log('\n5️⃣ Getting usage status after logging...');
    const { data: afterUsageData, error: afterUsageError } = await supabase.rpc('get_user_usage_status', {
      p_user_id: testUserId,
    });

    if (afterUsageError) {
      console.error('❌ After usage status error:', afterUsageError);
    } else {
      console.log('✅ Usage status after logging:', afterUsageData);
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

debugUsageTracking();
