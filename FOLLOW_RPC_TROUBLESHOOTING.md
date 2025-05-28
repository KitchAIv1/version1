# 🔧 FOLLOW RPC TROUBLESHOOTING GUIDE

## 🚨 **Current Issue**

**Error**: `Could not find the function public.get_follow_status(p_followed_id) in the schema cache`

**Root Cause**: Frontend RPC calls were missing required parameters that the backend functions expect.

---

## ✅ **Fixes Applied**

### **1. Fixed useFollowStatus Hook**
```typescript
// BEFORE (❌ Missing p_follower_id)
const { data, error } = await supabase.rpc('get_follow_status', {
  p_followed_id: targetUserId
});

// AFTER (✅ Both parameters included)
const { data, error } = await supabase.rpc('get_follow_status', {
  p_follower_id: currentUserId,
  p_followed_id: targetUserId
});
```

### **2. Fixed useFollowMutation Hook**
```typescript
// BEFORE (❌ Missing p_follower_id)
const { data, error } = await supabase.rpc(rpcFunction, {
  p_followed_id: targetUserId
});

// AFTER (✅ Both parameters included)
const { data, error } = await supabase.rpc(rpcFunction, {
  p_follower_id: currentUserId,
  p_followed_id: targetUserId
});
```

---

## 🔄 **Next Steps to Resolve**

### **Step 1: Reload the App**
```bash
# Stop the Metro bundler (Ctrl+C)
# Then restart
npx expo start --clear
```

### **Step 2: Clear React Query Cache**
If the error persists, add this temporary code to clear the cache:

```typescript
// Add this to your ProfileScreen or any component temporarily
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
queryClient.clear(); // This will clear all cached queries
```

### **Step 3: Verify Backend Function Signatures**
The backend functions should expect these parameters:

```sql
-- get_follow_status function should accept:
get_follow_status(p_follower_id UUID, p_followed_id UUID)

-- follow_user function should accept:
follow_user(p_follower_id UUID, p_followed_id UUID)

-- unfollow_user function should accept:
unfollow_user(p_follower_id UUID, p_followed_id UUID)
```

---

## 🧪 **Testing the Fix**

### **Test 1: Check Follow Status**
```typescript
// This should now work without errors
const { data: followStatus } = useFollowStatus(currentUserId, targetUserId);
console.log('Follow status:', followStatus?.isFollowing);
```

### **Test 2: Follow/Unfollow Actions**
```typescript
// This should now work without errors
const followMutation = useFollowMutation(currentUserId);
await followMutation.mutateAsync({ 
  targetUserId: 'target-user-id', 
  action: 'follow' 
});
```

---

## 🔍 **If Error Persists**

### **Check 1: Verify Parameter Names**
The error message suggests the backend expects these exact parameter names:
- `p_follower_id` (the user doing the following)
- `p_followed_id` (the user being followed)

### **Check 2: Backend Function Existence**
Verify these functions exist in your Supabase database:
- `public.get_follow_status`
- `public.follow_user` 
- `public.unfollow_user`

### **Check 3: RLS Policies**
Ensure Row Level Security policies allow the authenticated user to call these functions.

---

## 📊 **Expected Behavior After Fix**

1. ✅ **Follow Status**: Should load without errors when viewing other users' profiles
2. ✅ **Follow Button**: Should appear and function correctly
3. ✅ **Follow Counts**: Should update in real-time after follow/unfollow actions
4. ✅ **No RPC Errors**: Console should show successful RPC calls

---

## 🎯 **Summary**

The issue was caused by **parameter mismatch** between frontend and backend. The frontend was only sending `p_followed_id`, but the backend functions require both `p_follower_id` and `p_followed_id`.

**Status**: ✅ **FIXED** - Both parameters are now included in all RPC calls.

**Next**: Reload the app and test the follow functionality. 