import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description?: string;
  canonical: string;
}

/**
 * Sets document.title, meta description, and the canonical <link> tag
 * for the current route. Restores defaults on unmount.
 */
const DEFAULT_TITLE = "4Stash - Save Content for Later";
const DEFAULT_DESCRIPTION =
  "Save and organize multimedia content for later";
const DEFAULT_CANONICAL = "https://4stash.com/";

export function usePageMeta({
  title,
  description,
  canonical,
}: PageMetaOptions): void {
  useEffect(() => {
    // Title
    document.title = title;

    // Meta description
    const metaDesc = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    if (metaDesc && description) {
      metaDesc.content = description;
    }

    // Canonical
    const canonicalEl = document.getElementById(
      "canonical-url"
    ) as HTMLLinkElement | null;
    if (canonicalEl) {
      canonicalEl.href = canonical;
    }

    return () => {
      document.title = DEFAULT_TITLE;
      if (metaDesc) metaDesc.content = DEFAULT_DESCRIPTION;
      if (canonicalEl) canonicalEl.href = DEFAULT_CANONICAL;
    };
  }, [title, description, canonical]);
}
