import React, { useMemo } from "react";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

export interface FacebookVideoEmbedProps {
  url: string;
}

const FacebookVideoEmbed: React.FC<FacebookVideoEmbedProps> = ({ url }) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  const src = useMemo(() => {
    if (!normalizedUrl) return null;
    const href = encodeURIComponent(normalizedUrl);
    // Facebook official embed plugin for videos. Works for fb.watch and many watch/video URLs.
    return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=true&width=500`;
  }, [normalizedUrl]);

  if (!src || !normalizedUrl) return null;

  return (
    <div className="facebook-video-embed" onClick={(e) => e.stopPropagation()}>
      <div className="facebook-video-embed-frame">
        <iframe
          src={src}
          title="Facebook Video"
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="card-link"
        onClick={(e) => e.stopPropagation()}
      >
        View on Facebook
      </a>
    </div>
  );
};

export default FacebookVideoEmbed;
