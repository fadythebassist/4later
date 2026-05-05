import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const FB_APP_ID = defineSecret("FB_APP_ID");
const FB_APP_SECRET = defineSecret("FB_APP_SECRET");
const THREADS_APP_SECRET = defineSecret("THREADS_APP_SECRET");

const SITE_ORIGIN = "https://4stash.com";
const AGENT_LINK_HEADER = "</.well-known/api-catalog>; rel=\"api-catalog\", </index.md>; rel=\"alternate\"; type=\"text/markdown\"";
const FALLBACK_MARKDOWN = `# 4Stash — Save Content from Anywhere, Find It Later

4Stash is a personal multimedia content organizer for saving links, tweets, TikToks, Instagram posts, Reddit threads, YouTube videos, Threads posts, Facebook posts, and any URL in one private stash.

- Homepage: https://4stash.com/
- Login / Get Started: https://4stash.com/login
- Privacy Policy: https://4stash.com/privacy
- Terms of Service: https://4stash.com/terms
- API Catalog: https://4stash.com/.well-known/api-catalog
`;

const FALLBACK_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>4Stash - Save Content from Anywhere, Find It Later</title>
    <meta name="description" content="4Stash is a personal content organizer. Save links, tweets, TikToks, Instagram posts, Reddit threads, YouTube videos, and more — all in one place." />
    <link rel="canonical" href="https://4stash.com/" />
  </head>
  <body>
    <h1>4Stash</h1>
    <p>Save Content from Anywhere, Find It Later.</p>
    <p><a href="/login">Get started</a></p>
  </body>
