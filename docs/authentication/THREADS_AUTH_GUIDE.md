# Threads Authentication Setup Guide

This guide explains how to set up Threads authentication in 4Later to enable saving and viewing Threads posts with rich previews.

## Overview

The Threads integration allows users to:
- Connect their Threads account via OAuth
- Save Threads posts (requires authentication)
- View rich previews using Meta's official oEmbed API
- Automatic fallback to card UI when not connected

## Prerequisites

1. **Meta Developer Account**: [https://developers.facebook.com](https://developers.facebook.com)
2. **Meta App**: Create a new app or use existing one
3. **Threads API Access**: Request Advanced Access for Threads APIs

## Setup Steps

### 1. Create a Meta App

1. Go to [Meta Developers](https://developers.facebook.com/apps)
2. Click "Create App"
3. Select "Business" type (or appropriate for your use case)
4. Fill in app details:
   - App Name: `4Stash` (or your app name)
   - App Contact Email: Your email
   - Business Account: (optional)

### 2. Configure Threads API

1. In your app dashboard, go to "Add Products"
2. Find "Threads API" and click "Set Up"
3. Configure permissions:
   - Add `threads_basic` permission (read basic profile info)
   - Add `threads_content_publish` permission (if you want to post)

### 3. Set Up OAuth Settings

1. Go to "Threads API" → "Settings"
2. Add Valid OAuth Redirect URIs:
   ```
   http://localhost:5173/threads-oauth-callback.html
   https://yourdomain.com/threads-oauth-callback.html
   ```
3. Save changes

### 4. Get App Credentials

1. Go to "Settings" → "Basic"
2. Copy your:
   - **App ID**
   - **App Secret** (click "Show" to reveal)

### 5. Configure Environment Variables

Add these to your `.env` file:

```env
# Threads API Configuration
VITE_THREADS_APP_ID=your_app_id_here
VITE_THREADS_APP_SECRET=your_app_secret_here
VITE_THREADS_REDIRECT_URI=http://localhost:5173/threads-oauth-callback.html
```

**Production:**
```env
VITE_THREADS_REDIRECT_URI=https://yourdomain.com/threads-oauth-callback.html
```

### 6. Request Advanced Access

For oEmbed API to work with public Threads posts, you need Advanced Access:

1. Go to "App Review" → "Permissions and Features"
2. Request Advanced Access for:
   - `threads_basic`
   - `threads_content_publish` (if needed)
3. Fill out the review form explaining your use case
4. Wait for Meta to approve (usually 1-2 weeks)

## User Flow

### Connecting Threads Account

1. User clicks Settings (⚙️) in the app
2. Navigate to "Account" tab
3. Under "Social Connections", click "Connect" for Threads
4. OAuth popup opens to threads.net
5. User logs in and authorizes the app
6. Connection saved to Firebase Firestore

### Saving Threads Posts

1. User tries to save a Threads URL
2. App checks if Threads is connected
3. If not connected:
   - Shows alert: "Threads Connection Required"
   - Prompts user to connect in Settings
4. If connected:
   - Post is saved normally
   - Rich preview fetched via oEmbed API

### Viewing Threads Posts

**With Connection:**
- Uses Meta's oEmbed API
- Renders official Threads embed
- Shows rich content (text, images, author, etc.)

**Without Connection:**
- Shows fallback card UI
- Displays title/description if available
- Shows hint: "Connect your Threads account in Settings for rich previews"

## Architecture

### Components Updated

1. **types/index.ts**
   - Added `threads` to `SocialConnection.platform`
   - Added `socialConnections` to `User` interface

2. **services/StorageService.ts**
   - Added social connection CRUD methods

3. **services/FirebaseStorageService.ts**
   - Implemented social connection methods
   - Stores connections in `socialConnections` collection

4. **services/ThreadsAuthService.ts** (NEW)
   - Handles OAuth flow
   - Manages access tokens
   - Calls oEmbed API

5. **contexts/AuthContext.tsx**
   - Added `getSocialConnection()`
   - Added `addSocialConnection()`
   - Added `removeSocialConnection()`
   - Added `hasThreadsConnection()`

6. **components/SettingsModal.tsx**
   - Added Social Connections section
   - Connect/Disconnect Threads UI
   - OAuth popup handler

7. **components/AddItemModal.tsx**
   - Pre-save validation for Threads URLs
   - Prompts user to connect if not authenticated

8. **components/ThreadsEmbed.tsx**
   - Fetches oEmbed data when connected
   - Falls back to card UI when not connected
   - Loads Threads embed script dynamically

9. **threads-oauth-callback.html** (NEW)
   - OAuth callback page
   - Handles authorization code
   - Posts message to parent window

### Firebase Collections

**socialConnections**
```typescript
{
  id: string              // Document ID
  userId: string          // User who connected
  platform: string        // "threads"
  accessToken: string     // OAuth access token
  refreshToken?: string   // For long-lived tokens
  expiresAt?: Date        // Token expiration
  platformUserId: string  // Threads user ID
  platformUsername: string // @username
  connectedAt: Date       // Connection timestamp
  lastRefreshed?: Date    // Last token refresh
}
```

## API Endpoints Used

### OAuth Authorization
```
GET https://threads.net/oauth/authorize
  ?client_id={APP_ID}
  &redirect_uri={REDIRECT_URI}
  &scope=threads_basic,threads_content_publish
  &response_type=code
```

### Token Exchange
```
POST https://graph.threads.net/oauth/access_token
  client_id={APP_ID}
  client_secret={APP_SECRET}
  grant_type=authorization_code
  redirect_uri={REDIRECT_URI}
  code={AUTH_CODE}
```

### User Profile
```
GET https://graph.threads.net/v1.0/me
  ?fields=id,username
  &access_token={ACCESS_TOKEN}
```

### oEmbed API
```
GET https://graph.threads.net/v1.0/oembed
  ?url={THREADS_POST_URL}
  &access_token={ACCESS_TOKEN}
  &maxwidth=600
```

### Token Refresh
```
GET https://graph.threads.net/refresh_access_token
  ?grant_type=th_refresh_token
  &access_token={ACCESS_TOKEN}
```

## Security Considerations

1. **App Secret Protection**
   - Never expose `VITE_THREADS_APP_SECRET` in client code
   - Consider using a backend proxy for token exchange (future improvement)

2. **Token Storage**
   - Tokens stored in Firebase Firestore
   - Protected by Firebase Security Rules
   - Only user can access their own connections

3. **OAuth State Parameter**
   - Optionally add CSRF protection with state parameter
   - Validate state in callback

4. **Token Refresh**
   - Threads tokens expire (typically 60 days)
   - Implement automatic refresh before expiry
   - Handle token invalidation gracefully

## Testing

### Local Testing

1. Make sure `.env` has correct credentials
2. Start dev server: `npm run dev`
3. Open `http://localhost:5173`
4. Go to Settings → Account → Social Connections
5. Click "Connect" for Threads
6. Complete OAuth flow
7. Try saving a Threads post: `https://www.threads.net/@username/post/ABC123`

### Verify Connection

Check browser console for:
```
✅ Social connection added: threads
👤 Current user: { ..., socialConnections: [...] }
```

Check Firebase Firestore:
- Collection: `socialConnections`
- Should have document with platform="threads"

## Troubleshorhopoting

### "Failed to exchange code for token"
- Check `VITE_THREADS_APP_ID` and `VITE_THREADS_APP_SECRET`
- Verify redirect URI matches exactly in Meta app settings
- Check OAuth popup wasn't blocked by browser

### "Failed to get oEmbed data"
- Verify Advanced Access approved by Meta
- Check access token hasn't expired
- Ensure Threads post URL is public
- Check browser console for API errors

### Rich embeds not showing
- Confirm user is connected (check Settings)
- Verify `threads.net/embed.js` loads (Network tab)
- Check for CORS errors in console
- Try disconnecting and reconnecting

### OAuth popup blocked
- Browser may block popups
- User needs to allow popups for your domain
- Alternative: Use redirect flow instead of popup

## Future Improvements

1. **Backend Token Exchange**
   - Move token exchange to backend API
   - Hide app secret from client

2. **Automatic Token Refresh**
   - Background job to refresh expiring tokens
   - Notify user if refresh fails

3. **Multi-Platform Support**
   - Add Instagram, Facebook, TikTok connections
   - Reuse OAuth infrastructure

4. **Enhanced Error Handling**
   - Better error messages
   - Retry logic for API calls
   - Graceful degradation

5. **Analytics**
   - Track connection success rate
   - Monitor API usage
   - Measure rich embed engagement

## Resources

- [Threads API Documentation](https://developers.facebook.com/docs/threads)
- [Threads oEmbed API](https://developers.facebook.com/docs/threads/reply-moderation#oembed)
- [OAuth 2.0 Authorization](https://developers.facebook.com/docs/threads/get-started#authentication)
- [Meta App Review Process](https://developers.facebook.com/docs/app-review)

## Support

For issues or questions:
1. Check Meta Developer Community
2. Review app logs in Meta Dashboard
3. Test with Meta's Graph API Explorer
4. Contact Meta Support for API issues
