import React, { useCallback, useEffect, useMemo, useState } from "react";
import { isAndroidWebView } from "@/utils/apiBase";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import "./SocialCard.css";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractYouTubeVideoId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes("youtu.be")) {
      const id = url.pathname.slice(1).split("/")[0];
      return id || null;
    }

    if (hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;

      const match = url.pathname.match(/\/(?:shorts|live|embed)\/([^/?&#]+)/);
      if (match?.[1]) return match[1];
    }

    return null;
  } catch {
    const match = urlStr.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/))([^/?&#]+)/,
    );
    return match?.[1] ?? null;
  }
}

const YouTubeLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="22"
    height="16"
    viewBox="0 0 24 17"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M23.498 2.186A3.016 3.016 0 0 0 21.38.068C19.505-.39 12-.39 12-.39s-7.505 0-9.38.458A3.016 3.016 0 0 0 .502 2.186C.044 4.061.044 8.5.044 8.5s0 4.439.458 6.314a3.016 3.016 0 0 0 2.118 2.118C4.495 17.39 12 17.39 12 17.39s7.505 0 9.38-.458a3.016 3.016 0 0 0 2.118-2.118C23.956 12.939 23.956 8.5 23.956 8.5s0-4.439-.458-6.314zM9.545 12.189V4.811L15.818 8.5 9.545 12.189z" />
  </svg>
);

export interface YouTubeEmbedProps {
  url: string;
  autoplay?: boolean;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  url,
  autoplay = false,
  thumbnail,
  title,
  description,
}) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractYouTubeVideoId(url), [url]);
  const [failed, setFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const useAndroidFallback = isAndroidWebView();
  const playerOrigin = useMemo(() => window.location.origin, []);

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      autoplay: autoplay ? "1" : "0",
      mute: autoplay ? "1" : "0",
      playsinline: "1",
      enablejsapi: "1",
      origin: playerOrigin,
    });
    // Use YouTube's official privacy-enhanced embed domain in both browser and
    // app WebView. If playback fails, fall back to the thumbnail/open action.
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  }, [videoId, autoplay, playerOrigin]);

  useEffect(() => {
    setFailed(false);
    setThumbnailFailed(false);
  }, [url]);

  const handleClick = useCallback(() => {
    const target = normalizedUrl ?? url;
    if (target) {
      openPlatformUrl(target);
    }
  }, [normalizedUrl, url]);

  const handleThumbnailClick = useCallback(() => {
    handleClick();
  }, [handleClick]);

  const effectiveUrl = normalizedUrl ?? url;
  if (!effectiveUrl) return null;

  const ytThumbnail = thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined);

  const isGenericTitle = !title || title.length < 5;
  const isGenericDesc = !description || description.length < 10;
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  return (
    <div className="social-card social-card--youtube" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <YouTubeLogo />
        <span className="social-card-header-text">YouTube</span>
      </div>

      {embedUrl && !failed && !useAndroidFallback ? (
        /* Embed iframe */
        <>
          <div className="social-card-embed-wrap social-card-embed-16x9">
            <iframe
              src={embedUrl}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              onError={() => {
                setFailed(true);
              }}
            />
          </div>
        </>
      ) : ytThumbnail && !thumbnailFailed ? (
        <div
          className="social-card-thumbnail"
          onClick={(e) => { e.stopPropagation(); handleThumbnailClick(); }}
          style={{ cursor: "pointer" }}
        >
          <img
            src={ytThumbnail}
            alt={displayTitle || "YouTube video"}
            onError={() => setThumbnailFailed(true)}
            loading="lazy"
          />
          {useAndroidFallback && (
            <div className="social-card-play-overlay">▶</div>
          )}
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
              <div className="social-card-icon">▶️</div>
              <p className="social-card-cta">Tap to view on YouTube</p>
            </>
          )}
        </div>
      )}

      {embedUrl && !failed && !useAndroidFallback && (displayTitle || displayDesc) && (
        <div className="social-card-text">
          {displayTitle && <div className="social-card-title">{displayTitle}</div>}
          {displayDesc && <div className="social-card-description">{displayDesc}</div>}
        </div>
      )}

      <a
        href={effectiveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(); }}
      >
        Open in YouTube
      </a>
    </div>
  );
};

export default YouTubeEmbed;