</html>`;

// ---------------------------------------------------------------------------
// Helpers (ported from vite.config.ts unfurl middleware)
// ---------------------------------------------------------------------------

function getAcceptQuality(accept: string | undefined, mediaType: string): number {
  if (!accept) return 0;

  return accept
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((best, entry) => {
      const [type, ...params] = entry.split(";").map((part) => part.trim().toLowerCase());
      if (type !== mediaType.toLowerCase()) return best;

      const qParam = params.find((param) => param.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return Number.isFinite(q) ? Math.max(best, q) : best;
    }, 0);
}

function shouldReturnMarkdown(accept: string | undefined): boolean {
  const markdownQ = getAcceptQuality(accept, "text/markdown");
  if (markdownQ <= 0) return false;

  const htmlQ = getAcceptQuality(accept, "text/html");
  return markdownQ >= htmlQ;
}

async function fetchStaticText(path: string, fallback: string): Promise<string> {
  try {
    const response = await fetch(`${SITE_ORIGIN}${path}`);
    if (!response.ok) return fallback;
    return await response.text();
  } catch {
    return fallback;
  }
}

async function handleHomeRequest(req: functions.https.Request, res: functions.Response<unknown>): Promise<void> {
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Link", AGENT_LINK_HEADER);
  res.setHeader("Vary", "Accept");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (shouldReturnMarkdown(req.headers.accept)) {
    const markdown = await fetchStaticText("/index.md", FALLBACK_MARKDOWN);
    res.status(200).type("text/markdown; charset=utf-8").send(markdown);
    return;
  }

  const html = await fetchStaticText("/landing.html", FALLBACK_HTML);
  res.status(200).type("text/html; charset=utf-8").send(html);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractMetadata(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  const metas = html.match(/<meta\s+[^>]*>/gi) ?? [];
  const map = new Map<string, string>();

  for (const tag of metas) {
    const keyMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!keyMatch || !contentMatch) continue;
    const key = keyMatch[1].trim().toLowerCase();
    const content = decodeHtmlEntities(contentMatch[1].trim());
    if (!map.has(key) && content) map.set(key, content);
  }

  const titleFromOg = map.get("og:title") || map.get("twitter:title");
  const descriptionFromOg =
    map.get("og:description") ||
    map.get("twitter:description") ||
    map.get("description");
  const imageFromOg =
    map.get("og:image:secure_url") ||
    map.get("og:image:url") ||
    map.get("og:image") ||
    map.get("twitter:image");

  let title = titleFromOg;
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag?.[1]) title = decodeHtmlEntities(titleTag[1].trim());
  }

  if (!title || !descriptionFromOg || !imageFromOg) {
    const lines = html.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*(og:title|twitter:title|title)\s*:\s*(.+)\s*$/i);
      if (m && !title) { title = decodeHtmlEntities(m[2].trim()); continue; }
      const d = line.match(/^\s*(og:description|twitter:description|description)\s*:\s*(.+)\s*$/i);
      if (d && !descriptionFromOg) { map.set(d[1].toLowerCase(), decodeHtmlEntities(d[2].trim())); continue; }
      const i = line.match(/^\s*(og:image|twitter:image)\s*:\s*(https?:\/\/\S+)/i);
      if (i && !imageFromOg) { map.set(i[1].toLowerCase(), i[2].trim()); }
    }
  }

  const description = descriptionFromOg || map.get("og:description") || map.get("twitter:description") || map.get("description");
  const image = imageFromOg || map.get("og:image:secure_url") || map.get("og:image:url") || map.get("og:image") || map.get("twitter:image");
  return { title, description, image };
}

function isGenericInstagramTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "instagram") return true;
  if (t === "instagram post") return true;
  if (t === "instagram photo") return true;
  if (t === "instagram reel") return true;
  if (t === "instagram video") return true;
  if (/^post by @.+/.test(t)) return true;
  if (t.includes("403") || t.includes("forbidden") || t.includes("access denied")) return true;
  if (t.includes("not available")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up")) return true;
  if (t === "instagram • photos and videos") return true;
  return false;
}

function cleanInstagramText(input?: string): string | undefined {
  if (!input) return undefined;
  let t = decodeHtmlEntities(input).replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  t = t.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, "").trim();
  t = t.replace(/^\d+\s+likes,\s+\d+\s+comments\s+-\s+/i, "").trim();
  return t || undefined;
}

function isGenericInstagramDescription(desc?: string): boolean {
  const d = (desc ?? "").trim().toLowerCase();
  if (!d) return true;
  if (d.includes("log in") || d.includes("login") || d.includes("sign up")) return true;
  if (d.includes("url source:")) return true;
  if (d.includes("markdown content:")) return true;
  if (d.includes("see everyday moments from your close friends")) return true;
  if (d.includes("instagram")) return false;
  return false;
}

function isInstagramLoginUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("instagram.com") && u.pathname.startsWith("/accounts/login");
  } catch {
    return false;
  }
}

function isGenericRedditTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "403" || t === "error" || t === "forbidden" || t === "reddit") return true;
  if (t === "reddit - the heart of the internet") return true;
  if (t === "reddit \u2013 the heart of the internet") return true;
  if (t.includes("403") || t.includes("forbidden") || t.includes("access denied")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up")) return true;
  if (t.includes("not found") || t.includes("unavailable") || t.includes("not available")) return true;
  if (t.includes("something went wrong")) return true;
  if (t.includes("whoa there")) return true;
  if (t === "reddit post") return true;
  if (/^reddit post in r\/.+/.test(t)) return true;
  return false;
}

function cleanRedditUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
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
    for (const p of trackingParams) u.searchParams.delete(p);
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return urlStr;
  }
}

function isGenericFacebookTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "403" || t === "error" || t === "error facebook" || t === "facebook") return true;
  if (t.includes("403") || t.includes("forbidden") || t.includes("access denied")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up")) return true;
  if (t.includes("not available") || t.includes("content not found")) return true;
  if (t.includes("something went wrong")) return true;
  return false;
}

function cleanFacebookUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
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
      "rdid",
      "share_url",
      "mibextid",
      "__cft__",
      "__tn__",
    ];
    for (const p of trackingParams) u.searchParams.delete(p);
    u.hash = "";
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return urlStr;
  }
}

function getFacebookFallbackTitle(urlStr: string): string | undefined {
  try {
    const u = new URL(urlStr);
    const path = u.pathname.toLowerCase();
    if (path.includes("/groups/") && (path.includes("/permalink/") || path.includes("/posts/"))) {
      return "Facebook Group Post";
    }
    if (path.includes("/reel") || path.includes("/reels/")) {
      return "Facebook Reel";
    }
    if (path.includes("/video") || path.includes("/watch")) {
      return "Facebook Video";
    }
    if (path.includes("/photo")) {
      return "Facebook Photo";
    }
    return "Facebook Post";
  } catch {
    return undefined;
  }
}

/** Extract a numeric Facebook video/reel ID from a URL, or null. */
function extractFacebookVideoId(urlStr: string): string | null {
  try {
    const u = new URL(urlStr);
    const path = u.pathname;

    // /reel/933897635709855
    const reelMatch = path.match(/\/reel\/(\d+)/);
    if (reelMatch) return reelMatch[1];

    // /reels/933897635709855
    const reelsMatch = path.match(/\/reels\/(\d+)/);
    if (reelsMatch) return reelsMatch[1];

    // /watch/?v=933897635709855
    const vParam = u.searchParams.get("v");
    if (path.startsWith("/watch") && vParam && /^\d+$/.test(vParam)) return vParam;

    // /username/videos/933897635709855
    const videosMatch = path.match(/\/videos\/(\d+)/);
    if (videosMatch) return videosMatch[1];

    // /video.php?v=933897635709855
    if (path.includes("video.php") && vParam && /^\d+$/.test(vParam)) return vParam;

    return null;
  } catch {
    return null;
  }
}

/** Check if a Facebook URL points to a video or reel. */
function isFacebookVideoUrl(urlStr: string): boolean {
  try {
    const path = new URL(urlStr).pathname.toLowerCase();
    return path.includes("/reel") || path.includes("/reels/") ||
      path.includes("/video") || path.includes("/watch");
  } catch {
    return false;
  }
}

function shouldProxyImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    // Instagram CDN images are CORP-protected in browsers; proxy them with an
    // Instagram referer so they render inside our app origin.
    h.includes("instagram.com") ||
    h.endsWith("fbcdn.net") ||
    h.includes("facebook.com") ||
    h.endsWith("fbsbx.com")
  );
}

function isFacebookShareLike(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (!host.includes("facebook.com") && !host.includes("fb.watch")) return false;
  if (path.startsWith("/sharer/sharer.php")) return true;
  if (path.startsWith("/share.php")) return true;
  if (path.includes("/share/")) return true;
  if (host.includes("fb.watch")) return true;
  if (path.includes("/permalink.php")) return true;
  return false;
}

function extractFacebookSharedTarget(url: URL): URL | null {
  const uParam = url.searchParams.get("u") || url.searchParams.get("url");
  if (!uParam) return null;
  try { return new URL(uParam); } catch { return null; }
}

// Node.js-native HTTP fetch (Cloud Functions don't have the browser fetch API in Node 18-,
// but Node 20 does. We use the built-in fetch if available, otherwise fall back to http/https.)
async function nodeFetch(
  urlStr: string,
  opts: { method?: string; headers?: Record<string, string>; timeoutMs?: number; redirect?: "follow" | "manual" } = {}
): Promise<{ ok: boolean; status: number; finalUrl: string; text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer>; headers: Map<string, string> }> {
  // Node 20 has globalThis.fetch — use it when available
  if (typeof globalThis.fetch === "function") {
    const controller = new AbortController();
    const tid = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
    try {
      const res = await (globalThis.fetch as typeof fetch)(urlStr, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        redirect: opts.redirect ?? "follow",
        signal: controller.signal,
      });
      if (tid) clearTimeout(tid);
      const headersMap = new Map<string, string>();
      res.headers.forEach((v, k) => headersMap.set(k.toLowerCase(), v));
      return {
        ok: res.ok,
        status: res.status,
        finalUrl: res.url || urlStr,
        text: () => res.text(),
        arrayBuffer: () => res.arrayBuffer(),
        headers: headersMap,
      };
    } catch (e) {
      if (tid) clearTimeout(tid);
      throw e;
    }
  }

  // Fallback: Node http/https
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const lib: typeof https | typeof http = parsedUrl.protocol === "https:" ? https : http;
    const reqOpts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: opts.method ?? "GET",
      headers: opts.headers ?? {},
    };
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const req = lib.request(reqOpts, (res) => {
      if (timeoutId) clearTimeout(timeoutId);
      const finalUrl = res.headers.location || urlStr;
      const headersMap = new Map<string, string>();
      for (const [k, v] of Object.entries(res.headers)) {
        if (v) headersMap.set(k.toLowerCase(), Array.isArray(v) ? v[0] : v);
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          finalUrl,
          text: async () => buf.toString("utf8"),
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          headers: headersMap,
        });
      });
      res.on("error", reject);
    });
    if (opts.timeoutMs) {
      timeoutId = setTimeout(() => { req.destroy(); reject(new Error("Timeout")); }, opts.timeoutMs);
    }
    req.on("error", reject);
    req.end();
  });
}

async function fetchTextWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; finalUrl: string; contentType: string; text: string }> {
  const res = await nodeFetch(url, { headers, timeoutMs });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.finalUrl,
    contentType: res.headers.get("content-type") || "",
    text,
  };
}

function isFacebookLoginUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("facebook.com") && (
      u.pathname.startsWith("/login") ||
      u.pathname.startsWith("/checkpoint") ||
      u.pathname.startsWith("/recover")
    );
  } catch { return false; }
}

/**
 * When Facebook redirects us to a login wall, the real destination post URL is
 * encoded in the `next` query parameter of the login URL.
 * Extract it and convert it to a usable embed permalink:
 *   /permalink.php?story_fbid=<fbid>&id=<page_id>  →  /<page_id>/posts/<fbid>/
 */
function extractPermalinkFromLoginRedirect(loginUrl: string): string | null {
  try {
    const u = new URL(loginUrl);
    if (!isFacebookLoginUrl(loginUrl)) return null;
    const next = u.searchParams.get("next");
    if (!next) return null;
    const nextUrl = new URL(next);
    if (!nextUrl.hostname.includes("facebook.com")) return null;

    // Case 1: /permalink.php?story_fbid=X&id=Y  →  /Y/posts/X/
    if (nextUrl.pathname.toLowerCase().includes("/permalink.php")) {
      const storyFbid = nextUrl.searchParams.get("story_fbid");
      const id = nextUrl.searchParams.get("id");
      if (storyFbid && id) {
        return `https://www.facebook.com/${id}/posts/${storyFbid}/`;
      }
    }

    // Case 1b: /story.php?story_fbid=X&id=Y  →  /Y/posts/X/
    if (nextUrl.pathname.toLowerCase().includes("/story.php")) {
      const storyFbid = nextUrl.searchParams.get("story_fbid");
      const id = nextUrl.searchParams.get("id");
      if (storyFbid && id) {
        return `https://www.facebook.com/${id}/posts/${storyFbid}/`;
      }
    }

    // Case 2: the next URL itself is already a usable permalink (not a /share/ or /login/)
    if (!nextUrl.pathname.includes("/share/") && !isFacebookLoginUrl(next)) {
      // Strip tracking params before returning
      nextUrl.searchParams.delete("rdid");
      nextUrl.searchParams.delete("share_url");
      return nextUrl.toString();
    }
  } catch { /* ignore */ }
  return null;
}

