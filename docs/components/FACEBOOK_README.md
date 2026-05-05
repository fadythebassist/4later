# Facebook Component Architecture

## Overview
The Facebook integration uses a **preview card approach** instead of Facebook's SDK embeds for better reliability and user experience.

## Components

### 1. **FacebookPreviewCard.tsx**
- Displays a clean, clickable preview for all Facebook content
- Detects content type from URL (Post, Video, Reel, Photo)
- Shows thumbnail when available
- Always provides "Open in Facebook" button

### 2. **FacebookEmbed.tsx**
- Simplified wrapper that renders `FacebookPreviewCard`
- No longer attempts complex SDK embeds
- Clean, maintainable code

### 3. **AddItemModal.tsx**
- Smart fallback titles based on URL patterns
- Attempts metadata fetch but gracefully handles CORS failures
- Provides context-aware titles (e.g., "Facebook Video" vs "Facebook Photo")

### 4. **ContentCard.tsx**
- Renders Facebook content using `FacebookEmbed`
- Attempts URL resolution for share links
- Handles missing metadata gracefully

## Why Preview Cards Instead of SDK Embeds?

### Technical Challenges with Facebook SDK
1. **CORS Restrictions**: Facebook blocks client-side metadata fetching
2. **Cookie Requirements**: Embeds require third-party cookies (often blocked by browsers)
3. **Privacy Extensions**: Ad blockers and privacy tools block Facebook SDKs
4. **Loading Performance**: SDK embeds are slow (8+ seconds) and unreliable
5. **Complexity**: SDK requires complex initialization and error handling

### Benefits of Preview Card Approach
✅ **Fast**: Instant rendering, no SDK loading delays  
✅ **Reliable**: Works even when CORS/cookies are blocked  
✅ **Clean**: Simple, maintainable code  
✅ **Consistent**: Same experience across all Facebook content types  
✅ **Privacy-Friendly**: No third-party trackers or cookies  

## URL Patterns Supported

- **Posts**: `/share/p/...` or `/posts/...`
- **Videos**: `/share/v/...`, `/video/...`, `/watch/...`, `fb.watch/...`
- **Reels**: `/share/r/...` or `/reel/...`
- **Photos**: `/photo/...`
- **Generic**: Any facebook.com URL with path

## Smart Fallback Titles

When metadata fetch fails (expected due to CORS), we provide intelligent fallback titles:

```typescript
URL Pattern                  → Fallback Title
/share/p/...                → "Facebook Photo"
/share/v/...                → "Facebook Video"
/share/r/...                → "Facebook Reel"
fb.watch/...                → "Facebook Video"
Default                     → "Facebook Post"
```

## Error Handling

### Generic Title Detection
The system detects and replaces generic error titles:
- "403", "Error", "Forbidden"
- "Access Denied", "Log In"
- "Not Found", "Unavailable"

### Graceful Degradation
1. Try to fetch metadata
2. If fails → use fallback title
3. Always show preview card (never show error to user)

## Future Improvements

- [ ] Consider oEmbed API (if Facebook adds public support)
- [ ] Add link preview service backend
- [ ] Cache resolved URLs in localStorage
- [ ] Add manual thumbnail upload option

## Testing

To test Facebook integration:
1. Add a Facebook URL (e.g., `https://www.facebook.com/share/p/...`)
2. Should see preview card immediately
3. Title should be context-aware (not "Error" or "Facebook")
4. Click "Open in Facebook" to verify URL works
