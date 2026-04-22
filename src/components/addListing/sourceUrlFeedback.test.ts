import { describe, expect, it } from 'vitest';
import {
  getPastedTextSourceUrlWarningLines,
  isUnrecognizedPastedTextSourceUrl,
  resolveAddListingSource,
} from './sourceUrlFeedback';

describe('sourceUrlFeedback', () => {
  it('returns warnings for unrecognized pasted-text source URLs', () => {
    expect(getPastedTextSourceUrlWarningLines('https://example.com/car/123')).toEqual([
      'This URL doesn’t match a supported source we can identify confidently.',
      'We kept the URL, but did not infer the source.',
      'The listing will stay labeled as Pasted Text unless you enter a recognized source URL.',
    ]);
    expect(isUnrecognizedPastedTextSourceUrl('https://example.com/car/123')).toBe(true);
  });

  it('does not warn for empty or recognized pasted-text source URLs', () => {
    expect(getPastedTextSourceUrlWarningLines('')).toEqual([]);
    expect(getPastedTextSourceUrlWarningLines('https://m.facebook.com/marketplace/item/123')).toEqual([]);
    expect(isUnrecognizedPastedTextSourceUrl('https://m.facebook.com/marketplace/item/123')).toBe(false);
  });

  it('keeps raw_text when the optional source URL is unrecognized', () => {
    expect(
      resolveAddListingSource({
        tab: 'text',
        sourceUrl: 'https://example.com/car/123',
        parsedListingSource: 'raw_text',
      }),
    ).toBe('raw_text');
  });

  it('keeps a recognized embedded source when the optional source URL is unrecognized', () => {
    expect(
      resolveAddListingSource({
        tab: 'text',
        sourceUrl: 'https://example.com/car/123',
        parsedListingSource: 'facebook',
      }),
    ).toBe('facebook');
  });

  it('lets a recognized optional source URL override raw_text', () => {
    expect(
      resolveAddListingSource({
        tab: 'text',
        sourceUrl: 'https://m.facebook.com/marketplace/item/123',
        parsedListingSource: 'raw_text',
      }),
    ).toBe('facebook');
  });
});
