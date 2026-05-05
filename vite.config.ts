import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

function decodeHtmlEntities(input: string): string {
  return input
    // Numeric hex entities: &#x62e; or &#X62E;
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    // Numeric decimal entities: &#1575;
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
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

  // Some proxies return key/value text like "og:title: ..." instead of HTML meta tags
  if (!title || !descriptionFromOg || !imageFromOg) {
    const lines = html.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(
        /^\s*(og:title|twitter:title|title)\s*:\s*(.+)\s*$/i,
      );
      if (m && !title) {
        title = decodeHtmlEntities(m[2].trim());
        continue;
      }
      const d = line.match(
        /^\s*(og:description|twitter:description|description)\s*:\s*(.+)\s*$/i,
      );
      if (d && !descriptionFromOg) {
        map.set(d[1].toLowerCase(), decodeHtmlEntities(d[2].trim()));
        continue;
      }
      const i = line.match(
        /^\s*(og:image|twitter:image)\s*:\s*(https?:\/\/\S+)/i,
      );
      if (i && !imageFromOg) {
        map.set(i[1].toLowerCase(), i[2].trim());
      }
    }
  }

  const description =
    descriptionFromOg ||
    map.get("og:description") ||
    map.get("twitter:description") ||
    map.get("description");
  const image =
    imageFromOg ||
    map.get("og:image:secure_url") ||
    map.get("og:image:url") ||
    map.get("og:image") ||
    map.get("twitter:image");

  return {
    title,
    description,
    image,
  };
}

function isGenericInstagramTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "instagram") return true;
  if (t.includes("403")) return true;
  if (t.includes("forbidden")) return true;
  if (t.includes("access denied")) return true;
  if (t.includes("not available")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
    return true;
  if (t === "instagram • photos and videos") return true;
  return false;
}

function cleanInstagramText(input?: string): string | undefined {
  if (!input) return undefined;
  let t = decodeHtmlEntities(input).replace(/\s+/g, " ").trim();
  if (!t) return undefined;

  // Remove common "Likes/Comments" prefix
  t = t.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, "").trim();
  t = t.replace(/^\d+\s+likes,\s+\d+\s+comments\s+-\s+/i, "").trim();
  return t || undefined;
}

function isGenericInstagramDescription(desc?: string): boolean {
  const d = (desc ?? "").trim().toLowerCase();
  if (!d) return true;
  if (d.includes("log in") || d.includes("login") || d.includes("sign up"))
    return true;
  if (d.includes("instagram")) return false; // captions often mention instagram; don't discard
  return false;
}

function isGenericFacebookTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "403") return true;
  if (t === "error") return true;
  if (t === "error facebook") return true;
  if (t === "facebook") return true;
  if (t.includes("403")) return true;
  if (t.includes("forbidden")) return true;
  if (t.includes("access denied")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
    return true;
  if (t.includes("not available") || t.includes("content not found"))
    return true;
  if (t.includes("something went wrong")) return true;
  return false;
}

function isGenericRedditTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "reddit") return true;
  if (t === "reddit - the heart of the internet") return true;
  if (t === "reddit \u2013 the heart of the internet") return true;
  if (t === "403" || t === "error" || t === "forbidden") return true;
  if (t.includes("403") || t.includes("forbidden") || t.includes("access denied")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up")) return true;
  if (t.includes("not found") || t.includes("unavailable") || t.includes("not available")) return true;
  if (t.includes("something went wrong")) return true;
  if (t.includes("whoa there")) return true;
  return false;
}

function shouldProxyImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    // Instagram CDN images are CORP-protected in browsers; proxy them with an
    // Instagram referer so they render inside our app origin.
    h.includes("instagram.com") ||
    h.endsWith("fbcdn.net") ||
    h.includes("facebook.com") ||
    h.endsWith("twimg.com") ||
    // Facebook crawler thumbnails often come from lookaside.fbsbx.com and are CORP-protected.
    // Proxying them makes them render reliably in our UI.
    h.endsWith("fbsbx.com")
  );
}

function extractXStatusId(url: URL): string | null {
  const match = url.pathname.match(/\/status\/(\d+)/);
  return match?.[1] ?? null;
}

function extractTwitterSyndicationMeta(jsonText: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  try {
    const data = JSON.parse(jsonText) as {
      text?: string;
      user?: { screen_name?: string; name?: string };
      photos?: Array<{ url?: string; expanded_url?: string }>;
      mediaDetails?: Array<{ media_url_https?: string; media_url?: string; type?: string }>;
      video?: { poster?: string };
      card?: {
        binding_values?: Record<string, {
          image_value?: { url?: string };
          string_value?: string;
        }>;
      };
    };

    const screenName = data.user?.screen_name?.trim();
    const displayName = data.user?.name?.trim();
    const title = screenName
      ? `Tweet by @${screenName}`
      : displayName
        ? `Tweet by ${displayName}`
        : undefined;
    const description = typeof data.text === "string"
      ? decodeHtmlEntities(data.text).replace(/\s+/g, " ").trim() || undefined
      : undefined;

    const bindingValues = data.card?.binding_values ?? {};
    const image = data.photos?.find((photo) => typeof photo.url === "string")?.url
      || data.mediaDetails?.find((media) => typeof media.media_url_https === "string")?.media_url_https
      || data.mediaDetails?.find((media) => typeof media.media_url === "string")?.media_url
      || data.video?.poster
      || bindingValues.thumbnail_image_original?.image_value?.url
      || bindingValues.thumbnail_image_x_large?.image_value?.url
      || bindingValues.thumbnail_image_large?.image_value?.url
      || bindingValues.thumbnail_image?.image_value?.url
      || bindingValues.thumbnail_image_small?.image_value?.url;

    return {
      title,
      description,
      image,
    };
  } catch {
    return {};
  }
}

