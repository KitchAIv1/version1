# 🚀 Production Supabase Environment Setup Guide

## 📋 **OVERVIEW**

This guide will walk you through creating a separate production Supabase project and configuring it safely without disrupting your current development environment.

**Estimated Time**: 45-60 minutes  
**Risk Level**: LOW (development environment remains unchanged)

---

## 🏗️ **PHASE 1: CREATE PRODUCTION PROJECT**

### **Step 1: Supabase Dashboard Setup (15 minutes)**

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Create New Project**:
   - Click "New Project"
   - Organization: Your existing organization
   - Project Name: `kitchai-v2-production`
   - Database Password: Generate a strong password (save this!)
   - Region: Same as your development project (for consistency)
   - Plan: Keep the same plan as development

3. **Wait for Project Creation** (5-10 minutes)
   - Note the new project URL: `https://[NEW-PROJECT-ID].supabase.co`
   - Note the new project ID (different from `btpmaqffdmxhugvybgfn`)

### **Step 2: Copy Database Schema (20 minutes)**

You'll need to migrate your database schema to production. We'll use your existing migrations:

```bash
# First, let's check what migrations you have
ls -la supabase/migrations/

# Copy the migration files to apply to production
# We'll run these on the production database
```

### **Step 3: Configure Storage Buckets (10 minutes)**

1. **Go to Storage in Production Project**
2. **Create Buckets** (same as development):
   - `recipe-videos` (public)
   - `recipe-thumbnails` (public) 
   - `user-avatars` (public)
   - `pantry-scans` (private)

---

## 🔑 **PHASE 2: CONFIGURE PRODUCTION SECRETS**

### **Step 4: Get Production API Keys (5 minutes)**

1. **Go to Settings > API** in your production project
2. **Copy these values** (save them securely):
   - Project URL: `https://[PROD-PROJECT-ID].supabase.co`
   - Anon/Public Key: `eyJhbGci...` (public key)
   - Service Role Key: `eyJhbGci...` (private key - NEVER expose this)

### **Step 5: Configure EAS Secrets (10 minutes)**

Instead of putting production keys in code, we'll use EAS secrets:

```bash
# Set production environment variables as EAS secrets
npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_PROD --value "https://[PROD-PROJECT-ID].supabase.co"

npx eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_PROD --value "[PRODUCTION-ANON-KEY]"

# Verify secrets were created
npx eas secret:list
```

---

## 🧪 **TESTING & VALIDATION**

### **Step 6: Test Production Environment (15 minutes)**

1. **Build with Production Profile**:
```bash
# Test production build (won't submit to store)
npx eas build --platform ios --profile production --local
```

2. **Verify Environment Switching**:
   - Development builds should still use development Supabase
   - Production builds should use production Supabase
   - Check console logs for environment confirmation

---

## 🔒 **SECURITY BENEFITS**

✅ **Data Isolation**: Production and development data completely separate  
✅ **API Key Security**: Different keys for different environments  
✅ **Zero Risk**: Development environment remains unchanged  
✅ **Professional Setup**: Matches industry best practices  

---

**Ready to start? Let's begin with Step 1: Creating the production Supabase project.**
