# Testing Guide for 4Stash

## Testing in Mock Mode

The app runs in Mock Mode by default, which simulates Firebase using localStorage.

### 1. User Authentication

#### Test Google Sign-In (Mock)
1. Click "Continue with Google"
2. Automatically creates demo user: `demo@4stash.com`
3. Redirects to dashboard
4. Data persists across page refreshes

#### Test Email Sign-Up
1. Click "Sign up"
2. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
3. Click "Create Account"
4. Should redirect to dashboard
5. Two default lists created: "Quick Bin" and "Favorites"

#### Test Email Sign-In
1. Sign out
2. Click "Sign In"
3. Use credentials from sign-up
4. Should log in successfully

### 2. Lists Management

#### Create a New List
1. Click "+" button in top bar
2. Enter name: "Watch Later"
3. Select an icon: 📺
4. Click "Create List"
5. New list appears in top bar

#### Filter by List
1. Click "All" to see all items
2. Click a specific list name to filter
3. Only items from that list should show

#### Delete a List
1. Create a test list
2. Add items to it
3. Delete the list (via edit button)
4. Items should be deleted too

### 3. Items Management

#### Add a Text Item
1. Click FAB (+) button
2. Fill in:
   - Title: "My Note"
   - Notes: "This is a test note"
   - List: "Quick Bin"
3. Click "Add Item"
4. Item appears in grid

#### Add a Link Item
1. Click FAB
2. Fill in:
   - Title: "Interesting Article"
   - URL: "https://example.com/article"
   - List: "Quick Bin"
3. Click "Add Item"
4. Card shows domain name

#### Add YouTube Video
1. Click FAB
2. Fill in:
   - Title: "Tutorial Video"
   - URL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   - List: "Favorites"
3. Should auto-detect as YouTube (`▶️` badge)
4. Responsive 16:9 iframe player renders in card (not just a thumbnail)
5. `autoplayVideos` setting controls autoplay behaviour

#### View Item Details
1. Click on any item card
2. Modal opens with full details
3. Can see all metadata
4. Links open in new tab

#### Delete an Item
1. Click item to open details
2. Click "Delete" button
3. Confirm deletion
4. Item removed from list

### 4. Swipe Gestures (Mobile)

#### Archive an Item
1. On touch device or mobile browser
2. Swipe left on any card
3. "Archive" indicator appears
4. Complete swipe to archive
5. Haptic feedback triggers (if supported)
6. Item removed from view

### 5. Web Share Target (Requires HTTPS)

#### Test Sharing from Another App
1. Build and serve over HTTPS: `npm run build && npm run preview`
2. Or deploy to hosting service
3. Install as PWA
4. Open Twitter/Chrome/any app
5. Click share button
6. Select "4Later"
7. Add item modal opens with pre-filled data

### 6. UI States

#### Empty State
1. Create a new list
2. Don't add any items
3. Filter to that list
4. Should show empty state with icon

#### Loading State
1. Open DevTools
2. Throttle network to "Slow 3G"
3. Perform actions
4. Should see loading indicators

#### Error State
1. Modify localStorage to corrupt data
2. Try to load dashboard
3. Should handle errors gracefully

### 7. Responsive Design

#### Mobile View (360px - 450px)
1. Open DevTools
2. Toggle device toolbar
3. Select iPhone SE or similar
4. Test:
   - Top bar scrolls horizontally
   - Cards stack vertically
   - FAB positioned correctly
   - Modals fill screen

#### Tablet View (768px - 1024px)
1. Resize to tablet width
2. Cards should show in 2-column grid
3. User name appears in header

#### Desktop View (1024px+)
1. Resize to desktop width
2. Cards show in 3-column grid
3. Maximum width container applies

### 8. Data Persistence

#### Refresh Test
1. Add several items and lists
2. Refresh the page (F5)
3. All data should persist
4. Selected list filter maintained

#### Multiple Tabs
1. Open app in two tabs
2. Add item in tab 1
3. Refresh tab 2
4. New item should appear

### 9. Performance