async function resolveFacebookShareUrl(targetUrl: URL, headers: Record<string, string>, timeoutMs: number): Promise<string | null> {
  const host = targetUrl.hostname.toLowerCase();
  const path = targetUrl.pathname.toLowerCase();

  if (host.includes("fb.watch")) {
    try {
      const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
      const finalUrl = res.finalUrl && res.finalUrl !== targetUrl.toString() ? res.finalUrl : null;
      if (finalUrl && !isFacebookLoginUrl(finalUrl)) return finalUrl;
      if (finalUrl && isFacebookLoginUrl(finalUrl)) {
        return extractPermalinkFromLoginRedirect(finalUrl);
      }
    } catch { /* ignore */ }
    return null;
  }

  if (!host.includes("facebook.com") || !path.includes("/share/")) return null;

  try {
    const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
    const finalUrl = res.finalUrl && res.finalUrl !== targetUrl.toString() ? res.finalUrl : null;

    // Happy path: resolved to a non-share, non-login URL
    if (finalUrl && !finalUrl.includes("/share/") && !isFacebookLoginUrl(finalUrl)) return finalUrl;

    // Login wall: extract the real destination from the `next` param
    if (finalUrl && isFacebookLoginUrl(finalUrl)) {
      const extracted = extractPermalinkFromLoginRedirect(finalUrl);
      if (extracted) return extracted;
      // Don't fall through to HTML parsing — we're on a login page, not the target
      return null;
    }

    // Still on a share URL or no redirect — try HTML parsing
    const text = await res.text();
    const ogUrl = text.match(/<meta\s+[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (ogUrl?.[1] && !ogUrl[1].includes("/share/")) {
      try {
        const resolved = new URL(ogUrl[1], targetUrl.toString()).toString();
        if (!isFacebookLoginUrl(resolved)) return resolved;
        const extracted = extractPermalinkFromLoginRedirect(resolved);
        if (extracted) return extracted;
      } catch { /* ignore */ }
    }
    const canonical = text.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i);
    if (canonical?.[1] && !canonical[1].includes("/share/")) {
      try {
        const resolved = new URL(canonical[1], targetUrl.toString()).toString();
        if (!isFacebookLoginUrl(resolved)) return resolved;
      } catch { /* ignore */ }
    }
    const jsRedirect = text.match(/window\.location\s*=\s*["']([^"']+)["']/i) || text.match(/location\.href\s*=\s*["']([^"']+)["']/i) || text.match(/"redirect_url"\s*:\s*"([^"]+)"/i);
    if (jsRedirect?.[1] && !jsRedirect[1].includes("/share/")) {
      try {
        const decoded = jsRedirect[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
        const resolved = new URL(decoded, targetUrl.toString()).toString();
        if (!isFacebookLoginUrl(resolved)) return resolved;
      } catch { /* ignore */ }
    }
  } catch { return null; }
  return null;
}

async function resolveRedditShortUrl(
  targetUrl: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{
  resolvedUrl: string | null;
  debugAttempts: Array<{
    phase: "manual" | "follow";
    method: "HEAD" | "GET";
    host: string;
    status?: number;
    location?: string | null;
    finalUrl?: string;
    ok: boolean;
  }>;
}> {
  const isShort = /\/s\/[a-zA-Z0-9]+/.test(targetUrl.pathname);
  if (!isShort) {
    return {
      resolvedUrl: null,
      debugAttempts: [],
    };
  }

  const redditBotHeaders: Record<string, string> = {
    ...headers,
    "user-agent": "Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)",
  };
  const facebookBotHeaders: Record<string, string> = {
    ...headers,
    "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  };

  const headerVariants: Array<{ host: "www.reddit.com" | "old.reddit.com"; headers: Record<string, string> }> = [
    { host: "www.reddit.com", headers },
    { host: "www.reddit.com", headers: redditBotHeaders },
    { host: "www.reddit.com", headers: facebookBotHeaders },
    { host: "old.reddit.com", headers },
    { host: "old.reddit.com", headers: redditBotHeaders },
    { host: "old.reddit.com", headers: facebookBotHeaders },
    {
      host: "www.reddit.com",
      headers: {
        "user-agent": "curl/8.0.1",
        accept: "*/*",
      },
    },
    {
      host: "old.reddit.com",
      headers: {
        "user-agent": "curl/8.0.1",
        accept: "*/*",
      },
    },
    { host: "www.reddit.com", headers: {} },
    { host: "old.reddit.com", headers: {} },
  ];

  const debugAttempts: Array<{
    phase: "manual" | "follow";
    method: "HEAD" | "GET";
    host: string;
    status?: number;
    location?: string | null;
    finalUrl?: string;
    ok: boolean;
  }> = [];

  for (const variant of headerVariants) {
    const candidateUrl = new URL(targetUrl.toString());
    candidateUrl.hostname = variant.host;

    for (const method of ["HEAD", "GET"] as const) {
      try {
        const res = await nodeFetch(candidateUrl.toString(), {
          method,
          headers: variant.headers,
          timeoutMs,
          redirect: "manual",
        });
        const location = res.headers.get("location");
        debugAttempts.push({
          phase: "manual",
          method,
          host: variant.host,
          status: res.status,
          location: location ?? null,
          finalUrl: res.finalUrl,
          ok: res.ok,
        });
        if (location) {
          return {
            resolvedUrl: new URL(location, candidateUrl.toString()).toString(),
            debugAttempts,
          };
        }
      } catch {
        debugAttempts.push({
          phase: "manual",
          method,
          host: variant.host,
          ok: false,
        });
        // try next variant
      }
    }

    try {
      const followed = await nodeFetch(candidateUrl.toString(), {
        method: "GET",
        headers: variant.headers,
        timeoutMs,
        redirect: "follow",
      });
      debugAttempts.push({
        phase: "follow",
        method: "GET",
        host: variant.host,
        status: followed.status,
        finalUrl: followed.finalUrl,
        ok: followed.ok,
      });
      if (followed.finalUrl && followed.finalUrl !== candidateUrl.toString()) {
        return {
          resolvedUrl: followed.finalUrl,
          debugAttempts,
        };
      }
    } catch {
      debugAttempts.push({
        phase: "follow",
        method: "GET",
        host: variant.host,
        ok: false,
      });
      // try next variant
    }
  }

  return {
    resolvedUrl: null,
    debugAttempts,
  };
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function* walkJson(node: unknown): Generator<unknown> {
  if (node === null || node === undefined) return;
  yield node;
  if (Array.isArray(node)) { for (const v of node) yield* walkJson(v); }
  else if (typeof node === "object") { for (const v of Object.values(node as Record<string, unknown>)) yield* walkJson(v); }
}

function extractInstagramCaptionFromJsonLd(html: string): string | undefined {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const block of blocks) {
    const m = block.match(/>\s*([\s\S]*?)\s*<\/script>/i);
    if (!m?.[1]) continue;
    const parsed = tryParseJson(m[1].trim());
    if (!parsed) continue;
    for (const node of walkJson(parsed)) {
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      const candidates = [obj["caption"], obj["articleBody"], obj["description"], obj["text"], obj["headline"], obj["name"]].filter((v) => typeof v === "string") as string[];
      for (const c of candidates) {
        const cleaned = cleanInstagramText(c);
        if (cleaned && cleaned.length >= 5) return cleaned;
      }
    }
  }
  return undefined;
}

function extractInstagramCaptionFromHtml(html: string): string | undefined {
  const patterns = [
    /"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/i,
    /"edge_media_to_caption"\s*:\s*\{[\s\S]*?"text"\s*:\s*"([^"]+)"/i,
    /"accessibility_caption"\s*:\s*"([^"]+)"/i,
    /"caption_text"\s*:\s*"([^"]+)"/i,
    /"sharing_friction_info"[\s\S]*?"bloks_app_url"\s*:\s*"([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const unescaped = m[1]
        .replace(/\\n/g, " ")
        .replace(/\\u003c/g, "<")
        .replace(/\\u003e/g, ">")
        .replace(/\\u0026/g, "&")
        .replace(/\\\//g, "/");
      const cleaned = cleanInstagramText(unescaped);
      if (cleaned && cleaned.length >= 5) return cleaned;
    }
  }
  return undefined;
}

