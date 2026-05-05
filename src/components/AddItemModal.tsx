import React, { useState, useEffect, useRef, useMemo } from "react";
import { useData } from "@/contexts/DataContext";
import { fetchLinkMetadata } from "@/services/LinkMetadataService";
import { moderateItem, checkMetadata } from "@/services/ModerationService";
import { getGeminiSuggestions } from "@/services/GeminiService";
import { apiUrl } from "@/utils/apiBase";
import { cleanInstagramDescription } from "@/utils/instagramMetadata";
import TweetEmbed from "./TweetEmbed";
import "./Modal.css";

interface AddItemModalProps {
  onClose: () => void;
  onAddList?: () => void;
  initialUrl?: string;
  initialTitle?: string;
  initialContent?: string;
}

// Decode HTML entities (e.g., &#x627; → Arabic characters)
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

const FacebookLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="white" width="18" height="18" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

// Ensure a thumbnail URL returned by the Cloud Function is absolute.
// The server returns relative paths like /api/proxy-image?url=... which work on
// the web (same origin) but break inside the Capacitor WebView (capacitor://localhost).
function absolutizeThumbnail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Already a proxy path — just absolutize it
  if (raw.startsWith("/api/")) return apiUrl(raw);
  // Already proxied
  if (raw.includes("/api/proxy-image?")) return raw;
  // External images from social CDNs are CORP-protected and must go through our proxy
  try {
    const h = new URL(raw).hostname.toLowerCase();
    if (
      h.includes("instagram.com") ||
      h.endsWith("fbcdn.net") ||
      h.endsWith("fbsbx.com") ||
      h.includes("facebook.com") ||
      h.includes("tiktokcdn.com") ||
      h.includes("tiktok.com") ||
      h.includes("twimg.com") ||
      h.includes("redd.it") ||
      h.includes("redditmedia.com") ||
      h.includes("reddituploads.com")
    ) {
      return apiUrl(`/api/proxy-image?url=${encodeURIComponent(raw)}`);
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return raw;
}

const METADATA_TIMEOUT_MS = 12000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

const AddItemModal: React.FC<AddItemModalProps> = ({
  onClose,
  onAddList,
  initialUrl = "",
  initialTitle = "",
  initialContent = "",
}) => {
  const { lists, items, createItem, createList } = useData();
  // Mirror lists into a ref so async callbacks (runGeminiInBackground) always
  // read the latest list state, not the stale closure value from mount time.
  const listsRef = useRef(lists);
  useEffect(() => { listsRef.current = lists; }, [lists]);

  const [title, setTitle] = useState(
    initialTitle ? decodeHtmlEntities(initialTitle) : "",
  );
  const [url, setUrl] = useState(initialUrl);
  // Ref to always hold the latest resolved URL, bypassing React state closure lag.
  // This ensures handleSubmit always uses the canonical URL even if state hasn't re-rendered.
  const resolvedUrlRef = useRef<string>(initialUrl);
  const updateUrl = (newUrl: string) => {
    resolvedUrlRef.current = newUrl;
    setUrl(newUrl);
  };
  const [content, setContent] = useState(
    initialContent ? decodeHtmlEntities(initialContent) : "",
  );
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [nsfw, setNsfw] = useState(false);
  const [listIds, setListIds] = useState<string[]>(
    lists[0]?.id ? [lists[0].id] : [],
  );
  const [loading, setLoading] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [taggingWithAi, setTaggingWithAi] = useState(false);
  const [detectedSource, setDetectedSource] = useState<string | null>(null);
  const metadataRequestId = useRef(0);

  // Fire Gemini in the background as soon as we have enough metadata.
  // Populates tag chips and pre-selects / auto-creates lists so the user sees
  // AI suggestions before they hit Save — no extra wait at submit time.
  //
  // List assignment rules:
  // - The first list (default "quick bin") is always pre-selected but does NOT
  //   count toward the AI's 2-list budget. AI can add up to 2 more lists.
  // - If Gemini matches existing lists by name, those are added (up to 2).
  // - If Gemini proposes a new list name and the 2-list budget isn't full yet,
  //   the new list is created automatically and assigned.
  // - User can always adjust list selection manually before saving.
  const runGeminiInBackground = async (
    aiTitle: string,
    aiContent: string,
    aiUrl: string,
    aiSource: string | undefined,
  ) => {
    if (!aiTitle && !aiUrl) return;
    setTaggingWithAi(true);
    try {
      // Use listsRef.current so we always have the latest lists, even if this
      // function was called from a stale closure (e.g. mount-time useEffect).
      const currentLists = listsRef.current;
      const listNames = currentLists.map((l) => l.name);
      console.log("[AddItemModal] runGeminiInBackground — lists:", listNames, "title:", aiTitle, "url:", aiUrl);
      const result = await getGeminiSuggestions(
        aiTitle,
        aiContent,
        aiUrl,
        aiSource,
        existingTags,
        listNames,
      );
      console.log("[AddItemModal] Gemini result:", result);

      // Add AI tags as chips (skip any the user already added manually)
      if (result.tags.length > 0) {
        setTagChips((prev) => {
          const merged = Array.from(new Set([...prev, ...result.tags]));
          return merged;
        });
      }

      // The default list (lists[0]) is the "quick bin" — it is always pre-selected
      // but does not count toward the AI 2-list cap.
      const defaultListId = currentLists[0]?.id;

      // Track how many AI-assigned lists (beyond the default) we've added.
      let aiListsAdded = 0;
      const MAX_AI_LISTS = 2;

      // Accumulate new list IDs to add so we can do a single setListIds call.
      const toAdd: string[] = [];

      // 1. Match existing lists by name (Gemini returned exact or case-insensitive match)
      for (const name of result.listNames) {
        if (aiListsAdded >= MAX_AI_LISTS) break;
        const match = currentLists.find(
          (l) => l.name.toLowerCase() === name.toLowerCase(),
        );
        if (match && match.id !== defaultListId) {
          toAdd.push(match.id);
          aiListsAdded++;
        }
      }

      // 2. If Gemini proposed a new list name and budget allows, create it.
      if (result.newListName && aiListsAdded < MAX_AI_LISTS) {
        // Only create if a list with this name doesn't already exist.
        const alreadyExists = currentLists.find(
          (l) => l.name.toLowerCase() === result.newListName!.toLowerCase(),
        );
        if (alreadyExists) {
          // Treat as an existing list match instead
          if (alreadyExists.id !== defaultListId) {
            toAdd.push(alreadyExists.id);
            aiListsAdded++;
          }
        } else {
          try {
            console.log("[AddItemModal] AI creating new list:", result.newListName);
            const newList = await createList({ name: result.newListName });
            toAdd.push(newList.id);
            aiListsAdded++;
          } catch (err) {
            console.error("[AddItemModal] Failed to auto-create list:", err);
          }
        }
      }

      console.log("[AddItemModal] AI list IDs to add:", toAdd);

      // Apply all new list assignments in one update
      if (toAdd.length > 0) {
        setListIds((prev) => {
          const next = [...prev];
          for (const id of toAdd) {
            if (!next.includes(id)) next.push(id);
          }
          return next;
        });
      }
    } finally {
      setTaggingWithAi(false);
    }
  };

  // Chip-based tag input state
  const [tagChips, setTagChips] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Collect all existing tags from the user's saved items for autocomplete
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        set.add(tag.toLowerCase());
      }
    }
    return Array.from(set).sort();
  }, [items]);

  // Filtered suggestions: match the current input, excluding already-added chips
  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return existingTags
      .filter((t) => t.includes(q) && !tagChips.includes(t))
      .slice(0, 6);
  }, [tagInput, existingTags, tagChips]);

  const addTagChip = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (tag && !tagChips.includes(tag)) {
      setTagChips((prev) => [...prev, tag]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
  };

  const removeTagChip = (tag: string) => {
    setTagChips((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (tagInput.trim()) addTagChip(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tagChips.length > 0) {
      setTagChips((prev) => prev.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowTagSuggestions(false);
    }
  };

  // Seed the default list selection once the DataContext finishes loading lists.
  // lists[] is empty at mount (DataContext loads async), so the useState
  // initialiser above always produces []. This effect runs when lists first
  // populates and sets the first list as selected — but only if the user hasn't
  // already made a manual selection (listIds is still empty).
  useEffect(() => {
    if (listIds.length === 0 && lists.length > 0 && lists[0].id) {
      setListIds([lists[0].id]);
    }
  }, [lists]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceConfig: Record<string, { emoji: string; color: string; label: string }> = {
    youtube: { emoji: "▶️", color: "#ff0000", label: "YouTube" },
    twitter: { emoji: "𝕏", color: "#000000", label: "X (Twitter)" },
    tiktok: { emoji: "🎵", color: "#000000", label: "TikTok" },
    instagram: { emoji: "📷", color: "#e4405f", label: "Instagram" },
    reddit: { emoji: "👽", color: "#ff4500", label: "Reddit" },
    facebook: { emoji: "📘", color: "#1877f2", label: "Facebook" },
    threads: { emoji: "🧵", color: "#000000", label: "Threads" },
    medium: { emoji: "📝", color: "#000000", label: "Medium" },
    linkedin: { emoji: "💼", color: "#0077b5", label: "LinkedIn" },
    pinterest: { emoji: "📌", color: "#e60023", label: "Pinterest" },
    tumblr: { emoji: "📱", color: "#35465c", label: "Tumblr" },
    github: { emoji: "💻", color: "#181717", label: "GitHub" },
    vimeo: { emoji: "▶️", color: "#1ab7ea", label: "Vimeo" },
    spotify: { emoji: "🎧", color: "#1DB954", label: "Spotify" },
    anghami: { emoji: "🎶", color: "#6B2EFF", label: "Anghami" },
  };

  type UrlMetadata = {
    title?: string;
    description?: string;
    thumbnail?: string;
    url?: string;
    nsfw?: boolean;
  };

  // Detect source from URL
  const detectSource = (
    urlStr: string,
  ): {
    source: string;
    icon: string;
    label: string;
    contentType: string;
  } | null => {
    const lower = urlStr.toLowerCase();

    if (lower.includes("facebook.com") || lower.includes("fb.watch")) {
      let contentType = "Post";
      if (
        lower.includes("/share/v/") ||
        lower.includes("/video") ||
        lower.includes("fb.watch")
      )
        contentType = "Video";
      else if (lower.includes("/share/r/") || lower.includes("/reel"))
        contentType = "Reel";
      else if (lower.includes("/share/p/") || lower.includes("/photo"))
        contentType = "Photo";
      return { source: "facebook", icon: "📘", label: "Facebook", contentType };
    }
    if (lower.includes("instagram.com")) {
      let contentType = "Post";
      if (lower.includes("/reel")) contentType = "Reel";
      else if (lower.includes("/p/")) contentType = "Photo";
      return {
        source: "instagram",
        icon: "📷",
        label: "Instagram",
        contentType,
      };
    }
    if (lower.includes("twitter.com") || lower.includes("x.com")) {
      return {
        source: "twitter",
        icon: "𝕏",
        label: "X",
        contentType: "Post",
      };
    }
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      return {
        source: "youtube",
        icon: "▶️",
        label: "YouTube",
        contentType: "Video",
      };
    }
    if (lower.includes("tiktok.com")) {
      return {
        source: "tiktok",
        icon: "🎵",
        label: "TikTok",
        contentType: "Video",
      };
    }
    if (lower.includes("reddit.com") || lower.includes("redd.it")) {
      return {
        source: "reddit",
        icon: "👽",
        label: "Reddit",
        contentType: "Post",
      };
    }
    if (lower.includes("threads.net") || lower.includes("threads.com")) {
      return {
        source: "threads",
        icon: "🧵",
        label: "Threads",
        contentType: "Post",
      };
    }
    if (lower.includes("medium.com")) {
      return {
        source: "medium",
        icon: "📝",
        label: "Medium",
        contentType: "Article",
      };
    }
    if (lower.includes("linkedin.com")) {
      return {
        source: "linkedin",
        icon: "💼",
        label: "LinkedIn",
        contentType: "Post",
      };
    }
    if (lower.includes("github.com")) {
      return {
        source: "github",
        icon: "💻",
        label: "GitHub",
        contentType: "Repository",
      };
    }
    if (lower.includes("vimeo.com")) {
      return {
        source: "vimeo",
        icon: "▶️",
        label: "Vimeo",
        contentType: "Video",
      };
    }
    if (lower.includes("spotify.com")) {
      return {
        source: "spotify",
        icon: "🎧",
        label: "Spotify",
        contentType: "Audio",
      };
    }
    if (lower.includes("anghami.com")) {
      return {
        source: "anghami",
        icon: "🎶",
        label: "Anghami",
        contentType: "Audio",
      };
    }
    
    // Generic domain extraction for unknown sources
    try {
      const normalized = urlStr.startsWith("http://") || urlStr.startsWith("https://")
        ? urlStr
        : `https://${urlStr}`;
      const url = new URL(normalized);
      const hostname = url.hostname.toLowerCase();
      const parts = hostname.replace("www.", "").split(".");
      if (parts.length >= 2) {
        const domain = parts[parts.length - 2];
        return {
          source: domain,
          icon: "🔗",
          label: domain.charAt(0).toUpperCase() + domain.slice(1),
          contentType: "Link",
        };
      }
    } catch {
      // If URL parsing fails, fall through
    }
    return null;
  };

  // Auto-fetch metadata when modal opens with initial URL
  useEffect(() => {
    if (!initialUrl) return;

    const source = detectSource(initialUrl);
    if (source) {
      setDetectedSource(source.source);
    }

    const hasGenericInitialTitle =
      !!initialTitle &&
      !!source &&
      ((source.source === "facebook" && isGenericFacebookTitle(initialTitle)) ||
        (source.source === "instagram" &&
          isGenericInstagramTitle(initialTitle)) ||
        (source.source === "reddit" && isGenericRedditTitle(initialTitle)) ||
        (source.source === "threads" && isGenericThreadsTitle(initialTitle)));

    // Always fetch metadata for shared URLs. Even when the source app supplies a
    // good title, it usually does not supply the thumbnail we need for preview.

    // Only set a generic placeholder title if no real title was provided
    if (source && !initialTitle) {
      setTitle(`${source.label} ${source.contentType}`);
    }

    const fetchInitialMetadata = async () => {
      setFetchingTitle(true);
      try {
        const meta = await withTimeout(
          fetchUrlMetadata(initialUrl),
          METADATA_TIMEOUT_MS,
          null,
        );
        // Only overwrite title if we don't already have a real one from the share intent
        if (meta?.title && (!initialTitle || hasGenericInitialTitle)) {
          setTitle(decodeHtmlEntities(meta.title));
        }
        if (meta?.thumbnail) {
          setThumbnail(absolutizeThumbnail(meta.thumbnail));
        }
        if (meta?.description && !content) {
          setContent(decodeHtmlEntities(meta.description));
        }
        // Always update the URL if it resolved to something different
        // (critical for vt.tiktok.com and facebook.com/share/ URLs)
        if (meta?.url && meta.url !== initialUrl) {
          updateUrl(meta.url);
        }

        // Kick off Gemini as soon as we have metadata — runs in background
        const aiTitle = meta?.title ? decodeHtmlEntities(meta.title) : (initialTitle || "");
        const aiContent = meta?.description ? decodeHtmlEntities(meta.description) : (initialContent || "");
        const aiUrl = meta?.url || initialUrl;
        const aiSource = detectSource(aiUrl)?.source ?? undefined;
        runGeminiInBackground(aiTitle, aiContent, aiUrl, aiSource);
      } catch (err) {
        console.error("[AddItemModal] Error fetching initial metadata:", err);
        // Still run Gemini even if metadata fetch failed — use whatever we have
        const aiSource = source?.source ?? undefined;
        runGeminiInBackground(initialTitle || "", initialContent || "", initialUrl, aiSource);
      } finally {
        setFetchingTitle(false);
      }
    };

    fetchInitialMetadata();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const normalizeUrl = (urlStr: string): string | null => {
    try {
      const trimmed = urlStr.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
        return trimmed;
      return `https://${trimmed}`;
    } catch {
      return null;
    }
  };

  const isRedditShortOrDirtyUrl = (urlStr: string): boolean => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return false;
      const parsed = new URL(fullUrl);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes("reddit.com") && !host.includes("redd.it")) return false;
      // Short share links: reddit.com/r/sub/s/CODE
      if (/\/s\/[a-zA-Z0-9]+/.test(parsed.pathname)) return true;
      // Has UTM or tracking params that would confuse the embed widget
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_name",
        "utm_term",
        "utm_content",
        "utm_campaign",
        "ref",
        "ref_source",
        "context",
        "share_id",
        "sh",
      ];
      for (const p of trackingParams) {
        if (parsed.searchParams.has(p)) return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const cleanRedditUrl = (urlStr: string): string => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return urlStr;
      const parsed = new URL(fullUrl);
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_name",
        "utm_term",
        "utm_content",
        "utm_campaign",
        "ref",
        "ref_source",
        "context",
        "share_id",
        "sh",
      ];
      for (const p of trackingParams) parsed.searchParams.delete(p);
      // Remove trailing slash for consistency
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
      return parsed.toString();
    } catch {
      return urlStr;
    }
  };

  const cleanThreadsUrl = (urlStr: string): string => {
    try {
      const normalized = normalizeUrl(urlStr);
      if (!normalized) return urlStr;
      const parsed = new URL(normalized);
      // Rewrite threads.com -> threads.net for embed compatibility.
      if (parsed.hostname.includes("threads.com")) {
        parsed.hostname = parsed.hostname.replace("threads.com", "threads.net");
      }
      // Threads permalinks do not need query/hash. Share links often include
      // mt/xmt and other tracking params that break embeds.
      parsed.search = "";
      parsed.hash = "";
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
      return parsed.toString();
    } catch {
      return urlStr;
    }
  };

  const isAnghamiUrl = (urlStr: string): boolean => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return false;
      const parsed = new URL(fullUrl);
      const host = parsed.hostname.toLowerCase();
      return host.includes("anghami.com");
    } catch {
      return false;
    }
  };

  const cleanAnghamiUrl = (urlStr: string): string => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return urlStr;
      const parsed = new URL(fullUrl);

      // Share links include highly volatile branch/utm params that change on each copy.
      // Keep only stable canonical path.
      parsed.search = "";
      parsed.hash = "";
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

      // If we already resolved to play/song/<id>, keep that canonical form.
      if (
        parsed.hostname.toLowerCase().includes("anghami.com") &&
        /^\/song\/\d+$/i.test(parsed.pathname)
      ) {
        parsed.hostname = "play.anghami.com";
      }

      return parsed.toString();
    } catch {
      return urlStr;
    }
  };

  const isTikTokShortUrl = (urlStr: string): boolean => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return false;
      const parsed = new URL(fullUrl);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();

      if (host.includes("vt.tiktok.com") || host.includes("vm.tiktok.com")) {
        return true;
      }

      if (host.includes("tiktok.com") && path.startsWith("/t/")) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const fetchUnfurl = async (
    fullUrl: string,
  ): Promise<{
    url?: string;
    title?: string;
    description?: string;
    image?: string;
    nsfw?: boolean;
    redditShortUnresolved?: boolean;
  } | null> => {
    try {
      // Try the API endpoint first
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
      const response = await fetch(
        apiUrl(`/api/unfurl?url=${encodeURIComponent(fullUrl)}`),
        { signal: controller.signal },
      ).finally(() => clearTimeout(timeoutId));
      if (response.ok) {
        const data = await response.json();

        // Check for NSFW flag from server (Reddit, Twitter, etc.)
        const moderationCheck = checkMetadata(data);
        if (!moderationCheck.allowed) {
          alert(`⚠️ ${moderationCheck.reason}`);
          return null;
        }

        return {
          url: typeof data.url === "string" ? data.url : undefined,
          title: typeof data.title === "string" ? data.title : undefined,
          description:
            typeof data.description === "string" ? data.description : undefined,
          image: typeof data.image === "string" ? data.image : undefined,
          nsfw: data.nsfw === true,
          redditShortUnresolved: data.redditShortUnresolved === true,
        };
      }
    } catch {
      // API endpoint doesn't exist, fall back to LinkMetadataService
    }

    // Fallback to LinkMetadataService
    try {
      const metadata = await withTimeout(
        fetchLinkMetadata(fullUrl),
        METADATA_TIMEOUT_MS,
        null,
      );
      if (!metadata) return null;
      return {
        url: fullUrl, // LinkMetadataService doesn't resolve redirects
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
      };
    } catch (error) {
      console.error("[AddItemModal] Failed to fetch metadata:", error);
      return null;
    }
  };

  const isGenericRedditTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (t === "reddit") return true;
    if (t === "reddit - the heart of the internet") return true;
    if (t === "reddit – the heart of the internet") return true;
    if (t === "403" || t === "error" || t === "forbidden") return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
      return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
      return true;
    if (t.includes("not found") || t.includes("unavailable") || t.includes("not available"))
      return true;
    if (t.includes("something went wrong")) return true;
    if (t.includes("whoa there")) return true;
    if (t === "reddit post") return true;
    if (/^reddit post in r\/.+/.test(t)) return true;
    return false;
  };

  const isGenericInstagramTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (t === "instagram") return true;
    if (t.includes("403")) return true;
    if (t.includes("forbidden")) return true;
    if (t.includes("access denied")) return true;
    if (t.includes("not available")) return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
      return true;
    if (t === "instagram • photos and videos") return true;
    return false;
  };

  /**
   * Detect if a title is a generic Facebook error/placeholder
   * Due to CORS restrictions, Facebook often returns error pages instead of metadata
   */
  const isGenericFacebookTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    // Common error indicators
    if (t === "403" || t === "error" || t === "facebook") return true;
    if (t === "error facebook" || t === "facebook error") return true;
    // Access restriction messages
    if (
      t.includes("403") ||
      t.includes("forbidden") ||
      t.includes("access denied")
    )
      return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
      return true;
    // Page not found or unavailable
    if (
      t.includes("not found") ||
      t.includes("unavailable")
    )
      return true;
    if (t.includes("content not found") || t.includes("not available"))
      return true;
    if (t.includes("something went wrong")) return true;
    return false;
  };

  const isGenericFacebookDescription = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (!t) return true;
    if (t.includes("log into facebook")) return true;
    if (t.includes("log in to facebook")) return true;
    if (t.includes("start sharing and connecting")) return true;
    if (t.includes("create a page for a celebrity")) return true;
    if (t.includes("facebook helps you connect")) return true;
    return false;
  };

  const isGenericThreadsTitle = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (t === "threads") return true;
    if (t === "403" || t.includes("forbidden") || t.includes("access denied"))
      return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
      return true;
    if (t.includes("not found") || t.includes("unavailable")) return true;
    return false;
  };

  const isGenericThreadsDescription = (value?: string) => {
    if (!value) return true;
    const t = value.trim().toLowerCase();
    if (!t) return true;
    if (t.includes("join threads to share ideas")) return true;
    if (t.includes("log in with your instagram")) return true;
    if (t.includes("say more with threads")) return true;
    return false;
  };

  // Fetch metadata from URL (title/description/thumbnail)
  const fetchUrlMetadata = async (
    urlStr: string,
  ): Promise<UrlMetadata | null> => {
    try {
      const fullUrl = normalizeUrl(urlStr);
      if (!fullUrl) return null;
      const url = new URL(fullUrl);

      // For YouTube, use oEmbed API to get actual video title
      if (
        url.hostname.includes("youtube.com") ||
        url.hostname.includes("youtu.be")
      ) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(fullUrl)}&format=json`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            return {
              title: data.title || "YouTube Video",
              thumbnail: data.thumbnail_url || undefined,
            };
          }
        } catch (err) {
          console.error("Failed to fetch YouTube title:", err);
          return { title: "YouTube Video" };
        }
      }

      // For Instagram (and as a general fallback), use our server-side unfurl endpoint
      if (url.hostname.includes("instagram.com")) {
        const meta = await fetchUnfurl(fullUrl);

        // Fallback to URL-based title
        const pathParts = url.pathname.split("/").filter((p) => p);
        let fallbackTitle = "Instagram Post";
        if (pathParts.length >= 1) {
          const type = pathParts[0];
          if (type === "p") fallbackTitle = "Instagram Photo";
          else if (type === "reel") fallbackTitle = "Instagram Reel";
          else if (type === "tv") fallbackTitle = "Instagram Video";
          else fallbackTitle = `Post by @${type}`;
        }

        const description = cleanInstagramDescription(meta?.description);

        const metaTitle = meta?.title;
        return {
          title: !isGenericInstagramTitle(metaTitle)
            ? metaTitle
            : fallbackTitle,
          description: description || undefined,
          thumbnail: absolutizeThumbnail(meta?.image),
        };
      }

      // For TikTok, resolve short URLs (vt.tiktok.com) first, then use oEmbed
      if (url.hostname.includes("tiktok.com")) {
        // Short share URLs (vt/vm/t path) don't have a video ID — resolve via unfurl
        let resolvedTikTokUrl = fullUrl;
        if (isTikTokShortUrl(fullUrl)) {
          try {
            const meta = await fetchUnfurl(fullUrl);
            if (meta?.url && meta.url !== fullUrl) {
              resolvedTikTokUrl = meta.url;
            }
          } catch {
            // keep original, oEmbed will likely fail but we tried
          }
        }
        try {
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedTikTokUrl)}`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.title) {
              return {
                url: resolvedTikTokUrl,
                title:
                  data.title.length > 80
                    ? data.title.substring(0, 77) + "..."
                    : data.title,
                thumbnail: data.thumbnail_url || undefined,
              };
            }
            if (data.author_name) {
              return {
                url: resolvedTikTokUrl,
                title: `TikTok by @${data.author_name}`,
                thumbnail: data.thumbnail_url || undefined,
              };
            }
          }
        } catch (err) {
          console.error("Failed to fetch TikTok title:", err);
        }
        return { url: resolvedTikTokUrl, title: "TikTok Video" };
      }

      // For Twitter/X — use oEmbed to get the actual tweet text for categorization,
      // then supplement with unfurl for thumbnail/metadata.
      if (
        url.hostname.includes("twitter.com") ||
        url.hostname.includes("x.com")
      ) {
        const pathParts = url.pathname.split("/").filter((p) => p);
        const fallbackTitle =
          pathParts.length >= 1 ? `Tweet by @${pathParts[0]}` : "Tweet";

        let tweetText: string | undefined;
        let oembedTitle: string | undefined;

        // Twitter oEmbed returns the tweet HTML which contains the full tweet text
        try {
          const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(fullUrl)}&omit_script=true`;
          const oembedRes = await fetch(oembedUrl);
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            // Extract plain text from oEmbed HTML (strip tags)
            if (typeof oembedData.html === "string") {
              const stripped = oembedData.html
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              tweetText = stripped || undefined;
            }
            if (typeof oembedData.author_name === "string") {
              oembedTitle = `Tweet by @${oembedData.author_name}`;
            }
          }
        } catch {
          // oEmbed failed — fall through
        }

        // Try unfurl for thumbnail
        let thumbnail: string | undefined;
        let unfurlUrl: string | undefined;
        try {
          const meta = await fetchUnfurl(fullUrl);
          thumbnail = meta?.image || undefined;
          unfurlUrl = meta?.url || undefined;
        } catch {
          // unfurl failed — fine
        }

        return {
          title: oembedTitle || fallbackTitle,
          description: tweetText,
          thumbnail,
          url: unfurlUrl,
        };
      }

      // For Facebook - simplified approach
      // Due to CORS and privacy restrictions, we provide smart fallback titles
      if (
        url.hostname.includes("facebook.com") ||
        url.hostname.includes("fb.watch")
      ) {
        // Determine content type from URL pattern
        let fallbackTitle = "Facebook Post";
        if (url.hostname.includes("fb.watch")) {
          fallbackTitle = "Facebook Video";
        } else if (
          url.pathname.includes("/video") ||
          url.pathname.includes("/share/v/")
        ) {
          fallbackTitle = "Facebook Video";
        } else if (
          url.pathname.includes("/reel") ||
          url.pathname.includes("/share/r/")
        ) {
          fallbackTitle = "Facebook Reel";
        } else if (
          url.pathname.includes("/photo") ||
          url.pathname.includes("/share/p/")
        ) {
          fallbackTitle = "Facebook Photo";
        }

        // Try to fetch metadata, but expect it to often fail due to CORS
        try {
          const meta = await fetchUnfurl(fullUrl);
          const hasValidTitle =
            meta?.title && !isGenericFacebookTitle(meta.title);
          const safeDescription = !isGenericFacebookDescription(meta?.description)
            ? meta?.description
            : undefined;

           return {
            url: meta?.url || fullUrl,
            title: hasValidTitle ? meta.title : fallbackTitle,
            description: safeDescription,
            thumbnail: absolutizeThumbnail(meta?.image),
          };
        } catch (error) {
          console.log(
            "[AddItemModal] Facebook metadata fetch failed (expected):",
            error,
          );
          // Return fallback data without metadata
          return {
            url: fullUrl,
            title: fallbackTitle,
            description: undefined,
            thumbnail: undefined,
          };
        }
      }

      // For Reddit — resolve short share URLs and strip tracking params before saving.
      // reddit.com/r/sub/s/CODE short links and UTM-laden URLs both break the embed widget.
      if (url.hostname.includes("reddit.com") || url.hostname.includes("redd.it")) {
        const pathParts = url.pathname.split("/").filter((p) => p);
        let fallbackTitle = "Reddit Post";
        const subredditIdx = pathParts.indexOf("r");
        if (subredditIdx !== -1 && pathParts[subredditIdx + 1]) {
          fallbackTitle = `Reddit Post in r/${pathParts[subredditIdx + 1]}`;
        }

        try {
          const meta = await fetchUnfurl(fullUrl);
          // meta.url from the server is the resolved canonical URL (no tracking params, no /s/ short link)
          const resolvedUrl = cleanRedditUrl(meta?.url || fullUrl);
          const hasValidTitle = meta?.title && !isGenericRedditTitle(meta.title);
          return {
            url: resolvedUrl,
            title: hasValidTitle ? meta.title : fallbackTitle,
            description: meta?.description,
            thumbnail: absolutizeThumbnail(meta?.image),
          };
        } catch {
          return { url: cleanRedditUrl(fullUrl), title: fallbackTitle };
        }
      }

      // For Threads URLs, strip login-wall metadata before saving
      if (
        url.hostname.includes("threads.net") ||
        url.hostname.includes("threads.com")
      ) {
        const meta = await fetchUnfurl(fullUrl);
        const safeTitle = !isGenericThreadsTitle(meta?.title)
          ? meta?.title
          : undefined;
        const safeDescription = !isGenericThreadsDescription(meta?.description)
          ? meta?.description
          : undefined;
        // Keep any image the server found and let our proxy helper normalize
        // Instagram/Threads CDN URLs so the preview can actually render them.
        const safeThumbnail = absolutizeThumbnail(meta?.image);
        // Do NOT use meta.url — the unfurl follows threads.net → threads.com
        // redirects and would overwrite the user's URL. Strip tracking params from fullUrl.
        return {
          title: safeTitle,
          description: safeDescription,
          thumbnail: safeThumbnail,
          url: cleanThreadsUrl(fullUrl),
        };
      }

      // For Anghami URLs, resolve open.anghami short links once and strip volatile tracking params.
      if (url.hostname.includes("anghami.com")) {
        const meta = await fetchUnfurl(fullUrl);
        const resolved = cleanAnghamiUrl(meta?.url || fullUrl);
        const fallbackTitle = "Anghami Track";
        return {
          title: meta?.title || fallbackTitle,
          description: meta?.description,
          thumbnail: absolutizeThumbnail(meta?.image),
          url: resolved,
        };
      }

      // For other URLs, try unfurl then fall back to domain
      const meta = await fetchUnfurl(fullUrl);
      if (meta?.title || meta?.description || meta?.image) {
        return {
          title: meta.title,
          description: meta.description,
          thumbnail: absolutizeThumbnail(meta.image),
          url: meta.url,
        };
      }

      return { title: url.hostname.replace("www.", "") };
    } catch (err) {
      return null;
    }
  };

  const handleUrlChange = async (newUrl: string) => {
    updateUrl(newUrl);
    setThumbnail(undefined);
    const source = detectSource(newUrl);
    setDetectedSource(source?.source ?? null);
    const requestId = ++metadataRequestId.current;

    const trimmedUrl = newUrl.trim();
    const existingTitle = title.trim();

    const isTitleGeneric = (src?: string) => {
      if (!src) return !existingTitle;
      if (src === "facebook")
        return !existingTitle || isGenericFacebookTitle(existingTitle);
      if (src === "instagram")
        return !existingTitle || isGenericInstagramTitle(existingTitle);
      if (src === "reddit")
        return !existingTitle || isGenericRedditTitle(existingTitle);
      if (src === "threads")
        return !existingTitle || isGenericThreadsTitle(existingTitle);
      return !existingTitle;
    };

    if (source && isTitleGeneric(source.source)) {
      setTitle(`${source.label} ${source.contentType}`);
    }

    const shouldResolveFacebookShare =
      !!trimmedUrl &&
      source?.source === "facebook" &&
      (trimmedUrl.includes("facebook.com/share/") ||
        trimmedUrl.includes("fb.watch"));

    const shouldFetchMetadata = !!trimmedUrl || shouldResolveFacebookShare;

    // Auto-fetch metadata if URL is provided and title is missing or generic
    if (shouldFetchMetadata) {
      setFetchingTitle(true);
      try {
        const fetched = await withTimeout(
          fetchUrlMetadata(trimmedUrl),
          METADATA_TIMEOUT_MS,
          null,
        );

        if (metadataRequestId.current !== requestId) return;

        // Update the URL if it resolved to something more specific.
        // This is critical for short/opaque URLs (vt.tiktok.com, fb.watch, facebook.com/share/)
        // where the embed cannot work without the canonical URL.
        const isShortOrShareUrl =
          (source?.source === "tiktok" && isTikTokShortUrl(trimmedUrl)) ||
          trimmedUrl.includes("fb.watch") ||
          trimmedUrl.includes("facebook.com/share/") ||
          (source?.source === "anghami" && isAnghamiUrl(trimmedUrl)) ||
          (source?.source === "reddit" && isRedditShortOrDirtyUrl(trimmedUrl));
        if (fetched?.url && fetched.url !== trimmedUrl && isShortOrShareUrl) {
          updateUrl(source?.source === "anghami" ? cleanAnghamiUrl(fetched.url) : fetched.url);
        }

        const shouldUpdateTitle =
          !existingTitle ||
          (source?.source === "facebook" &&
            isGenericFacebookTitle(existingTitle)) ||
          (source?.source === "instagram" &&
            isGenericInstagramTitle(existingTitle)) ||
          (source?.source === "reddit" &&
            isGenericRedditTitle(existingTitle)) ||
          (source?.source === "threads" &&
            isGenericThreadsTitle(existingTitle));

        if (shouldUpdateTitle && fetched?.title) {
          setTitle(decodeHtmlEntities(fetched.title));
        }
        if (fetched?.thumbnail) {
          setThumbnail(absolutizeThumbnail(fetched.thumbnail));
        }
        if (fetched?.nsfw) {
          setNsfw(true);
        }
        if (fetched?.description && !content.trim()) {
          setContent(decodeHtmlEntities(fetched.description));
        }

        // Kick off Gemini in background after metadata is ready
        const aiTitle = (shouldUpdateTitle && fetched?.title)
          ? decodeHtmlEntities(fetched.title)
          : existingTitle;
        const aiContent = fetched?.description || content.trim();
        const aiUrl = fetched?.url || trimmedUrl;
        runGeminiInBackground(aiTitle, aiContent, aiUrl, source?.source ?? undefined);
      } catch (err) {
        console.error("[AddItemModal] Error fetching title:", err);
      } finally {
        if (metadataRequestId.current === requestId) {
          setFetchingTitle(false);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If no title provided, try to generate one from URL.
    // Use resolvedUrlRef.current to get the latest canonical URL regardless of whether
    // React has flushed the state update from fetchInitialMetadata yet (race condition fix).
    let finalTitle = title.trim();
    const currentUrl = resolvedUrlRef.current || url;
    let finalUrl = currentUrl.trim() || undefined;
    let finalThumbnail = thumbnail;
    let finalContent = content.trim() || undefined;

    const hasUrl = !!currentUrl.trim();

    // Final guard: if we're still holding a TikTok short URL at submit time,
    // resolve it once more right before save.
    if (finalUrl && isTikTokShortUrl(finalUrl)) {
      try {
        const resolved = await fetchUnfurl(finalUrl);
        if (resolved?.url && resolved.url !== finalUrl) {
          finalUrl = resolved.url;
          updateUrl(resolved.url);
        }
      } catch {
        // keep original
      }
    }

    // Final guard: resolve Reddit short share links and strip tracking params before save.
    if (finalUrl && isRedditShortOrDirtyUrl(finalUrl)) {
      try {
        const resolved = await fetchUnfurl(finalUrl);
        const cleanUrl = cleanRedditUrl(resolved?.url || finalUrl);

        if (cleanUrl !== finalUrl) {
          finalUrl = cleanUrl;
          updateUrl(cleanUrl);
        }
      } catch {
        finalUrl = cleanRedditUrl(finalUrl);
        updateUrl(finalUrl);
      }
    }

    // Final guard: always normalize Threads links before save.
    // This handles paths where metadata fetch is skipped (e.g. title already present),
    // so share-sheet params like ?mt=... are never persisted.
    if (
      finalUrl &&
      (finalUrl.includes("threads.net") || finalUrl.includes("threads.com"))
    ) {
      const cleanUrl = cleanThreadsUrl(finalUrl);
      if (cleanUrl !== finalUrl) {
        finalUrl = cleanUrl;
        updateUrl(cleanUrl);
      }
    }

    // Final guard: canonicalize Anghami URLs and strip branch/utm parameters before save.
    if (finalUrl && isAnghamiUrl(finalUrl)) {
      try {
        const resolved = await fetchUnfurl(finalUrl);
        const cleanUrl = cleanAnghamiUrl(resolved?.url || finalUrl);
        if (cleanUrl !== finalUrl) {
          finalUrl = cleanUrl;
          updateUrl(cleanUrl);
        }
      } catch {
        const cleanUrl = cleanAnghamiUrl(finalUrl);
        if (cleanUrl !== finalUrl) {
          finalUrl = cleanUrl;
          updateUrl(cleanUrl);
        }
      }
    }

    if (!finalTitle && hasUrl) {
      const meta = await withTimeout(
        fetchUrlMetadata(currentUrl.trim()),
        METADATA_TIMEOUT_MS,
        null,
      );
      const resolvedUrl = meta?.url || currentUrl.trim();
      finalUrl = resolvedUrl;
      finalTitle = meta?.title || "Untitled";
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      updateUrl(resolvedUrl);
    } else if (hasUrl && (!finalThumbnail || !finalContent)) {
      // Title might already be a fallback (e.g. "Instagram Photo"), but we still want thumbnail/snippet.
      const meta = await withTimeout(
        fetchUrlMetadata(currentUrl.trim()),
        METADATA_TIMEOUT_MS,
        null,
      );
      const resolvedUrl = meta?.url || currentUrl.trim();
      finalUrl = resolvedUrl;
      if (!finalThumbnail && meta?.thumbnail) finalThumbnail = meta.thumbnail;
      if (!finalContent && meta?.description) finalContent = meta.description;

      updateUrl(resolvedUrl);
    } else if (!finalTitle && !hasUrl) {
      alert("Please enter a title or URL");
      return;
    }

    if (!listIds.length) {
      alert("Please select at least one list");
      return;
    }

    setLoading(true);

    try {
      // Moderate content before saving
      const moderationResult = moderateItem({
        url: finalUrl,
        title: finalTitle,
        content: finalContent,
      });

      if (!moderationResult.allowed) {
        alert(
          `⚠️ Content blocked: ${moderationResult.reason || "This content is not allowed"}`,
        );
        setLoading(false);
        return;
      }

      const finalSource = finalUrl ? detectSource(finalUrl)?.source : undefined;

      // Tags and lists are already populated from the background Gemini call
      // that ran after metadata fetch. Just use current chip/list state.
      const finalTags = Array.from(new Set(tagChips));
      const autoListIds = [...listIds];

      await createItem({
        title: finalTitle,
        url: finalUrl,
        content: finalContent,
        thumbnail: finalThumbnail,
        listIds: autoListIds,
        type: url ? "link" : "text",
        source: finalSource,
        tags: finalTags,
        nsfw: nsfw || undefined,
      });

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add item";
      alert(message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const previewDetails = url ? detectSource(url) : null;
  const previewSource = detectedSource ?? previewDetails?.source ?? null;
  const previewConfig = previewSource
    ? (sourceConfig[previewSource] ?? {
        emoji: previewDetails?.icon ?? "🔗",
        color: "#666",
        label: previewDetails?.label ?? "Link",
      })
    : null;
  const previewPlatformClass = previewSource === "twitter" ? "x" : previewSource ?? "generic";
  const previewContentType = previewDetails?.contentType;
  const previewLabel = previewConfig
    ? `${previewConfig.label}${previewContentType ? ` ${previewContentType}` : ""}`
    : "Link preview";
  const isThreadsPreview = previewSource === "threads";
  const previewDescription = content.trim();
  const shouldShowPreview = !!(url.trim() || thumbnail || previewSource || fetchingTitle);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content slide-in-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Add Item</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form id="add-item-form" onSubmit={handleSubmit} className="modal-form">
          {/* Preview section scrolls with the rest of the form content */}
          {shouldShowPreview && (
            previewConfig ? (
              previewSource === "twitter" && url.trim() ? (
                <div className="share-preview share-preview--compact">
                  <TweetEmbed
                    url={url}
                    thumbnail={thumbnail}
                    title={title.trim() || previewLabel}
                    description={previewDescription}
                  />
                </div>
              ) : (
                <div className={`share-preview share-preview--compact share-preview-platform-card share-preview-platform-card--${previewPlatformClass}${isThreadsPreview ? " share-preview-platform-card--threads-compact" : ""}`}>
                  <div className="share-preview-platform-header">
                    {previewSource === "facebook" ? (
                      <FacebookLogo />
                    ) : (
                      <span className="share-preview-platform-emoji" aria-hidden="true">
                        {previewConfig.emoji}
                      </span>
                    )}
                    <span>{previewLabel}</span>
                  </div>
                  {thumbnail ? (
                    <div className="share-preview-platform-thumb">
                      <img
                        src={thumbnail}
                        alt={previewLabel}
                        onError={() => setThumbnail(undefined)}
                      />
                    </div>
                  ) : (
                    <div className="share-preview-platform-body">
                      <div className="share-preview-platform-icon">
                        {fetchingTitle ? "⏳" : previewConfig.emoji}
                      </div>
                      <div className="share-preview-platform-title">
                        {fetchingTitle ? "Loading preview…" : (title.trim() || previewLabel)}
                      </div>
                      {!fetchingTitle && isThreadsPreview && previewDescription ? (
                        <div className="share-preview-platform-text share-preview-platform-text--threads">
                          {previewDescription}
                        </div>
                      ) : (
                        <div className="share-preview-platform-text">
                          {fetchingTitle
                            ? `Fetching ${previewConfig.label} metadata`
                            : `Preview will use ${previewConfig.label} branding when saved`}
                        </div>
                      )}
                    </div>
                  )}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="share-preview-platform-button"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open in {previewConfig.label}
                  </a>
                </div>
              )
            ) : (
              <div className="share-preview share-preview--compact">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt="Preview"
                    className="share-preview-image"
                    onError={() => setThumbnail(undefined)}
                  />
                ) : (
                  <div className="share-preview-placeholder share-preview-placeholder--compact">
                    <span className={`share-preview-icon ${previewSource ?? "generic"}`}>
                      {fetchingTitle ? "⏳" : "🔗"}
                    </span>
                    <span className="share-preview-text">
                      {fetchingTitle ? "Loading preview…" : "Link preview"}
                    </span>
                  </div>
                )}
              </div>
            )
          )}

          <div className="form-group">
            <label htmlFor="url">URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com or youtu.be/..."
              disabled={loading}
              autoFocus={!initialUrl}
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">
              Title
              {fetchingTitle && (
                <span className="fetching-indicator"> (fetching...)</span>
              )}
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated from URL or enter manually"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Notes</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add any notes or description..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>
              Tags (optional)
              {taggingWithAi && (
                <span className="fetching-indicator"> (AI tagging...)</span>
              )}
            </label>
            <div
              className="tag-chip-input"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tagChips.map((chip) => (
                <span key={chip} className="tag-chip">
                  {chip}
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={(e) => { e.stopPropagation(); removeTagChip(chip); }}
                    disabled={loading}
                    aria-label={`Remove tag ${chip}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                className="tag-chip-text-input"
                value={tagInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Auto-split on comma
                  if (val.includes(",")) {
                    val.split(",").forEach((part) => {
                      if (part.trim()) addTagChip(part);
                    });
                  } else {
                    setTagInput(val);
                    setShowTagSuggestions(val.trim().length > 0);
                  }
                }}
                onKeyDown={handleTagKeyDown}
                onFocus={() => setShowTagSuggestions(tagInput.trim().length > 0)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                placeholder={tagChips.length === 0 ? "Add tags... (Enter or comma to confirm)" : ""}
                disabled={loading}
              />
            </div>
            {showTagSuggestions && tagSuggestions.length > 0 && (
              <div className="tag-suggestions">
                {tagSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="tag-suggestion-item"
                    onMouseDown={(e) => { e.preventDefault(); addTagChip(suggestion); }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Lists *</label>
            <div className="list-picker">
              {lists.map((list) => {
                const checked = listIds.includes(list.id);
                return (
                  <label
                    key={list.id}
                    className={`list-picker-item${checked ? " selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={loading}
                      onChange={() => {
                        setListIds((prev) =>
                          prev.includes(list.id)
                            ? prev.filter((id) => id !== list.id)
                            : [...prev, list.id],
                        );
                      }}
                    />
                    <span className="list-picker-icon">{list.icon}</span>
                    <span className="list-picker-name">{list.name}</span>
                  </label>
                );
              })}
              {onAddList && (
                <button
                  type="button"
                  className="list-picker-add"
                  onClick={onAddList}
                  disabled={loading}
                >
                  + New List
                </button>
              )}
            </div>
          </div>

        </form>
        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-item-form"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddItemModal;
