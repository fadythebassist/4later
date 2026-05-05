import React, { useCallback, useMemo, useState } from "react";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import { isGenericInstagramDescription } from "@/utils/instagramMetadata";
import "./SocialCard.css";

// Use Instagram's official iframe embeds for posts/reels. Direct MP4 extraction
// is intentionally avoided because Instagram URLs are private/signed and unstable.
const ENABLE_INLINE_INSTAGRAM_POSTS = true;

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (parsed.hostname.includes("instagram.com")) {
      parsed.protocol = "https:";
      parsed.search = "";
      parsed.hash = "";

      if (parsed.pathname.startsWith("/reels/")) {
        parsed.pathname = parsed.pathname.replace("/reels/", "/reel/");
      }

      if (!parsed.pathname.endsWith("/")) {
        parsed.pathname = `${parsed.pathname}/`;
      }
    }

    return parsed.toString();
  } catch {
    return withProtocol;
  }
}

function getContentType(url: string): string {
  if (/\/reel\//.test(url)) return "Reel";
  if (/\/stories\//.test(url)) return "Story";
  if (/\/tv\//.test(url)) return "IGTV";
  return "Post";
}

function buildIframeEmbedUrl(normalizedUrl: string): string | null {
  try {
    const parsed = new URL(normalizedUrl);
    const match = parsed.pathname.match(/\/(p|reel|tv)\/([^/?#]+)/);
    if (!match) return null;
    return `https://www.instagram.com/${match[1]}/${match[2]}/embed/`;
  } catch {
    return null;
  }
}

const InstagramLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

export interface InstagramEmbedProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  onThumbnailError?: () => void;
}

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({
  url,
  thumbnail,
  title,
  description,
  onThumbnailError,
}) => {
  const [playInline, setPlayInline] = useState(false);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const contentType = useMemo(() => getContentType(url), [url]);
  const iframeEmbedUrl = useMemo(
    () => (normalizedUrl ? buildIframeEmbedUrl(normalizedUrl) : null),
    [normalizedUrl],
  );

  const handleCardClick = useCallback(() => {
    if (normalizedUrl) {
      openPlatformUrl(normalizedUrl);
    }
  }, [normalizedUrl]);

  if (!normalizedUrl) return null;

  const isGenericTitle =
    !title ||
    (title.includes("Instagram") && title.length < 30);

  const isGenericDesc =
    !description ||
    isGenericInstagramDescription(description) ||
    description.includes("likes,") ||
    description.includes("Followers,") ||
    description.length < 10;

  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  const isReel = contentType === "Reel";
  const isPost = contentType === "Post";
  const canViewInline =
    !!iframeEmbedUrl &&
    !iframeFailed &&
    (isReel || (ENABLE_INLINE_INSTAGRAM_POSTS && isPost));
  const inlineButtonLabel = isReel ? "Play Reel Here" : "View Post Here";
  const shouldUsePreviewCard = !!thumbnail && !thumbnailFailed;

  return (
    <div className="social-card social-card--instagram" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <InstagramLogo />
        <span className="social-card-header-text">Instagram {contentType}</span>
      </div>

      {canViewInline && playInline && iframeEmbedUrl ? (
        <>
          <div
            className={`social-card-embed-wrap ${
              isReel ? "social-card-embed-ig-reel" : "social-card-embed-ig-post"
            }`}
          >
            <iframe
              src={iframeEmbedUrl}
              title={`Instagram ${contentType}`}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              scrolling="no"
              onError={() => {
                setIframeFailed(true);
                setPlayInline(false);
              }}
            />
          </div>
          {/* Dismiss + hint row — shown under the iframe so users aren't stuck
              if Instagram's "Watch on Instagram" wall appears inside the embed */}
          <div className="social-card-iframe-controls">
            <button
              type="button"
              className="social-card-iframe-dismiss"
              onClick={(e) => { e.stopPropagation(); setPlayInline(false); }}
            >
              ✕ Close preview
            </button>
            {isReel && (
              <span className="social-card-iframe-hint">
                Not playing? Use the button below to open on Instagram.
              </span>
            )}
          </div>
        </>
      ) : shouldUsePreviewCard ? (
        <div
          className="social-card-thumbnail"
          onClick={(e) => {
            e.stopPropagation();
            if (canViewInline) {
              setPlayInline(true);
            } else {
              handleCardClick();
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <img
            src={thumbnail}
            alt={displayTitle || `Instagram ${contentType}`}
            onError={() => {
              setThumbnailFailed(true);
              onThumbnailError?.();
            }}
            loading="lazy"
          />
          {canViewInline && (
            <button
              type="button"
              className="social-card-inline-play"
              onClick={(e) => {
                e.stopPropagation();
                setPlayInline(true);
              }}
            >
              {inlineButtonLabel}
            </button>
          )}
        </div>
      ) : (
        /* No thumbnail */
        <div
          className="social-card-body"
          onClick={(e) => {
            e.stopPropagation();
            if (canViewInline) {
              setPlayInline(true);
            } else {
              handleCardClick();
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {(displayTitle || displayDesc) ? (
            <>
              {displayTitle && <div className="social-card-title">{displayTitle}</div>}
              {displayDesc && <div className="social-card-description">{displayDesc}</div>}
            </>
          ) : (
            <>
              <div className="social-card-icon">📷</div>
          <p className="social-card-cta">
                {canViewInline
                  ? "Tap to view inside 4Stash"
                  : "Tap to view on Instagram"}
              </p>
            </>
          )}
          {canViewInline && (
            <button
              type="button"
              className="social-card-inline-play"
              style={{ position: "static", transform: "none", marginTop: "12px" }}
              onClick={(e) => {
                e.stopPropagation();
                setPlayInline(true);
              }}
            >
              {inlineButtonLabel}
            </button>
          )}
        </div>
      )}

      {shouldUsePreviewCard && (displayTitle || displayDesc) && (
        <div className="social-card-text">
          {displayTitle && <div className="social-card-title">{displayTitle}</div>}
          {displayDesc && <div className="social-card-description">{displayDesc}</div>}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); openPlatformUrl(normalizedUrl); }}
      >
        Open in Instagram
      </a>
    </div>
  );
};

export default InstagramEmbed;