#### Load Time
1. Open DevTools > Network
2. Hard refresh (Ctrl+Shift+R)
3. Check performance:
   - Initial bundle size < 300KB
   - First Contentful Paint < 1.5s
   - Time to Interactive < 3s

#### Animation Performance
1. Open DevTools > Performance
2. Record while:
   - Opening modals
   - Scrolling list
   - Swiping cards
3. Check for 60fps animations

## Testing Firebase Integration

Once you've set up Firebase (see FIREBASE_SETUP.md):

### 1. Authentication
1. Test real Google Sign-In
2. Verify user appears in Firebase Console > Authentication
3. Test email sign-up with verification

### 2. Data Sync
1. Add items on device 1
2. Sign in on device 2 with same account
3. Data should sync automatically

### 3. Offline Behavior
1. Add item while online
2. Disconnect internet
3. Try to add another item
4. Should show appropriate error

### 4. Security Rules
1. Try to access another user's data
2. Should be denied by Firestore rules
3. Check Firebase Console > Firestore > Rules

## Common Issues

### Mock Data Not Persisting
- Check localStorage isn't disabled
- Clear cache: DevTools > Application > Clear storage

### Swipe Gesture Not Working
- Ensure touch events are enabled
- Try on actual mobile device
- Check for JavaScript errors

### Web Share Not Available
- Requires HTTPS
- Only works on supported browsers (Chrome, Edge)
- Must be installed as PWA

### Firebase Connection Issues
- Verify config in FirebaseStorageService.ts
- Check network tab for errors
- Ensure Firestore rules are set

## Social Media Platform Test Plan

### Scope

| Tier | Platforms | Embed behaviour |
|---|---|---|
| **Tier 1 — Full embed** | Twitter/X, TikTok, Instagram, Reddit, Facebook, Threads, **YouTube**, **Vimeo** | Interactive player/widget renders inside the card |
| **Tier 2 — Link + metadata** | Medium, LinkedIn, GitHub | OG title/description/thumbnail fetched; source badge shown; no iframe |
| **Tier 3 — Generic unfurl** | Any other URL | Best-effort Open Graph scrape; plain link card |

---

### Tier 1 — Full Embed Platforms

#### Twitter / X

| # | URL | Content type | Expected result |
|---|---|---|---|
| T1 | `https://x.com/OpenAI/status/1719976815488090213` | Text tweet | `𝕏` badge; Twitter widget renders |
| T2 | `https://twitter.com/elonmusk/status/1719976815488090213` | Old-style URL | Same widget, old domain resolved |
| T3 | Any tweet with an image attachment | Photo tweet | Widget renders with image |
| T4 | Any tweet with a video attachment | Video tweet | Widget renders with inline video |
| T5 | `https://x.com/i/web/status/{id}` | Anonymous status URL | ID extracted correctly, widget renders |

#### TikTok

| # | URL | Content type | Expected result |
|---|---|---|---|
| TK1 | `https://www.tiktok.com/@therock/video/7023733246888706309` | Standard video | `🎵` badge; TikTok embed renders |
| TK2 | `https://www.tiktok.com/@nasa/video/7195266014028671275` | Second video | Same behaviour |
| TK3 | oEmbed metadata | Any TikTok video | Title ≤ 80 chars; `author_name` in description; thumbnail loaded |

#### Instagram

| # | URL | Content type | Expected result |
|---|---|---|---|
| IG1 | `https://www.instagram.com/p/C0xLgQIsI9T/` | Photo post | `📷` badge; InstagramEmbed widget renders |
| IG2 | `https://www.instagram.com/reel/C5vHGFVxxx/` | Reel | Source label "Reel"; embed renders |
| IG3 | `https://www.instagram.com/tv/{shortcode}/` | IGTV video | Detected as video; embed renders |
| IG4 | Any post with a caption | Caption extraction | Description field populated via JSON-LD / regex |
| IG5 | Any post where OG image is returned | With thumbnail | Thumbnail shown first; InstagramEmbed only as fallback |

#### Reddit

