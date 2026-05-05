# Firebase Setup Instructions

## Creating a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or "Create a project"
3. Enter project name: `4stash` (or your preferred name)
4. Disable Google Analytics (optional for this project)
5. Click "Create Project"

## Enable Authentication

1. In Firebase Console, click "Authentication" in the left sidebar
2. Click "Get Started"
3. Enable the following sign-in methods:
   - **Email/Password**: Click and toggle "Enable"
   - **Google**: Click, toggle "Enable", and configure:
     - Add a public-facing name for your project
     - Add support email
     - Click "Save"

## Create Firestore Database

1. In Firebase Console, click "Firestore Database" in the left sidebar
2. Click "Create Database"
3. Choose "Start in production mode" (we'll add security rules later)
4. Select a location closest to your users
5. Click "Enable"

## Security Rules

After creating the database, add these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lists collection
    match /lists/{listId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Items collection
    match /items/{itemId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Get Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>`
5. Register your app with a nickname (e.g., "4Later Web")
6. Copy the `firebaseConfig` object

## Configure Your App

1. Open `src/services/FirebaseStorageService.ts`
2. Replace the `firebaseConfig` object with your actual Firebase configuration:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## Switch from Mock to Firebase

1. Open `src/contexts/AuthContext.tsx`
2. Change the import and service instance:

```typescript
// Before:
import { mockStorageService } from '@/services/MockStorageService';
const storageService: StorageService = mockStorageService;

// After:
import { firebaseStorageService } from '@/services/FirebaseStorageService';
const storageService: StorageService = firebaseStorageService;
```

3. Do the same in `src/contexts/DataContext.tsx`

## Testing Firebase Integration

1. Run the app: `npm run dev`
2. Try signing up with a new email
3. Check Firebase Console > Authentication to see the new user
4. Add some items and lists
5. Check Firebase Console > Firestore Database to see the data

## Environment Variables (Optional but Recommended)

Instead of hardcoding Firebase config, use environment variables:

1. Create `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

2. Update `FirebaseStorageService.ts`:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

## Deployment

When deploying to production:
1. Make sure `.env` is in `.gitignore`
2. Add environment variables to your hosting platform (Vercel, Netlify, etc.)
3. Enable proper CORS settings in Firebase
4. Update Firebase authorized domains in Authentication settings
