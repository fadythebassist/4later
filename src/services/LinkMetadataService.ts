/**
 * Service to fetch metadata (title, description, image) from URLs
 * Useful for populating preview cards when sharing links
 */

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

/**
 * Fetch metadata from a URL using Open Graph tags or standard meta tags
 * Falls back to title/description extraction if available
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  try {
    // Try direct fetch first
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'default',
      headers: {
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      return fetchViaCorsproxy(url);
    }

    const html = await response.text();
    return parseHtmlMetadata(html, url);
  } catch (error) {
    // If direct fetch fails due to CORS, try CORS proxy
    console.warn(`Direct fetch failed for ${url}, trying CORS proxy:`, error);
    return fetchViaCorsproxy(url);
  }
}

/**
 * Try fetching via CORS proxy services
 */
async function fetchViaCorsproxy(url: string): Promise<LinkMetadata> {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'default'
      });

      if (response.ok) {
        const html = await response.text();
        const metadata = parseHtmlMetadata(html, url);
        if (metadata.title || metadata.description || metadata.image) {
          return metadata;
        }
      }
    } catch (error) {
      console.warn(`CORS proxy ${proxyUrl} failed:`, error);
      continue;
    }
  }

  // All proxy attempts failed, extract from URL
  return extractMetadataFromUrl(url);
}

/**
 * Parse HTML and extract Open Graph, Twitter Card, and standard meta tags
 */
function parseHtmlMetadata(html: string, url: string): LinkMetadata {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const metadata: LinkMetadata = {};

  // Open Graph tags (highest priority)
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle?.getAttribute('content')) {
    metadata.title = ogTitle.getAttribute('content') || undefined;
  }

  const ogDescription = doc.querySelector('meta[property="og:description"]');
  if (ogDescription?.getAttribute('content')) {
    metadata.description = ogDescription.getAttribute('content') || undefined;
  }

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage?.getAttribute('content')) {
    metadata.image = ogImage.getAttribute('content') || undefined;
  }

  // Fallback to Twitter Card tags
  if (!metadata.title) {
    const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
    if (twitterTitle?.getAttribute('content')) {
      metadata.title = twitterTitle.getAttribute('content') || undefined;
    }
  }

  if (!metadata.description) {
    const twitterDescription = doc.querySelector('meta[name="twitter:description"]');
    if (twitterDescription?.getAttribute('content')) {
      metadata.description = twitterDescription.getAttribute('content') || undefined;
    }
  }

  if (!metadata.image) {
    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (twitterImage?.getAttribute('content')) {
      metadata.image = twitterImage.getAttribute('content') || undefined;
    }
  }

  // Fallback to standard meta tags
  if (!metadata.title) {
    const title = doc.querySelector('title');
    if (title?.textContent) {
      metadata.title = title.textContent;
    }
  }

  if (!metadata.description) {
    const description = doc.querySelector('meta[name="description"]');
    if (description?.getAttribute('content')) {
      metadata.description = description.getAttribute('content') || undefined;
    }
  }

  if (!metadata.image) {
    // Try to find first image in page
    const img = doc.querySelector('img');
    if (img?.src) {
      metadata.image = resolveUrl(img.src, url);
    }
  }

  // Resolve relative URLs
  if (metadata.image) {
    metadata.image = resolveUrl(metadata.image, url);
  }

  // Try to get favicon
  const favicon = doc.querySelector('link[rel="icon"]') || doc.querySelector('link[rel="shortcut icon"]');
  if (favicon?.getAttribute('href')) {
    metadata.favicon = resolveUrl(favicon.getAttribute('href') || '', url);
  }

  return metadata;
}

/**
 * Extract basic metadata from URL when full HTML parsing fails
 */
function extractMetadataFromUrl(url: string): LinkMetadata {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname.toLowerCase();

    let title = '';
    let description = '';

    // Facebook-specific parsing
    if (domain.includes('facebook.com')) {
      if (path.includes('/video') || path.includes('/videos')) {
        title = 'Facebook Video';
        description = 'Watch video on Facebook';
      } else if (path.includes('/reel')) {
        title = 'Facebook Reel';
        description = 'Watch reel on Facebook';
      } else if (path.includes('/photo') || path.includes('/photos')) {
        title = 'Facebook Photo';
        description = 'View photo on Facebook';
      } else if (path.includes('/watch')) {
        title = 'Facebook Watch';
        description = 'Watch content on Facebook';
      } else if (path.includes('fb.watch')) {
        title = 'Facebook Video';
        description = 'Watch video on Facebook';
      } else {
        title = 'Facebook Post';
        description = 'View post on Facebook';
      }

      // Try to extract user/page name from URL
      const pathParts = path.split('/').filter(p => p);
      if (pathParts.length > 0 && !pathParts[0].includes('?')) {
        const username = pathParts[0];
        if (!['watch', 'photo', 'video', 'photos', 'videos', 'permalink.php', 'share'].includes(username)) {
          description = `Posted by @${username}`;
        }
      }

      return {
        title,
        description,
        favicon: 'https://www.facebook.com/favicon.ico'
      };
    }

    // Instagram-specific parsing
    if (domain.includes('instagram.com')) {
      const pathParts = path.split('/').filter(p => p);
      if (pathParts.length >= 1) {
        const type = pathParts[0];
        if (type === 'p') {
          title = 'Instagram Photo';
          description = 'View photo on Instagram';
        } else if (type === 'reel') {
          title = 'Instagram Reel';
          description = 'Watch reel on Instagram';
        } else if (type === 'tv') {
          title = 'Instagram Video';
          description = 'Watch video on Instagram';
        } else {
          title = 'Instagram Post';
          description = `Posted by @${type}`;
        }
      } else {
        title = 'Instagram Post';
        description = 'View on Instagram';
      }

      return {
        title,
        description,
        favicon: 'https://www.instagram.com/favicon.ico'
      };
    }

    // Generic fallback for other domains
    const cleanDomain = domain.charAt(0).toUpperCase() + domain.slice(1);
    if (path.includes('video') || path.includes('watch') || path.includes('reel')) {
      title = `${cleanDomain} Video`;
    } else if (path.includes('photo') || path.includes('image')) {
      title = `${cleanDomain} Photo`;
    } else {
      title = `${cleanDomain} Post`;
    }

    return {
      title,
      description: `Shared from ${domain}`,
      favicon: `https://${urlObj.hostname}/favicon.ico`
    };
  } catch {
    return {
      title: 'Shared Link',
      description: 'Open to view content'
    };
  }
}

/**
 * Resolve relative URLs to absolute URLs
 */
function resolveUrl(relativeUrl: string, baseUrl: string): string {
  try {
    // If it's already an absolute URL, return as is
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }

    // If it's protocol-relative, add https
    if (relativeUrl.startsWith('//')) {
      return `https:${relativeUrl}`;
    }

    // Resolve relative to base URL
    const baseUrlObj = new URL(baseUrl);
    return new URL(relativeUrl, baseUrlObj.origin + baseUrlObj.pathname).toString();
  } catch {
    return relativeUrl;
  }
}

/**
 * Cache for recently fetched metadata to avoid repeated requests
 */
const metadataCache = new Map<string, { data: LinkMetadata; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Fetch metadata with caching
 */
export async function fetchLinkMetadataWithCache(url: string): Promise<LinkMetadata> {
  const cached = metadataCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const metadata = await fetchLinkMetadata(url);
  metadataCache.set(url, { data: metadata, timestamp: Date.now() });
  return metadata;
}
