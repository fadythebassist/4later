import React, { useMemo } from "react";

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

export interface FacebookPostEmbedProps {
  url: string;
}

const FacebookPostEmbed: React.FC<FacebookPostEmbedProps> = ({ url }) => {
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  const src = useMemo(() => {
    if (!normalizedUrl) return null;
    const href = encodeURIComponent(normalizedUrl);
    // Facebook official embed plugin for posts/photos.
    return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`;
  }, [normalizedUrl]);

  if (!src || !normalizedUrl) return null;

  return (
    <div className="facebook-post-embed" onClick={(e) => e.stopPropagation()}>
      <div className="facebook-post-embed-frame">
        <iframe
          src={src}
          title="Facebook Post"
          scrolling="no"
          allow="encrypted-media; picture-in-picture; web-share"
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

export default FacebookPostEmbed;
