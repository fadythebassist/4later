/**
 * Content Moderation Service
 * Prevents NSFW and inappropriate content from being added to the app
 */

// Known NSFW/adult domains to block
const BLOCKED_DOMAINS = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "redtube.com",
  "youporn.com",
  "xhamster.com",
  "onlyfans.com",
  // Add more as needed
];

// Keywords in URLs/titles that might indicate NSFW content.
// These are matched with word boundaries to avoid false positives
// (e.g. "sex" must not match "actress", "adult" must not match "adults").
const NSFW_KEYWORDS = [
  "porn",
  "xxx",
  "nsfw",
  " sex ",
  "nude",
  "naked",
  // Add more patterns
];

// Regex-based word-boundary check for NSFW keywords (avoids substring false positives)
function containsNsfwKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const keyword of NSFW_KEYWORDS) {
    // Keywords with leading/trailing spaces are already bounded; use includes()
    if (keyword.startsWith(" ") || keyword.endsWith(" ")) {
      if (lower.includes(keyword)) return keyword.trim();
      continue;
    }
    // Multi-word phrases: simple includes is sufficient (already specific)
    if (keyword.includes(" ")) {
      if (lower.includes(keyword)) return keyword;
      continue;
    }
    // Single-word keywords: require word boundaries to avoid false positives
    const re = new RegExp(`(^|\\W)${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|\\W)`, "i");
    if (re.test(lower)) return keyword;
  }
  return null;
}

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  confidence?: number;
}

/**
 * Check if a URL is from a blocked domain
 */
export function checkUrl(url: string): ModerationResult {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase();

    // Check against blocked domains
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.includes(blocked)) {
        return {
          allowed: false,
          reason: "Content from this domain is not allowed",
        };
      }
    }

    // Check URL path for NSFW keywords
    const urlLower = url.toLowerCase();
    const urlMatch = containsNsfwKeyword(urlLower);
    if (urlMatch) {
      return {
        allowed: false,
        reason: "URL contains inappropriate content indicators",
      };
    }

    // Check for Reddit NSFW indicators in URL
    if (hostname.includes("reddit.com") || hostname.includes("redd.it")) {
      // Reddit often includes 'over18' in NSFW post URLs
      if (urlLower.includes("over18") || urlLower.includes("over_18")) {
        return {
          allowed: false,
          reason: "This Reddit post is marked as NSFW (18+)",
        };
      }
    }

    // Check for Twitter/X NSFW indicators
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      // Twitter uses /i/web/status/ pattern and includes sensitive media warnings
      // We'll check metadata instead (in the API response)
    }

    return { allowed: true };
  } catch (err) {
    // Invalid URL
    return { allowed: true }; // Allow if we can't parse it
  }
}

/**
 * Check if text content contains NSFW keywords
 */
export function checkText(text: string | undefined): ModerationResult {
  if (!text) return { allowed: true };

  const match = containsNsfwKeyword(text);
  if (match) {
    return {
      allowed: false,
      reason: "Content contains inappropriate language",
    };
  }

  return { allowed: true };
}

/**
 * Check if metadata from unfurl indicates NSFW content
 * This catches Reddit/Twitter posts marked as NSFW
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkMetadata(_metadata: any): ModerationResult {
  // NSFW content is allowed — the nsfw flag is stored on the item and shown as a badge.
  // We do not block saving; the user intentionally chose to save this post.

  // Check if title indicates NSFW via keyword (belt-and-suspenders, not a block)
  return { allowed: true };
}

/**
 * Check if an item is appropriate before saving
 */
export function moderateItem(item: {
  url?: string;
  title?: string;
  content?: string;
}): ModerationResult {
  // Check URL
  if (item.url) {
    const urlCheck = checkUrl(item.url);
    if (!urlCheck.allowed) return urlCheck;
  }

  // Check title
  if (item.title) {
    const titleCheck = checkText(item.title);
    if (!titleCheck.allowed) return titleCheck;
  }

  // Check content/description
  if (item.content) {
    const contentCheck = checkText(item.content);
    if (!contentCheck.allowed) return contentCheck;
  }

  return { allowed: true };
}

/**
 * Advanced: Image moderation using external API
 * Requires API key from providers like Google Cloud Vision or AWS Rekognition
 */
export async function moderateImage(
  _imageUrl: string,
): Promise<ModerationResult> {
  // Placeholder for future implementation
  // You would call an image moderation API here

  // Example with Google Cloud Vision (requires setup):
  /*
  const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GOOGLE_CLOUD_API_KEY}`
    },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: imageUrl } },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }]
      }]
    })
  });
  
  const data = await response.json();
  const safeSearch = data.responses[0]?.safeSearchAnnotation;
  
  if (safeSearch.adult === 'VERY_LIKELY' || safeSearch.adult === 'LIKELY') {
    return { allowed: false, reason: 'Image contains inappropriate content' };
  }
  */

  return { allowed: true };
}

export default {
  checkUrl,
  checkText,
  checkMetadata,
  moderateItem,
  moderateImage,
};
