/**
 * Facebook Preview Card Component
 *
 * Displays a clean, clickable preview card for Facebook content.
 *
 * Why we use a preview card instead of Facebook's embed SDK:
 * 1. CORS Restrictions: Facebook blocks metadata fetching from client-side apps
 * 2. Cookie Requirements: Facebook embeds require third-party cookies (often blocked)
 * 3. Privacy Extensions: Ad blockers and privacy tools often block Facebook SDKs
 * 4. Loading Performance: SDK embeds are slow and unreliable
 * 5. User Experience: A simple preview card is faster and more consistent
 *
 * This approach provides a better, more reliable experience for users.
 */

import React from "react";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import "./FacebookPreviewCard.css";

export interface FacebookPreviewCardProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

const FacebookPreviewCard: React.FC<FacebookPreviewCardProps> = ({
  url,
  title,
  description,
  thumbnail,
}) => {
  const normalizedUrl =
    url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://${url}`;
  const handleOpen = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ("preventDefault" in e) {
      e.preventDefault();
    }
    openPlatformUrl(normalizedUrl);
  };

  // Determine content type from URL for better display
  const getContentType = (): { icon: string; label: string } => {
    const lower = url.toLowerCase();
    if (
      lower.includes("/share/v/") ||
      lower.includes("/video") ||
      lower.includes("fb.watch") ||
      lower.includes("/reel")
    ) {
      return { icon: "🎬", label: "Video" };
    }
    if (lower.includes("/share/r/")) {
      return { icon: "🎞️", label: "Reel" };
    }
    if (lower.includes("/photo") || lower.includes("/share/p/")) {
      return { icon: "🖼️", label: "Photo" };
    }
    return { icon: "📄", label: "Post" };
  };

  const contentType = getContentType();
  const displayTitle =
    title && !title.toLowerCase().includes("facebook")
      ? title
      : `Facebook ${contentType.label}`;

  return (
    <div
      className="facebook-preview-card"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleOpen(e);
        }
      }}
    >
      <div className="facebook-preview-header">
        <span className="facebook-logo">📘</span>
        <span className="facebook-label">Facebook</span>
        <span className="facebook-content-type">
          {contentType.icon} {contentType.label}
        </span>
      </div>

      {thumbnail ? (
        <div className="facebook-preview-image">
          <img src={thumbnail} alt={displayTitle} />
          <div className="facebook-preview-overlay">
            <span className="facebook-play-icon">{contentType.icon}</span>
          </div>
        </div>
      ) : (
        <div className="facebook-preview-placeholder">
          <span className="facebook-placeholder-icon">{contentType.icon}</span>
          <p>Tap to view on Facebook</p>
        </div>
      )}

      <div className="facebook-preview-content">
        {displayTitle && (
          <h4 className="facebook-preview-title">{displayTitle}</h4>
        )}
        {description && (
          <p className="facebook-preview-description">{description}</p>
        )}
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="facebook-preview-button"
          onClick={handleOpen}
        >
          Open in Facebook
        </a>
      </div>
    </div>
  );
};

export default FacebookPreviewCard;
