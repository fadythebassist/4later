import { Capacitor } from "@capacitor/core";

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    platform?: string;
  };
  androidBridge?: unknown;
}

/**
 * Base URL for all /api/* calls.
 *
 * Both the browser (PWA) and the native Android app use relative paths here.
 *
 * For the PWA: the app is served from https://4stash.com, so relative /api/*
 * paths hit Firebase Hosting which rewrites them to the Cloud Functions.
 *
 * For Android: capacitor.config.ts sets server.url = "https://4stash.com",
 * which makes the Capacitor WebView load from Firebase Hosting directly.
 * The WebView origin is therefore https://4stash.com, so relative /api/*
 * paths also reach the Cloud Functions — and Instagram/Facebook iframes are
 * no longer blocked by X-Frame-Options (they allow https://4stash.com).
 *
 * VITE_API_BASE_URL should be left empty (or unset) in .env.
 */
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Build an absolute-safe URL for a server API path.
 *
 * @example
 * apiUrl("/api/unfurl?url=" + encodeURIComponent(url))
 * // → "/api/unfurl?url=..." in both browser and Android
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * Returns true when running inside the Capacitor Android WebView.
 *
 * Primary check: Capacitor.isNativePlatform() — reliable regardless of
 * server.url setting, because Capacitor injects its bridge into the WebView
 * before the page loads.
 *
 * Fallback: UA heuristic (Android + "wv" flag) for cases where the Capacitor
 * bridge is not yet available (e.g. very early in page load).
 */
export function isAndroidWebView(): boolean {
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform() === "android";

  const capacitorWindow = window as unknown as CapacitorWindow;
  const nativePlatform = capacitorWindow.Capacitor?.isNativePlatform?.() ?? false;
  const capacitorPlatform =
    capacitorWindow.Capacitor?.getPlatform?.() ?? capacitorWindow.Capacitor?.platform;
  if (nativePlatform && capacitorPlatform === "android") return true;
  if (capacitorWindow.androidBridge) return true;

  const ua = navigator.userAgent;
  return /Android/.test(ua) && (/wv\b/.test(ua) || /FourstashApp\//.test(ua));
}
