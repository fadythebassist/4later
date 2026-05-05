# AGENTS.md — Coding Agent Guide for 4Later

## Project Overview

**4Later** is a React 18 + TypeScript PWA for saving and organizing multimedia content (tweets, TikToks, Instagram posts, Reddit threads, etc.). It runs in **Mock Mode** by default (localStorage) — no Firebase credentials needed for development.

---

## Build & Development Commands

```bash
npm run dev          # Start Vite dev server on port 5173
npm run dev:kill     # Kill port 5173 process and restart (Windows/PowerShell only)
npm run build        # tsc (type-check) + vite build (production)
npm run preview      # Preview the production build locally
npm run lint         # ESLint with zero-warnings policy (--max-warnings 0)
```

**No test runner is configured.** There are no Jest, Vitest, or other test files. To verify changes, run `npm run build` (type-checks + bundles) and `npm run lint` (zero warnings enforced).

**Always run both before committing:**
```bash
npm run lint && npm run build
```

---

## Architecture Overview

### Service Layer
`StorageService` (`src/services/StorageService.ts`) is a TypeScript **interface** with two implementations:
- `MockStorageService` — localStorage with `4stash_` key prefix, simulated async delays. **Default for development.**
- `FirebaseStorageService` — Firebase Auth + Cloud Firestore for production.

To switch implementations, change the import in `AuthContext.tsx` and `DataContext.tsx` at the module-level singleton line:
```ts
const storageService: StorageService = mockStorageService; // or firebaseStorageService
```

### State Management
Two React Contexts manage all global state:
- **`AuthContext`** — user auth state, sign-in/out (Google, Facebook, Twitter, email/password), user settings
- **`DataContext`** — lists and items CRUD, selection state, data loading

### Routing (`App.tsx`)
React Router v6 with `ProtectedRoute` (requires auth → `/login`) and `PublicRoute` (redirects authed users → `/dashboard`). Routes: `/login`, `/register`, `/dashboard`, `/share-target`, `/recovery`.

### Vite Config (`vite.config.ts`)
Contains a custom unfurl middleware plugin:
- `GET /api/unfurl?url=<URL>` — extracts metadata (title, description, image) with platform-specific handlers
- `GET /api/proxy-image?url=<URL>` — proxies images to avoid CORS

---

## File Structure

```
src/
├── types/index.ts              # ALL shared types — Item, List, User, DTOs, unions
├── contexts/AuthContext.tsx    # Auth state + social connection management
├── contexts/DataContext.tsx    # Lists/items CRUD + selection state
├── services/                  # StorageService interface + implementations
├── pages/                     # Login, Register, Dashboard, ShareTarget, Recovery
├── components/                # UI components + embed components (Tweet, TikTok, etc.)
└── styles/globals.css         # CSS variables, reset, global base styles
```

All shared types live in `src/types/index.ts`. Never scatter type definitions across component files.

---

## Code Style Guidelines

### TypeScript

- **`strict: true`** is enabled — all strict checks apply (`strictNullChecks`, etc.).
- **`noUnusedLocals` and `noUnusedParameters`: true** — unused variables are compile errors.
- **`noFallthroughCasesInSwitch`: true** — exhaustive switch cases required.
- Prefer explicit interfaces over inline object types for props and context shapes.
- Use `Partial<T>`, `Omit<T, K>`, `Pick<T, K>` for derived types rather than duplicating fields.
- Use `as const` for literal arrays/objects used as types:
  ```ts
  export const DICEBEAR_STYLES = [...] as const;
  export type DiceBearStyle = (typeof DICEBEAR_STYLES)[number]["id"];
  ```
- Use union string types instead of enums:
  ```ts
  type TabType = 'appearance' | 'behavior' | 'privacy' | 'account';
  ```
- Use `unknown` casts for typed globals, not `any`:
  ```ts
  const win = window as unknown as { twttr?: { ... } };
  ```
- `no-explicit-any` is a warning (not error), but zero warnings are allowed in CI — **avoid `any`**.
- Underscore-prefix unused parameters: `_foo`.

### Naming Conventions

| Category | Convention | Example |
|---|---|---|
| Component files | PascalCase `.tsx` | `ContentCard.tsx`, `AddItemModal.tsx` |
| CSS files | Match component name | `ContentCard.css`, `Modal.css` |
| Service files | PascalCase `.ts` | `StorageService.ts`, `MockStorageService.ts` |
| Types / Interfaces | PascalCase | `Item`, `List`, `User`, `ContentCardProps` |
| DTO interfaces | PascalCase + `DTO` suffix | `CreateItemDTO`, `UpdateItemDTO` |
| Constants | SCREAMING_SNAKE_CASE | `DICEBEAR_STYLES`, `BLOCKED_DOMAINS` |
| React components | PascalCase function | `const ContentCard: React.FC<Props> = ...` |
| Custom hooks | camelCase with `use` prefix | `useAuth`, `useData` |
| Event handlers | `handle` prefix | `handleSignOut`, `handleDeleteList` |
| Boolean state | Descriptive present tense | `loading`, `failed`, `isTextExpanded` |

