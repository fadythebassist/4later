# 🔥 Firebase Migration Guide - Step by Step

This guide will help you migrate from localStorage to Firebase with authentication.

**This Guide Covers:**

- ✅ Google OAuth
- ✅ Email/Password authentication
- ✅ Firestore database setup
- ✅ Security rules configuration

**Want Facebook & Twitter/X Login?**  
After completing this migration, you can add social login providers by following our [Social Login Setup Guide](../authentication/SOCIAL_LOGIN_SETUP.md). The app code already supports them!

---

## Phase 1: Firebase Console Setup (15 minutes)

### Step 1.1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"** or **"Create a project"**
3. Enter project name: `4stash-production`
4. **Disable** Google Analytics (not needed for now)
5. Click **"Create Project"** and wait for setup to complete
6. Click **"Continue"** when done

### Step 1.2: Enable Authentication Methods

1. In left sidebar, click **"Build"** → **"Authentication"**
2. Click **"Get Started"** button
3. Go to **"Sign-in method"** tab

**Enable Google Sign-In:**

1. Click on **"Google"** provider
2. Toggle to **Enable**
3. Enter **Project support email**: (your email)
4. Click **"Save"**

**Enable Email/Password:**

1. Click on **"Email/Password"** provider
2. Toggle **Enable** (first option only, not Email link)
3. Click **"Save"**

> 💡 **Want Facebook & Twitter/X login too?**  
> You can add them later following our [Social Login Setup Guide](../authentication/SOCIAL_LOGIN_SETUP.md). The app code already supports all four authentication methods - you just need to enable them in Firebase Console and get credentials when you're ready.

### Step 1.3: Create Firestore Database

1. In left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll add rules in Step 1.5)
4. Select location: **Choose closest to your target users**
   - If unsure, select `us-central1` (Iowa)
5. Click **"Enable"** and wait for database creation

### Step 1.4: Get Firebase Configuration

1. Click the **⚙️ gear icon** next to "Project Overview" (top left)
2. From the dropdown menu, click **"General"** (first option)
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** `</>`
5. Enter app nickname: `4Later Web App`
6. **Do NOT** check "Also set up Firebase Hosting"
7. Click **"Register app"**
8. You'll see "Add Firebase SDK" page with **"Use npm"** selected - leave it as is
9. **COPY** the `firebaseConfig` object values (looks like this):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456",
};
```

10. **Ignore the npm install commands** shown on that page (we'll handle SDK installation in Phase 3)
11. Click **"Continue to console"**

### Step 1.5: Configure Firestore Security Rules

1. In Firestore Database, click **"Rules"** tab at the top
2. **Replace all content** with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lists collection - user can only access their own lists
    match /lists/{listId} {
      // Read: only if user owns it
      allow read: if request.auth != null &&
                     resource.data.userId == request.auth.uid;

      // Create: only if userId matches auth uid
      allow create: if request.auth != null &&
                       request.resource.data.userId == request.auth.uid;

      // Update/Delete: only if user owns it
      allow update, delete: if request.auth != null &&
                               resource.data.userId == request.auth.uid;
    }

    // Items collection - user can only access their own items
    match /items/{itemId} {
      // Read: only if user owns it
      allow read: if request.auth != null &&
                     resource.data.userId == request.auth.uid;

      // Create: only if userId matches auth uid
      allow create: if request.auth != null &&
                       request.resource.data.userId == request.auth.uid;

      // Update/Delete: only if user owns it
      allow update, delete: if request.auth != null &&
                               resource.data.userId == request.auth.uid;
    }
  }
}
```

3. Click **"Publish"**
4. Confirm by clicking **"Publish"** again in the dialog

---

## Phase 2: Configure Your App (5 minutes)

### Step 2.1: Add Firebase Config to .env

