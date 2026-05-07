# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server on port 5173
npm run dev:kill     # Kill process on port 5173 and restart (Windows/PowerShell)
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
npm run lint         # ESLint with zero warnings policy
```

No test runner is configured. The app runs in **Mock Mode** by default (localStorage) — no Firebase credentials needed for development.

## Architecture

**4Later** is a React 18 + TypeScript PWA for saving and organizing multimedia content (tweets, TikToks, Instagram posts, Reddit threads, etc.).

### Service Layer Pattern

The core abstraction is `StorageService` (src/services/StorageService.ts), an interface implemented by:

- **MockStorageService** — uses localStorage with `4stash_` prefix, simulates API delays. Default for development.
- **FirebaseStorageService** — uses Firebase Auth + Cloud Firestore for production.

Switching between them is done by changing the import in `AuthContext.tsx` and `DataContext.tsx`.

### State Management

Two React Contexts provide all global state:

- **AuthContext** (src/contexts/AuthContext.tsx) — user auth state, sign-in/out methods (Google, Facebook, Twitter, email/password), user settings
- **DataContext** (src/contexts/DataContext.tsx) — lists and items CRUD, selection state, data loading

### Routing

React Router v6 with route guards in `App.tsx`:
- `ProtectedRoute` — requires auth, redirects to `/login`
- `PublicRoute` — redirects authenticated users to `/dashboard`
- Routes: `/login`, `/register`, `/dashboard`, `/share-target`, `/recovery`

### Vite Config (vite.config.ts — ~1200 lines)

This file is unusually large because it contains a **custom unfurl plugin** that acts as dev server middleware:

- `GET /api/unfurl?url=<URL>` — extracts metadata (title, description, image) with platform-specific handlers for Instagram, Facebook, Reddit, Threads, YouTube
- `GET /api/proxy-image?url=<URL>` — proxies images to avoid CORS issues
- PWA configuration with Web Share Target support (users can share content from other apps directly to 4Stash)

### Styling

Pure CSS with CSS Variables — no CSS-in-JS. Theme system (light/dark) via `data-theme` attribute on `<html>`. Glassmorphism design with backdrop blur effects. All variables defined in `src/styles/globals.css`.

### Types

All shared TypeScript types live in `src/types/index.ts`: `Item`, `List`, `User`, `AppSettings`, and content type unions.

### Social Media Embeds

Platform-specific embed components in `src/components/` (e.g., `TweetEmbed.tsx`, `InstagramEmbed.tsx`, `TikTokEmbed.tsx`, `RedditEmbed.tsx`, `FacebookEmbed.tsx`, `ThreadsEmbed.tsx`) handle rendering previews using each platform's embed SDK or API.

## Key Conventions

- Path alias: `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts)
- ESLint: `@typescript-eslint/no-explicit-any` and unused vars are warnings, not errors. Underscore-prefixed vars (`_foo`) are allowed as unused.
- TypeScript strict mode is enabled
- Mobile-first design targeting 360-450px width with 44px minimum touch targets
- Environment variables use `VITE_` prefix (see `.env.example` for Firebase and Facebook config)

## Documentation

Detailed guides live in `docs/` covering Firebase setup, social login OAuth configuration, content moderation, and architecture overviews.
