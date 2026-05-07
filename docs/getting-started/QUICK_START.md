# Quick Start Guide - 4Stash

Get up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd c:\Users\Fady\GitHub\4stash
npm install
```

This will install all required packages including React, TypeScript, Vite, and Firebase.

## Step 2: Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

## Step 3: Test the App

### Create an Account (Mock Mode)

1. Click **"Continue with Google"** or **"Sign up"**
   - Google: Creates demo user `demo@4stash.com` instantly
   - Email: Use any email/password (stored locally)

2. You'll see the dashboard with two default lists:
   - 📥 Quick Bin
   - ⭐ Favorites

### Add Your First Item

1. Click the **+ FAB button** (bottom right)
2. Fill in the form:
   - **Title**: "My First Save"
   - **URL**: `https://youtube.com/watch?v=dQw4w9WgXcQ`
   - **List**: Quick Bin
3. Click **"Add Item"**
4. Notice it auto-detects YouTube and adds a badge!

### Create a Custom List

1. Scroll the top bar to the right
2. Click the **+** button
3. Enter name: "Watch Later"
4. Pick an icon: 📺
5. Click **"Create List"**

### Try Swipe Gestures

1. On a touch device (or use DevTools device emulation)
2. Swipe left on any card
3. See "Archive" indicator
4. Complete the swipe to archive

### Filter by List

1. Click different list names in the top bar
2. View switches to show only items in that list
3. Click "All" to see everything

## Step 4: Explore Features

### Test Different Content Types

Add these URLs to see auto-detection in action:

**YouTube Video**:
```
https://youtube.com/watch?v=dQw4w9WgXcQ
```

**Twitter Post**:
```
https://twitter.com/username/status/123456789
```

**Image**:
```
https://picsum.photos/200/300
```

**Article**:
```
https://example.com/article
```

### View Item Details

1. Click any item card
2. Modal opens with full details
3. Click URL to open in new tab
4. Click "Delete" to remove

## Step 5: Test Persistence

1. Add several items
2. Refresh the page (F5)
3. Everything persists! (stored in localStorage)
4. Open in incognito - data is isolated per browser

## What's Next?

### Keep Using Mock Mode

Perfect for development! Data stays in your browser.

### Switch to Firebase (Optional)

For production with cloud sync:

1. Follow **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**
2. Update config in `src/services/FirebaseStorageService.ts`
3. Switch service in contexts

## Common First-Time Issues

### Port Already in Use
```bash
# Vite will automatically try 5174, 5175, etc.
# Or specify a port:
npm run dev -- --port 3000
```

### Module Not Found
```bash
# Make sure you're in the right directory:
cd c:\Users\Fady\GitHub\4stash

# Reinstall dependencies:
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
# Clear TypeScript cache:
rm -rf node_modules/.vite
npm run dev
```

## Testing on Mobile

### Local Network Access

1. Find your computer's IP address:
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address: 192.168.x.x
   ```

2. Start dev server:
   ```bash
   npm run dev -- --host
   ```

3. On your phone, open:
   ```
   http://192.168.x.x:5173
   ```

### Test Web Share Target

Web Share requires HTTPS. Options:

1. **Deploy to Vercel/Netlify** (easiest)
2. **Use ngrok**:
   ```bash
   npx ngrok http 5173
   ```
3. **Build and preview**:
   ```bash
   npm run build
   npm run preview
   ```

## Development Tips

### Hot Module Replacement

Vite provides instant updates:
- Edit any `.tsx` file → See changes immediately
- Edit `.css` files → Styles update without refresh
- TypeScript errors → Show in browser

### DevTools

Recommended setup:
1. Open Chrome DevTools (F12)
2. Enable device toolbar (Ctrl+Shift+M)
3. Select iPhone or Android device
4. Test mobile UI and gestures

### React DevTools

Install extension:
- [Chrome](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

Then inspect:
- Component tree
- Props and state
- Context values

## Keyboard Shortcuts

While in the app:
- `Esc` - Close any modal
- `Tab` - Navigate form fields
- `Enter` - Submit forms

## Project Structure at a Glance

```
src/
├── components/     → UI building blocks
├── contexts/       → Global state (Auth, Data)
├── pages/         → Route components
├── services/      → Business logic (Mock/Firebase)
├── styles/        → Global CSS
└── types/         → TypeScript definitions
```

## Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run dev -- --host    # Expose on network

# Production
npm run build           # Create production build
npm run preview         # Preview production build

# Code Quality
npm run lint            # Check for errors
npm run lint -- --fix   # Auto-fix errors
```

## Getting Help

1. Check **[README.md](./README.md)** for detailed docs
2. Review **[ARCHITECTURE.md](./ARCHITECTURE.md)** to understand structure
3. See **[TESTING.md](./TESTING.md)** for testing guide
4. Open an issue on GitHub

## Next Steps

- [ ] Customize the theme colors in `globals.css`
- [ ] Add more list icons in `AddListModal.tsx`
- [ ] Implement additional content type detection
- [ ] Set up Firebase for cloud sync
- [ ] Deploy to Vercel or Netlify
- [ ] Install as PWA on your phone

---

Enjoy building with 4Later! 🚀