function isFacebookShareLike(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (!host.includes("facebook.com") && !host.includes("fb.watch"))
    return false;
  if (path.startsWith("/sharer/sharer.php")) return true;
  if (path.startsWith("/share.php")) return true;
  if (path.includes("/share/")) return true;
  if (host.includes("fb.watch")) return true;
  if (path.includes("/permalink.php")) return true;
  return false;
}

function isFacebookLoginUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.hostname.includes("facebook.com") && (
      u.pathname.startsWith("/login") ||
      u.pathname.startsWith("/checkpoint") ||
      u.pathname.startsWith("/recover")
    );
  } catch { return false; }
}

function extractPermalinkFromLoginRedirect(loginUrl: string): string | null {
  try {
    if (!isFacebookLoginUrl(loginUrl)) return null;
    const u = new URL(loginUrl);
    const next = u.searchParams.get("next");
    if (!next) return null;
    const nextUrl = new URL(next);
    if (!nextUrl.hostname.includes("facebook.com")) return null;
    if (nextUrl.pathname.toLowerCase().includes("/permalink.php")) {
      const storyFbid = nextUrl.searchParams.get("story_fbid");
      const id = nextUrl.searchParams.get("id");
      if (storyFbid && id) {
        return `https://www.facebook.com/${id}/posts/${storyFbid}/`;
      }
    }
    if (!nextUrl.pathname.includes("/share/") && !isFacebookLoginUrl(next)) {
      nextUrl.searchParams.delete("rdid");
      nextUrl.searchParams.delete("share_url");
      return nextUrl.toString();
    }
  } catch { /* ignore */ }
  return null;
}

function extractFacebookSharedTarget(url: URL): URL | null {
  const uParam = url.searchParams.get("u") || url.searchParams.get("url");
  if (!uParam) return null;
  try {
    return new URL(uParam);
  } catch {
    return null;
  }
}

async function followRedirectsWithHeadThenGet(
  startUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
  limit: number = 5,
): Promise<string> {
  let current = startUrl;
  for (let i = 0; i < limit; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const headRes = await fetch(current, {
        method: "HEAD",
        redirect: "follow",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const finalHeadUrl = headRes.url || current;
      if (finalHeadUrl !== current) {
        current = finalHeadUrl;
        continue;
      }
      if (headRes.ok) return finalHeadUrl;
    } catch {
      // ignore and fallback to GET
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const getRes = await fetch(current, {
        method: "GET",
        redirect: "follow",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const finalGetUrl = getRes.url || current;
      if (finalGetUrl !== current) {
        current = finalGetUrl;
        continue;
      }
      return finalGetUrl;
    } catch {
      return current;
    }
  }
  return current;
}

async function resolveRedditShortUrl(
  targetUrl: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<string | null> {
  const isShort = /\/s\/[a-zA-Z0-9]+/.test(targetUrl.pathname);
  if (!isShort) return null;

  const headerVariants: Record<string, string>[] = [
    headers,
    {
      "user-agent": "curl/8.0.1",
      accept: "*/*",
    },
    {},
  ];

  for (const h of headerVariants) {
    for (const method of ["HEAD", "GET"] as const) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(targetUrl.toString(), {
          method,
          redirect: "manual",
          headers: h,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const location = res.headers.get("location");
        if (location) {
          return new URL(location, targetUrl.toString()).toString();
        }
      } catch {
        // try next variant
      }
    }

    try {
      const followed = await followRedirectsWithHeadThenGet(
        targetUrl.toString(),
        h,
        timeoutMs,
        3,
      );
      if (followed !== targetUrl.toString()) return followed;
    } catch {
      // try next variant
    }
  }

  return null;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function* walkJson(node: unknown): Generator<unknown> {
  if (node === null || node === undefined) return;
  yield node;
  if (Array.isArray(node)) {
    for (const v of node) yield* walkJson(v);
  } else if (typeof node === "object") {
    for (const v of Object.values(node)) yield* walkJson(v);
  }
}

function extractInstagramCaptionFromJsonLd(html: string): string | undefined {
  const blocks =
    html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ) ?? [];
  for (const block of blocks) {
    const m = block.match(/>\s*([\s\S]*?)\s*<\/script>/i);
    if (!m?.[1]) continue;
    const raw = m[1].trim();
    const parsed = tryParseJson(raw);
    if (!parsed) continue;

    for (const node of walkJson(parsed)) {
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;

      const candidates = [
        obj.caption,
        obj.articleBody,
        obj.description,
        obj.text,
        obj.headline,
        obj.name,
      ].filter((v) => typeof v === "string") as string[];

      for (const c of candidates) {
        const cleaned = cleanInstagramText(c);
        if (cleaned && cleaned.length >= 5) return cleaned;
      }
    }
  }
  return undefined;
}

function extractInstagramCaptionFromHtml(html: string): string | undefined {
  // Heuristic: look for "caption" fields in embedded JSON.
  const patterns = [
    /"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/i,
    /"edge_media_to_caption"\s*:\s*\{[\s\S]*?"text"\s*:\s*"([^"]+)"/i,
    /"accessibility_caption"\s*:\s*"([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const unescaped = m[1]
        .replace(/\\n/g, " ")
        .replace(/\\u003c/g, "<")
        .replace(/\\u003e/g, ">");
      const cleaned = cleanInstagramText(unescaped);
      if (cleaned && cleaned.length >= 5) return cleaned;
    }
  }
  return undefined;
}

async function tryInstagramJson(
  targetUrl: URL,
): Promise<{ description?: string; image?: string } | null> {
  try {
    const base = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, "/")}`;
    const jsonUrl = `${base}?__a=1&__d=dis`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(jsonUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as Record<string, any>;

    // Common shapes observed historically
    const media = data?.graphql?.shortcode_media ?? data?.items?.[0];
    if (!media) return null;

    const captionText =
      media?.edge_media_to_caption?.edges?.[0]?.node?.text ??
      media?.caption?.text ??
      media?.caption?.text ??
      undefined;

    const imageUrl =
      media?.display_url ??
      media?.image_versions2?.candidates?.[0]?.url ??
      undefined;

    return {
      description: typeof captionText === "string" ? captionText : undefined,
      image: typeof imageUrl === "string" ? imageUrl : undefined,
    };
  } catch {
    return null;
  }
}

function extractInstagramShortcode(
  u: URL,
): { kind: "p" | "reel" | "tv"; code: string } | null {
  const m = u.pathname.match(/\/(p|reel|tv)\/([^/?#]+)/i);
  if (!m?.[1] || !m?.[2]) return null;
  const kind = m[1].toLowerCase() as "p" | "reel" | "tv";
  const code = m[2];
  return { kind, code };
}

function buildInstagramMediaFallbackUrl(u: URL): string | null {
  const sc = extractInstagramShortcode(u);
  if (!sc) return null;
  // Instagram's legacy media endpoint is most consistently reachable under /p/<shortcode>/...
  // even when the original URL is /reel/<shortcode>/ or /tv/<shortcode>/.
  return `https://www.instagram.com/p/${sc.code}/media/?size=l`;
}

async function fetchTextWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  text: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, {
    redirect: "follow",
    signal: controller.signal,
    headers,
  });
  clearTimeout(timeoutId);
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.url || url,
    contentType: res.headers.get("content-type") || "",
    text,
  };
}

