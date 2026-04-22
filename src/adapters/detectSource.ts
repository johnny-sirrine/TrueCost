import type { ListingSource } from '../types';

/** Map a listing URL to its canonical `ListingSource`. Returns null when
 *  the domain isn't one we explicitly recognize — callers should fall back
 *  to whatever default is appropriate for their entry path (raw_text,
 *  manual, etc.). Kept separate from the URL-specific adapters so any
 *  code path that has a URL can classify it consistently: the rawText
 *  adapter uses it to detect URLs embedded in pasted copy; the add
 *  dialog uses it to classify the optional `sourceUrl` field the user
 *  can type on any tab. */
export function detectSourceFromUrl(url: string): ListingSource | null {
  const lower = url.toLowerCase();
  if (lower.includes('facebook.com/marketplace') || lower.includes('fb.com')) {
    return 'facebook';
  }
  if (lower.includes('ksl.com/listing') || lower.includes('cars.ksl.com')) {
    return 'ksl';
  }
  if (lower.includes('cars.com')) {
    return 'carscom';
  }
  if (lower.includes('craigslist.org')) {
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
  const match = text.match(/https?:\/\/\S+/i);
  if (!match) return null;
  const url = match[0].replace(/[),.;!?\]]+$/, '');
  const source = detectSourceFromUrl(url);
  if (!source) return null;
  return { source, url };
}
