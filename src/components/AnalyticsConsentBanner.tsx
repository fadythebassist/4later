import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AnalyticsConsent,
  getStoredAnalyticsConsent,
  setStoredAnalyticsConsent,
  trackPageView,
} from "@/services/AnalyticsService";
import "./AnalyticsConsentBanner.css";

const AnalyticsConsentBanner: React.FC = () => {
  const { user, updateUserSettings } = useAuth();
  const [consent, setConsent] = useState<AnalyticsConsent | null>(() =>
    getStoredAnalyticsConsent(),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedConsent = getStoredAnalyticsConsent();
    const accountConsent = user?.settings?.analyticsConsent ?? null;
    const resolvedConsent = storedConsent ?? accountConsent;

    if (resolvedConsent && storedConsent !== resolvedConsent) {
      setStoredAnalyticsConsent(resolvedConsent);
    }

    setConsent(resolvedConsent);
  }, [user?.settings?.analyticsConsent]);

  const handleConsentChoice = async (nextConsent: AnalyticsConsent) => {
    setStoredAnalyticsConsent(nextConsent);
    setConsent(nextConsent);

    if (nextConsent === "granted") {
      const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      void trackPageView(path);
    }

    if (!user || !updateUserSettings) {
      return;
    }

    setSaving(true);
    try {
      await updateUserSettings({
        ...(user.settings || {}),
        analyticsConsent: nextConsent,
      });
    } catch (error) {
      console.error("Failed to persist analytics consent:", error);
    } finally {
      setSaving(false);
    }
  };

  if (consent !== null) {
    return null;
  }

  return (
    <div className="analytics-consent-banner glass fade-in" role="dialog" aria-live="polite">
      <div className="analytics-consent-copy">
        <p className="analytics-consent-eyebrow">Privacy choice</p>
        <h2>Help improve 4Stash with anonymous analytics?</h2>
        <p>
          We use Google Analytics for page views and feature usage only. We do not
          use it to read the private content you save.
        </p>
      </div>
      <div className="analytics-consent-actions">
        <a href="/privacy" className="analytics-consent-link">
          Read privacy policy
        </a>
        <button
          type="button"
          className="analytics-consent-btn analytics-consent-btn-secondary"
          onClick={() => void handleConsentChoice("denied")}
          disabled={saving}
        >
          No thanks
        </button>
        <button
          type="button"
          className="analytics-consent-btn analytics-consent-btn-primary"
          onClick={() => void handleConsentChoice("granted")}
          disabled={saving}
        >
          Allow analytics
        </button>
      </div>
    </div>
  );
};

export default AnalyticsConsentBanner;
