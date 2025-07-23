# 🔧 Backend Team: KitchAI v2 Production Migration Instructions

## 📋 **PROJECT OVERVIEW**

**Client**: KitchAI v2 Mobile App  
**Task**: Migrate development database schema to production environment  
**Urgency**: Critical deployment blocker  
**Estimated Time**: 2-3 hours  
**Risk Level**: LOW (existing development environment unaffected)

---

## 🎯 **MISSION BRIEFING**

The client has already created a production Supabase project but needs the database schema migrated from development to production. This is a standard environment separation task for a React Native app preparing for App Store deployment.

### **What's Already Done:**
- ✅ Production Supabase project created
- ✅ App environment configuration ready
- ✅ EAS build system configured

### **What You Need to Do:**
1. Export development database schema
2. Apply schema to production database
3. Set up Row Level Security (RLS)
4. Configure storage buckets
5. Provide production API keys to client

---

## 📊 **DEVELOPMENT PROJECT DETAILS**

**Development Supabase Project**: `btpmaqffdmxhugvybgfn`  
**Development URL**: `https://btpmaqffdmxhugvybgfn.supabase.co`

### **Migration Files Available:**
The client has organized migration files in `supabase/migrations/`:

```
20240320000000_create_recipe_uploads.sql
20240320000001_add_comments_functions.sql  
20241225000001_fix_recipe_details_comments.sql
20241226000001_fix_get_profile_details_role.sql
20241226000002_creator_role_fix_complete.sql
20250125000002_restore_ai_generated_field.sql
20250125000003_complete_get_profile_details_fix.sql
20250125000004_create_user_follows_table.sql
20250126000001_create_followers_following_functions.sql
20250126000002_assess_backup_tables.sql
20250126000003_cleanup_backup_tables.sql
20250126000004_create_proper_backup_system.sql
20250126000005_fix_get_profile_details_new_user_issue.sql
```

---

## 🛠️ **STEP-BY-STEP MIGRATION PROCESS**

### **Phase 1: Access Development Database (15 minutes)**

1. **Get Development Database Access**:
   - URL: `https://btpmaqffdmxhugvybgfn.supabase.co`
   - Ask client for development database credentials OR
   - Request client to add your email to the development project

2. **Export Current Schema**:
```sql
-- Connect to development database SQL Editor
-- Run this to get complete schema export:

-- Get all tables structure
SELECT 
    'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' (' ||
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
            WHEN data_type = 'character' THEN 'char(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE data_type 
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', '
    ) || ');' as create_statement
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN (
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    )
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Get all constraints
SELECT
    'ALTER TABLE ' || tc.table_name || ' ADD CONSTRAINT ' || tc.constraint_name || ' ' ||
    CASE 
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRIMARY KEY (' || string_agg(kcu.column_name, ', ') || ')'
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FOREIGN KEY (' || string_agg(kcu.column_name, ', ') || ') REFERENCES ' || ccu.table_name || '(' || string_agg(ccu.column_name, ', ') || ')'
        WHEN tc.constraint_type = 'UNIQUE' THEN 'UNIQUE (' || string_agg(kcu.column_name, ', ') || ')'
    END || ';' as constraint_statement
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, ccu.table_name;

-- Get all RLS policies
SELECT 
    'CREATE POLICY ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) ||
    ' FOR ' || cmd || 
    CASE WHEN roles::text != '{public}' THEN ' TO ' || roles::text ELSE '' END ||
    ' USING (' || qual || ')' ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END || ';' as policy_statement
FROM pg_policies 
WHERE schemaname = 'public';

-- Get all functions
SELECT 
    'CREATE OR REPLACE FUNCTION ' || routine_name || '(' ||
    COALESCE(string_agg(parameter_name || ' ' || udt_name, ', '), '') || ') ' ||
    'RETURNS ' || data_type || ' AS $$ ' || routine_definition || ' $$ LANGUAGE ' || external_language || ';' as function_statement
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public' AND r.routine_type = 'FUNCTION'
GROUP BY r.routine_name, r.data_type, r.routine_definition, r.external_language;
```

3. **Save Export Results**: Copy all results to text files for production import

### **Phase 2: Apply Schema to Production (30 minutes)**

1. **Access Production Database**:
   - Get production project URL and credentials from client
   - Login to production Supabase dashboard

2. **Apply Migration Files in Order**:
   - Copy content from each migration file (in chronological order)
   - Run in production SQL Editor
   - Wait for each to complete before running next

3. **Alternative: Use Supabase CLI** (if available):
```bash
# If client has Supabase CLI access
supabase link --project-ref [PRODUCTION-PROJECT-ID]
supabase db push
```

