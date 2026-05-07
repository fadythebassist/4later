import React, { useCallback, useMemo, useState } from "react";
import "./SocialCard.css";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractVimeoVideoId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();

    if (!hostname.includes("vimeo.com")) return null;

    const match = url.pathname.match(/\/(?:video\/)?(\d+)/);
    return match?.[1] ?? null;
  } catch {
    const match = urlStr.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match?.[1] ?? null;
  }
}

function extractVimeoHash(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && /^[a-f0-9]+$/i.test(parts[1])) return parts[1];
    return null;
  } catch {
    return null;
  }
}

const VimeoLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="22"
    height="20"
    viewBox="0 0 24 21"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M23.977 4.87c-.105 2.307-1.718 5.466-4.838 9.478C15.94 18.783 12.952 21 10.5 21c-1.518 0-2.8-1.4-3.849-4.2l-2.1-7.706C3.792 6.294 2.986 4.894 2.12 4.894c-.182 0-.819.383-1.91 1.148L-.001 5.631c1.2-1.055 2.384-2.11 3.546-3.167C5.088 1.148 6.238.52 7.02.458c1.882-.18 3.04 1.107 3.474 3.862.468 2.973.793 4.822.975 5.546.541 2.46 1.138 3.69 1.788 3.69.505 0 1.264-.798 2.276-2.395 1.012-1.597 1.554-2.813 1.625-3.647.144-1.377-.397-2.066-1.625-2.066-.578 0-1.175.132-1.79.396C14.94 2.222 17.37.394 20.36.265c2.214-.096 3.259 1.5 3.617 4.605z" />
  </svg>
);

export interface VimeoEmbedProps {
  url: string;
  autoplay?: boolean;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const VimeoEmbed: React.FC<VimeoEmbedProps> = ({
  url,
  autoplay = false,
  thumbnail,
  title,
  description,
}) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const videoId = useMemo(() => extractVimeoVideoId(url), [url]);
  const videoHash = useMemo(() => extractVimeoHash(url), [url]);
  const [failed, setFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      muted: autoplay ? "1" : "0",
      byline: "0",
      portrait: "0",
      title: "0",
      dnt: "1",
    });
    if (videoHash) params.set("h", videoHash);
    return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
  }, [videoId, videoHash, autoplay]);

  const handleClick = useCallback(() => {
    const target = normalizedUrl ?? url;
    if (target) {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  }, [normalizedUrl, url]);

  const effectiveUrl = normalizedUrl ?? url;
  if (!effectiveUrl) return null;

  const isGenericTitle = !title || title.length < 5;
  const isGenericDesc = !description || description.length < 10;
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  return (
    <div className="social-card social-card--vimeo" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <VimeoLogo />
        <span className="social-card-header-text">Vimeo</span>
      </div>

      {embedUrl && !failed ? (
        <div className="social-card-embed-wrap social-card-embed-16x9">
          <iframe
            src={embedUrl}
            title="Vimeo video"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            onError={() => setFailed(true)}
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
            alt={displayTitle || "Vimeo video"}
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
              <div className="social-card-icon">🎬</div>
              <p className="social-card-cta">Tap to view on Vimeo</p>
            </>
          )}
        </div>
      )}

      {(embedUrl && !failed) && (displayTitle || displayDesc) && (
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
        onClick={(e) => e.stopPropagation()}
      >
        Open in Vimeo
      </a>
    </div>
  );
};

export default VimeoEmbed;