| # | URL | Content type | Expected result |
|---|---|---|---|
| R1 | `https://www.reddit.com/r/programming/comments/za8d77/` | Text post | `👽` badge; RedditEmbed widget; title and description populated |
| R2 | Any image post | Image post | Thumbnail extracted from `preview.images` |
| R3 | Any video post (v.redd.it) | Video | Embed renders; video plays |
| R4 | `https://redd.it/{id}` | Short URL | Detected via `redd.it` hostname |
| R5 | Any NSFW-flagged post | 18+ content | **Blocked** — `alert()` shown; item NOT saved |

#### Facebook

| # | URL | Content type | Expected result |
|---|---|---|---|
| F1 | `https://www.facebook.com/{page}/posts/{id}` | Standard post | `📘` badge; post plugin iframe renders |
| F2 | `https://www.facebook.com/watch/?v={id}` | Watch video | Video iframe; correct plugin URL built |
| F3 | `https://www.facebook.com/{page}/videos/{id}` | Video | Video iframe, not post iframe |
| F4 | `https://www.facebook.com/reel/{id}` | Reel | Detected as "Reel" |
| F5 | `https://fb.watch/{id}` | Short link | Redirect resolved; canonical URL saved |
| F6 | `/share/v/`, `/share/r/`, `/share/p/` | Video / Reel / Photo | Redirect resolved; correct content type |
| F7 | Any private/broken post | Empty iframe | Auto-fallback to static card after 3 s height check |
| F8 | `facebook.com/groups/*/permalink/*` | Group permalink | Skips iframe; shows static card immediately |

#### Threads

| # | URL | Content type | Expected result |
|---|---|---|---|
| TH1 | `https://www.threads.net/@zuck/post/C2ks7lYRxxx` | Post (no auth) | `🧵` badge; static branded card with thumbnail/title/description |
| TH2 | `https://www.threads.com/@{user}/post/{id}` | threads.com variant | Same — both hostnames detected |
| TH3 | Any post with Threads account connected | Authenticated | oEmbed HTML rendered |
| TH4 | Post that returns login-wall title | Generic title | Stripped — fallback hint shown |

#### YouTube *(promoted to Tier 1)*

| # | URL | Content type | Expected result |
|---|---|---|---|
| YT1 | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | Standard video | `▶️` badge; responsive 16:9 iframe player renders inside card |
| YT2 | `https://youtu.be/dQw4w9WgXcQ` | Short URL | Same ID extracted; same embed |
| YT3 | `https://www.youtube.com/shorts/5MgBikgcWnY` | YouTube Short | `/shorts/` ID extracted; player renders |
| YT4 | `https://www.youtube.com/live/{id}` | Live stream URL | `/live/` ID extracted; player renders |
| YT5 | Autoplay off (Settings → disable autoplay) | Any video | `autoplay=0` passed; player does not autostart |
| YT6 | Invalid / deleted video ID | Broken embed | Falls back to "View on YouTube" plain link |

#### Vimeo *(promoted to Tier 1)*

| # | URL | Content type | Expected result |
|---|---|---|---|
| VM1 | `https://vimeo.com/76979871` | Standard video | `▶️` (Vimeo blue badge); responsive 16:9 iframe player renders |
| VM2 | `https://vimeo.com/channels/staffpicks/{id}` | Channel video | ID extracted from path; player renders |
| VM3 | `https://vimeo.com/{id}/{hash}` | Private-but-embeddable | Hash extracted; `?h={hash}` appended; player renders |
| VM4 | `https://player.vimeo.com/video/{id}` | Embed URL pasted directly | ID extracted; clean embed URL built |
| VM5 | Autoplay off (Settings → disable autoplay) | Any video | `autoplay=0` passed; player silent on load |
| VM6 | Non-embeddable private video | Blocked by Vimeo | Falls back to "View on Vimeo" plain link |

---

### Tier 2 — Link + Metadata Platforms

