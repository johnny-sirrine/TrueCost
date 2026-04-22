import { detectSourceFromUrl } from '../../adapters/detectSource';
import type { ListingSource } from '../../types';

export const PASTED_TEXT_UNRECOGNIZED_SOURCE_URL_WARNING_LINES = [
  'This URL doesn’t match a supported source we can identify confidently.',
  'We kept the URL, but did not infer the source.',
  'The listing will stay labeled as Pasted Text unless you enter a recognized source URL.',
] as const;

export function isUnrecognizedPastedTextSourceUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.length > 0 && detectSourceFromUrl(trimmed) === null;
}

export function getPastedTextSourceUrlWarningLines(url: string): string[] {
  return isUnrecognizedPastedTextSourceUrl(url)
    ? [...PASTED_TEXT_UNRECOGNIZED_SOURCE_URL_WARNING_LINES]
    : [];
}

export function resolveAddListingSource(args: {
  tab: 'url' | 'text' | 'manual';
  sourceUrl: string;
  parsedListingSource?: ListingSource;
}): ListingSource {
  const sourceUrlTrimmed = args.sourceUrl.trim();
  const urlFieldSource = sourceUrlTrimmed ? detectSourceFromUrl(sourceUrlTrimmed) : null;
  const fallbackSource =
    args.tab === 'url'
      ? (args.parsedListingSource ?? 'manual')
      : args.tab === 'text'
        ? (args.parsedListingSource ?? 'raw_text')
        : 'manual';
  return urlFieldSource ?? fallbackSource;
}