1. Open your `.env` file (create it if it doesn't exist in project root)
2. Add your Firebase configuration:

```env
# Existing Facebook credentials
VITE_FACEBOOK_APP_ID=your-facebook-app-id
VITE_FACEBOOK_APP_SECRET=your-facebook-app-secret

# Firebase Configuration (ADD THESE)
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

3. **Replace** the values with your actual Firebase config from Step 1.4
4. **Save** the file

### Step 2.2: Verify .env is in .gitignore

```bash
# Run this to check:
cat .gitignore | grep .env
```

If you don't see `.env`, add it:

```bash
echo ".env" >> .gitignore
```

---

## Phase 3: Update Code to Use Firebase (Next steps)

After you complete Phase 1 and Phase 2 above, let me know and I'll:

1. ✅ Update `FirebaseStorageService.ts` to use environment variables
2. ✅ Switch `AuthContext.tsx` from Mock to Firebase
3. ✅ Switch `DataContext.tsx` from Mock to Firebase
4. ✅ Create a data migration utility to move localStorage data to Firestore
5. ✅ Test authentication flows
6. ✅ Test data sync across devices

---

## What You'll Have After Migration

### ✅ Benefits:

- **Real authentication** with Google and Email/Password
- **Data persists** across devices and browsers
- **Secure** with Firestore security rules
- **Scalable** for production use
- **No more localhost port issues** (data syncs via Firebase)
- **Ready for social login** (add Facebook/Twitter later if needed)

### 🔄 Changes:

- Users must sign up/login (no more automatic demo@4stash.com)
- Data stored in cloud, not localStorage
- New users start with empty lists (migration tool handles existing users)

---

## Estimated Time:

- **Phase 1** (Firebase Console): 15 min
- **Phase 2** (App Config): 5 min
- **Phase 3** (Code Updates): I'll handle this - 10 min
- **Testing**: 10 min

**Total: ~40 minutes**

> 💡 **Want to add Facebook & Twitter/X login?** You can add them anytime after migration by following the [Optional: Social Login Setup](#optional-social-login-setup) section below or the [Social Login Setup Guide](../authentication/SOCIAL_LOGIN_SETUP.md).

---

## Ready to Start?

### Your Next Actions:

1. ✅ Complete **Phase 1** (Firebase Console Setup)
2. ✅ Complete **Phase 2** (Add config to .env)
3. ✅ Share your Firebase config values with me (or just confirm you've added them to .env)
4. ✅ I'll implement Phase 3 automatically

### Questions Before Starting:

- Do you already have a Google/Firebase account?
- Do you want to keep the existing localStorage data? (I can create a migration tool)

> 💡 **Tip:** After migration is complete, you can add Facebook & Twitter/X login anytime by following our [Social Login Setup Guide](../authentication/SOCIAL_LOGIN_SETUP.md).

Let me know when you've completed Phase 1 and 2, and I'll proceed with the code updates! 🚀

---

## Optional: Social Login Setup

**⚠️ Complete the main migration (Phase 1-3) first!** Then come back here if you want to add Facebook and Twitter authentication.

This is a quick reference - for full detailed instructions, see the [Social Login Setup Guide](../authentication/SOCIAL_LOGIN_SETUP.md).

### Prerequisites:

1. First, go to Firebase Console → Authentication → Sign-in method
2. Enable **Facebook** and/or **Twitter** providers (toggle them on)
3. Copy the OAuth redirect URIs shown for each provider
4. Then follow the steps below to get credentials and complete setup

---

### For Facebook Login:

**Option A: Reuse Your Existing Facebook App (Faster - 5 minutes)**

Since you already have a Facebook App (ID: 1386216603247526) for post previews, you can reuse it:

1. Go to [Meta for Developers](https://developers.facebook.com/) → Your Apps
2. Select your existing app (4Later or similar)
3. **Add Facebook Login Product** (if not already added):
   - Click **"Add Product"** in left sidebar
   - Find **"Facebook Login"** → Click **"Set Up"**
   - Select **"Web"** platform
4. **Configure OAuth Redirect URIs**:
   - Go to **Facebook Login → Settings** (left sidebar)
   - In **"Valid OAuth Redirect URIs"**, add the Firebase redirect URI from the prerequisites above
   - For development, also add: `http://localhost:5173`
   - Click **"Save Changes"**
5. **Make App Live** (Important!):
   - At the top, toggle from **"Development"** to **"Live"**
6. **Add Credentials to Firebase**:
   - Go to **Settings → Basic** (left sidebar)
   - Copy your **App ID** and **App Secret**
   - Add them to Firebase Console → Authentication → Facebook provider
7. Click **"Save"** in Firebase

✅ Done! Your existing app now handles both post previews AND user authentication.

**Option B: Create a New Facebook App**

If you prefer to keep concerns separated (recommended for production):

- Follow the detailed guide: [Social Login Setup - Facebook Section](../authentication/SOCIAL_LOGIN_SETUP.md#phase-2-get-facebook-app-credentials-10-minutes)

---

### For Twitter/X Login:

Follow the detailed guide: [Social Login Setup - Twitter Section](../authentication/SOCIAL_LOGIN_SETUP.md#phase-3-get-twitterx-api-credentials-15-minutes)

**Time required:** ~5-15 minutes depending on whether you reuse existing Facebook app

---

**💡 Tip:** The app code already supports Facebook and Twitter login - you just need to configure Firebase Console and get credentials when ready!