### Import Order

Imports must follow this order (enforced by convention, not a linter plugin):

1. React and React hooks
2. Third-party libraries (`react-router-dom`, `firebase/...`)
3. Internal types (`@/types`)
4. Internal services (`@/services/...`)
5. Internal contexts (`@/contexts/...`)
6. Internal components (`@/components/...`)
7. CSS files (always last)

Use the `@/` path alias for all cross-directory imports. Use relative `./` only for siblings in the same directory.

```ts
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Item } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import ContentCard from "@/components/ContentCard";
import "./Dashboard.css";
```

### Component Structure

Follow this ordering within every component file:

1. Imports
2. Module-level helpers/constants (pure functions, not hooks)
3. Props interface (`interface ComponentNameProps { ... }`)
4. Component as `React.FC<Props>` with destructured props + defaults
5. Context hooks (`useAuth`, `useData`)
6. State declarations (`useState`)
7. Derived values (`useMemo`)
8. Effects (`useEffect`)
9. Event handlers (`async` where needed, prefixed `handle`)
10. Guard early returns (`if (!isOpen) return null`)
11. JSX return
12. `export default ComponentName`

Context hooks use a **named export** with a runtime guard:
```ts
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
```

### Error Handling

Always use `try/catch/finally` for every async operation. The universal error extraction idiom:
```ts
} catch (err) {
  setError(err instanceof Error ? err.message : "Fallback human-readable message");
  throw err; // always re-throw from context methods so callers can handle too
} finally {
  setLoading(false); // always restore loading state
}
```

Guard clauses throw immediately with descriptive messages:
```ts
if (!user) throw new Error("No user logged in");
```

For cancelled async operations in `useEffect`:
```ts
useEffect(() => {
  let cancelled = false;
  const run = async () => {
    try {
      const result = await someAsyncOp();
      if (cancelled) return;
      setData(result);
    } catch {
      if (!cancelled) setFailed(true);
    }
  };
  run();
  return () => { cancelled = true; };
}, [dep]);
```

Empty `catch` blocks are only acceptable when errors are intentionally swallowed with a clear fallback.

### Async / Await

- Always use `async/await` — never `.then()/.catch()` chains.
- Never make `useEffect` itself `async`; use an inner async IIFE instead.
- Use `Promise.all` for parallel async operations:
  ```ts
  const [lists, items] = await Promise.all([getLists(uid), getItems(uid)]);
  ```
- After any data mutation, call `await refreshData()` — no optimistic local updates.
- Use module-level promise singletons for third-party SDK loading to prevent duplicate injection:
  ```ts
  let twitterWidgetsPromise: Promise<void> | null = null;
  ```

### CSS & Styling

- **Pure CSS with CSS custom properties** — no CSS-in-JS, no Tailwind, no styled-components.
- CSS files are co-located with their component and imported directly in the `.tsx` file.
- Use CSS variables from `globals.css` for all colors, spacing, typography, radii, shadows, and transitions. Never hardcode values.
- Class naming: **kebab-case**, BEM-inspired but not strict BEM (`content-card`, `card-thumbnail`, `modal-overlay`).
- Dark mode via `[data-theme="dark"]` attribute on `<html>` — set programmatically, never with `prefers-color-scheme` media queries directly.
- Glassmorphism: apply `glass` class alongside component classes (`<div className="topbar glass">`).
- Mobile-first design: target 360–450px width, 44px minimum touch targets.
- Inline styles are used sparingly — only for positional overrides not suited to class-based CSS.

---

## Key Constraints

- **Zero lint warnings in CI** — `npm run lint` uses `--max-warnings 0`. Fix all warnings before committing.
- **TypeScript type-check must pass** — `npm run build` runs `tsc` first. No `@ts-ignore` without explanation.
- The `@/` path alias maps to `src/` — always use it for non-sibling imports.
- All shared types go in `src/types/index.ts`, not scattered across files.
- `window.confirm` / `alert` are acceptable for simple destructive confirmations — no need for a custom dialog component for these.
- `navigator.vibrate(50)` is intentional for haptic feedback on swipe actions (mobile PWA).
- `console.error` and `console.log` with emoji prefixes are used in service/context layers for debugging — this is intentional and expected.