function extractInstagramCaptionFromPageText(html: string): string | undefined {
  const normalized = decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return undefined;

  const patterns = [
    /(?:likes?,\s*\d+\s*comments?\s*-\s*)(.{30,500}?)(?:\s+more\b|\s+view all\b|\s+on instagram\b)/i,
    /(?:add a comment\.{0,3}\s+)(.{30,500}?)(?:\s+more\b|\s+view all\b|\s+on instagram\b)/i,
  ];

  for (const re of patterns) {
    const m = normalized.match(re);
    const candidate = cleanInstagramText(m?.[1]);
    if (candidate && candidate.length >= 20) return candidate;
  }

  return undefined;
}

function extractInstagramImageFromHtml(html: string): string | undefined {
  const metaMatch = html.match(
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)/i,
  );
  if (metaMatch?.[1]) {
    return decodeHtmlEntities(metaMatch[1]);
  }

  const imageCandidates = [
    ...html.matchAll(/https?:\/\/[^"'\s)]+cdninstagram\.com[^"'\s)]*/gi),
  ].map((match) => decodeHtmlEntities(match[0]));

  return imageCandidates.find((candidate) =>
    !candidate.includes("s150x150") && !candidate.includes("profile_pic") && !candidate.includes("Audio image"),
  ) || imageCandidates[0];
}

function extractPlainTextMetadata(text: string): {
  title?: string;
  description?: string;
} {
  const normalized = decodeHtmlEntities(text).replace(/\r/g, "").trim();
  if (!normalized) return {};

  const lines = normalized.split("\n").map((line) => line.trim());
  const titleLineIndex = lines.findIndex((line) => /^title:\s*/i.test(line));
  const rawTitle = titleLineIndex >= 0
    ? lines[titleLineIndex].replace(/^title:\s*/i, "").trim()
    : undefined;

  let descriptionLines = titleLineIndex >= 0 ? lines.slice(titleLineIndex + 1) : lines;
  while (descriptionLines[0] === "") {
    descriptionLines = descriptionLines.slice(1);
  }

  const description = descriptionLines
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    title: rawTitle || undefined,
    description: description || undefined,
  };
}

function cleanInstagramDerivedTitle(input?: string): string | undefined {
  if (!input) return undefined;

  let title = decodeHtmlEntities(input).trim();
  if (!title) return undefined;

  title = title.replace(/^.+? on instagram:\s*/i, "").trim();
  title = title.replace(/^['"\u201c\u2018]+/, "").trim();
  title = title.replace(/['"\u201d\u2019]+$/, "").trim();
  title = title.split(/\n+/)[0]?.trim() || title;

  return title || undefined;
}

async function fetchJinaSnapshot(targetUrl: URL, timeoutMs: number): Promise<{
  ok: boolean;
  status: number;
  finalUrl: string;
  text: string;
}> {
  const canonicalUrl = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, "/")}`;
  const variants = Array.from(new Set([
    `https://r.jina.ai/http://${targetUrl.hostname}${targetUrl.pathname}`,
    `https://r.jina.ai/${canonicalUrl}`,
    `https://r.jina.ai/http://${canonicalUrl}`,
    `https://r.jina.ai/${targetUrl.toString()}`,
    `https://r.jina.ai/http://${targetUrl.hostname}${targetUrl.pathname}${targetUrl.search}`,
    `https://r.jina.ai/http://${targetUrl.toString()}`,
  ]));

  let bestResponse: {
    ok: boolean;
    status: number;
    finalUrl: string;
    text: string;
  } | null = null;

  let bestScore = -1;

  for (const variant of variants) {
    try {
      const response = await fetchTextWithTimeout(variant, {}, timeoutMs);
      if (!response.ok || !response.text.trim()) {
        continue;
      }

      const plainTextMeta = extractPlainTextMetadata(response.text);
      const derivedTitle = cleanInstagramDerivedTitle(plainTextMeta.title);
      const score = [
        derivedTitle && !isGenericInstagramTitle(derivedTitle) ? 2 : 0,
        plainTextMeta.description && !isGenericInstagramDescription(plainTextMeta.description) ? 3 : 0,
      ].reduce((sum, value) => sum + value, 0);

      if (score > bestScore) {
        bestScore = score;
        bestResponse = response;
      }

      if (score >= 5) {
        return response;
      }
    } catch {
      // Try the next variant
    }
  }

  return bestResponse || {
    ok: false,
    status: 0,
    finalUrl: "",
    text: "",
  };
}

async function tryInstagramJson(targetUrl: URL): Promise<{ description?: string; image?: string } | null> {
  try {
    const base = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, "/")}`;
    const jsonUrl = `${base}?__a=1&__d=dis`;
    const res = await nodeFetch(jsonUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
      },
      timeoutMs: 10000,
    });
    if (!res.ok) return null;
    const data = tryParseJson(await res.text()) as Record<string, unknown> | null;
    if (!data) return null;
    const graphql = data["graphql"] as Record<string, unknown> | undefined;
    const items = data["items"] as unknown[] | undefined;
    const media = (graphql?.["shortcode_media"] ?? items?.[0]) as Record<string, unknown> | undefined;
    if (!media) return null;
    const edgeCaption = (media["edge_media_to_caption"] as Record<string, unknown> | undefined);
    const edges = edgeCaption?.["edges"] as unknown[] | undefined;
    const firstEdge = edges?.[0] as Record<string, unknown> | undefined;
    const firstNode = firstEdge?.["node"] as Record<string, unknown> | undefined;
    const captionObj = media["caption"] as Record<string, unknown> | undefined;
    const captionText = firstNode?.["text"] ?? captionObj?.["text"];
    const imageUrl = media["display_url"] ?? (media["image_versions2"] as Record<string, unknown> | undefined)?.["candidates"];
    return {
      description: typeof captionText === "string" ? captionText : undefined,
      image: typeof imageUrl === "string" ? imageUrl : undefined,
    };
  } catch { return null; }
}

async function tryInstagramOEmbed(targetUrl: URL): Promise<{ title?: string; description?: string; image?: string } | null> {
  try {
    const canonicalUrl = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, "/")}`;
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(canonicalUrl)}`;
    const res = await nodeFetch(oembedUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
      },
      timeoutMs: 10000,
    });
    if (!res.ok) return null;
    const data = tryParseJson(await res.text()) as Record<string, unknown> | null;
    if (!data) return null;

    const title = typeof data["author_name"] === "string"
      ? `Post by @${data["author_name"]}`
      : undefined;

    return {
      title,
      description: typeof data["title"] === "string" ? data["title"] : undefined,
      image: typeof data["thumbnail_url"] === "string" ? data["thumbnail_url"] : undefined,
    };
  } catch {
    return null;
  }
}

function buildInstagramMediaFallbackUrl(u: URL): string | null {
  const m = u.pathname.match(/\/(p|reel|reels|tv)\/([^/?#]+)/i);
  if (!m?.[1] || !m?.[2]) return null;
  return `https://www.instagram.com/p/${m[2]}/media/?size=l`;
}

