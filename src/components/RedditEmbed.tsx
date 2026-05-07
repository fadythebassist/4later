import React, { useCallback, useMemo, useState } from "react";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import "./SocialCard.css";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  const full = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(full);
    const TRACKING_PARAMS = [
      "utm_source", "utm_medium", "utm_name", "utm_term", "utm_content",
      "utm_campaign", "ref", "ref_source", "context", "share_id", "sh",
    ];
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return full;
  }
}

/**
 * Build a direct Reddit embed iframe URL from a post URL.
 * Format: https://embed.reddit.com + post path + query params
 * Reddit's embed endpoint supports inline video playback for v.redd.it videos.
 */
function buildRedditEmbedUrl(normalizedUrl: string): string | null {
  try {
    const u = new URL(normalizedUrl);
    if (!u.hostname.includes("reddit.com") && !u.hostname.includes("redd.it")) return null;
    // Must be a /comments/ URL to embed
    if (!u.pathname.includes("/comments/")) return null;
    // Build embed URL: use embed.reddit.com with the same path
    const embedUrl = new URL(`https://embed.reddit.com${u.pathname}`);
    embedUrl.searchParams.set("ref_source", "embed");
    embedUrl.searchParams.set("ref", "share");
    // Use the canonical production domain as embed host so Reddit accepts the
    // iframe regardless of whether the app is running as a PWA or via Capacitor.
    const embedHost = window.location.origin.startsWith('https://') ? window.location.origin : 'https://4stash.com';
    embedUrl.searchParams.set("embed_host_url", embedHost);
    embedUrl.searchParams.set("showmedia", "true");
    embedUrl.searchParams.set("showmore", "false");
    embedUrl.searchParams.set("theme", document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    return embedUrl.toString();
  } catch {
    return null;
  }
}

const RedditLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 0-.463.327.327 0 0 0-.462 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.205-.094z" />
  </svg>
);

export interface RedditEmbedProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const RedditEmbed: React.FC<RedditEmbedProps> = ({ url, thumbnail, title, description }) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const embedUrl = useMemo(
    () => (normalizedUrl ? buildRedditEmbedUrl(normalizedUrl) : null),
    [normalizedUrl],
  );
  const [iframeFailed, setIframeFailed] = useState(false);
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

  return (
    <div className="social-card social-card--reddit" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <RedditLogo />
        <span className="social-card-header-text">Reddit</span>
      </div>

      {embedUrl && !iframeFailed ? (
        /* Direct iframe embed — supports inline video playback */
        <div className="social-card-embed-wrap social-card-embed-reddit">
          <iframe
            src={embedUrl}
            title="Reddit post"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            allow="autoplay; clipboard-write; encrypted-media"
            loading="lazy"
            scrolling="yes"
            onError={() => setIframeFailed(true)}
            style={{ border: 0 }}
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
            alt={displayTitle || "Reddit post"}
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
              <div className="social-card-icon">🤖</div>
              <p className="social-card-cta">Tap to view on Reddit</p>
            </>
          )}
        </div>
      )}

      {iframeFailed && thumbnail && !thumbnailFailed && (displayTitle || displayDesc) && (
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
        Open in Reddit
      </a>
    </div>
  );
};

export default RedditEmbed;
