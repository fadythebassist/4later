# Firestore Security Rules

## Required Security Rules for 4Later

Add these rules to your Firebase Console:
**Firebase Console → Firestore Database → Rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Lists collection - users can only access their own lists
    match /lists/{listId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
                      request.auth.uid == request.resource.data.userId;
    }
    
    // Items collection - users can only access their own items
    match /items/{itemId} {
      allow read, write: if request.auth != null && 
                           request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
                      request.auth.uid == request.resource.data.userId;
    }
    
    // Social Connections collection - users can only access their own connections
    match /socialConnections/{connectionId} {
      allow read: if request.auth != null && 
                    request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
                      request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && 
                              request.auth.uid == resource.data.userId;
    }
  }
}
```

## Rule Explanations

### Users Collection
- Users can only read and write their own user document
- Prevents users from accessing other users' data

### Lists Collection
- Users can only read lists they own (checked via `userId` field)
- Users can only create lists with their own `userId`
- Prevents unauthorized access to other users' lists

### Items Collection
- Users can only read/write items they own (checked via `userId` field)
- Users can only create items with their own `userId`
- Ensures content privacy

### Social Connections Collection (NEW)
- Users can only read their own social connections
- Users can only create connections with their own `userId`
- Users can only update/delete their own connections
- Protects OAuth tokens and platform credentials

## Testing Rules

After applying these rules, test in Firebase Console:

1. Go to **Firestore Database → Rules**
2. Click **Rules Playground**
3. Test scenarios:
   - Authenticated user reading their own data ✅
   - Authenticated user reading another user's data ❌
   - Unauthenticated user reading any data ❌

## Development Mode (Not Recommended)

If you need to bypass security for development (NOT for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // ⚠️ INSECURE - Development only!
    }
  }
}
```

⚠️ **WARNING**: Never use open rules in production! Your data will be publicly accessible.

## Common Issues

### "Missing or insufficient permissions"
- Check that security rules are published
- Verify user is authenticated (`request.auth != null`)
- Ensure `userId` field matches `request.auth.uid`
- Wait ~1 minute after publishing rules for changes to take effect

### "PERMISSION_DENIED" errors
- User might not be logged in
- Document might belong to another user
- Rules might not be published yet
- Check browser console for specific error details

## Migration Steps

If you already have data in Firestore:

1. **Backup your data** first!
2. Apply the new security rules
3. Test with your account
4. If errors occur, check that all documents have correct `userId` fields
5. Update any documents missing `userId`:
   ```javascript
   // Run in Firebase Console → Firestore → Run query
   db.collection('socialConnections')
     .where('userId', '==', null)
     .get()
     .then(snapshot => {
       snapshot.forEach(doc => {
         console.log('Missing userId:', doc.id);
       });
     });
   ```

## Additional Security

Consider adding these enhanced rules for production:

```javascript
// Rate limiting helper
function isRateLimited() {
  return request.time > resource.data.lastModified + duration.value(1, 's');
}

// Validate social connection data
match /socialConnections/{connectionId} {
  allow create: if request.auth != null && 
                  request.auth.uid == request.resource.data.userId &&
                  request.resource.data.keys().hasAll(['platform', 'accessToken', 'connectedAt']) &&
                  request.resource.data.platform in ['facebook', 'instagram', 'twitter', 'threads', 'tiktok', 'pinterest'];
  
  allow update: if request.auth != null && 
                  request.auth.uid == resource.data.userId &&
                  isRateLimited();
}
```

## Monitoring

Enable Firestore security rules monitoring:

1. Go to **Firebase Console → Firestore → Usage**
2. Check **Security rules evaluation** metrics
3. Look for denied requests
4. Adjust rules if legitimate requests are being blocked

## Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Rules Reference](https://firebase.google.com/docs/rules/rules-language)
- [Security Best Practices](https://firebase.google.com/docs/firestore/security/rules-conditions)
