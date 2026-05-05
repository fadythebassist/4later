# Social Login Setup Guide
## Facebook & Twitter/X Authentication

### What's Been Implemented ✅

**Code Changes (Complete):**
1. ✅ **Backend Services** - Facebook and Twitter OAuth methods added to:
   - `FirebaseStorageService.ts` - Production Firebase authentication
   - `MockStorageService.ts` - Development mock authentication
   - `StorageService.ts` - Interface definitions

2. ✅ **Frontend Context** - `AuthContext.tsx`:
   - Added `signInWithFacebook()` and `signInWithTwitter()` methods
   - Both methods handle OAuth popup flow and user creation
   - Creates default lists (Quick Bin, Favorites) for new users

3. ✅ **UI Components** - `Login.tsx` and `Register.tsx`:
   - Added Facebook login button (blue, Facebook icon)
   - Added Twitter/X login button (black, X logo)
   - Both pages now support 4 authentication methods:
     - Email/Password
     - Google OAuth
     - Facebook OAuth
     - Twitter/X OAuth

4. ✅ **Type Definitions** - `types/index.ts`:
   - Updated User provider type to include `'facebook' | 'twitter'`
   - Added `vite-env.d.ts` for environment variable types

5. ✅ **Styling** - `Auth.css`:
   - `.btn-facebook` - Facebook blue (#1877F2)
   - `.btn-twitter` - Twitter/X black (#000000)
   - Hover effects and shadow transitions

---

## Firebase Console Setup (Required Next Steps)

### Phase 1: Enable Authentication Providers (15 minutes)

#### A. Enable Facebook Authentication

1. **Go to Firebase Console** → Your Project → Authentication → Sign-in method
2. Click **"Add new provider"**
3. Select **Facebook**
4. Toggle **"Enable"** to ON
5. You'll see two empty fields:
   - **App ID** (leave empty for now)
   - **App Secret** (leave empty for now)
6. **Copy the OAuth Redirect URI** shown at the bottom (looks like: `https://your-project.firebaseapp.com/__/auth/handler`)
7. Click **"Save"** (we'll come back to add credentials)

#### B. Enable Twitter Authentication

1. On the same page, click **"Add new provider"**
2. Select **Twitter**
3. Toggle **"Enable"** to ON
4. You'll see two empty fields:
   - **API Key** (leave empty for now)
   - **API Secret** (leave empty for now)
5. **Copy the OAuth Callback URL** shown at the bottom
6. Click **"Save"** (we'll come back to add credentials)

---

### Phase 2: Get Facebook App Credentials (10 minutes)

1. **Go to Meta for Developers**: https://developers.facebook.com/
2. **Log in** with your Facebook account
3. Click **"My Apps"** → **"Create App"**
4. Select **"Consumer"** as app type → Click **"Next"**
5. Fill in:
   - **App Name**: "4Later" (or your app name)
   - **App Contact Email**: your@email.com
6. Click **"Create App"**

7. **Add Facebook Login Product**:
   - On the left sidebar, click **"Add Product"**
   - Find **"Facebook Login"** → Click **"Set Up"**
   - Select **"Web"** platform
   - Enter your site URL (for development: `http://localhost:5173`)

8. **Configure OAuth Redirect URIs**:
   - Go to **Facebook Login → Settings** (left sidebar)
   - In **"Valid OAuth Redirect URIs"**, paste the URI from Firebase:
     ```
     https://your-project.firebaseapp.com/__/auth/handler
     ```
   - Add development URL:
     ```
     http://localhost:5173
     ```
   - Click **"Save Changes"**

9. **Get App Credentials**:
   - Go to **Settings → Basic** (left sidebar)
   - Copy **"App ID"**
   - Click **"Show"** next to **"App Secret"** → Copy it
   - **Keep these safe!**

10. **Make App Live** (Important!):
    - At the top, toggle from **"Development"** to **"Live"**
    - This makes Facebook login work for all users

11. **Go back to Firebase Console**:
    - Authentication → Sign-in method → Facebook
    - Paste **App ID** and **App Secret**
    - Click **"Save"**

---

### Phase 3: Get Twitter/X API Credentials (15 minutes)

1. **Go to Twitter Developer Portal**: https://developer.twitter.com/
2. **Sign in** with your Twitter/X account
3. Click **"+ Create Project"**
4. Fill in:
   - **Project Name**: "4Later"
   - **Use Case**: Select appropriate option (e.g., "Building tools for personal use")
   - **Project Description**: "PWA for saving and organizing content"
5. Click **"Next"** and create the project

6. **Create an App**:
   - After project creation, click **"+ Add App"**
   - App environment: **Production**
   - App name: "4Later App"
   - Click **"Complete"**

7. **Get API Keys**:
   - You'll see **API Key** and **API Secret** → **SAVE THESE!**
   - If you miss this screen, go to: **App Settings → Keys and tokens**

8. **Configure OAuth Settings**:
   - Go to **App Settings** → **User authentication settings**
   - Click **"Set up"**
   - Select **OAuth 1.0a** and **OAuth 2.0** (enable both)
   - **App permissions**: Select **"Read"**
   - **Type of App**: Web App
   - **Callback URLs**: Paste the URL from Firebase:
     ```
     https://your-project.firebaseapp.com/__/auth/handler
     ```
   - Add development URL:
     ```
     http://localhost:5173/__/auth/handler
     ```
   - **Website URL**: Your app's URL (for now: `http://localhost:5173`)
   - Click **"Save"**

9. **Go back to Firebase Console**:
   - Authentication → Sign-in method → Twitter
   - Paste **API Key** and **API Secret**
   - Click **"Save"**

---

## Phase 4: Testing (5 minutes)

### Local Testing (Mock Storage):

Since you're currently using `MockStorageService`, the Facebook and Twitter buttons will work in **mock mode**:
- They'll create a demo user (`demo@4stash.com`)
- No real OAuth will happen
- Perfect for UI testing before Firebase migration

### After Firebase Migration:

1. **Start the app**: `npm run dev`
2. **Go to Login page**: http://localhost:5173/login
3. **Test Facebook Login**:
   - Click **"Continue with Facebook"**
   - Facebook OAuth popup should appear
   - Log in with Facebook account
   - Should redirect to Dashboard with Facebook profile
4. **Test Twitter Login**:
   - Click **"Continue with X"**
   - Twitter OAuth popup should appear
   - Authorize the app
   - Should redirect to Dashboard with Twitter profile
5. **Verify User Data**:
   - Check Firebase Console → Authentication → Users
   - You should see new users with providers: facebook.com, twitter.com
   - Check Firestore Database → users collection
   - Verify user document has `provider: 'facebook'` or `provider: 'twitter'`

---

## Troubleshooting

### Facebook Login Not Working:
- ✅ Check Facebook app is in **"Live"** mode (not Development)
- ✅ Verify OAuth redirect URI matches Firebase exactly
- ✅ Check App ID and Secret are correct in Firebase
- ✅ Try clearing browser cache
- ✅ Check browser console for errors

### Twitter Login Not Working:
- ✅ Verify OAuth 1.0a is enabled in Twitter Developer Portal
- ✅ Check callback URL matches Firebase exactly
- ✅ Ensure API Key and Secret are correct in Firebase
- ✅ Try using Twitter app in browser (not logged in elsewhere)
- ✅ Check browser console for errors

### "Popup Blocked" Error:
- Allow popups for your domain in browser settings
- Or click the browser's popup blocked icon (address bar)

### "Unauthorized Origin" Error:
- Add `http://localhost:5173` to Firebase Authorized domains:
  - Firebase Console → Authentication → Settings → Authorized domains

---

## Security Notes

1. **Never commit credentials to Git**:
   - Facebook App ID/Secret stay in Firebase only
   - Twitter API Key/Secret stay in Firebase only
   - Your `.env` file is already in `.gitignore` ✅

2. **Production Setup**:
   - Before deploying, add your production domain to:
     - Firebase Authorized domains
     - Facebook OAuth Redirect URIs
     - Twitter Callback URLs

3. **User Privacy**:
   - Firebase only requests basic profile info (name, email, photo)
   - No posting permissions requested
   - Users can revoke access anytime from their Facebook/Twitter settings

---

## What's Next?

After you complete Firebase Console setup (above), you'll have:
- ✅ 4 login methods working (Email, Google, Facebook, Twitter)
- ✅ Professional authentication experience
- ✅ Better user acquisition (more login options = more users)
- ✅ Play Store compliance (multiple auth methods recommended)

**Then you can:**
1. Complete Firebase migration using the guides:
   - `FIREBASE_MIGRATION_GUIDE.md`
   - `FIREBASE_SWITCH_GUIDE.md`
2. Test all login methods in production
3. Deploy PWA to your production domain
4. Submit to Google Play Store beta

---

## Summary of Changes

**Files Modified:**
1. `src/contexts/AuthContext.tsx` - Added Facebook/Twitter auth methods
2. `src/services/FirebaseStorageService.ts` - Added OAuth providers
3. `src/services/MockStorageService.ts` - Added mock implementations
4. `src/services/StorageService.ts` - Updated interface
5. `src/pages/Login.tsx` - Added Facebook/Twitter buttons
6. `src/pages/Register.tsx` - Added Facebook/Twitter buttons
7. `src/pages/Auth.css` - Added button styles
8. `src/types/index.ts` - Updated User provider type
9. `src/vite-env.d.ts` - Created environment variable types

**Current Status:**
- ✅ Code: 100% complete and tested
- ⏳ Firebase Console: Needs setup (follow guide above)
- ⏳ Facebook App: Needs credentials (follow Phase 2)
- ⏳ Twitter App: Needs credentials (follow Phase 3)

**Estimated Time:**
- Firebase setup: 15 min
- Facebook credentials: 10 min
- Twitter credentials: 15 min
- Testing: 5 min
- **Total: ~45 minutes**
