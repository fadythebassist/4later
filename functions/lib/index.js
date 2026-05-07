"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.home = exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
const FB_APP_ID = (0, params_1.defineSecret)("FB_APP_ID");
const FB_APP_SECRET = (0, params_1.defineSecret)("FB_APP_SECRET");
const THREADS_APP_SECRET = (0, params_1.defineSecret)("THREADS_APP_SECRET");
const SITE_ORIGIN = "https://4stash.com";
const PROTECTED_DEV_ORIGIN = "https://dev.4stash.com";
const BLOCKED_DEV_HOSTS = new Set([
    "stash-dev-22b99.web.app",
    "stash-dev-22b99.firebaseapp.com",
]);
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
function redirectDefaultDevHost(req, res) {
    const hostname = (req.hostname || req.headers.host || "").split(":")[0].toLowerCase();
    if (!BLOCKED_DEV_HOSTS.has(hostname))
        return false;
    const path = req.originalUrl || req.url || "/";
    res.redirect(307, `${PROTECTED_DEV_ORIGIN}${path}`);
    return true;
}
// ---------------------------------------------------------------------------
// Helpers (ported from vite.config.ts unfurl middleware)
// ---------------------------------------------------------------------------
function getAcceptQuality(accept, mediaType) {
    if (!accept)
        return 0;
    return accept
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .reduce((best, entry) => {
        const [type, ...params] = entry.split(";").map((part) => part.trim().toLowerCase());
        if (type !== mediaType.toLowerCase())
            return best;
        const qParam = params.find((param) => param.startsWith("q="));
        const q = qParam ? Number(qParam.slice(2)) : 1;
        return Number.isFinite(q) ? Math.max(best, q) : best;
    }, 0);
}
function shouldReturnMarkdown(accept) {
    const markdownQ = getAcceptQuality(accept, "text/markdown");
    if (markdownQ <= 0)
        return false;
    const htmlQ = getAcceptQuality(accept, "text/html");
    return markdownQ >= htmlQ;
}
async function fetchStaticText(path, fallback) {
    try {
        const response = await fetch(`${SITE_ORIGIN}${path}`);
        if (!response.ok)
            return fallback;
        return await response.text();
    }
    catch (_a) {
        return fallback;
    }
}
async function handleHomeRequest(req, res) {
    if (redirectDefaultDevHost(req, res))
        return;
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
function decodeHtmlEntities(input) {
    return input
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
}
function extractMetadata(html) {
    var _a;
    const metas = (_a = html.match(/<meta\s+[^>]*>/gi)) !== null && _a !== void 0 ? _a : [];
    const map = new Map();
    for (const tag of metas) {
        const keyMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
        const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
        if (!keyMatch || !contentMatch)
            continue;
        const key = keyMatch[1].trim().toLowerCase();
        const content = decodeHtmlEntities(contentMatch[1].trim());
        if (!map.has(key) && content)
            map.set(key, content);
    }
    const titleFromOg = map.get("og:title") || map.get("twitter:title");
    const descriptionFromOg = map.get("og:description") ||
        map.get("twitter:description") ||
        map.get("description");
    const imageFromOg = map.get("og:image:secure_url") ||
        map.get("og:image:url") ||
        map.get("og:image") ||
        map.get("twitter:image");
    let title = titleFromOg;
    if (!title) {
        const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleTag === null || titleTag === void 0 ? void 0 : titleTag[1])
            title = decodeHtmlEntities(titleTag[1].trim());
    }
    if (!title || !descriptionFromOg || !imageFromOg) {
        const lines = html.split(/\r?\n/);
        for (const line of lines) {
            const m = line.match(/^\s*(og:title|twitter:title|title)\s*:\s*(.+)\s*$/i);
            if (m && !title) {
                title = decodeHtmlEntities(m[2].trim());
                continue;
            }
            const d = line.match(/^\s*(og:description|twitter:description|description)\s*:\s*(.+)\s*$/i);
            if (d && !descriptionFromOg) {
                map.set(d[1].toLowerCase(), decodeHtmlEntities(d[2].trim()));
                continue;
            }
            const i = line.match(/^\s*(og:image|twitter:image)\s*:\s*(https?:\/\/\S+)/i);
            if (i && !imageFromOg) {
                map.set(i[1].toLowerCase(), i[2].trim());
            }
        }
    }
    const description = descriptionFromOg || map.get("og:description") || map.get("twitter:description") || map.get("description");
    const image = imageFromOg || map.get("og:image:secure_url") || map.get("og:image:url") || map.get("og:image") || map.get("twitter:image");
    return { title, description, image };
}
function isGenericInstagramTitle(title) {
    if (!title)
        return true;
    const t = title.trim().toLowerCase();
    if (t === "instagram")
        return true;
    if (t === "instagram post")
        return true;
    if (t === "instagram photo")
        return true;
    if (t === "instagram reel")
        return true;
    if (t === "instagram video")
        return true;
    if (/^post by @.+/.test(t))
        return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
        return true;
    if (t.includes("not available"))
        return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
        return true;
    if (t === "instagram • photos and videos")
        return true;
    return false;
}
function cleanInstagramText(input) {
    if (!input)
        return undefined;
    let t = decodeHtmlEntities(input).replace(/\s+/g, " ").trim();
    if (!t)
        return undefined;
    t = t.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, "").trim();
    t = t.replace(/^\d+\s+likes,\s+\d+\s+comments\s+-\s+/i, "").trim();
    return t || undefined;
}
function isGenericInstagramDescription(desc) {
    const d = (desc !== null && desc !== void 0 ? desc : "").trim().toLowerCase();
    if (!d)
        return true;
    if (d.includes("log in") || d.includes("login") || d.includes("sign up"))
        return true;
    if (d.includes("url source:"))
        return true;
    if (d.includes("markdown content:"))
        return true;
    if (d.includes("see everyday moments from your close friends"))
        return true;
    if (d.includes("instagram"))
        return false;
    return false;
}
function isInstagramLoginUrl(url) {
    try {
        const u = new url_1.URL(url);
        return u.hostname.includes("instagram.com") && u.pathname.startsWith("/accounts/login");
    }
    catch (_a) {
        return false;
    }
}
function isGenericRedditTitle(title) {
    if (!title)
        return true;
    const t = title.trim().toLowerCase();
    if (t === "403" || t === "error" || t === "forbidden" || t === "reddit")
        return true;
    if (t === "reddit - the heart of the internet")
        return true;
    if (t === "reddit \u2013 the heart of the internet")
        return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
        return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
        return true;
    if (t.includes("not found") || t.includes("unavailable") || t.includes("not available"))
        return true;
    if (t.includes("something went wrong"))
        return true;
    if (t.includes("whoa there"))
        return true;
    if (t === "reddit post")
        return true;
    if (/^reddit post in r\/.+/.test(t))
        return true;
    return false;
}
function cleanRedditUrl(urlStr) {
    try {
        const u = new url_1.URL(urlStr);
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
        for (const p of trackingParams)
            u.searchParams.delete(p);
        u.pathname = u.pathname.replace(/\/+$/, "") || "/";
        return u.toString();
    }
    catch (_a) {
        return urlStr;
    }
}
function isGenericFacebookTitle(title) {
    if (!title)
        return true;
    const t = title.trim().toLowerCase();
    if (t === "403" || t === "error" || t === "error facebook" || t === "facebook")
        return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
        return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
        return true;
    if (t.includes("not available") || t.includes("content not found"))
        return true;
    if (t.includes("something went wrong"))
        return true;
    return false;
}
function cleanFacebookUrl(urlStr) {
    try {
        const u = new url_1.URL(urlStr);
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
        for (const p of trackingParams)
            u.searchParams.delete(p);
        u.hash = "";
        u.pathname = u.pathname.replace(/\/+$/, "") || "/";
        return u.toString();
    }
    catch (_a) {
        return urlStr;
    }
}
function getFacebookFallbackTitle(urlStr) {
    try {
        const u = new url_1.URL(urlStr);
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
    }
    catch (_a) {
        return undefined;
    }
}
/** Extract a numeric Facebook video/reel ID from a URL, or null. */
function extractFacebookVideoId(urlStr) {
    try {
        const u = new url_1.URL(urlStr);
        const path = u.pathname;
        // /reel/933897635709855
        const reelMatch = path.match(/\/reel\/(\d+)/);
        if (reelMatch)
            return reelMatch[1];
        // /reels/933897635709855
        const reelsMatch = path.match(/\/reels\/(\d+)/);
        if (reelsMatch)
            return reelsMatch[1];
        // /watch/?v=933897635709855
        const vParam = u.searchParams.get("v");
        if (path.startsWith("/watch") && vParam && /^\d+$/.test(vParam))
            return vParam;
        // /username/videos/933897635709855
        const videosMatch = path.match(/\/videos\/(\d+)/);
        if (videosMatch)
            return videosMatch[1];
        // /video.php?v=933897635709855
        if (path.includes("video.php") && vParam && /^\d+$/.test(vParam))
            return vParam;
        return null;
    }
    catch (_a) {
        return null;
    }
}
/** Check if a Facebook URL points to a video or reel. */
function isFacebookVideoUrl(urlStr) {
    try {
        const path = new url_1.URL(urlStr).pathname.toLowerCase();
        return path.includes("/reel") || path.includes("/reels/") ||
            path.includes("/video") || path.includes("/watch");
    }
    catch (_a) {
        return false;
    }
}
function shouldProxyImageHost(hostname) {
    const h = hostname.toLowerCase();
    return (
    // Instagram CDN images are CORP-protected in browsers; proxy them with an
    // Instagram referer so they render inside our app origin.
    h.includes("instagram.com") ||
        h.endsWith("fbcdn.net") ||
        h.includes("facebook.com") ||
        h.endsWith("fbsbx.com"));
}
function isFacebookShareLike(url) {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (!host.includes("facebook.com") && !host.includes("fb.watch"))
        return false;
    if (path.startsWith("/sharer/sharer.php"))
        return true;
    if (path.startsWith("/share.php"))
        return true;
    if (path.includes("/share/"))
        return true;
    if (host.includes("fb.watch"))
        return true;
    if (path.includes("/permalink.php"))
        return true;
    return false;
}
function extractFacebookSharedTarget(url) {
    const uParam = url.searchParams.get("u") || url.searchParams.get("url");
    if (!uParam)
        return null;
    try {
        return new url_1.URL(uParam);
    }
    catch (_a) {
        return null;
    }
}
// Node.js-native HTTP fetch (Cloud Functions don't have the browser fetch API in Node 18-,
// but Node 20 does. We use the built-in fetch if available, otherwise fall back to http/https.)
async function nodeFetch(urlStr, opts = {}) {
    var _a, _b;
    // Node 20 has globalThis.fetch — use it when available
    if (typeof globalThis.fetch === "function") {
        const controller = new AbortController();
        const tid = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
        try {
            const res = await globalThis.fetch(urlStr, {
                method: (_a = opts.method) !== null && _a !== void 0 ? _a : "GET",
                headers: opts.headers,
                redirect: (_b = opts.redirect) !== null && _b !== void 0 ? _b : "follow",
                signal: controller.signal,
            });
            if (tid)
                clearTimeout(tid);
            const headersMap = new Map();
            res.headers.forEach((v, k) => headersMap.set(k.toLowerCase(), v));
            return {
                ok: res.ok,
                status: res.status,
                finalUrl: res.url || urlStr,
                text: () => res.text(),
                arrayBuffer: () => res.arrayBuffer(),
                headers: headersMap,
            };
        }
        catch (e) {
            if (tid)
                clearTimeout(tid);
            throw e;
        }
    }
    // Fallback: Node http/https
    return new Promise((resolve, reject) => {
        var _a, _b;
        const parsedUrl = new url_1.URL(urlStr);
        const lib = parsedUrl.protocol === "https:" ? https : http;
        const reqOpts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: (_a = opts.method) !== null && _a !== void 0 ? _a : "GET",
            headers: (_b = opts.headers) !== null && _b !== void 0 ? _b : {},
        };
        let timeoutId = null;
        const req = lib.request(reqOpts, (res) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            const finalUrl = res.headers.location || urlStr;
            const headersMap = new Map();
            for (const [k, v] of Object.entries(res.headers)) {
                if (v)
                    headersMap.set(k.toLowerCase(), Array.isArray(v) ? v[0] : v);
            }
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
                var _a, _b, _c;
                const buf = Buffer.concat(chunks);
                resolve({
                    ok: ((_a = res.statusCode) !== null && _a !== void 0 ? _a : 0) >= 200 && ((_b = res.statusCode) !== null && _b !== void 0 ? _b : 0) < 300,
                    status: (_c = res.statusCode) !== null && _c !== void 0 ? _c : 0,
                    finalUrl,
                    text: async () => buf.toString("utf8"),
                    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
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
async function fetchTextWithTimeout(url, headers, timeoutMs) {
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
function isFacebookLoginUrl(url) {
    try {
        const u = new url_1.URL(url);
        return u.hostname.includes("facebook.com") && (u.pathname.startsWith("/login") ||
            u.pathname.startsWith("/checkpoint") ||
            u.pathname.startsWith("/recover"));
    }
    catch (_a) {
        return false;
    }
}
/**
 * When Facebook redirects us to a login wall, the real destination post URL is
 * encoded in the `next` query parameter of the login URL.
 * Extract it and convert it to a usable embed permalink:
 *   /permalink.php?story_fbid=<fbid>&id=<page_id>  →  /<page_id>/posts/<fbid>/
 */
function extractPermalinkFromLoginRedirect(loginUrl) {
    try {
        const u = new url_1.URL(loginUrl);
        if (!isFacebookLoginUrl(loginUrl))
            return null;
        const next = u.searchParams.get("next");
        if (!next)
            return null;
        const nextUrl = new url_1.URL(next);
        if (!nextUrl.hostname.includes("facebook.com"))
            return null;
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
    }
    catch ( /* ignore */_a) { /* ignore */ }
    return null;
}
async function resolveFacebookShareUrl(targetUrl, headers, timeoutMs) {
    const host = targetUrl.hostname.toLowerCase();
    const path = targetUrl.pathname.toLowerCase();
    if (host.includes("fb.watch")) {
        try {
            const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
            const finalUrl = res.finalUrl && res.finalUrl !== targetUrl.toString() ? res.finalUrl : null;
            if (finalUrl && !isFacebookLoginUrl(finalUrl))
                return finalUrl;
            if (finalUrl && isFacebookLoginUrl(finalUrl)) {
                return extractPermalinkFromLoginRedirect(finalUrl);
            }
        }
        catch ( /* ignore */_a) { /* ignore */ }
        return null;
    }
    if (!host.includes("facebook.com") || !path.includes("/share/"))
        return null;
    try {
        const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
        const finalUrl = res.finalUrl && res.finalUrl !== targetUrl.toString() ? res.finalUrl : null;
        // Happy path: resolved to a non-share, non-login URL
        if (finalUrl && !finalUrl.includes("/share/") && !isFacebookLoginUrl(finalUrl))
            return finalUrl;
        // Login wall: extract the real destination from the `next` param
        if (finalUrl && isFacebookLoginUrl(finalUrl)) {
            const extracted = extractPermalinkFromLoginRedirect(finalUrl);
            if (extracted)
                return extracted;
            // Don't fall through to HTML parsing — we're on a login page, not the target
            return null;
        }
        // Still on a share URL or no redirect — try HTML parsing
        const text = await res.text();
        const ogUrl = text.match(/<meta\s+[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i);
        if ((ogUrl === null || ogUrl === void 0 ? void 0 : ogUrl[1]) && !ogUrl[1].includes("/share/")) {
            try {
                const resolved = new url_1.URL(ogUrl[1], targetUrl.toString()).toString();
                if (!isFacebookLoginUrl(resolved))
                    return resolved;
                const extracted = extractPermalinkFromLoginRedirect(resolved);
                if (extracted)
                    return extracted;
            }
            catch ( /* ignore */_b) { /* ignore */ }
        }
        const canonical = text.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i);
        if ((canonical === null || canonical === void 0 ? void 0 : canonical[1]) && !canonical[1].includes("/share/")) {
            try {
                const resolved = new url_1.URL(canonical[1], targetUrl.toString()).toString();
                if (!isFacebookLoginUrl(resolved))
                    return resolved;
            }
            catch ( /* ignore */_c) { /* ignore */ }
        }
        const jsRedirect = text.match(/window\.location\s*=\s*["']([^"']+)["']/i) || text.match(/location\.href\s*=\s*["']([^"']+)["']/i) || text.match(/"redirect_url"\s*:\s*"([^"]+)"/i);
        if ((jsRedirect === null || jsRedirect === void 0 ? void 0 : jsRedirect[1]) && !jsRedirect[1].includes("/share/")) {
            try {
                const decoded = jsRedirect[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
                const resolved = new url_1.URL(decoded, targetUrl.toString()).toString();
                if (!isFacebookLoginUrl(resolved))
                    return resolved;
            }
            catch ( /* ignore */_d) { /* ignore */ }
        }
    }
    catch (_e) {
        return null;
    }
    return null;
}
async function resolveRedditShortUrl(targetUrl, headers, timeoutMs) {
    const isShort = /\/s\/[a-zA-Z0-9]+/.test(targetUrl.pathname);
    if (!isShort) {
        return {
            resolvedUrl: null,
            debugAttempts: [],
        };
    }
    const redditBotHeaders = Object.assign(Object.assign({}, headers), { "user-agent": "Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)" });
    const facebookBotHeaders = Object.assign(Object.assign({}, headers), { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" });
    const headerVariants = [
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
    const debugAttempts = [];
    for (const variant of headerVariants) {
        const candidateUrl = new url_1.URL(targetUrl.toString());
        candidateUrl.hostname = variant.host;
        for (const method of ["HEAD", "GET"]) {
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
                    location: location !== null && location !== void 0 ? location : null,
                    finalUrl: res.finalUrl,
                    ok: res.ok,
                });
                if (location) {
                    return {
                        resolvedUrl: new url_1.URL(location, candidateUrl.toString()).toString(),
                        debugAttempts,
                    };
                }
            }
            catch (_a) {
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
        }
        catch (_b) {
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
function tryParseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch (_a) {
        return null;
    }
}
function* walkJson(node) {
    if (node === null || node === undefined)
        return;
    yield node;
    if (Array.isArray(node)) {
        for (const v of node)
            yield* walkJson(v);
    }
    else if (typeof node === "object") {
        for (const v of Object.values(node))
            yield* walkJson(v);
    }
}
function extractInstagramCaptionFromJsonLd(html) {
    var _a;
    const blocks = (_a = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)) !== null && _a !== void 0 ? _a : [];
    for (const block of blocks) {
        const m = block.match(/>\s*([\s\S]*?)\s*<\/script>/i);
        if (!(m === null || m === void 0 ? void 0 : m[1]))
            continue;
        const parsed = tryParseJson(m[1].trim());
        if (!parsed)
            continue;
        for (const node of walkJson(parsed)) {
            if (!node || typeof node !== "object")
                continue;
            const obj = node;
            const candidates = [obj["caption"], obj["articleBody"], obj["description"], obj["text"], obj["headline"], obj["name"]].filter((v) => typeof v === "string");
            for (const c of candidates) {
                const cleaned = cleanInstagramText(c);
                if (cleaned && cleaned.length >= 5)
                    return cleaned;
            }
        }
    }
    return undefined;
}
function extractInstagramCaptionFromHtml(html) {
    const patterns = [
        /"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/i,
        /"edge_media_to_caption"\s*:\s*\{[\s\S]*?"text"\s*:\s*"([^"]+)"/i,
        /"accessibility_caption"\s*:\s*"([^"]+)"/i,
        /"caption_text"\s*:\s*"([^"]+)"/i,
        /"sharing_friction_info"[\s\S]*?"bloks_app_url"\s*:\s*"([^"]+)"/i,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m === null || m === void 0 ? void 0 : m[1]) {
            const unescaped = m[1]
                .replace(/\\n/g, " ")
                .replace(/\\u003c/g, "<")
                .replace(/\\u003e/g, ">")
                .replace(/\\u0026/g, "&")
                .replace(/\\\//g, "/");
            const cleaned = cleanInstagramText(unescaped);
            if (cleaned && cleaned.length >= 5)
                return cleaned;
        }
    }
    return undefined;
}
function extractInstagramCaptionFromPageText(html) {
    const normalized = decodeHtmlEntities(html)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized)
        return undefined;
    const patterns = [
        /(?:likes?,\s*\d+\s*comments?\s*-\s*)(.{30,500}?)(?:\s+more\b|\s+view all\b|\s+on instagram\b)/i,
        /(?:add a comment\.{0,3}\s+)(.{30,500}?)(?:\s+more\b|\s+view all\b|\s+on instagram\b)/i,
    ];
    for (const re of patterns) {
        const m = normalized.match(re);
        const candidate = cleanInstagramText(m === null || m === void 0 ? void 0 : m[1]);
        if (candidate && candidate.length >= 20)
            return candidate;
    }
    return undefined;
}
function extractInstagramImageFromHtml(html) {
    const metaMatch = html.match(/<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)/i);
    if (metaMatch === null || metaMatch === void 0 ? void 0 : metaMatch[1]) {
        return decodeHtmlEntities(metaMatch[1]);
    }
    const imageCandidates = [
        ...html.matchAll(/https?:\/\/[^"'\s)]+cdninstagram\.com[^"'\s)]*/gi),
    ].map((match) => decodeHtmlEntities(match[0]));
    return imageCandidates.find((candidate) => !candidate.includes("s150x150") && !candidate.includes("profile_pic") && !candidate.includes("Audio image")) || imageCandidates[0];
}
function extractPlainTextMetadata(text) {
    const normalized = decodeHtmlEntities(text).replace(/\r/g, "").trim();
    if (!normalized)
        return {};
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
function cleanInstagramDerivedTitle(input) {
    var _a;
    if (!input)
        return undefined;
    let title = decodeHtmlEntities(input).trim();
    if (!title)
        return undefined;
    title = title.replace(/^.+? on instagram:\s*/i, "").trim();
    title = title.replace(/^['"\u201c\u2018]+/, "").trim();
    title = title.replace(/['"\u201d\u2019]+$/, "").trim();
    title = ((_a = title.split(/\n+/)[0]) === null || _a === void 0 ? void 0 : _a.trim()) || title;
    return title || undefined;
}
async function fetchJinaSnapshot(targetUrl, timeoutMs) {
    const canonicalUrl = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, "/")}`;
    const variants = Array.from(new Set([
        `https://r.jina.ai/http://${targetUrl.hostname}${targetUrl.pathname}`,
        `https://r.jina.ai/${canonicalUrl}`,
        `https://r.jina.ai/http://${canonicalUrl}`,
        `https://r.jina.ai/${targetUrl.toString()}`,
        `https://r.jina.ai/http://${targetUrl.hostname}${targetUrl.pathname}${targetUrl.search}`,
        `https://r.jina.ai/http://${targetUrl.toString()}`,
    ]));
    let bestResponse = null;
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
        }
        catch (_a) {
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
async function tryInstagramJson(targetUrl) {
    var _a, _b, _c, _d;
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
        if (!res.ok)
            return null;
        const data = tryParseJson(await res.text());
        if (!data)
            return null;
        const graphql = data["graphql"];
        const items = data["items"];
        const media = ((_a = graphql === null || graphql === void 0 ? void 0 : graphql["shortcode_media"]) !== null && _a !== void 0 ? _a : items === null || items === void 0 ? void 0 : items[0]);
        if (!media)
            return null;
        const edgeCaption = media["edge_media_to_caption"];
        const edges = edgeCaption === null || edgeCaption === void 0 ? void 0 : edgeCaption["edges"];
        const firstEdge = edges === null || edges === void 0 ? void 0 : edges[0];
        const firstNode = firstEdge === null || firstEdge === void 0 ? void 0 : firstEdge["node"];
        const captionObj = media["caption"];
        const captionText = (_b = firstNode === null || firstNode === void 0 ? void 0 : firstNode["text"]) !== null && _b !== void 0 ? _b : captionObj === null || captionObj === void 0 ? void 0 : captionObj["text"];
        const imageUrl = (_c = media["display_url"]) !== null && _c !== void 0 ? _c : (_d = media["image_versions2"]) === null || _d === void 0 ? void 0 : _d["candidates"];
        return {
            description: typeof captionText === "string" ? captionText : undefined,
            image: typeof imageUrl === "string" ? imageUrl : undefined,
        };
    }
    catch (_e) {
        return null;
    }
}
async function tryInstagramOEmbed(targetUrl) {
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
        if (!res.ok)
            return null;
        const data = tryParseJson(await res.text());
        if (!data)
            return null;
        const title = typeof data["author_name"] === "string"
            ? `Post by @${data["author_name"]}`
            : undefined;
        return {
            title,
            description: typeof data["title"] === "string" ? data["title"] : undefined,
            image: typeof data["thumbnail_url"] === "string" ? data["thumbnail_url"] : undefined,
        };
    }
    catch (_a) {
        return null;
    }
}
function buildInstagramMediaFallbackUrl(u) {
    const m = u.pathname.match(/\/(p|reel|reels|tv)\/([^/?#]+)/i);
    if (!(m === null || m === void 0 ? void 0 : m[1]) || !(m === null || m === void 0 ? void 0 : m[2]))
        return null;
    return `https://www.instagram.com/p/${m[2]}/media/?size=l`;
}
// ---------------------------------------------------------------------------
// Main handler (shared between /api/unfurl and /api/proxy-image)
// ---------------------------------------------------------------------------
async function handleRequest(req, res, fbAppId, fbAppSecret, threadsAppSecret) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (redirectDefaultDevHost(req, res))
        return;
    // CORS — allow 4stash.com and localhost dev
    const origin = req.headers["origin"];
    const allowedOrigins = ["https://4stash.com", "https://later-production-9a596.web.app", "http://localhost:5173", "http://localhost:4173", "capacitor://localhost"];
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    else {
        res.setHeader("Access-Control-Allow-Origin", "https://4stash.com");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    const path = req.path;
    // POST routes
    if (req.method === "POST") {
        // -------------------------------------------------------------------------
        // /api/threads-token  — server-side Threads OAuth code exchange
        // Keeps the app secret out of the client bundle.
        // -------------------------------------------------------------------------
        if (path === "/threads-token" || path === "/api/threads-token") {
            const { code, redirectUri, appId } = req.body;
            if (!code || !redirectUri || !appId) {
                res.status(400).json({ error: "Missing required fields: code, redirectUri, appId" });
                return;
            }
            if (!threadsAppSecret) {
                res.status(500).json({ error: "Threads app secret not configured" });
                return;
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
                const response = await globalThis.fetch("https://graph.threads.net/oauth/access_token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
                    body: params.toString(),
                    signal: controller.signal,
                });
                clearTimeout(tid);
                const data = await response.json();
                if (!response.ok) {
                    res.status(400).json({ error: (_b = (_a = data["error_message"]) !== null && _a !== void 0 ? _a : data["error"]) !== null && _b !== void 0 ? _b : "Token exchange failed" });
                    return;
                }
                res.status(200).json(data);
            }
            catch (e) {
                res.status(500).json({ error: e instanceof Error ? e.message : "Token exchange failed" });
            }
            return;
        }
        res.status(404).json({ error: "Not found" });
        return;
    }
    // -------------------------------------------------------------------------
    // /api/proxy-image
    // -------------------------------------------------------------------------
    if (path === "/proxy-image" || path === "/api/proxy-image") {
        const target = req.query["url"];
        if (!target) {
            res.status(400).json({ error: "Missing url param" });
            return;
        }
        let targetUrl;
        try {
            targetUrl = new url_1.URL(target);
        }
        catch (_j) {
            res.status(400).json({ error: "Invalid url param" });
            return;
        }
        if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
            res.status(400).json({ error: "Only http/https URLs are allowed" });
            return;
        }
        const h = targetUrl.hostname.toLowerCase();
        const isFbImg = h.endsWith("fbsbx.com") || h.endsWith("fbcdn.net") || h.includes("facebook.com");
        const isIgImg = h.includes("instagram.com");
        const imgHeaders = Object.assign(Object.assign({ "user-agent": isFbImg
                ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
                : isIgImg
                    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
                    : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" }, (isFbImg ? { referer: "https://www.facebook.com/" } : {})), (isIgImg ? { referer: "https://www.instagram.com/" } : {}));
        try {
            const upstream = await nodeFetch(targetUrl.toString(), { headers: imgHeaders, timeoutMs: 10000 });
            const contentType = upstream.headers.get("content-type") || "";
            if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
                res.status(422).json({ error: "Upstream did not return an image", status: upstream.status, contentType });
                return;
            }
            const buf = Buffer.from(await upstream.arrayBuffer());
            if (buf.byteLength > 8 * 1024 * 1024) {
                res.status(413).json({ error: "Image too large" });
                return;
            }
            res.status(200).setHeader("Content-Type", contentType).setHeader("Cache-Control", "public, max-age=3600").end(buf);
        }
        catch (e) {
            res.status(500).json({ error: e instanceof Error && e.message === "Timeout" ? "Upstream timeout" : "Proxy failed" });
        }
        return;
    }
    // -------------------------------------------------------------------------
    // /api/threads-token  — server-side Threads OAuth code exchange
    // Keeps the app secret out of the client bundle.
    // -------------------------------------------------------------------------
    if (path === "/threads-token" || path === "/api/threads-token") {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const { code, redirectUri, appId } = req.body;
        if (!code || !redirectUri || !appId) {
            res.status(400).json({ error: "Missing required fields: code, redirectUri, appId" });
            return;
        }
        if (!threadsAppSecret) {
            res.status(500).json({ error: "Threads app secret not configured" });
            return;
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
            const response = await globalThis.fetch("https://graph.threads.net/oauth/access_token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
                body: params.toString(),
                signal: controller.signal,
            });
            clearTimeout(tid);
            // suppress unused variable — nodeFetch call above was replaced
            void tokenRes;
            const data = await response.json();
            if (!response.ok) {
                res.status(400).json({ error: (_d = (_c = data["error_message"]) !== null && _c !== void 0 ? _c : data["error"]) !== null && _d !== void 0 ? _d : "Token exchange failed" });
                return;
            }
            res.status(200).json(data);
        }
        catch (e) {
            res.status(500).json({ error: e instanceof Error ? e.message : "Token exchange failed" });
        }
        return;
    }
    // -------------------------------------------------------------------------
    // /api/unfurl
    // -------------------------------------------------------------------------
    if (path !== "/unfurl" && path !== "/api/unfurl") {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const target = req.query["url"];
    const debug = req.query["debug"] === "1";
    if (!target) {
        res.status(400).json({ error: "Missing url param" });
        return;
    }
    let targetUrl;
    try {
        targetUrl = new url_1.URL(target);
    }
    catch (_k) {
        res.status(400).json({ error: "Invalid url param" });
        return;
    }
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
        res.status(400).json({ error: "Only http/https URLs are allowed" });
        return;
    }
    const headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
    };
    const facebookPreviewHeaders = Object.assign(Object.assign({}, headers), { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" });
    const isFacebook = targetUrl.hostname.includes("facebook.com") || targetUrl.hostname.includes("fb.watch");
    if (isFacebook) {
        try {
            targetUrl = new url_1.URL(cleanFacebookUrl(targetUrl.toString()));
            if (isFacebookLoginUrl(targetUrl.toString())) {
                const next = (_e = targetUrl.searchParams.get("next")) !== null && _e !== void 0 ? _e : (_f = target.match(/[?&]next=([^&]+)/)) === null || _f === void 0 ? void 0 : _f[1];
                if (next) {
                    targetUrl = new url_1.URL(cleanFacebookUrl(decodeURIComponent(next)));
                }
            }
        }
        catch (_l) {
            // keep original targetUrl
        }
    }
    const isFacebookShare = isFacebook && isFacebookShareLike(targetUrl);
    // Keep a copy of the original share URL so we can return it if resolution fails / hits a login wall
    const originalShareUrl = isFacebookShare ? targetUrl.toString() : null;
    let shareResolvedUrl = null;
    if (isFacebookShare) {
        const extracted = extractFacebookSharedTarget(targetUrl);
        if (extracted) {
            shareResolvedUrl = extracted.toString();
            targetUrl = extracted;
        }
        else {
            const resolved = await resolveFacebookShareUrl(targetUrl, facebookPreviewHeaders, 10000);
            if (resolved) {
                shareResolvedUrl = resolved;
                try {
                    targetUrl = new url_1.URL(resolved);
                }
                catch ( /* keep original */_m) { /* keep original */ }
            }
        }
    }
    // If after resolution we ended up on a login/checkpoint page, bail out early.
    // Return the original share URL so the client keeps the short URL (which isFacebookShortShareUrl() handles).
    if (isFacebook && isFacebookLoginUrl(targetUrl.toString())) {
        res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: originalShareUrl !== null && originalShareUrl !== void 0 ? originalShareUrl : targetUrl.toString(), contentType: "", status: 0, title: undefined, description: undefined, image: undefined, shareResolvedUrl: null }, (debug ? { debug: { loginWall: true } } : {})));
        return;
    }
    let primary = await fetchTextWithTimeout(targetUrl.toString(), isFacebookShare ? facebookPreviewHeaders : headers, 10000);
    if (isFacebook && !primary.ok) {
        const cleanedFacebookUrl = cleanFacebookUrl(targetUrl.toString());
        if (cleanedFacebookUrl !== targetUrl.toString()) {
            try {
                primary = await fetchTextWithTimeout(cleanedFacebookUrl, facebookPreviewHeaders, 10000);
                targetUrl = new url_1.URL(cleanedFacebookUrl);
            }
            catch (_o) {
                // keep original failed response
            }
        }
    }
    let finalUrl = primary.finalUrl;
    const contentType = primary.contentType;
    const meta = extractMetadata(primary.text);
    let redditShortUnresolved = false;
    const attempts = {
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
        }
        else {
            meta.description = cleanInstagramText(meta.description) || meta.description;
        }
        attempts["instagramJson"] = { attempted: true, ok: false };
        const ig = await tryInstagramJson(targetUrl);
        attempts["instagramJson"]["ok"] = !!ig;
        if ((ig === null || ig === void 0 ? void 0 : ig.description) && (!meta.description || isGenericInstagramDescription(meta.description))) {
            meta.description = cleanInstagramText(ig.description) || ig.description;
        }
        if ((ig === null || ig === void 0 ? void 0 : ig.image) && !meta.image)
            meta.image = ig.image;
        attempts["instagramOembed"] = { attempted: true, ok: false };
        const igOembed = await tryInstagramOEmbed(targetUrl);
        attempts["instagramOembed"]["ok"] = !!igOembed;
        if ((igOembed === null || igOembed === void 0 ? void 0 : igOembed.description) && (!meta.description || isGenericInstagramDescription(meta.description))) {
            meta.description = cleanInstagramText(igOembed.description) || igOembed.description;
        }
        if ((igOembed === null || igOembed === void 0 ? void 0 : igOembed.image) && !meta.image)
            meta.image = igOembed.image;
        if (!meta.title && (igOembed === null || igOembed === void 0 ? void 0 : igOembed.title) && !isGenericInstagramTitle(igOembed.title)) {
            meta.title = igOembed.title;
        }
        if (isGenericInstagramTitle(meta.title))
            meta.title = undefined;
        if (!meta.image || !meta.description) {
            attempts["jina"] = { attempted: true, ok: false };
            const proxied = await fetchJinaSnapshot(targetUrl, 10000);
            attempts["jina"]["ok"] = proxied.ok;
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
            if (!meta.image && proxyMeta.image)
                meta.image = proxyMeta.image;
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
            if (fallback) {
                meta.image = fallback;
                attempts["fallbackMediaUrl"]["used"] = true;
            }
        }
    }
    const isFacebookHost = targetUrl.hostname.includes("facebook.com") || targetUrl.hostname.includes("fb.watch");
    // For Facebook we run all fallback enrichment attempts in parallel so the
    // total wait is bounded by the slowest single attempt rather than the sum of
    // all attempts.  Each helper resolves to a partial meta object; we merge them
    // in priority order afterwards.
    if (isFacebookHost) {
        // Clear generic Facebook error titles so fallback attempts can replace them
        if (isGenericFacebookTitle(meta.title))
            meta.title = undefined;
        // ── Helper A: mbasic.facebook.com scrape ────────────────────────────────
        const mbasicPromise = (async () => {
            var _a;
            if (meta.image)
                return {}; // already have image — skip
            try {
                const mbasicUrl = new url_1.URL(targetUrl.toString());
                mbasicUrl.hostname = "mbasic.facebook.com";
                const mbasicRes = await fetchTextWithTimeout(mbasicUrl.toString(), facebookPreviewHeaders, 8000);
                if (!mbasicRes.ok)
                    return {};
                const mbasicMeta = extractMetadata(mbasicRes.text);
                const result = {};
                if (mbasicMeta.image) {
                    result.image = mbasicMeta.image;
                }
                else {
                    // Scan raw <img> tags as a last resort, skipping CDN/emoji/reaction assets
                    const imgMatches = (_a = mbasicRes.text.match(/<img\s[^>]*src=["']([^"']+)["'][^>]*>/gi)) !== null && _a !== void 0 ? _a : [];
                    for (const imgTag of imgMatches) {
                        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
                        if (!(srcMatch === null || srcMatch === void 0 ? void 0 : srcMatch[1]))
                            continue;
                        const src = srcMatch[1];
                        if (src.includes("static.xx.fbcdn") ||
                            src.includes("emoji") ||
                            src.includes("reaction") ||
                            src.includes("rsrc.php"))
                            continue;
                        if (src.startsWith("https://")) {
                            result.image = src;
                            break;
                        }
                    }
                }
                if (mbasicMeta.title && !isGenericFacebookTitle(mbasicMeta.title))
                    result.title = mbasicMeta.title;
                if (mbasicMeta.description)
                    result.description = mbasicMeta.description;
                return result;
            }
            catch (_b) {
                return {};
            }
        })();
        // ── Helper B: Graph API /{videoId}?fields=picture ───────────────────────
        const fbVideoId = extractFacebookVideoId(targetUrl.toString());
        const isVideoUrl = isFacebookVideoUrl(targetUrl.toString());
        const appId = fbAppId;
        const appSecret = fbAppSecret;
        const accessToken = appId && appSecret ? `${appId}|${appSecret}` : "";
        const graphPromise = (async () => {
            if (!fbVideoId || !accessToken)
                return {};
            attempts["facebookGraphVideo"] = { attempted: true, ok: false, videoId: fbVideoId };
            try {
                const graphUrl = `https://graph.facebook.com/v19.0/${fbVideoId}?fields=picture,description,from{name}&access_token=${encodeURIComponent(accessToken)}`;
                const graphRes = await nodeFetch(graphUrl, { headers: { accept: "application/json" }, timeoutMs: 8000 });
                if (!graphRes.ok)
                    return {};
                const graphData = tryParseJson(await graphRes.text());
                if (!graphData)
                    return {};
                attempts["facebookGraphVideo"]["ok"] = true;
                const result = {};
                if (graphData["picture"] && typeof graphData["picture"] === "string")
                    result.image = graphData["picture"];
                if (graphData["description"] && typeof graphData["description"] === "string")
                    result.description = graphData["description"];
                const from = graphData["from"];
                if ((from === null || from === void 0 ? void 0 : from["name"]) && typeof from["name"] === "string")
                    result.title = from["name"];
                return result;
            }
            catch (_a) {
                return {};
            }
        })();
        // ── Helper C: oEmbed ────────────────────────────────────────────────────
        const oembedEndpoints = isVideoUrl ? ["oembed_video", "oembed_post"] : ["oembed_post"];
        const oembedPromises = oembedEndpoints.map((endpoint) => (async () => {
            if (!accessToken)
                return {};
            const attemptKey = endpoint === "oembed_video" ? "facebookOembedVideo" : "facebookOembed";
            attempts[attemptKey] = { attempted: true, ok: false };
            try {
                const oembedUrl = `https://graph.facebook.com/v19.0/${endpoint}?url=${encodeURIComponent(targetUrl.toString())}&access_token=${encodeURIComponent(accessToken)}&fields=author_name,author_url,provider_name,provider_url,type,width,height,html,thumbnail_url,thumbnail_width,thumbnail_height`;
                const oembedRes = await nodeFetch(oembedUrl, { headers: { accept: "application/json" }, timeoutMs: 8000 });
                if (!oembedRes.ok)
                    return {};
                const oembedData = tryParseJson(await oembedRes.text());
                if (!oembedData)
                    return {};
                attempts[attemptKey]["ok"] = true;
                const result = {};
                if (oembedData["thumbnail_url"] && typeof oembedData["thumbnail_url"] === "string")
                    result.image = oembedData["thumbnail_url"];
                if (oembedData["author_name"])
                    result.title = decodeHtmlEntities(oembedData["author_name"]);
                else if (oembedData["html"]) {
                    const textMatch = oembedData["html"].match(/>([^<]+)</);
                    if (textMatch === null || textMatch === void 0 ? void 0 : textMatch[1])
                        result.title = decodeHtmlEntities(textMatch[1].trim());
                }
                if (oembedData["html"]) {
                    const descText = oembedData["html"]
                        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                    if (descText)
                        result.description = decodeHtmlEntities(descText);
                }
                return result;
            }
            catch (_a) {
                return {};
            }
        })());
        // ── Helper D: plugins/video.php embed page ───────────────────────────────
        const embedPagePromise = (async () => {
            if (!isVideoUrl)
                return {};
            attempts["facebookEmbedPage"] = { attempted: true, ok: false };
            try {
                const embedPageUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(targetUrl.toString())}`;
                const embedRes = await fetchTextWithTimeout(embedPageUrl, facebookPreviewHeaders, 8000);
                if (!embedRes.ok)
                    return {};
                attempts["facebookEmbedPage"]["ok"] = true;
                const embedMeta = extractMetadata(embedRes.text);
                const result = {};
                if (embedMeta.image) {
                    result.image = embedMeta.image;
                }
                else {
                    const posterMatch = embedRes.text.match(/poster=["']([^"']+)["']/i);
                    if (posterMatch === null || posterMatch === void 0 ? void 0 : posterMatch[1])
                        result.image = decodeHtmlEntities(posterMatch[1]);
                    else {
                        const bgImgMatch = embedRes.text.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
                        if (bgImgMatch === null || bgImgMatch === void 0 ? void 0 : bgImgMatch[1])
                            result.image = decodeHtmlEntities(bgImgMatch[1]);
                    }
                }
                return result;
            }
            catch (_a) {
                return {};
            }
        })();
        // ── Helper E: Jina AI proxy ──────────────────────────────────────────────
        const jinaPromise = (async () => {
            attempts["facebookJina"] = { attempted: true, ok: false };
            try {
                const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
                const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
                attempts["facebookJina"]["ok"] = proxied.ok;
                const fbMeta = extractMetadata(proxied.text);
                const result = {};
                if (fbMeta.title && !isGenericFacebookTitle(fbMeta.title))
                    result.title = fbMeta.title;
                if (fbMeta.description)
                    result.description = fbMeta.description;
                if (fbMeta.image)
                    result.image = fbMeta.image;
                return result;
            }
            catch (_a) {
                return {};
            }
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
        const embedPageResult = (_g = oembedResults[oembedResults.length - 2]) !== null && _g !== void 0 ? _g : {};
        const jinaResult = (_h = oembedResults[oembedResults.length - 1]) !== null && _h !== void 0 ? _h : {};
        const oembedMerged = oembedResults.slice(0, oembedResults.length - 2);
        for (const result of [mbasicResult, graphResult, ...oembedMerged, embedPageResult, jinaResult]) {
            if (!meta.image && result.image)
                meta.image = result.image;
            if (!meta.title && result.title)
                meta.title = result.title;
            if (!meta.description && result.description)
                meta.description = result.description;
        }
        // Replace any generic Facebook error title with a meaningful fallback
        if (isGenericFacebookTitle(meta.title)) {
            meta.title = getFacebookFallbackTitle(targetUrl.toString());
        }
        // Early return if Facebook still has nothing
        if (!meta.title && !meta.description && !meta.image) {
            const fallbackTitle = getFacebookFallbackTitle(targetUrl.toString());
            res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: targetUrl.toString(), contentType, status: primary.status, title: fallbackTitle, description: undefined, image: undefined, shareResolvedUrl }, (debug ? { debug: { attempts } } : {})));
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
                const resolvedUrl = new url_1.URL(redditResolved);
                targetUrl = resolvedUrl;
                finalUrl = cleanRedditUrl(resolvedUrl.toString());
                targetUrl = new url_1.URL(finalUrl);
                attempts["redditResolve"] = {
                    attempted: true,
                    ok: true,
                    resolvedUrl: finalUrl,
                    steps: redditResolveResult.debugAttempts,
                };
            }
            catch (_p) {
                // keep original targetUrl
            }
        }
        else if (originalRedditShort) {
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
            const redditJsonUrl = new url_1.URL(targetUrl.toString());
            redditJsonUrl.search = "";
            redditJsonUrl.hash = "";
            if (!redditJsonUrl.pathname.endsWith("/"))
                redditJsonUrl.pathname += "/";
            const jsonUrl = redditJsonUrl.toString() + ".json";
            const redditHeaders = Object.assign(Object.assign({}, headers), { "user-agent": "Mozilla/5.0 (compatible; 4Stash/1.0; +https://4stash.com)" });
            const jsonRes = await fetchTextWithTimeout(jsonUrl, redditHeaders, 8000);
            attempts["redditJson"]["ok"] = jsonRes.ok;
            if (jsonRes.ok) {
                const data = tryParseJson(jsonRes.text);
                const post = data === null || data === void 0 ? void 0 : data[0];
                const postData = post === null || post === void 0 ? void 0 : post["data"];
                const children = postData === null || postData === void 0 ? void 0 : postData["children"];
                const firstChild = children === null || children === void 0 ? void 0 : children[0];
                const p = firstChild === null || firstChild === void 0 ? void 0 : firstChild["data"];
                if (p) {
                    if (p["over_18"] === true || p["over18"] === true) {
                        const nsfwTitle = p["title"] ? decodeHtmlEntities(p["title"]) : "NSFW Reddit Post";
                        res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: targetUrl.toString(), contentType, status: primary.status, title: nsfwTitle, description: "This Reddit post is marked as NSFW (18+)", image: undefined, nsfw: true }, (debug ? { debug: { attempts } } : {})));
                        return;
                    }
                    if (!meta.title && p["title"])
                        meta.title = decodeHtmlEntities(p["title"]);
                    if (!meta.description && p["selftext"])
                        meta.description = decodeHtmlEntities(p["selftext"].replace(/\n+/g, " ").trim().substring(0, 300));
                    if (!meta.image) {
                        const preview = p["preview"];
                        const images = preview === null || preview === void 0 ? void 0 : preview["images"];
                        const firstImg = images === null || images === void 0 ? void 0 : images[0];
                        const source = firstImg === null || firstImg === void 0 ? void 0 : firstImg["source"];
                        if (source === null || source === void 0 ? void 0 : source["url"])
                            meta.image = decodeHtmlEntities(source["url"]).replace(/&amp;/g, "&");
                        else if (p["thumbnail"] && p["thumbnail"].startsWith("http"))
                            meta.image = p["thumbnail"];
                        else if (p["url"] && (p["url"].match(/\.(jpg|jpeg|png|gif|webp)$/i) || p["post_hint"] === "image"))
                            meta.image = p["url"];
                    }
                }
            }
        }
        catch ( /* Reddit JSON failed */_q) { /* Reddit JSON failed */ }
        // Reddit oEmbed — works server-side and returns the real post title.
        // Try this before Jina since it's more reliable.
        if (!meta.title) {
            attempts["redditOembed"] = { attempted: true, ok: false };
            try {
                const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`;
                const oembedRes = await fetchTextWithTimeout(oembedUrl, Object.assign(Object.assign({}, headers), { accept: "application/json" }), 8000);
                attempts["redditOembed"]["ok"] = oembedRes.ok;
                if (oembedRes.ok) {
                    const oembedData = tryParseJson(oembedRes.text);
                    if ((oembedData === null || oembedData === void 0 ? void 0 : oembedData["title"]) && typeof oembedData["title"] === "string") {
                        const t = decodeHtmlEntities(oembedData["title"]);
                        if (!isGenericRedditTitle(t))
                            meta.title = t;
                    }
                    if (!meta.title && (oembedData === null || oembedData === void 0 ? void 0 : oembedData["author_name"]) && typeof oembedData["author_name"] === "string") {
                        meta.title = `Post by u/${oembedData["author_name"]}`;
                    }
                }
            }
            catch ( /* ignore */_r) { /* ignore */ }
        }
        if (!meta.title || !meta.description || !meta.image) {
            attempts["redditJina"] = { attempted: true, ok: false };
            try {
                const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
                const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
                attempts["redditJina"]["ok"] = proxied.ok;
                const redditMeta = extractMetadata(proxied.text);
                if (!meta.title && redditMeta.title)
                    meta.title = redditMeta.title;
                if (!meta.description && redditMeta.description)
                    meta.description = redditMeta.description;
                if (!meta.image && redditMeta.image)
                    meta.image = redditMeta.image;
            }
            catch ( /* ignore */_s) { /* ignore */ }
        }
        // If title is still a generic error string (e.g. "403" from the error page HTML),
        // clear it so the client falls back to its own "Reddit Post in r/..." label.
        if (isGenericRedditTitle(meta.title))
            meta.title = undefined;
    }
    // Threads
    const isThreads = targetUrl.hostname.includes("threads.com") || targetUrl.hostname.includes("threads.net");
    if (isThreads && (!meta.title || !meta.description || !meta.image)) {
        attempts["threadsJina"] = { attempted: true, ok: false };
        try {
            const threadsHeaders = {
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.9",
            };
            const threadsRes = await fetchTextWithTimeout(targetUrl.toString(), threadsHeaders, 10000);
            attempts["threadsJina"]["ok"] = threadsRes.ok;
            if (threadsRes.ok) {
                const threadsMeta = extractMetadata(threadsRes.text);
                if (threadsMeta.title && threadsMeta.title !== "403")
                    meta.title = threadsMeta.title;
                if (threadsMeta.description)
                    meta.description = threadsMeta.description;
                if (threadsMeta.image)
                    meta.image = threadsMeta.image;
            }
        }
        catch ( /* ignore */_t) { /* ignore */ }
    }
    const image = meta.image ? new url_1.URL(meta.image, finalUrl).toString() : undefined;
    const proxiedImage = (() => {
        if (!image)
            return undefined;
        try {
            const host = new url_1.URL(image).hostname;
            return shouldProxyImageHost(host) ? `/api/proxy-image?url=${encodeURIComponent(image)}` : image;
        }
        catch (_a) {
            return image;
        }
    })();
    res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: finalUrl, contentType, status: primary.status, title: meta.title, description: meta.description, image: proxiedImage, redditShortUnresolved }, (debug ? { debug: { isInstagram, attempts, extracted: { hasTitle: !!meta.title, hasDescription: !!meta.description, hasImage: !!meta.image } } } : {})));
}
// ---------------------------------------------------------------------------
// Exported Cloud Function
// ---------------------------------------------------------------------------
exports.api = (0, https_1.onRequest)({
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    secrets: [FB_APP_ID, FB_APP_SECRET, THREADS_APP_SECRET],
}, async (req, res) => {
    await handleRequest(req, res, FB_APP_ID.value(), FB_APP_SECRET.value(), THREADS_APP_SECRET.value());
});
exports.home = (0, https_1.onRequest)({
    region: "us-central1",
    timeoutSeconds: 10,
    memory: "128MiB",
}, async (req, res) => {
    await handleHomeRequest(req, res);
});
//# sourceMappingURL=index.js.map