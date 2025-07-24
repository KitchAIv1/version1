// Secure configuration template for database maintenance scripts
// NEVER commit actual credentials to Git!

require('dotenv').config({ path: __dirname + '/.env' });

const { createClient } = require('@supabase/supabase-js');

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  console.error('   Copy .env.example to .env and add your credentials');
  process.exit(1);
}

// Create secure Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };

// Usage in your scripts:
// const { supabase } = require('./config-template'); 