async function resolveFacebookShareUrlWithTimeout(
  targetUrl: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<string | null> {
  const host = targetUrl.hostname.toLowerCase();
  const path = targetUrl.pathname.toLowerCase();

  // Handle fb.watch short links
  if (host.includes("fb.watch")) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(targetUrl.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeoutId);
      const finalUrl = res.url && res.url !== targetUrl.toString() ? res.url : null;
      if (finalUrl && !isFacebookLoginUrl(finalUrl)) return finalUrl;
      if (finalUrl && isFacebookLoginUrl(finalUrl)) return extractPermalinkFromLoginRedirect(finalUrl);
    } catch {
      // ignore
    }
    return null;
  }

  if (!host.includes("facebook.com") || !path.includes("/share/")) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // First try: follow redirects to get final URL
    const followRes = await fetch(targetUrl.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);

    const finalUrl = followRes.url && followRes.url !== targetUrl.toString() ? followRes.url : null;

    // Happy path: resolved to a real non-share URL
    if (finalUrl && !finalUrl.includes("/share/") && !isFacebookLoginUrl(finalUrl)) {
      return finalUrl;
    }

    // Login wall: extract the real destination from the `next` param
    if (finalUrl && isFacebookLoginUrl(finalUrl)) {
      const extracted = extractPermalinkFromLoginRedirect(finalUrl);
      if (extracted) return extracted;
      // Don't fall through to HTML parsing — we're on a login page
      return null;
    }

    // Parse the response for redirect hints
    const text = await followRes.text().catch(() => "");

    // Look for og:url which often has the canonical post URL
    const ogUrl = text.match(
      /<meta\s+[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i,
    );
    if (ogUrl?.[1] && !ogUrl[1].includes("/share/")) {
      try {
        const resolved = new URL(ogUrl[1], targetUrl.toString()).toString();
        if (!isFacebookLoginUrl(resolved)) return resolved;
        const extracted = extractPermalinkFromLoginRedirect(resolved);
        if (extracted) return extracted;
      } catch {
        // ignore
      }
    }

    // Look for canonical link
    const canonical = text.match(
      /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    );
    if (canonical?.[1] && !canonical[1].includes("/share/")) {
      try {
        const resolved = new URL(canonical[1], targetUrl.toString()).toString();
        if (!isFacebookLoginUrl(resolved)) return resolved;
      } catch {
        // ignore
      }
    }

    // Look for meta refresh redirect
    const metaRefresh = text.match(
      /http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*url=([^"'>\s]+)["']/i,
    );
    if (metaRefresh?.[1] && !metaRefresh[1].includes("/share/")) {
      try {
        return new URL(metaRefresh[1], targetUrl.toString()).toString();
      } catch {
        // ignore
      }
    }

    // Look for JavaScript redirect patterns in the HTML
    const jsRedirect =
      text.match(/window\.location\s*=\s*["']([^"']+)["']/i) ||
      text.match(/location\.href\s*=\s*["']([^"']+)["']/i) ||
      text.match(/"redirect_url"\s*:\s*"([^"]+)"/i);
    if (jsRedirect?.[1] && !jsRedirect[1].includes("/share/")) {
      try {
        const decoded = jsRedirect[1]
          .replace(/\\u002F/g, "/")
          .replace(/\\\//g, "/");
        const resolved = new URL(decoded, targetUrl.toString()).toString();
        if (!isFacebookLoginUrl(resolved)) return resolved;
      } catch {
        // ignore
      }
    }
  } catch {
    return null;
  }

  return null;
}

function unfurlPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      if (url.pathname !== "/api/unfurl" && url.pathname !== "/api/proxy-image")
        return false;

      // Image proxy (helps when third-party cookies prevent Instagram images from loading in <img>)
      if (url.pathname === "/api/proxy-image") {
        if ((req.method ?? "GET").toUpperCase() !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return true;
        }

        const target = url.searchParams.get("url");
        const debug = url.searchParams.get("debug") === "1";
        if (!target) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing url param" }));
          return true;
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(target);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid url param" }));
          return true;
        }

        if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ error: "Only http/https URLs are allowed" }),
          );
          return true;
        }

        const isFacebookImageHost = (() => {
          const h = targetUrl.hostname.toLowerCase();
          return (
            h.endsWith("fbsbx.com") ||
            h.endsWith("fbcdn.net") ||
            h.includes("facebook.com")
          );
        })();

        const isInstagramImageHost = (() => {
          const h = targetUrl.hostname.toLowerCase();
          return (
            h.includes("cdninstagram.com") ||
            h.includes("instagram.com")
          );
        })();

        const headers = {
          "user-agent": isFacebookImageHost
            ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
            : isInstagramImageHost
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          // Some Facebook image endpoints are sensitive to Referer.
          ...(isFacebookImageHost
            ? { referer: "https://www.facebook.com/" }
            : {}),
          // Instagram/Threads images need Instagram referer
          ...(isInstagramImageHost
            ? { referer: "https://www.instagram.com/" }
            : {}),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const upstream = await fetch(targetUrl.toString(), {
          redirect: "follow",
          signal: controller.signal,
          headers,
        });
        clearTimeout(timeoutId);

        const contentType = upstream.headers.get("content-type") || "";
        if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
          res.statusCode = 422;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(
            JSON.stringify({
              error: "Upstream did not return an image",
              status: upstream.status,
              contentType,
              url: upstream.url || targetUrl.toString(),
              ...(debug
                ? {
                    debug: {
                      headers: {
                        "content-type": upstream.headers.get("content-type"),
                        location: upstream.headers.get("location"),
                      },
                    },
                  }
                : {}),
            }),
          );
          return true;
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        // safety cap ~8MB
        if (buf.byteLength > 8 * 1024 * 1024) {
          res.statusCode = 413;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify({ error: "Image too large" }));
          return true;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
        res.end(buf);
        return true;
      }
      if ((req.method ?? "GET").toUpperCase() !== "GET") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return true;
      }

      const target = url.searchParams.get("url");
      const debug = url.searchParams.get("debug") === "1";
      if (!target) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing url param" }));
        return true;
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(target);
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid url param" }));
        return true;
      }

      if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Only http/https URLs are allowed" }));
        return true;
      }

      const headers = {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      };

      // Facebook often serves different HTML/redirect behavior depending on the user agent.
      // For /share/* links specifically, a link-preview UA tends to get the canonical target URL.
      const facebookPreviewHeaders = {
        ...headers,
        "user-agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      };

      const isFacebook =
        targetUrl.hostname.includes("facebook.com") ||
        targetUrl.hostname.includes("fb.watch");
      const isFacebookShare = isFacebook && isFacebookShareLike(targetUrl);

      // Resolve Facebook share links: extract ?u= target or follow redirects. Do not scrape Facebook pages directly.
      let shareResolvedUrl: string | null = null;
      if (isFacebookShare) {
        const extracted = extractFacebookSharedTarget(targetUrl);
        if (extracted) {
          shareResolvedUrl = extracted.toString();
          targetUrl = extracted;
        } else {
          const resolvedByHelper = await resolveFacebookShareUrlWithTimeout(
            targetUrl,
            facebookPreviewHeaders,
            10000,
          );
          if (resolvedByHelper) {
            shareResolvedUrl = resolvedByHelper;
            try {
              targetUrl = new URL(resolvedByHelper);
            } catch {
              // keep original
            }
          } else {
            const resolved = await followRedirectsWithHeadThenGet(
              targetUrl.toString(),
              facebookPreviewHeaders,
              8000,
              5,
            );
            shareResolvedUrl = resolved;
            try {
              targetUrl = new URL(resolved);
            } catch {
              // keep original
            }
          }
        }
      }

      const primary = await fetchTextWithTimeout(
        targetUrl.toString(),
        isFacebookShare ? facebookPreviewHeaders : headers,
        10000,
      );
      let finalUrl = primary.finalUrl;
      const contentType = primary.contentType;
      const meta = extractMetadata(primary.text);
      let redditShortUnresolved = false;

      const attempts: Record<string, Record<string, unknown>> = {
        primary: { ok: primary.ok, status: primary.status, contentType },
        shareResolve: { attempted: isFacebookShare, url: shareResolvedUrl },
        twitterSyndication: { attempted: false, ok: false },
        instagramJson: { attempted: false, ok: false },
        jina: { attempted: false, ok: false },
        fallbackMediaUrl: { attempted: false, used: false },
        facebookJina: { attempted: false, ok: false },
        redditJson: { attempted: false, ok: false },
        redditJina: { attempted: false, ok: false },
        threadsJina: { attempted: false, ok: false },
      };

      const isTwitterHost =
        targetUrl.hostname.includes("x.com") ||
        targetUrl.hostname.includes("twitter.com");
      if (isTwitterHost && (!meta.title || !meta.description || !meta.image)) {
        const tweetId = extractXStatusId(targetUrl);
        if (tweetId) {
          attempts.twitterSyndication = { attempted: true, ok: false, tweetId };
          try {
            const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(tweetId)}&token=x`;
            const syndicationRes = await fetchTextWithTimeout(
              syndicationUrl,
              {
                "user-agent":
                  "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
                accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.9",
              },
              8000,
            );
            attempts.twitterSyndication.ok = syndicationRes.ok;
            if (syndicationRes.ok) {
              const twitterMeta = extractTwitterSyndicationMeta(syndicationRes.text);
              if (!meta.title && twitterMeta.title) meta.title = twitterMeta.title;
              if (!meta.description && twitterMeta.description)
                meta.description = twitterMeta.description;
              if (!meta.image && twitterMeta.image) meta.image = twitterMeta.image;
            }
          } catch {
            // Ignore Twitter syndication failures and fall back to existing metadata paths.
          }
        }
      }

      // Instagram often returns a login/blocked page with generic metadata.
      // Try JSON endpoint first, then fall back to a text-proxy fetch.
      const isInstagram = targetUrl.hostname.includes("instagram.com");
      if (
        isInstagram &&
        (isGenericInstagramTitle(meta.title) ||
          !meta.image ||
          !meta.description)
      ) {
        // Try to extract caption/snippet from HTML if OG tags are missing.
        if (
          !meta.description ||
          isGenericInstagramDescription(meta.description)
        ) {
          const fromLd = extractInstagramCaptionFromJsonLd(primary.text);
          const fromHtml = extractInstagramCaptionFromHtml(primary.text);
          meta.description =
            cleanInstagramText(fromLd || fromHtml || meta.description) ||
            meta.description;
        } else {
          meta.description =
            cleanInstagramText(meta.description) || meta.description;
        }

        attempts.instagramJson.attempted = true;
        const ig = await tryInstagramJson(targetUrl);
        attempts.instagramJson.ok = !!ig;
        if (
          ig?.description &&
          (!meta.description || isGenericInstagramDescription(meta.description))
        ) {
          meta.description =
            cleanInstagramText(ig.description) || ig.description;
        }
        if (ig?.image && !meta.image) meta.image = ig.image;

        if (isGenericInstagramTitle(meta.title)) {
          meta.title = undefined;
        }

        if (!meta.image || !meta.description) {
          const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
          attempts.jina.attempted = true;
          const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
          attempts.jina.ok = proxied.ok;
          // keep finalUrl/contentType from original
          const proxyMeta = extractMetadata(proxied.text);
          if (
            !meta.title &&
            proxyMeta.title &&
            !isGenericInstagramTitle(proxyMeta.title)
          )
            meta.title = proxyMeta.title;
          if (!meta.description && proxyMeta.description)
            meta.description =
              cleanInstagramText(proxyMeta.description) ||
              proxyMeta.description;
          if (!meta.image && proxyMeta.image) meta.image = proxyMeta.image;

          if (!meta.description) {
            const proxyLd = extractInstagramCaptionFromJsonLd(proxied.text);
            const proxyHtml = extractInstagramCaptionFromHtml(proxied.text);
            meta.description =
              cleanInstagramText(proxyLd || proxyHtml) || meta.description;
          }
        }

        // oembed fallback: Instagram's public oembed endpoint returns thumbnail_url without auth.
        if (!meta.image) {
          attempts.instagramOembed = { attempted: true, ok: false };
          try {
            const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(targetUrl.toString())}&maxwidth=640&omitscript=1`;
            const oembedRes = await fetchTextWithTimeout(oembedUrl, {
              "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
              accept: "application/json,*/*;q=0.8",
              "accept-language": "en-US,en;q=0.9",
            }, 8000);
            attempts.instagramOembed.ok = oembedRes.ok;
            if (oembedRes.ok) {
              const oembedData = tryParseJson(oembedRes.text) as Record<string, unknown> | null;
              if (oembedData && typeof oembedData["thumbnail_url"] === "string") {
                meta.image = oembedData["thumbnail_url"] as string;
              }
              if (oembedData && !meta.description && typeof oembedData["title"] === "string") {
                const cleaned = cleanInstagramText(oembedData["title"] as string);
                if (cleaned && cleaned.length >= 5) meta.description = cleaned;
              }
            }
          } catch {
            // oembed failed
          }
        }

        // Last-resort: Instagram legacy media endpoint (may still be blocked, but sometimes works)
        if (!meta.image) {
          attempts.fallbackMediaUrl.attempted = true;
          const fallback = buildInstagramMediaFallbackUrl(targetUrl);
          if (fallback) {
            meta.image = fallback;
            attempts.fallbackMediaUrl.used = true;
          }
        }

      }

      const isFacebookHost =
        targetUrl.hostname.includes("facebook.com") ||
        targetUrl.hostname.includes("fb.watch");

      // For Facebook group posts (/groups/<id>/posts/<id>/ or /groups/<id>/permalink/<id>/),
      // the embed plugin is blocked server-side. Try mbasic.facebook.com which sometimes
      // returns OG image metadata for public groups without requiring login.
      const isFacebookGroupPost = isFacebookHost && (() => {
        const p = targetUrl.pathname.toLowerCase();
        return (
          p.includes("/groups/") &&
          (p.includes("/posts/") || p.includes("/permalink/"))
        );
      })();

      if (isFacebookGroupPost && !meta.image) {
        try {
          const mbasicUrl = new URL(targetUrl.toString());
          mbasicUrl.hostname = "mbasic.facebook.com";
          const mbasicRes = await fetchTextWithTimeout(
            mbasicUrl.toString(),
            facebookPreviewHeaders,
            8000,
          );
          if (mbasicRes.ok) {
            const mbasicMeta = extractMetadata(mbasicRes.text);
            if (mbasicMeta.image) meta.image = mbasicMeta.image;
            if (!meta.title && mbasicMeta.title && !isGenericFacebookTitle(mbasicMeta.title))
              meta.title = mbasicMeta.title;
            if (!meta.description && mbasicMeta.description)
              meta.description = mbasicMeta.description;

            // Also look for <img> tags in mbasic HTML as last resort for image
            if (!meta.image) {
              // mbasic renders actual <img> tags — grab the first non-icon image
              const imgMatches = mbasicRes.text.match(/<img\s[^>]*src=["']([^"']+)["'][^>]*>/gi) ?? [];
              for (const imgTag of imgMatches) {
                const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
                if (!srcMatch?.[1]) continue;
                const src = srcMatch[1];
                // Skip tiny icons, profile pics, and non-content images
                if (src.includes("static.xx.fbcdn") || src.includes("emoji") || src.includes("reaction")) continue;
                if (src.includes("rsrc.php")) continue; // Facebook static resources
                if (src.startsWith("https://")) {
                  meta.image = src;
                  break;
                }
              }
            }
          }
        } catch {
          // mbasic fetch failed — continue to oEmbed fallback
        }
      }

      // Try Facebook oEmbed API first for better metadata
      if (isFacebookHost && (!meta.title || !meta.description || !meta.image)) {
        const appId = process.env.VITE_FACEBOOK_APP_ID;
        const appSecret = process.env.VITE_FACEBOOK_APP_SECRET;

        if (appId && appSecret) {
          attempts.facebookOembed = { attempted: true, ok: false };
          try {
            const accessToken = `${appId}|${appSecret}`;
            const oembedUrl = `https://graph.facebook.com/v19.0/oembed_post?url=${encodeURIComponent(targetUrl.toString())}&access_token=${encodeURIComponent(accessToken)}&fields=author_name,author_url,provider_name,provider_url,type,width,height,html`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const oembedRes = await fetch(oembedUrl, {
              signal: controller.signal,
              headers: {
                accept: "application/json",
              },
            });
            clearTimeout(timeoutId);

            if (oembedRes.ok) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const oembedData: Record<string, any> = await oembedRes.json();
              attempts.facebookOembed.ok = true;

              // Extract metadata from oEmbed response with proper HTML entity decoding
              // Title: use author_name or extract from HTML
              if (!meta.title && oembedData.author_name) {
                meta.title = decodeHtmlEntities(oembedData.author_name);
              } else if (!meta.title && oembedData.html) {
                // Try to extract text content from HTML
                const textMatch = oembedData.html.match(/>([^<]+)</);
                if (textMatch?.[1]) {
                  meta.title = decodeHtmlEntities(textMatch[1].trim());
                }
              }

              // Description: extract from HTML content and decode entities
              if (!meta.description && oembedData.html) {
                // Remove HTML tags and get text content
                const descText = oembedData.html
                  .replace(
                    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                    "",
                  )
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
                // Decode HTML entities (&#x627; → actual characters)
                if (descText) {
                  meta.description = decodeHtmlEntities(descText);
                }
              }

              // Image: oEmbed doesn't provide direct image URLs, so we'll rely on OG tags
              // but we can try to extract from the HTML iframe src
              if (!meta.image && oembedData.html) {
                const srcMatch = oembedData.html.match(/src=["']([^"']+)["']/);
                if (srcMatch?.[1]) {
                  attempts.facebookOembed.iframeSrc = srcMatch[1];
                  // Note: iframe src won't give us an image, but we log it for debugging
                }
              }
            }
          } catch {
            // Ignore oEmbed errors and fall back
          }
        }

        // Fallback to Jina if oEmbed didn't provide enough data
        if (!meta.title || !meta.description || !meta.image) {
          attempts.facebookJina = { attempted: true, ok: false };
          try {
            const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
            const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
            attempts.facebookJina.ok = proxied.ok;
            const fbMeta = extractMetadata(proxied.text);
            if (
              !meta.title &&
              fbMeta.title &&
              !isGenericFacebookTitle(fbMeta.title)
            )
              meta.title = fbMeta.title;
            if (!meta.description && fbMeta.description)
              meta.description = fbMeta.description;
            if (!meta.image && fbMeta.image) meta.image = fbMeta.image;
          } catch {
            // ignore
          }
        }
      }

      // If Facebook host is still empty after fallback, return early without thumbnail/description
      if (isFacebookHost && !meta.title && !meta.description && !meta.image) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(
          JSON.stringify({
            url: targetUrl.toString(),
            contentType,
            status: primary.status,
            title: undefined,
            description: undefined,
            image: undefined,
            shareResolvedUrl,
            ...(debug ? { debug: { attempts } } : {}),
          }),
        );
        return true;
      }

      // Reddit handling: Use .json API for better metadata
      const isReddit =
        targetUrl.hostname.includes("reddit.com") ||
        targetUrl.hostname.includes("redd.it");
      if (isReddit) {
        const originalRedditShort = /\/s\/[a-zA-Z0-9]+/.test(targetUrl.pathname);
        // Resolve Reddit /s/CODE mobile share URLs before trying .json.
        // These links are a redirect hop and must become /comments/... first.
        const redditResolved = await resolveRedditShortUrl(targetUrl, headers, 8000);
        if (redditResolved) {
          try {
            const resolvedUrl = new URL(redditResolved);
            targetUrl = resolvedUrl;
            finalUrl = resolvedUrl.toString();
          } catch {
            // keep original targetUrl
          }
        }
        if (originalRedditShort && !targetUrl.pathname.includes("/comments/")) {
          redditShortUnresolved = true;
        }

        attempts.redditJson = { attempted: true, ok: false };
        try {
          // Reddit JSON API: append .json to the pathname, NOT the full URL.
          // UTM params and other query strings must be stripped — appending .json to a URL
          // that still has a query string puts it on the last param value, not the path,
          // causing Reddit's API to ignore it and return HTML instead of JSON.
          const redditJsonUrl = new URL(targetUrl.toString());
          redditJsonUrl.search = ""; // strip all query params
          redditJsonUrl.hash = "";
          // Ensure path ends with / before appending .json
          if (!redditJsonUrl.pathname.endsWith("/")) {
            redditJsonUrl.pathname += "/";
          }
          const jsonUrl = redditJsonUrl.toString() + ".json";

          const redditHeaders = {
            ...headers,
            "user-agent":
              "Mozilla/5.0 (compatible; 4Stash/1.0; +https://4stash.com)",
          };

          const jsonRes = await fetchTextWithTimeout(
            jsonUrl,
            redditHeaders,
            8000,
          );
          attempts.redditJson.ok = jsonRes.ok;

          if (jsonRes.ok) {
            try {
              const data = JSON.parse(jsonRes.text);
              // Reddit returns array with [0] = post data
              const post = data?.[0]?.data?.children?.[0]?.data;

              if (post) {
                // Check for NSFW content
                if (post.over_18 === true || post.over18 === true) {
                  attempts.redditJson.nsfw = true;
                  // Return the real post title so the user can save it with the correct name
                  const nsfwTitle = post.title
                    ? decodeHtmlEntities(post.title)
                    : "NSFW Reddit Post";
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "application/json");
                  res.setHeader("Cache-Control", "no-store");
                  res.end(
                    JSON.stringify({
                      url: targetUrl.toString(),
                      contentType,
                      status: primary.status,
                      title: nsfwTitle,
                      description: "This Reddit post is marked as NSFW (18+)",
                      image: undefined,
                      nsfw: true,
                      ...(debug ? { debug: { attempts } } : {}),
                    }),
                  );
                  return true;
                }

                // Extract title
                if (!meta.title && post.title) {
                  meta.title = decodeHtmlEntities(post.title);
                }

                // Extract description (selftext for text posts)
                if (!meta.description && post.selftext) {
                  const cleanText = post.selftext
                    .replace(/\n+/g, " ")
                    .trim()
                    .substring(0, 300);
                  meta.description = decodeHtmlEntities(cleanText);
                }

                // Extract image/video thumbnail
                if (!meta.image) {
                  // Try preview images first
                  if (post.preview?.images?.[0]?.source?.url) {
                    meta.image = decodeHtmlEntities(
                      post.preview.images[0].source.url,
                    ).replace(/&amp;/g, "&");
                  }
                  // Fallback to thumbnail
                  else if (
                    post.thumbnail &&
                    post.thumbnail.startsWith("http")
                  ) {
                    meta.image = post.thumbnail;
                  }
                  // For direct image posts
                  else if (
                    post.url &&
                    (post.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                      post.post_hint === "image")
                  ) {
                    meta.image = post.url;
                  }
                }
              }
            } catch (parseErr) {
              // JSON parse failed, continue with OG tags
            }
          }
        } catch {
          // Reddit JSON API failed, fall back to OG tags
        }

        // Fallback to Jina if Reddit JSON didn't work
        if (!meta.title || !meta.description || !meta.image) {
          attempts.redditJina = { attempted: true, ok: false };
          try {
            const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
            const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
            attempts.redditJina.ok = proxied.ok;
            const redditMeta = extractMetadata(proxied.text);
            if (!meta.title && redditMeta.title) meta.title = redditMeta.title;
            if (!meta.description && redditMeta.description)
              meta.description = redditMeta.description;
            if (!meta.image && redditMeta.image) meta.image = redditMeta.image;
          } catch {
            // ignore
          }
        }

        // Clear generic error titles (e.g. "Reddit - The heart of the internet",
        // "403") so the client falls back to its own "Reddit Post in r/..." label.
        if (isGenericRedditTitle(meta.title)) meta.title = undefined;
      }

      // Threads handling: Try direct fetch with mobile user agent
      const isThreads =
        targetUrl.hostname.includes("threads.com") ||
        targetUrl.hostname.includes("threads.net");
      if (isThreads && (!meta.title || !meta.description || !meta.image)) {
        attempts.threadsJina = { attempted: true, ok: false };
        try {
          // Threads works better with mobile user agent
          const threadsHeaders = {
            "user-agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
          };

          const threadsRes = await fetchTextWithTimeout(
            targetUrl.toString(),
            threadsHeaders,
            10000,
          );
          attempts.threadsJina.ok = threadsRes.ok;

          if (threadsRes.ok) {
            const threadsMeta = extractMetadata(threadsRes.text);
            if (threadsMeta.title && threadsMeta.title !== "403")
              meta.title = threadsMeta.title;
            if (threadsMeta.description)
              meta.description = threadsMeta.description;
            if (threadsMeta.image) meta.image = threadsMeta.image;
          }
        } catch {
          // Direct fetch failed, metadata will be empty
        }

        // Jina.ai fallback for Threads when direct fetch fails or returns no image
        if (!meta.image || !meta.description) {
          attempts.threadsJinaFallback = { attempted: true, ok: false };
          try {
            const jinaThreadsUrl = `https://r.jina.ai/${targetUrl.toString()}`;
            const jinaRes = await fetchTextWithTimeout(jinaThreadsUrl, {
              "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
              accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "accept-language": "en-US,en;q=0.9",
            }, 10000);
            attempts.threadsJinaFallback.ok = jinaRes.ok;
            if (jinaRes.ok) {
              const jinaMeta = extractMetadata(jinaRes.text);
              if (!meta.image && jinaMeta.image) meta.image = jinaMeta.image;
              if (!meta.description && jinaMeta.description) meta.description = jinaMeta.description;
              if (!meta.title && jinaMeta.title) meta.title = jinaMeta.title;
            }
          } catch {
            // Jina fallback failed
          }
        }
      }

      const image = meta.image
        ? new URL(meta.image, finalUrl).toString()
        : undefined;
      const proxiedImage = (() => {
        if (!image) return undefined;
        try {
          const host = new URL(image).hostname;
          return shouldProxyImageHost(host)
            ? `/api/proxy-image?url=${encodeURIComponent(image)}`
            : image;
        } catch {
          return image;
        }
      })();

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.end(
        JSON.stringify({
          url: finalUrl,
          contentType,
          status: primary.status,
          title: meta.title,
          description: meta.description,
          image: proxiedImage,
          redditShortUnresolved,
          ...(debug
            ? {
                debug: {
                  isInstagram,
                  attempts,
                  extracted: {
                    hasTitle: !!meta.title,
                    hasDescription: !!meta.description,
                    hasImage: !!meta.image,
                  },
                },
              }
            : {}),
        }),
      );
      return true;
    } catch (err: unknown) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(
        JSON.stringify({
          error:
            err instanceof Error && err.name === "AbortError" ? "Upstream timeout" : "Unfurl failed",
        }),
      );
      return true;
    }
  };

  return {
    name: "4stash-unfurl",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    unfurlPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Exclude Firebase Auth popup handler from SW navigation fallback.
        // The Firebase OAuth popup opens /__/auth/handler on the firebaseapp.com
        // domain (which also hosts this SPA). Without this exclusion, the SW
        // intercepts that navigation and serves the SPA shell, causing the popup
        // to render the app's /login page instead of Google's OAuth consent screen.
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/api/unfurl",
            handler: "CacheFirst",
            options: {
              cacheName: "unfurl-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname === "/api/proxy-image",
            handler: "CacheFirst",
            options: {
              cacheName: "proxy-image-cache",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
      manifest: {
        name: "4Stash",
        short_name: "4Stash",
        description: "Save and organize multimedia content for later",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        share_target: {
          action: "/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor libraries into separate cacheable chunks.
        // Firebase alone is ~400 KB gzip — separating it means users
        // only re-download it when Firebase itself updates.
        manualChunks(id: string) {
          if (id.includes("node_modules/firebase")) return "vendor-firebase";
          if (id.includes("node_modules/react-dom")) return "vendor-react";
          if (id.includes("node_modules/react-router")) return "vendor-router";
          if (id.includes("node_modules/react-masonry-css")) return "vendor-masonry";
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    strictPort: true, // Fail if port 5173 is already in use
    open: true,
    host: true, // Allow external access
    allowedHosts: [
      'localhost',
      'gyrational-romana-scaphocephalic.ngrok-free.dev'
    ],
  },
});