| # | Platform | URL example | Expected result |
|---|---|---|---|
| M1 | Medium | `https://medium.com/@user/{slug}` | `📝` badge; OG title, description, image via unfurl |
| LI1 | LinkedIn | `https://www.linkedin.com/posts/...` | `💼` badge; title/description if OG tags accessible |
| GH1 | GitHub repo | `https://github.com/facebook/react` | `💻` badge; repo title + description from OG |
| GH2 | GitHub issue/PR | Any issue URL | Title from OG; description snippet |

---

### Tier 3 — Generic Unfurl

| # | Content | URL | Expected result |
|---|---|---|---|
| G1 | News article | BBC, NYT, CNN article URL | OG title, description, thumbnail all populated |
| G2 | Blog post | Any personal blog | `<title>` / meta description fallback |
| G3 | No-OG page | Plain HTML, no meta tags | Title from `<title>` only; no description or image |
| G4 | Direct image URL | `.jpg` / `.png` URL | Image shown as thumbnail; no description |
| G5 | CORS-blocked URL | Any URL rejecting CORS | Falls back: allorigins.win → corsproxy.io → URL heuristic |

---

### Cross-Cutting Checks

| # | Scenario | Expected result |
|---|---|---|
| X1 | Paste any URL into AddItemModal | Unfurl triggers automatically; placeholder title shown immediately |
| X2 | Dark mode (`Settings → Appearance`) | Card chrome switches; embeds (iframes/SDKs) remain unaffected |
| X3 | Source badge on every saved item | Correct emoji + platform colour for all Tier 1 + 2 platforms |
| X4 | List-view layout | All embeds suppressed (CSS `display: none`); small square thumbnail shown instead |
| X5 | Autoplay setting off | YouTube and Vimeo iframes pass `autoplay=0`; TikTok passes `data-autoplay="0"` |
| X6 | Tags on any item type | Hashtags persist and render on card |
| X7 | Swipe-left to archive | Card disappears from main view; `archived: true` set |
| X8 | NSFW block | Reddit NSFW post or URL with `nsfw` in path → `alert()` + item not saved |
| X9 | Share Target | Browser Share → 4Later; URL pre-filled in AddItemModal |
| X10 | Edit & delete | Edit title/description/tags; delete via card action button |

---

## Automated Testing (Future)

Consider adding:
- Unit tests with Vitest
- Component tests with React Testing Library
- E2E tests with Playwright
- Visual regression tests


## Test Checklist

Before deploying:
- [ ] All authentication flows work
- [ ] CRUD operations for lists and items
- [ ] Swipe gestures function properly
- [ ] Web Share Target receives data
- [ ] Responsive on all screen sizes
- [ ] Data persists across refreshes
- [ ] No console errors
- [ ] Performance metrics acceptable
- [ ] Accessible (keyboard navigation works)
- [ ] Works on Chrome, Firefox, Safari

### Social Media Embed Checklist

**Tier 1 — Full embed:**
- [ ] Twitter/X — widget renders for `x.com` and `twitter.com` status URLs
- [ ] TikTok — embed renders for `/@user/video/{id}` URLs
- [ ] Instagram — embed renders for `/p/`, `/reel/`, `/tv/` URLs
- [ ] Reddit — widget renders; NSFW posts are blocked
- [ ] Facebook — post/video/reel iframe renders; fallback to static card works
- [ ] Threads — static card (unauthenticated) and oEmbed (authenticated) work
- [ ] YouTube — responsive 16:9 iframe renders for `watch?v=`, `youtu.be/`, `/shorts/`, `/live/` URLs
- [ ] Vimeo — responsive 16:9 iframe renders; private video hash passed correctly

**Tier 2 — Link + metadata:**
- [ ] Medium — `📝` badge; OG metadata fetched
- [ ] LinkedIn — `💼` badge; metadata fetched where accessible
- [ ] GitHub — `💻` badge; repo/issue title from OG

**Cross-cutting:**
- [ ] All embeds suppressed in list-view layout
- [ ] Autoplay setting respected by YouTube, Vimeo, and TikTok
- [ ] NSFW block triggers alert and prevents save
- [ ] Source badge correct for all platforms