### **Phase 3: Configure Row Level Security (20 minutes)**

1. **Enable RLS on All Tables**:
```sql
-- Enable RLS (run for each table found in development)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
-- Add all other tables found in development
```

2. **Verify RLS Policies Applied**: 
   - Check that all policies from development are active in production
   - Test basic queries to ensure RLS is working

### **Phase 4: Configure Storage (15 minutes)**

1. **Create Storage Buckets**:
   - Go to Storage section in production dashboard
   - Create these buckets:
     - `recipe-videos` (public)
     - `recipe-thumbnails` (public)
     - `user-avatars` (public)
     - `pantry-scans` (private)

2. **Apply Storage Policies**:
```sql
-- Public read access for recipe content
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'recipe-videos');

CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'recipe-thumbnails');

CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'user-avatars');

-- User-specific access for pantry scans
CREATE POLICY "User Access" ON storage.objects 
FOR ALL USING (auth.uid()::text = (storage.foldername(name))[1]);
```

### **Phase 5: Verification & Testing (30 minutes)**

1. **Schema Verification**:
```sql
-- Compare table count
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

-- Compare function count  
SELECT COUNT(*) as function_count FROM information_schema.routines WHERE routine_schema = 'public';

-- Compare policy count
SELECT COUNT(*) as policy_count FROM pg_policies WHERE schemaname = 'public';
```

2. **Test Core Functions**:
```sql
-- Test key RPC functions
SELECT get_profile_details('test-user-id');
SELECT toggle_like_recipe('test-recipe-id', 'test-user-id');
-- Test other critical functions
```

3. **Test User Registration Flow**:
   - Create test user via Auth
   - Verify profile creation triggers work
   - Test basic CRUD operations

---

## 📋 **DELIVERABLES FOR CLIENT**

### **1. Production API Keys**
Provide these from production project Settings > API:
- **Production URL**: `https://[PROD-PROJECT-ID].supabase.co`
- **Anon Key**: `eyJhbGci...` (public key for client app)
- **Service Role Key**: `eyJhbGci...` (admin key - handle securely)

### **2. Migration Report**
```markdown
## Migration Completion Report

### ✅ Completed Tasks:
- [ ] Database schema migrated (X tables, Y functions, Z policies)
- [ ] Row Level Security enabled on all tables
- [ ] Storage buckets created and configured
- [ ] Core functionality tested
- [ ] API keys provided

### 📊 Production Database Stats:
- Tables: X
- RPC Functions: Y  
- RLS Policies: Z
- Storage Buckets: 4

### 🧪 Test Results:
- User registration: ✅
- Profile creation: ✅
- Recipe operations: ✅
- Storage access: ✅

### 🔑 Production Credentials:
- URL: https://[PROJECT-ID].supabase.co
- Anon Key: [PROVIDED-SEPARATELY]
```

### **3. EAS Secret Commands**
Provide client with these commands to run:
```bash
npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_PROD --value "https://[PROD-PROJECT-ID].supabase.co"
npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_PROD --value "[PRODUCTION-ANON-KEY]"
```

---

## 🚨 **CRITICAL SUCCESS FACTORS**

### **Security Requirements:**
- ✅ All tables MUST have RLS enabled
- ✅ All policies MUST be copied from development
- ✅ Storage buckets MUST have proper access controls
- ✅ Service role key MUST be handled securely

### **Data Integrity:**
- ✅ Schema MUST match development exactly
- ✅ All functions MUST work identically
- ✅ All triggers MUST be active
- ✅ All constraints MUST be preserved

### **Testing Checklist:**
- ✅ User can register and login
- ✅ Profile creation works
- ✅ Recipe upload/download works
- ✅ Storage access works
- ✅ RLS prevents unauthorized access

---

## ⚠️ **IMPORTANT NOTES**

1. **Development Environment**: Do NOT modify development database during this process
2. **Backup Strategy**: Production is starting fresh - no existing data to backup
3. **Rollback Plan**: If issues occur, client can continue using development environment
4. **Timeline**: Client needs this completed ASAP for App Store submission
5. **Support**: Client may need guidance on setting EAS secrets after completion

---

## 📞 **POST-MIGRATION SUPPORT**

After completing migration:
1. **Test Production Build**: Help client verify `npx eas build --profile production` works
2. **Environment Switching**: Confirm app uses correct environment based on build profile
3. **Performance Check**: Verify production database performance
4. **Documentation**: Provide any additional setup notes

---

**Questions? Contact client for:**
- Development database access
- Production project details  
- Specific business logic clarification
- Testing requirements

**This migration is the critical blocker for App Store deployment. Professional completion of this task enables the client to proceed with their Silicon Valley-grade app launch.** 🚀 