import type { ListingSource } from '../types';

const TRAILING_URL_PUNCTUATION = /[),.;!?\]]+$/;

function stripTrailingUrlPunctuation(url: string): string {
  return url.trim().replace(TRAILING_URL_PUNCTUATION, '');
}

export function extractFirstUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/i);
  if (!match) return null;
  return stripTrailingUrlPunctuation(match[0]);
}

function parseUrlForDetection(rawUrl: string): URL | null {
  const cleaned = stripTrailingUrlPunctuation(rawUrl);
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function hostnameMatches(hostname: string, allowedDomain: string): boolean {
  return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
}

function isFacebookMarketplaceUrl(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  if (!hostnameMatches(host, 'facebook.com') && !hostnameMatches(host, 'fb.com')) {
    return false;
  }
  return parsed.pathname.toLowerCase().startsWith('/marketplace');
}

function isKslUrl(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  if (hostnameMatches(host, 'cars.ksl.com')) {
    return true;
  }
  if (host === 'ksl.com' || host === 'www.ksl.com') {
    return /\/listing(?:\/|$)/i.test(parsed.pathname);
  }
  return false;
}

/** Map a listing URL to its canonical `ListingSource`. Returns null when
 *  the domain isn't one we explicitly recognize — callers should fall back
 *  to whatever default is appropriate for their entry path (raw_text,
 *  manual, etc.). Kept separate from the URL-specific adapters so any
 *  code path that has a URL can classify it consistently: the rawText
 *  adapter uses it to detect URLs embedded in pasted copy; the add
 *  dialog uses it to classify the optional `sourceUrl` field the user
 *  can type on any tab. */
export function detectSourceFromUrl(url: string): ListingSource | null {
  const parsed = parseUrlForDetection(url);
  if (!parsed) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (isFacebookMarketplaceUrl(parsed)) {
    return 'facebook';
  }
  if (isKslUrl(parsed)) {
    return 'ksl';
  }
  if (hostnameMatches(host, 'cars.com')) {
    return 'carscom';
  }
  if (hostnameMatches(host, 'craigslist.org')) {
    return 'craigslist';
  }
  return null;
}

/** Scan arbitrary text for the first http(s) URL and classify it.
 *  Strips common trailing punctuation so URLs pasted mid-sentence
 *  don't get mangled. */
export function detectSourceFromText(
  text: string,
): { source: ListingSource; url: string } | null {
  const url = extractFirstUrlFromText(text);
  if (!url) return null;
  const source = detectSourceFromUrl(url);
  if (!source) return null;
  return { source, url };
}
