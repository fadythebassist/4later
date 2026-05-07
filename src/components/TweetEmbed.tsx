import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openPlatformUrl } from "@/utils/openPlatformUrl";
import "./SocialCard.css";

const TWITTER_WIDGETS_SRC = "https://platform.twitter.com/widgets.js";

let twitterWidgetsPromise: Promise<void> | null = null;

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractTweetId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const match = url.pathname.match(/\/status\/(\d+)/);
    if (match?.[1]) return match[1];
    return null;
  } catch {
    const match = urlStr.match(/\/status\/(\d+)/);
    return match?.[1] ?? null;
  }
}

function loadTwitterWidgets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const win = window as unknown as {
    twttr?: { widgets?: { load?: () => void } };
  };
  if (win.twttr?.widgets) return Promise.resolve();

  if (twitterWidgetsPromise) return twitterWidgetsPromise;

  twitterWidgetsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TWITTER_WIDGETS_SRC}"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Twitter widgets")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = TWITTER_WIDGETS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Twitter widgets"));
    document.head.appendChild(script);
  });

  return twitterWidgetsPromise;
}

const XLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="white"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export interface TweetEmbedProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const TweetEmbed: React.FC<TweetEmbedProps> = ({ url, thumbnail, title, description }) => {
  const embedRef = useRef<HTMLDivElement | null>(null);
  const tweetId = useMemo(() => extractTweetId(url), [url]);
  const [failed, setFailed] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setFailed(false);

      if (!tweetId || !embedRef.current) {
        setFailed(true);
        return;
      }

      embedRef.current.innerHTML = "";

      try {
        await loadTwitterWidgets();
        if (cancelled || !embedRef.current) return;

        const win = window as unknown as {
          twttr?: {
            widgets?: {
              createTweet?: (
                id: string,
                element: HTMLElement,
                options?: Record<string, unknown>,
              ) => Promise<unknown>;
            };
          };
        };

        if (!win.twttr?.widgets?.createTweet) {
          setFailed(true);
          return;
        }

        await win.twttr.widgets.createTweet(tweetId, embedRef.current, {
          dnt: true,
          align: "center",
          conversation: "none",
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [tweetId]);

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
    <div className="social-card social-card--x" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <XLogo />
        <span className="social-card-header-text">X (Twitter)</span>
      </div>

      {!failed ? (
        /* Embed loading or succeeded */
        <div ref={embedRef} className="social-card-embed-wrap" />
      ) : thumbnail && !thumbnailFailed ? (
        /* Embed failed, show thumbnail */
        <div
          className="social-card-thumbnail"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{ cursor: "pointer" }}
        >
          <img
            src={thumbnail}
            alt={displayTitle || "Post on X"}
            onError={() => setThumbnailFailed(true)}
            loading="lazy"
          />
        </div>
      ) : (
        /* No thumbnail */
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
              <div className="social-card-icon">{"\ud835\udd4f"}</div>
              <p className="social-card-cta">Tap to view on X</p>
            </>
          )}
        </div>
      )}

      {failed && thumbnail && !thumbnailFailed && (displayTitle || displayDesc) && (
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
        Open in X
      </a>
    </div>
  );
};

export default TweetEmbed;
