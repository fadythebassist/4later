import React, { useCallback, useMemo, useState } from "react";
import "./SocialCard.css";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

const AnghamiLogo: React.FC = () => (
  <svg
    className="social-card-logo"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" fill="white" />
    <path d="M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z" fill="#6B2EFF" />
    <path d="M12 8.75a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Z" fill="white" />
  </svg>
);

export interface AnghamiEmbedProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
}

const AnghamiEmbed: React.FC<AnghamiEmbedProps> = ({
  url,
  thumbnail,
  title,
  description,
}) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const handleClick = useCallback(() => {
    if (normalizedUrl) {
      window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    }
  }, [normalizedUrl]);

  if (!normalizedUrl) return null;

  const isGenericTitle = !title || title.length < 4;
  const isGenericDesc = !description || description.length < 10;
  const displayTitle = !isGenericTitle ? title : undefined;
  const displayDesc = !isGenericDesc ? description : undefined;

  return (
    <div className="social-card social-card--anghami" onClick={(e) => e.stopPropagation()}>
      <div className="social-card-header">
        <AnghamiLogo />
        <span className="social-card-header-text">Anghami</span>
      </div>

      {thumbnail && !thumbnailFailed ? (
        <div
          className="social-card-thumbnail"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          style={{ cursor: "pointer" }}
        >
          <img
            src={thumbnail}
            alt={displayTitle || "Anghami track"}
            onError={() => setThumbnailFailed(true)}
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="social-card-body"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
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
              <div className="social-card-icon">🎶</div>
              <p className="social-card-cta">Tap to open in Anghami</p>
            </>
          )}
        </div>
      )}

      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="social-card-button"
        onClick={(e) => e.stopPropagation()}
      >
        Open in Anghami
      </a>
    </div>
  );
};

export default AnghamiEmbed;