// ---------------------------------------------------------------------------
// Main handler (shared between /api/unfurl and /api/proxy-image)
// ---------------------------------------------------------------------------

async function handleRequest(req: functions.https.Request, res: functions.Response<unknown>, fbAppId: string, fbAppSecret: string, threadsAppSecret: string): Promise<void> {
  // CORS — allow 4stash.com and localhost dev
  const origin = req.headers["origin"] as string | undefined;
  const allowedOrigins = ["https://4stash.com", "https://later-production-9a596.web.app", "http://localhost:5173", "http://localhost:4173", "capacitor://localhost"];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://4stash.com");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  const path = req.path;

  // POST routes
  if (req.method === "POST") {
    // -------------------------------------------------------------------------
    // /api/threads-token  — server-side Threads OAuth code exchange
    // Keeps the app secret out of the client bundle.
    // -------------------------------------------------------------------------
    if (path === "/threads-token" || path === "/api/threads-token") {
      const { code, redirectUri, appId } = req.body as { code?: string; redirectUri?: string; appId?: string };
      if (!code || !redirectUri || !appId) {
        res.status(400).json({ error: "Missing required fields: code, redirectUri, appId" }); return;
      }
      if (!threadsAppSecret) {
        res.status(500).json({ error: "Threads app secret not configured" }); return;
      }
      try {
        const params = new URLSearchParams({
          client_id: appId,
          client_secret: threadsAppSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        });
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
        const response = await (globalThis.fetch as typeof fetch)("https://graph.threads.net/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: params.toString(),
          signal: controller.signal,
        });
        clearTimeout(tid);
        const data = await response.json() as Record<string, unknown>;
        if (!response.ok) {
          res.status(400).json({ error: data["error_message"] ?? data["error"] ?? "Token exchange failed" }); return;
        }
        res.status(200).json(data);
      } catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Token exchange failed" });
      }
      return;
    }
    res.status(404).json({ error: "Not found" }); return;
  }

  // -------------------------------------------------------------------------
  // /api/proxy-image
  // -------------------------------------------------------------------------
  if (path === "/proxy-image" || path === "/api/proxy-image") {
    const target = req.query["url"] as string | undefined;
    if (!target) { res.status(400).json({ error: "Missing url param" }); return; }

    let targetUrl: URL;
    try { targetUrl = new URL(target); } catch { res.status(400).json({ error: "Invalid url param" }); return; }
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") { res.status(400).json({ error: "Only http/https URLs are allowed" }); return; }

    const h = targetUrl.hostname.toLowerCase();

    const isFbImg = h.endsWith("fbsbx.com") || h.endsWith("fbcdn.net") || h.includes("facebook.com");
    const isIgImg = h.includes("instagram.com");

    const imgHeaders: Record<string, string> = {
      "user-agent": isFbImg
        ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
        : isIgImg
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      ...(isFbImg ? { referer: "https://www.facebook.com/" } : {}),
      ...(isIgImg ? { referer: "https://www.instagram.com/" } : {}),
    };

    try {
      const upstream = await nodeFetch(targetUrl.toString(), { headers: imgHeaders, timeoutMs: 10000 });
      const contentType = upstream.headers.get("content-type") || "";
      if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
        res.status(422).json({ error: "Upstream did not return an image", status: upstream.status, contentType });
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength > 8 * 1024 * 1024) { res.status(413).json({ error: "Image too large" }); return; }
      res.status(200).setHeader("Content-Type", contentType).setHeader("Cache-Control", "public, max-age=3600").end(buf);
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error && e.message === "Timeout" ? "Upstream timeout" : "Proxy failed" });
    }
    return;
  }

  // -------------------------------------------------------------------------
  // /api/threads-token  — server-side Threads OAuth code exchange
  // Keeps the app secret out of the client bundle.
  // -------------------------------------------------------------------------
  if (path === "/threads-token" || path === "/api/threads-token") {
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
    const { code, redirectUri, appId } = req.body as { code?: string; redirectUri?: string; appId?: string };
    if (!code || !redirectUri || !appId) {
      res.status(400).json({ error: "Missing required fields: code, redirectUri, appId" }); return;
    }
    if (!threadsAppSecret) {
      res.status(500).json({ error: "Threads app secret not configured" }); return;
    }
    try {
      const params = new URLSearchParams({
        client_id: appId,
        client_secret: threadsAppSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });
      const tokenRes = await nodeFetch("https://graph.threads.net/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
        timeoutMs: 10000,
      });
      // nodeFetch doesn't support body for POST yet — use globalThis.fetch directly
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const response = await (globalThis.fetch as typeof fetch)("https://graph.threads.net/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: params.toString(),
        signal: controller.signal,
      });
      clearTimeout(tid);
      // suppress unused variable — nodeFetch call above was replaced
      void tokenRes;
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        res.status(400).json({ error: data["error_message"] ?? data["error"] ?? "Token exchange failed" }); return;
      }
      res.status(200).json(data);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Token exchange failed" });
    }
    return;
  }

  // -------------------------------------------------------------------------
  // /api/unfurl
  // -------------------------------------------------------------------------
  if (path !== "/unfurl" && path !== "/api/unfurl") {
    res.status(404).json({ error: "Not found" }); return;
  }

  const target = req.query["url"] as string | undefined;
  const debug = req.query["debug"] === "1";
  if (!target) { res.status(400).json({ error: "Missing url param" }); return; }

  let targetUrl: URL;
  try { targetUrl = new URL(target); } catch { res.status(400).json({ error: "Invalid url param" }); return; }
  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") { res.status(400).json({ error: "Only http/https URLs are allowed" }); return; }

  const headers: Record<string, string> = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };
  const facebookPreviewHeaders: Record<string, string> = {
    ...headers,
    "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  };

  const isFacebook = targetUrl.hostname.includes("facebook.com") || targetUrl.hostname.includes("fb.watch");
  if (isFacebook) {
    try {
      targetUrl = new URL(cleanFacebookUrl(targetUrl.toString()));
      if (isFacebookLoginUrl(targetUrl.toString())) {
        const next = targetUrl.searchParams.get("next") ?? target.match(/[?&]next=([^&]+)/)?.[1];
        if (next) {
          targetUrl = new URL(cleanFacebookUrl(decodeURIComponent(next)));
        }
      }
    } catch {
      // keep original targetUrl
    }
  }
  const isFacebookShare = isFacebook && isFacebookShareLike(targetUrl);

  // Keep a copy of the original share URL so we can return it if resolution fails / hits a login wall
  const originalShareUrl = isFacebookShare ? targetUrl.toString() : null;

  let shareResolvedUrl: string | null = null;
  if (isFacebookShare) {
    const extracted = extractFacebookSharedTarget(targetUrl);
    if (extracted) {
      shareResolvedUrl = extracted.toString();
      targetUrl = extracted;
    } else {
      const resolved = await resolveFacebookShareUrl(targetUrl, facebookPreviewHeaders, 10000);
      if (resolved) {
        shareResolvedUrl = resolved;
        try { targetUrl = new URL(resolved); } catch { /* keep original */ }
      }
    }
  }

  // If after resolution we ended up on a login/checkpoint page, bail out early.
  // Return the original share URL so the client keeps the short URL (which isFacebookShortShareUrl() handles).
  if (isFacebook && isFacebookLoginUrl(targetUrl.toString())) {
    res.status(200).setHeader("Cache-Control", "no-store").json({
      url: originalShareUrl ?? targetUrl.toString(),
      contentType: "",
      status: 0,
      title: undefined,
      description: undefined,
      image: undefined,
      shareResolvedUrl: null,
      ...(debug ? { debug: { loginWall: true } } : {}),
    });
    return;
  }

  let primary = await fetchTextWithTimeout(targetUrl.toString(), isFacebookShare ? facebookPreviewHeaders : headers, 10000);
  if (isFacebook && !primary.ok) {
    const cleanedFacebookUrl = cleanFacebookUrl(targetUrl.toString());
    if (cleanedFacebookUrl !== targetUrl.toString()) {
      try {
        primary = await fetchTextWithTimeout(cleanedFacebookUrl, facebookPreviewHeaders, 10000);
        targetUrl = new URL(cleanedFacebookUrl);
      } catch {
        // keep original failed response
      }
    }
  }
  let finalUrl = primary.finalUrl;
  const contentType = primary.contentType;
  const meta = extractMetadata(primary.text);
  let redditShortUnresolved = false;

  const attempts: Record<string, unknown> = {
    primary: { ok: primary.ok, status: primary.status, contentType },
    shareResolve: { attempted: isFacebookShare, url: shareResolvedUrl },
    instagramJson: { attempted: false, ok: false },
    instagramOembed: { attempted: false, ok: false },
    jina: { attempted: false, ok: false },
    fallbackMediaUrl: { attempted: false, used: false },
    facebookJina: { attempted: false, ok: false },
    redditJson: { attempted: false, ok: false },
    redditResolve: { attempted: false, ok: false },
    redditJina: { attempted: false, ok: false },
    threadsJina: { attempted: false, ok: false },
  };

  // Instagram
  const isInstagram = targetUrl.hostname.includes("instagram.com");
  if (isInstagram && isInstagramLoginUrl(finalUrl)) {
    finalUrl = targetUrl.toString();
  }
    if (isInstagram && (isGenericInstagramTitle(meta.title) || !meta.image || !meta.description)) {
      if (!meta.description || isGenericInstagramDescription(meta.description)) {
        const fromLd = extractInstagramCaptionFromJsonLd(primary.text);
        const fromHtml = extractInstagramCaptionFromHtml(primary.text);
        const fromPageText = extractInstagramCaptionFromPageText(primary.text);
        meta.description = cleanInstagramText(fromLd || fromHtml || fromPageText || meta.description) || meta.description;
      } else {
        meta.description = cleanInstagramText(meta.description) || meta.description;
      }
    attempts["instagramJson"] = { attempted: true, ok: false };
    const ig = await tryInstagramJson(targetUrl);
    (attempts["instagramJson"] as Record<string, unknown>)["ok"] = !!ig;
    if (ig?.description && (!meta.description || isGenericInstagramDescription(meta.description))) {
      meta.description = cleanInstagramText(ig.description) || ig.description;
    }
    if (ig?.image && !meta.image) meta.image = ig.image;
    attempts["instagramOembed"] = { attempted: true, ok: false };
    const igOembed = await tryInstagramOEmbed(targetUrl);
    (attempts["instagramOembed"] as Record<string, unknown>)["ok"] = !!igOembed;
    if (igOembed?.description && (!meta.description || isGenericInstagramDescription(meta.description))) {
      meta.description = cleanInstagramText(igOembed.description) || igOembed.description;
    }
    if (igOembed?.image && !meta.image) meta.image = igOembed.image;
    if (!meta.title && igOembed?.title && !isGenericInstagramTitle(igOembed.title)) {
      meta.title = igOembed.title;
    }
    if (isGenericInstagramTitle(meta.title)) meta.title = undefined;

      if (!meta.image || !meta.description) {
        attempts["jina"] = { attempted: true, ok: false };
        const proxied = await fetchJinaSnapshot(targetUrl, 10000);
        (attempts["jina"] as Record<string, unknown>)["ok"] = proxied.ok;
        const proxyMeta = extractMetadata(proxied.text);
        const proxyTextMeta = extractPlainTextMetadata(proxied.text);
        const derivedTitle = cleanInstagramDerivedTitle(proxyTextMeta.title);

        if (!meta.title && proxyMeta.title && !isGenericInstagramTitle(proxyMeta.title)) {
          meta.title = proxyMeta.title;
        }
        if (!meta.title && derivedTitle && !isGenericInstagramTitle(derivedTitle)) {
          meta.title = derivedTitle;
        }
        if (!meta.description && proxyMeta.description) {
          meta.description = cleanInstagramText(proxyMeta.description) || proxyMeta.description;
        }
        if (!meta.description && proxyTextMeta.description) {
          meta.description = cleanInstagramText(proxyTextMeta.description) || proxyTextMeta.description;
        }
        if (!meta.image && proxyMeta.image) meta.image = proxyMeta.image;
        if (!meta.description) {
          const proxyLd = extractInstagramCaptionFromJsonLd(proxied.text);
          const proxyHtml = extractInstagramCaptionFromHtml(proxied.text);
          const proxyPageText = extractInstagramCaptionFromPageText(proxied.text);
          meta.description = cleanInstagramText(proxyLd || proxyHtml || proxyPageText) || meta.description;
        }
        if (!meta.image) {
          meta.image = extractInstagramImageFromHtml(proxied.text) || meta.image;
        }
      }
    if (!meta.image) {
      attempts["fallbackMediaUrl"] = { attempted: true, used: false };
      const fallback = buildInstagramMediaFallbackUrl(targetUrl);
      if (fallback) { meta.image = fallback; (attempts["fallbackMediaUrl"] as Record<string, unknown>)["used"] = true; }
    }
  }

  const isFacebookHost = targetUrl.hostname.includes("facebook.com") || targetUrl.hostname.includes("fb.watch");

  // For Facebook we run all fallback enrichment attempts in parallel so the
  // total wait is bounded by the slowest single attempt rather than the sum of
  // all attempts.  Each helper resolves to a partial meta object; we merge them
  // in priority order afterwards.
  if (isFacebookHost) {
    // Clear generic Facebook error titles so fallback attempts can replace them
    if (isGenericFacebookTitle(meta.title)) meta.title = undefined;

    type PartialMeta = { title?: string; description?: string; image?: string };

    // ── Helper A: mbasic.facebook.com scrape ────────────────────────────────
    const mbasicPromise: Promise<PartialMeta> = (async () => {
      if (meta.image) return {}; // already have image — skip
      try {
        const mbasicUrl = new URL(targetUrl.toString());
        mbasicUrl.hostname = "mbasic.facebook.com";
        const mbasicRes = await fetchTextWithTimeout(mbasicUrl.toString(), facebookPreviewHeaders, 8000);
        if (!mbasicRes.ok) return {};
        const mbasicMeta = extractMetadata(mbasicRes.text);
        const result: PartialMeta = {};
        if (mbasicMeta.image) {
          result.image = mbasicMeta.image;
        } else {
          // Scan raw <img> tags as a last resort, skipping CDN/emoji/reaction assets
          const imgMatches = mbasicRes.text.match(/<img\s[^>]*src=["']([^"']+)["'][^>]*>/gi) ?? [];
          for (const imgTag of imgMatches) {
            const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
            if (!srcMatch?.[1]) continue;
            const src = srcMatch[1];
            if (
              src.includes("static.xx.fbcdn") ||
              src.includes("emoji") ||
              src.includes("reaction") ||
              src.includes("rsrc.php")
            ) continue;
            if (src.startsWith("https://")) { result.image = src; break; }
          }
        }
        if (mbasicMeta.title && !isGenericFacebookTitle(mbasicMeta.title)) result.title = mbasicMeta.title;
        if (mbasicMeta.description) result.description = mbasicMeta.description;
        return result;
      } catch { return {}; }
    })();

    // ── Helper B: Graph API /{videoId}?fields=picture ───────────────────────
    const fbVideoId = extractFacebookVideoId(targetUrl.toString());
    const isVideoUrl = isFacebookVideoUrl(targetUrl.toString());
    const appId: string = fbAppId;
    const appSecret: string = fbAppSecret;
    const accessToken = appId && appSecret ? `${appId}|${appSecret}` : "";

    const graphPromise: Promise<PartialMeta> = (async () => {
      if (!fbVideoId || !accessToken) return {};
      attempts["facebookGraphVideo"] = { attempted: true, ok: false, videoId: fbVideoId };
      try {
        const graphUrl = `https://graph.facebook.com/v19.0/${fbVideoId}?fields=picture,description,from{name}&access_token=${encodeURIComponent(accessToken)}`;
        const graphRes = await nodeFetch(graphUrl, { headers: { accept: "application/json" }, timeoutMs: 8000 });
        if (!graphRes.ok) return {};
        const graphData = tryParseJson(await graphRes.text()) as Record<string, unknown> | null;
        if (!graphData) return {};
        (attempts["facebookGraphVideo"] as Record<string, unknown>)["ok"] = true;
        const result: PartialMeta = {};
        if (graphData["picture"] && typeof graphData["picture"] === "string") result.image = graphData["picture"];
        if (graphData["description"] && typeof graphData["description"] === "string") result.description = graphData["description"];
        const from = graphData["from"] as Record<string, unknown> | undefined;
        if (from?.["name"] && typeof from["name"] === "string") result.title = from["name"];
        return result;
      } catch { return {}; }
    })();

    // ── Helper C: oEmbed ────────────────────────────────────────────────────
    const oembedEndpoints = isVideoUrl ? ["oembed_video", "oembed_post"] : ["oembed_post"];
    const oembedPromises: Promise<PartialMeta>[] = oembedEndpoints.map((endpoint) => (async () => {
      if (!accessToken) return {};
      const attemptKey = endpoint === "oembed_video" ? "facebookOembedVideo" : "facebookOembed";
      attempts[attemptKey] = { attempted: true, ok: false };
      try {
        const oembedUrl = `https://graph.facebook.com/v19.0/${endpoint}?url=${encodeURIComponent(targetUrl.toString())}&access_token=${encodeURIComponent(accessToken)}&fields=author_name,author_url,provider_name,provider_url,type,width,height,html,thumbnail_url,thumbnail_width,thumbnail_height`;
        const oembedRes = await nodeFetch(oembedUrl, { headers: { accept: "application/json" }, timeoutMs: 8000 });
        if (!oembedRes.ok) return {};
        const oembedData = tryParseJson(await oembedRes.text()) as Record<string, unknown> | null;
        if (!oembedData) return {};
        (attempts[attemptKey] as Record<string, unknown>)["ok"] = true;
        const result: PartialMeta = {};
        if (oembedData["thumbnail_url"] && typeof oembedData["thumbnail_url"] === "string") result.image = oembedData["thumbnail_url"];
        if (oembedData["author_name"]) result.title = decodeHtmlEntities(oembedData["author_name"] as string);
        else if (oembedData["html"]) {
          const textMatch = (oembedData["html"] as string).match(/>([^<]+)</);
          if (textMatch?.[1]) result.title = decodeHtmlEntities(textMatch[1].trim());
        }
        if (oembedData["html"]) {
          const descText = (oembedData["html"] as string)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (descText) result.description = decodeHtmlEntities(descText);
        }
        return result;
      } catch { return {}; }
    })());

    // ── Helper D: plugins/video.php embed page ───────────────────────────────
    const embedPagePromise: Promise<PartialMeta> = (async () => {
      if (!isVideoUrl) return {};
      attempts["facebookEmbedPage"] = { attempted: true, ok: false };
      try {
        const embedPageUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(targetUrl.toString())}`;
        const embedRes = await fetchTextWithTimeout(embedPageUrl, facebookPreviewHeaders, 8000);
        if (!embedRes.ok) return {};
        (attempts["facebookEmbedPage"] as Record<string, unknown>)["ok"] = true;
        const embedMeta = extractMetadata(embedRes.text);
        const result: PartialMeta = {};
        if (embedMeta.image) {
          result.image = embedMeta.image;
        } else {
          const posterMatch = embedRes.text.match(/poster=["']([^"']+)["']/i);
          if (posterMatch?.[1]) result.image = decodeHtmlEntities(posterMatch[1]);
          else {
            const bgImgMatch = embedRes.text.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
            if (bgImgMatch?.[1]) result.image = decodeHtmlEntities(bgImgMatch[1]);
          }
        }
        return result;
      } catch { return {}; }
    })();

    // ── Helper E: Jina AI proxy ──────────────────────────────────────────────
    const jinaPromise: Promise<PartialMeta> = (async () => {
      attempts["facebookJina"] = { attempted: true, ok: false };
      try {
        const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
        const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
        (attempts["facebookJina"] as Record<string, unknown>)["ok"] = proxied.ok;
        const fbMeta = extractMetadata(proxied.text);
        const result: PartialMeta = {};
        if (fbMeta.title && !isGenericFacebookTitle(fbMeta.title)) result.title = fbMeta.title;
        if (fbMeta.description) result.description = fbMeta.description;
        if (fbMeta.image) result.image = fbMeta.image;
        return result;
      } catch { return {}; }
    })();

    // ── Run all helpers in parallel, then merge ──────────────────────────────
    // Priority: primary HTML fetch (already in meta) > mbasic > Graph API > oEmbed (video first) > embed page > Jina
    const [mbasicResult, graphResult, ...oembedResults] = await Promise.all([
      mbasicPromise,
      graphPromise,
      ...oembedPromises,
      embedPagePromise,
      jinaPromise,
    ]);
    const embedPageResult = oembedResults[oembedResults.length - 2] ?? {};
    const jinaResult = oembedResults[oembedResults.length - 1] ?? {};
    const oembedMerged = oembedResults.slice(0, oembedResults.length - 2);

    for (const result of [mbasicResult, graphResult, ...oembedMerged, embedPageResult, jinaResult]) {
      if (!meta.image && result.image) meta.image = result.image;
      if (!meta.title && result.title) meta.title = result.title;
      if (!meta.description && result.description) meta.description = result.description;
    }

    // Replace any generic Facebook error title with a meaningful fallback
    if (isGenericFacebookTitle(meta.title)) {
      meta.title = getFacebookFallbackTitle(targetUrl.toString());
    }

    // Early return if Facebook still has nothing
    if (!meta.title && !meta.description && !meta.image) {
      const fallbackTitle = getFacebookFallbackTitle(targetUrl.toString());
      res.status(200).setHeader("Cache-Control", "no-store").json({
        url: targetUrl.toString(), contentType, status: primary.status,
        title: fallbackTitle, description: undefined, image: undefined,
        shareResolvedUrl,
        ...(debug ? { debug: { attempts } } : {}),
      });
      return;
    }
  }

  // Reddit
  const isReddit = targetUrl.hostname.includes("reddit.com") || targetUrl.hostname.includes("redd.it");
  if (isReddit) {
    const originalRedditShort = /\/s\/[a-zA-Z0-9]+/.test(targetUrl.pathname);
    // Resolve Reddit /s/CODE mobile share URLs before trying .json.
    attempts["redditResolve"] = { attempted: originalRedditShort, ok: false, resolvedUrl: null };
    const redditResolveResult = await resolveRedditShortUrl(targetUrl, headers, 8000);
    const redditResolved = redditResolveResult.resolvedUrl;
    if (redditResolved) {
      try {
        const resolvedUrl = new URL(redditResolved);
        targetUrl = resolvedUrl;
        finalUrl = cleanRedditUrl(resolvedUrl.toString());
        targetUrl = new URL(finalUrl);
        attempts["redditResolve"] = {
          attempted: true,
          ok: true,
          resolvedUrl: finalUrl,
          steps: redditResolveResult.debugAttempts,
        };
      } catch {
        // keep original targetUrl
      }
    } else if (originalRedditShort) {
      attempts["redditResolve"] = {
        attempted: true,
        ok: false,
        resolvedUrl: null,
        steps: redditResolveResult.debugAttempts,
      };
    }
    if (originalRedditShort && !targetUrl.pathname.includes("/comments/")) {
      redditShortUnresolved = true;
    }

    attempts["redditJson"] = { attempted: true, ok: false };
    try {
      const redditJsonUrl = new URL(targetUrl.toString());
      redditJsonUrl.search = "";
      redditJsonUrl.hash = "";
      if (!redditJsonUrl.pathname.endsWith("/")) redditJsonUrl.pathname += "/";
      const jsonUrl = redditJsonUrl.toString() + ".json";
      const redditHeaders = { ...headers, "user-agent": "Mozilla/5.0 (compatible; 4Stash/1.0; +https://4stash.com)" };
      const jsonRes = await fetchTextWithTimeout(jsonUrl, redditHeaders, 8000);
      (attempts["redditJson"] as Record<string, unknown>)["ok"] = jsonRes.ok;
      if (jsonRes.ok) {
        const data = tryParseJson(jsonRes.text) as unknown[] | null;
        const post = (data as unknown[])?.[0] as Record<string, unknown> | undefined;
        const postData = post?.["data"] as Record<string, unknown> | undefined;
        const children = postData?.["children"] as unknown[] | undefined;
        const firstChild = children?.[0] as Record<string, unknown> | undefined;
        const p = firstChild?.["data"] as Record<string, unknown> | undefined;
        if (p) {
          if (p["over_18"] === true || p["over18"] === true) {
            const nsfwTitle = p["title"] ? decodeHtmlEntities(p["title"] as string) : "NSFW Reddit Post";
            res.status(200).setHeader("Cache-Control", "no-store").json({
              url: targetUrl.toString(), contentType, status: primary.status,
              title: nsfwTitle, description: "This Reddit post is marked as NSFW (18+)", image: undefined, nsfw: true,
              ...(debug ? { debug: { attempts } } : {}),
            });
            return;
          }
          if (!meta.title && p["title"]) meta.title = decodeHtmlEntities(p["title"] as string);
          if (!meta.description && p["selftext"]) meta.description = decodeHtmlEntities((p["selftext"] as string).replace(/\n+/g, " ").trim().substring(0, 300));
          if (!meta.image) {
            const preview = p["preview"] as Record<string, unknown> | undefined;
            const images = preview?.["images"] as unknown[] | undefined;
            const firstImg = images?.[0] as Record<string, unknown> | undefined;
            const source = firstImg?.["source"] as Record<string, unknown> | undefined;
            if (source?.["url"]) meta.image = decodeHtmlEntities(source["url"] as string).replace(/&amp;/g, "&");
            else if (p["thumbnail"] && (p["thumbnail"] as string).startsWith("http")) meta.image = p["thumbnail"] as string;
            else if (p["url"] && ((p["url"] as string).match(/\.(jpg|jpeg|png|gif|webp)$/i) || p["post_hint"] === "image")) meta.image = p["url"] as string;
          }
        }
      }
    } catch { /* Reddit JSON failed */ }

    // Reddit oEmbed — works server-side and returns the real post title.
    // Try this before Jina since it's more reliable.
    if (!meta.title) {
      attempts["redditOembed"] = { attempted: true, ok: false };
      try {
        const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`;
        const oembedRes = await fetchTextWithTimeout(oembedUrl, {
          ...headers,
          accept: "application/json",
        }, 8000);
        (attempts["redditOembed"] as Record<string, unknown>)["ok"] = oembedRes.ok;
        if (oembedRes.ok) {
          const oembedData = tryParseJson(oembedRes.text) as Record<string, unknown> | null;
          if (oembedData?.["title"] && typeof oembedData["title"] === "string") {
            const t = decodeHtmlEntities(oembedData["title"]);
            if (!isGenericRedditTitle(t)) meta.title = t;
          }
          if (!meta.title && oembedData?.["author_name"] && typeof oembedData["author_name"] === "string") {
            meta.title = `Post by u/${oembedData["author_name"]}`;
          }
        }
      } catch { /* ignore */ }
    }

    if (!meta.title || !meta.description || !meta.image) {
      attempts["redditJina"] = { attempted: true, ok: false };
      try {
        const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
        const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
        (attempts["redditJina"] as Record<string, unknown>)["ok"] = proxied.ok;
        const redditMeta = extractMetadata(proxied.text);
        if (!meta.title && redditMeta.title) meta.title = redditMeta.title;
        if (!meta.description && redditMeta.description) meta.description = redditMeta.description;
        if (!meta.image && redditMeta.image) meta.image = redditMeta.image;
      } catch { /* ignore */ }
    }

    // If title is still a generic error string (e.g. "403" from the error page HTML),
    // clear it so the client falls back to its own "Reddit Post in r/..." label.
    if (isGenericRedditTitle(meta.title)) meta.title = undefined;
  }

  // Threads
  const isThreads = targetUrl.hostname.includes("threads.com") || targetUrl.hostname.includes("threads.net");
  if (isThreads && (!meta.title || !meta.description || !meta.image)) {
    attempts["threadsJina"] = { attempted: true, ok: false };
    try {
      const threadsHeaders: Record<string, string> = {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      };
      const threadsRes = await fetchTextWithTimeout(targetUrl.toString(), threadsHeaders, 10000);
      (attempts["threadsJina"] as Record<string, unknown>)["ok"] = threadsRes.ok;
      if (threadsRes.ok) {
        const threadsMeta = extractMetadata(threadsRes.text);
        if (threadsMeta.title && threadsMeta.title !== "403") meta.title = threadsMeta.title;
        if (threadsMeta.description) meta.description = threadsMeta.description;
        if (threadsMeta.image) meta.image = threadsMeta.image;
      }
    } catch { /* ignore */ }
  }

  const image = meta.image ? new URL(meta.image, finalUrl).toString() : undefined;
  const proxiedImage = (() => {
    if (!image) return undefined;
    try {
      const host = new URL(image).hostname;
      return shouldProxyImageHost(host) ? `/api/proxy-image?url=${encodeURIComponent(image)}` : image;
    } catch { return image; }
  })();

  res.status(200).setHeader("Cache-Control", "no-store").json({
    url: finalUrl, contentType, status: primary.status,
    title: meta.title, description: meta.description, image: proxiedImage,
    redditShortUnresolved,
    ...(debug ? { debug: { isInstagram, attempts, extracted: { hasTitle: !!meta.title, hasDescription: !!meta.description, hasImage: !!meta.image } } } : {}),
  });
}

// ---------------------------------------------------------------------------
// Exported Cloud Function
// ---------------------------------------------------------------------------

export const api = functions
  .runWith({ timeoutSeconds: 30, memory: "256MB", secrets: ["FB_APP_ID", "FB_APP_SECRET", "THREADS_APP_SECRET"] })
  .https.onRequest(async (req, res) => {
    await handleRequest(req, res, FB_APP_ID.value(), FB_APP_SECRET.value(), THREADS_APP_SECRET.value());
  });

export const home = functions
  .runWith({ timeoutSeconds: 10, memory: "128MB" })
  .https.onRequest(async (req, res) => {
    await handleHomeRequest(req, res);
  });
