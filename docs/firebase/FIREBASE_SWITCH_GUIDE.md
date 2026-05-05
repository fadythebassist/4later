# Switching from Mock to Firebase - Quick Reference

## When to Execute These Changes

**ONLY AFTER:**
1. ✅ Firebase project created
2. ✅ Authentication and Firestore enabled
3. ✅ Security rules configured
4. ✅ Firebase config added to `.env` file

---

## Code Changes Required (I'll do this for you)

### 1. Update AuthContext.tsx

**File:** `src/contexts/AuthContext.tsx`

**Change line 4:**
```typescript
// FROM:
import { mockStorageService } from '@/services/MockStorageService';

// TO:
import { firebaseStorageService } from '@/services/FirebaseStorageService';
```

**Change line 19:**
```typescript
// FROM:
const storageService: StorageService = mockStorageService;

// TO:
const storageService: StorageService = firebaseStorageService;
```

### 2. Update DataContext.tsx

**File:** `src/contexts/DataContext.tsx`

**Change line 4:**
```typescript
// FROM:
import { mockStorageService } from '@/services/MockStorageService';

// TO:
import { firebaseStorageService } from '@/services/FirebaseStorageService';
```

**Change line 33:**
```typescript
// FROM:
const storageService: StorageService = mockStorageService;

// TO:
const storageService: StorageService = firebaseStorageService;
```

---

## Testing the Migration

### Step 1: Test Firebase Connection
```bash
# Start the dev server
npm run dev
```

Open browser console, check for:
- ✅ No Firebase configuration errors
- ✅ Firebase successfully initialized

### Step 2: Test Authentication

**Google Sign-In:**
1. Go to http://localhost:5173/login
2. Click "Sign in with Google"
3. Select your Google account
4. Should redirect to dashboard
5. Check Firebase Console → Authentication → Users (should see new user)

**Email Sign-Up:**
1. Go to http://localhost:5173/register
2. Enter email and password
3. Click "Sign Up"
4. Should redirect to dashboard
5. Check Firebase Console → Authentication → Users

### Step 3: Test Data Creation

1. Create a new list
2. Add some items
3. Go to Firebase Console → Firestore Database
4. You should see:
   - `lists` collection with your lists
   - `items` collection with your items

### Step 4: Test Multi-Device Sync

1. Sign in on one browser
2. Add an item
3. Open new incognito window
4. Sign in with same account
5. Should see the same items ✅

---

## Migration of Existing Data

If you want to keep your localStorage data (the 19 items from port 5173):

### Option A: Manual Migration via Console

```javascript
// 1. Sign into Firebase in the app
// 2. Open browser console (F12)
// 3. Run this command:
await window.migrateToFirebase()
```

This will:
- Copy all lists from localStorage to Firestore
- Copy all items from localStorage to Firestore  
- Create a backup in localStorage
- Show progress in console

### Option B: Start Fresh

If you want to start with a clean slate:
```javascript
// Just delete the localStorage data
localStorage.removeItem('4stash_mock_data');
```

---

## Rollback Plan (If Something Goes Wrong)

### Quick Rollback to Mock Storage

If Firebase isn't working, you can quickly switch back:

**1. Revert AuthContext.tsx:**
```typescript
import { mockStorageService } from '@/services/MockStorageService';
const storageService: StorageService = mockStorageService;
```

**2. Revert DataContext.tsx:**
```typescript
import { mockStorageService } from '@/services/MockStorageService';
const storageService: StorageService = mockStorageService;
```

**3. Restart dev server:**
```bash
# Ctrl+C to stop
npm run dev
```

Your localStorage data will still be there!

---

## Common Issues & Solutions

### Issue: "Firebase configuration is missing"
**Solution:** Check `.env` file has all 6 Firebase variables

### Issue: "Permission denied" in Firestore
**Solution:** Check Firebase Console → Firestore → Rules (should allow authenticated users)

### Issue: "User not found after sign-in"
**Solution:** Clear browser cache and localStorage, try again

### Issue: "Data not syncing between devices"
**Solution:** 
1. Check internet connection
2. Check Firebase Console → Firestore to verify data is saved
3. Hard refresh other device (Ctrl+Shift+R)

---

## After Successful Migration

### Clean Up:
1. ✅ Remove old localStorage data: `localStorage.removeItem('4stash_mock_data')`
2. ✅ Update README.md to mention Firebase requirement
3. ✅ Remove Recovery page (no longer needed since no localStorage)
4. ✅ Update documentation

### Next Steps:
- Monitor Firebase usage in Console → Usage tab
- Set up Firebase budget alerts (optional)
- Consider Firebase performance monitoring
- Plan for production deployment

---

## Need Help?

If you encounter any issues during migration:
1. Check browser console for error messages
2. Check Firebase Console for authentication/database errors
3. Share the error message with me
4. We can rollback to Mock storage if needed

---

## Summary

✅ **Before Migration:** Data in localStorage, demo login, single device  
✅ **After Migration:** Data in Firebase, real auth, multi-device sync, production-ready

**Estimated migration time:** 5-10 minutes
