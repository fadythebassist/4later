import React, { useCallback, useMemo, useState } from "react";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import "./SocialCard.css";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractTikTokVideoId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match?.[1]) return match[1];
    return null;
  } catch {
    const match = urlStr.match(/\/video\/(\d+)/);
    return match?.[1] ?? null;
  }
}

const TikTokLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="18"
    height="20"
    viewBox="0 0 18 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9.37 0h3.24c.17 1.86.94 3.24 2.12 4.16A5.84 5.84 0 0 0 18 5.26v3.38a9.2 9.2 0 0 1-5.24-1.68v7.46A6.58 6.58 0 0 1 6.18 21 6.58 6.58 0 0 1 0 14.58a6.58 6.58 0 0 1 6.94-6.52v3.44a3.24 3.24 0 0 0-3.58 3.14 3.24 3.24 0 0 0 3.28 3.22A3.26 3.26 0 0 0 9.9 14.7l.02-14.7h-.55z"
      fill="white"
    />
  </svg>
);

export interface TikTokEmbedProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ url, thumbnail, title, description }) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractTikTokVideoId(url), [url]);
  const embedSrc = useMemo(
    () => (videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null),
    [videoId],
  );
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const handleClick = useCallback(() => {
    if (normalizedUrl) {
      openPlatformUrl(normalizedUrl);
    }
  }, [normalizedUrl]);

  if (!normalizedUrl) return null;

  const isGenericTitle = !title || title.length < 5;
  const isGenericDesc = !description || description.length < 10;
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  // No video ID — show card-only fallback
  if (!videoId) {
    return (
      <div className="social-card social-card--tiktok" onClick={(e) => e.stopPropagation()}>
        <div className="social-card-header">
          <TikTokLogo />
          <span className="social-card-header-text">TikTok</span>
        </div>
        {thumbnail && !thumbnailFailed ? (
          <div
            className="social-card-thumbnail"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            style={{ cursor: "pointer" }}
          >
            <img
              src={thumbnail}
              alt={displayTitle || "TikTok video"}
              onError={() => setThumbnailFailed(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="social-card-body"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            style={{ cursor: "pointer" }}
          >
            <div className="social-card-icon">🎵</div>
            <p className="social-card-cta">Tap to view on TikTok</p>
          </div>
        )}
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="social-card-button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); openPlatformUrl(normalizedUrl); }}
        >
          Open in TikTok
        </a>
      </div>
    );
  }

  // Has video ID — always wrap embed with branded header + button
  return (
    <div className="social-card social-card--tiktok" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <TikTokLogo />
        <span className="social-card-header-text">TikTok</span>
      </div>

      {embedSrc ? (
        <div className="social-card-embed-wrap social-card-embed-tiktok">
          <iframe
            src={embedSrc}
            title={displayTitle || "TikTok embed"}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : thumbnail && !thumbnailFailed ? (
        <div
          className="social-card-thumbnail"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{ cursor: "pointer" }}
        >
          <img
            src={thumbnail}
            alt={displayTitle || "TikTok video"}
            onError={() => setThumbnailFailed(true)}
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="social-card-body"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{ cursor: "pointer" }}
        >
          {(displayTitle || displayDesc) ? (
            <>
              {displayTitle && <div className="social-card-title">{displayTitle}</div>}
              {displayDesc && <div className="social-card-description">{displayDesc}</div>}
            </>
          ) : (
            <>
              <div className="social-card-icon">🎵</div>
              <p className="social-card-cta">Tap to view on TikTok</p>
            </>
          )}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); openPlatformUrl(normalizedUrl); }}
      >
        Open in TikTok
      </a>
    </div>
  );
};

export default TikTokEmbed;
