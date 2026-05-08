/**
 * openPlatformUrl
 *
 * Opens a social media URL in the platform's native app when running inside
 * the Capacitor Android WebView, falling back to the system browser otherwise.
 *
 * Strategy (Android):
 *   Build an Android intent URI and pass it to window.open().
 *   Capacitor's WebView forwards window.open() with non-http(s) schemes to the
 *   Android intent system, which routes it to the installed app.
 *   The intent URI includes a browser_fallback_url so that if the app is not
 *   installed, Android opens the https:// URL in the browser instead.
 *
 * Native-scheme URLs (fb://, instagram://, etc.):
 *   Some URLs stored in the DB may already be native app deep links.
 *   We pass them directly to window.open() — Capacitor forwards them to Android,
 *   which resolves them to the correct app. In a browser context they will fail,
 *   but that is acceptable since native schemes are only ever encountered on device.
 *
 * Android intent URI format:
 *   intent://<host><path>#Intent;scheme=https;package=<pkg>;
 *            S.browser_fallback_url=<encoded-https-url>;end
 */

/** Returns true when running on Android (native app or browser on device). */
function isAndroid(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /android/i.test(navigator.userAgent)
  );
}

/** Known native URL schemes that should be forwarded directly to window.open. */
const NATIVE_SCHEMES = ["fb:", "instagram:", "tiktok:", "reddit:", "twitter:", "x:"];

interface PlatformConfig {
  /** Android package name used in the intent URI. */
  androidPackage: string;
  /** Returns true if this config handles the given parsed URL. */
  matches: (parsed: URL) => boolean;
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    androidPackage: "com.instagram.android",
    matches: (p) => p.hostname.includes("instagram.com"),
  },
  {
    androidPackage: "com.facebook.katana",
    matches: (p) =>
      p.hostname.includes("facebook.com") || p.hostname.includes("fb.watch"),
  },
  {
    androidPackage: "com.zhiliaoapp.musically",
    matches: (p) => p.hostname.includes("tiktok.com"),
  },
  {
    androidPackage: "com.reddit.frontpage",
    matches: (p) =>
      p.hostname.includes("reddit.com") || p.hostname.includes("redd.it"),
  },
  {
    androidPackage: "com.twitter.android",
    matches: (p) =>
      p.hostname.includes("twitter.com") || p.hostname.includes("x.com"),
  },
  {
    androidPackage: "com.instagram.barcelona",
    matches: (p) => p.hostname.includes("threads.net"),
  },
  {
    androidPackage: "com.google.android.youtube",
    matches: (p) =>
      p.hostname.includes("youtube.com") || p.hostname.includes("youtu.be"),
  },
];

/**
 * Build an Android intent URI for a known platform https:// URL.
 * Returns null if the URL does not match any known platform.
 *
 * Format: intent://<host><path><search>#Intent;scheme=https;package=<pkg>;
 *                  S.browser_fallback_url=<encoded>;end
 */
function buildAndroidIntentUri(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Only handle https:// URLs here — native schemes are handled separately.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  for (const config of PLATFORM_CONFIGS) {
    if (!config.matches(parsed)) continue;

    const host = parsed.hostname;
    const path = parsed.pathname + parsed.search;
    const fallback = encodeURIComponent(url);

    return (
      `intent://${host}${path}` +
      `#Intent;scheme=https` +
      `;package=${config.androidPackage}` +
      `;S.browser_fallback_url=${fallback}` +
      `;end`
    );
  }

  return null;
}

/**
 * Open a social media post URL in the platform's native app.
 *
 * - On Android: uses an intent URI via window.open so Android routes it to
 *   the installed app (Capacitor forwards window.open to the intent system).
 * - On iOS / desktop browser: falls back to window.open with the https:// URL.
 */
export function openPlatformUrl(url: string): void {
  if (!url) return;

  // If already a native scheme (fb://, instagram://, etc.), open directly.
  // Capacitor's WebView will forward this to Android's intent system.
  const isNativeScheme = NATIVE_SCHEMES.some((s) => url.startsWith(s));
  if (isNativeScheme) {
    window.open(url, "_system");
    return;
  }

  // On Android, build an intent URI so the OS can route to the native app.
  if (isAndroid()) {
    const intentUri = buildAndroidIntentUri(url);
    if (intentUri) {
      window.open(intentUri, "_system");
      return;
    }
  }

  // Default: open in a new browser tab.
  window.open(url, "_blank", "noopener,noreferrer");
}
