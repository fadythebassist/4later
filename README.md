# 4Stash

<div align="center">
  <h3>🔖 Save and organize multimedia content for later</h3>
  <p>A premium-feel progressive web app for saving, organizing, and managing content from across the web</p>
</div>

---

## ✨ Features

- 🎨 **Premium Dark Theme** - Glassmorphism UI with smooth animations
- 📱 **Mobile-First Design** - Optimized for phone screens with responsive layout
- 🔐 **Secure Authentication** - Google Sign-In and Email/Password support
- 📂 **Organize with Lists** - Create custom lists with icons and colors
- 🎯 **Smart Auto-Tagging** - Automatically detects content type (YouTube, Twitter, TikTok, etc.)
- 📤 **Web Share Target** - Share content directly from other apps
- 👆 **Swipe Gestures** - Swipe left to archive items
- 📳 **Haptic Feedback** - Subtle vibrations for better UX
- 💾 **Offline Ready** - PWA with service worker for offline access
- 🔄 **Mock Mode** - Test without Firebase using local storage

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Firebase account (for production deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/4stash.git
   cd 4stash
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

The app runs in **Mock Mode** by default, storing data in browser's localStorage. No Firebase setup required for development!

## 🧪 Mock Mode vs Production Mode

### Mock Mode (Default)

The app starts with `MockStorageService` that:
- Stores data in browser's `localStorage`
- Simulates Firebase API delays
- Creates demo user on Google Sign-In
- Perfect for development and testing
- No internet connection required

### Production Mode (Firebase)

To switch to Firebase:
1. Follow [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) to create a Firebase project
2. Update Firebase config in `src/services/FirebaseStorageService.ts`
3. Switch service in contexts:
   ```typescript
   // In AuthContext.tsx and DataContext.tsx
   import { firebaseStorageService } from '@/services/FirebaseStorageService';
   const storageService = firebaseStorageService;
   ```

## 📁 Project Structure

```
4stash/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── TopBar.tsx      # Horizontal scrollable list filter
│   │   ├── ContentCard.tsx # Item card with swipe gestures
│   │   ├── FAB.tsx         # Floating action button
│   │   ├── AddItemModal.tsx
│   │   ├── AddListModal.tsx
│   │   └── ItemDetailModal.tsx
│   ├── contexts/            # React contexts
│   │   ├── AuthContext.tsx # Authentication state
│   │   └── DataContext.tsx # Lists and items data
│   ├── pages/               # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx   # Main app interface
│   │   └── ShareTarget.tsx # Web Share Target handler
│   ├── services/            # Business logic
│   │   ├── StorageService.ts        # Interface
│   │   ├── MockStorageService.ts    # Local storage implementation
│   │   └── FirebaseStorageService.ts # Firebase implementation
│   ├── styles/              # Global styles
│   │   └── globals.css
│   ├── types/               # TypeScript definitions
│   │   └── index.ts
│   ├── App.tsx              # Root component with routing
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🎯 Key Features Explained

### Web Share Target API

Share content to 4Stash from any app:

1. Click share button in any app (Chrome, Twitter, etc.)
   2. Select "4Stash"
3. Content automatically opens in add item modal
4. Choose a list and save

Configured in `vite.config.ts` with PWA manifest:
```typescript
share_target: {
  action: '/share-target',
  method: 'POST',
  enctype: 'multipart/form-data',
  params: {
    title: 'title',
    text: 'text',
    url: 'url'
  }
}
```

### Smart Content Detection

Automatically detects content type from URL:
- 🎥 YouTube videos
- 🐦 Twitter/X posts
- 🎵 TikTok videos
- 📷 Instagram posts
- 🖼️ Images
- 📄 Generic links

### Swipe Gestures

- **Swipe left** on any card to archive
- Haptic feedback on successful swipe
- Visual indicator shows archive action

### Glassmorphism UI

Premium design with:
- Semi-transparent backgrounds
- Backdrop blur effects
- Smooth gradient accents
- Subtle shadows and borders

## 🎨 Design System

### Colors

```css
--bg-primary: #0f0f0f       /* Main background */
--bg-secondary: #1a1a1a     /* Card background */
--bg-tertiary: #252525      /* Hover states */

--accent-primary: #6366f1   /* Primary actions */
--accent-secondary: #818cf8 /* Gradients */

--text-primary: #ffffff     /* Main text */
--text-secondary: #a0a0a0   /* Secondary text */
```

### Components

- **Buttons**: Gradient backgrounds with hover effects
- **Cards**: Elevated with smooth transitions
- **TopBar**: Glass effect with snap scrolling
- **Modals**: Slide-in animations

## 📱 Mobile Optimization

- Target width: 360px - 450px
- Touch-friendly tap targets (44px minimum)
- Swipe gestures for common actions
- Fixed navigation elements
- Responsive grid layouts

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Technology Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Backend**: Firebase (Auth + Firestore)
- **PWA**: Vite PWA Plugin
- **Styling**: CSS with CSS Variables

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables (if using Firebase)
4. Deploy

### Netlify

1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variables
5. Deploy

### Firebase Hosting

```bash
npm run build
firebase init hosting
firebase deploy
```

## 🔐 Security

- Firebase security rules restrict data access to authenticated users
- Environment variables for sensitive config
- HTTPS enforced in production
- CSP headers recommended

## 🎯 Roadmap

- [ ] Offline mode with service worker caching
- [ ] Full-text search across items
- [ ] Tags management interface
- [ ] Bulk actions (move, delete, archive)
- [ ] Export data (JSON, CSV)
- [ ] Browser extension for quick saves
- [ ] Desktop PWA install
- [ ] Collaborative lists
- [ ] Rich text notes with markdown

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- Design inspiration from modern content curation apps
- Firebase for excellent backend infrastructure
- Vite for blazing fast development experience

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

<div align="center">
  <p>Built with ❤️ using React + TypeScript + Firebase</p>
</div>
