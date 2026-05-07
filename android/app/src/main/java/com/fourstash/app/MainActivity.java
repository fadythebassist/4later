package com.fourstash.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "4StashShare";

    // Pending share URL from a cold-start share intent — held until the
    // WebView has finished loading the app, then dispatched.
    private String pendingShareText = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Intent intent = getIntent();
        if (isShareIntent(intent)) {
            pendingShareText = intent.getStringExtra(Intent.EXTRA_TEXT);
            Log.d(TAG, "onCreate: captured share text, will dispatch after page load");
        }

        // Remove the "; wv" marker from the WebView user agent string.
        // Third-party embed scripts (Threads, Instagram) detect WebViews via
        // this marker and serve degraded experiences — showing static posters
        // with "open in app" redirects instead of inline video players.
        // By removing the marker, embeds treat our WebView as a regular Chrome
        // browser and render full interactive content (inline video playback).
        WebSettings webSettings = getBridge().getWebView().getSettings();

        // Replace the default WebView UA with a standard Chrome Mobile UA.
        // YouTube (and other embeds) actively block the default Android WebView
        // UA — this makes the WebView appear as a regular Chrome browser.
        // We append "FourstashApp/1.0" so our JS can still detect the WebView
        // context (e.g. to skip embeds that don't work in-app).
        webSettings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 10; Mobile) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Mobile Safari/537.36 FourstashApp/1.0"
        );

        // Enable DOM storage — required for YouTube's session/auth state.
        webSettings.setDomStorageEnabled(true);
        // Allow media to autoplay without a user gesture (muted autoplay).
        webSettings.setMediaPlaybackRequiresUserGesture(false);

        // Enable third-party cookies so YouTube embed iframes can authenticate.
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);

        // Hook into the WebView's page-load lifecycle so we can reliably
        // fire JS after the SPA has fully initialized, while also intercepting
        // external platform URLs (intent://, fb://, instagram://, etc.) and
        // routing them to the correct native app via Android intents.
        getBridge().getWebView().setWebViewClient(new WebViewClient() {


            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String url = uri.toString();

                // Let Instagram/Threads embeds handle their own iframe media
                // navigation. Only top-level app navigations should be routed
                // out to Android native intents or the system browser.
                if (!request.isForMainFrame()) {
                    return false;
                }

                // Let the app and dev access/PIN auth origins load normally inside the WebView.
                if ("https".equals(scheme) && isAllowedWebViewHost(uri.getHost())) {
                    return false;
                }

                // Allow threads.net to load inside the WebView so that Threads
                // embed iframes can navigate for video playback. Without this,
                // tapping a video inside a Threads embed triggers the external-URL
                // handler below and opens the Threads native app instead.
                // Covers www.threads.net, threads.net, and any CDN subdomains.
                String host = uri.getHost();
                if ("https".equals(scheme) && host != null && (host.equals("threads.net") || host.endsWith(".threads.net"))) {
                    return false;
                }

                // Route intent:// URIs and known native app schemes to Android.
                if ("intent".equals(scheme)
                        || "fb".equals(scheme)
                        || "instagram".equals(scheme)
                        || "tiktok".equals(scheme)
                        || "reddit".equals(scheme)
                        || "twitter".equals(scheme)
                        || "x".equals(scheme)) {
                    try {
                        Intent i = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        startActivity(i);
                    } catch (Exception e) {
                        // App not installed — open fallback https:// URL in browser.
                        String fallback = uri.getQueryParameter("browser_fallback_url");
                        if (fallback == null || fallback.isEmpty()) {
                            // For raw native schemes, reconstruct an https URL.
                            fallback = url.replaceFirst("^[a-z]+://", "https://www.");
                        }
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallback)));
                        } catch (Exception ex) {
                            Log.e(TAG, "Could not open fallback URL: " + fallback, ex);
                        }
                    }
                    return true;
                }

                // Any other external https:// URL — open in system browser.
                if ("https".equals(scheme) || "http".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception e) {
                        Log.e(TAG, "Could not open external URL: " + url, e);
                    }
                    return true;
                }

                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d(TAG, "onPageFinished: " + url);
                if (url != null && isAppUrl(url) && pendingShareText != null) {
                    String text = pendingShareText;
                    pendingShareText = null;
                    // Give React/router a moment to mount before navigating.
                    new Handler(Looper.getMainLooper()).postDelayed(
                        () -> dispatchShare(text),
                        500
                    );
                }
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.d(TAG, "onNewIntent received");
        if (isShareIntent(intent)) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text != null && !text.isEmpty()) {
                // If onCreate already captured this share (cold-start), the
                // onPageFinished hook will handle it — don't fire twice.
                if (pendingShareText != null) {
                    Log.d(TAG, "onNewIntent: cold-start duplicate, skipping (onPageFinished will handle)");
                    return;
                }
                Log.d(TAG, "onNewIntent: warm share, dispatching after 300ms delay");
                // App is already running — give React a moment to settle, then fire.
                new Handler(Looper.getMainLooper()).postDelayed(
                    () -> dispatchShare(text),
                    300
                );
            }
        }
    }

    private boolean isShareIntent(Intent intent) {
        return intent != null
            && Intent.ACTION_SEND.equals(intent.getAction())
            && "text/plain".equals(intent.getType());
    }

    private boolean isAppUrl(String url) {
        Uri uri = Uri.parse(url);
        return "https".equals(uri.getScheme()) && isAllowedWebViewHost(uri.getHost());
    }

    private boolean isAllowedWebViewHost(String host) {
        return "4stash.com".equals(host)
            || "dev.4stash.com".equals(host)
            || (host != null && host.endsWith(".cloudflareaccess.com"));
    }

    private void dispatchShare(String text) {
        String encoded = text
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");

        String currentUrl = getBridge().getWebView().getUrl();
        Log.d(TAG, "dispatchShare: currentUrl=" + currentUrl);

        // Store share data in a global so Dashboard can pick it up even if the
        // event fires before the React listener is mounted (cold-start / auth delay).
        // Also fire a CustomEvent for the warm-start case where listener is ready.
        String js =
            "window.__pendingCapacitorShare = { url: \"" + encoded + "\" };" +
            "window.dispatchEvent(new CustomEvent('capacitor-share'," +
            "{ detail: { url: \"" + encoded + "\" } }));";
        Log.d(TAG, "dispatchShare: setting pending share + firing capacitor-share event");
        getBridge().getWebView().post(
            () -> getBridge().getWebView().evaluateJavascript(js, null)
        );
    }
}
