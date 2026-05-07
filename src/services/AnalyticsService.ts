import { getApp, getApps, initializeApp } from "firebase/app";
import { Analytics, getAnalytics, isSupported, logEvent } from "firebase/analytics";

export type AnalyticsConsent = "granted" | "denied";

const ANALYTICS_CONSENT_KEY = "4stash_analytics_consent";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getStoredAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedConsent = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return storedConsent === "granted" || storedConsent === "denied"
    ? storedConsent
    : null;
}

export function setStoredAnalyticsConsent(consent: AnalyticsConsent): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
}

function getFirebaseApp() {
  if (!hasFirebaseConfig) {
    return null;
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (import.meta.env.VITE_USE_MOCK === "true") {
    return null;
  }

  if (
    typeof window === "undefined" ||
    !firebaseConfig.measurementId ||
    getStoredAnalyticsConsent() !== "granted"
  ) {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => {
        if (!supported) {
          return null;
        }

        return getAnalytics(app);
      })
      .catch((error) => {
        console.error("Failed to initialize Firebase Analytics:", error);
        return null;
      });
  }

  return analyticsPromise;
}

export async function trackPageView(path: string): Promise<void> {
  const analytics = await getFirebaseAnalytics();
  if (!analytics) {
    return;
  }

  logEvent(analytics, "page_view", {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  });
}
