import { describe, expect, it } from 'vitest';
import { detectSourceFromText, detectSourceFromUrl, extractFirstUrlFromText } from './detectSource';

describe('detectSourceFromUrl', () => {
  it('recognizes facebook marketplace URLs across supported subdomains', () => {
    expect(detectSourceFromUrl('https://m.facebook.com/marketplace/item/123?ref=bookmark')).toBe('facebook');
    expect(detectSourceFromUrl('https://www.facebook.com/marketplace/item/123')).toBe('facebook');
    expect(detectSourceFromUrl('https://fb.com/marketplace/item/123')).toBe('facebook');
  });

  it('requires marketplace path for facebook hosts', () => {
    expect(detectSourceFromUrl('https://www.facebook.com/groups/truecost')).toBeNull();
    expect(detectSourceFromUrl('https://fb.com/some-short-link')).toBeNull();
  });

  it('recognizes allowlisted hosts with query strings and trailing punctuation', () => {
    expect(detectSourceFromUrl('https://www.ksl.com/listing/12345?foo=bar')).toBe('ksl');
    expect(detectSourceFromUrl('https://cars.ksl.com/search?make=Honda')).toBe('ksl');
    expect(detectSourceFromUrl('https://www.cars.com/vehicledetail/123?aff=share,')).toBe('carscom');
    expect(detectSourceFromUrl('https://saltlakecity.craigslist.org/cto/d/example/123.html.)')).toBe('craigslist');
  });

  it('returns null for malformed or non-allowlisted URLs instead of guessing', () => {
    expect(detectSourceFromUrl('not a url')).toBeNull();
    expect(detectSourceFromUrl('https://example.com/?next=https://www.facebook.com/marketplace/item/123')).toBeNull();
    expect(detectSourceFromUrl('https://totally-not-cars.com/vehicledetail/123')).toBeNull();
  });
});

describe('detectSourceFromText', () => {
  it('detects embedded recognized URLs and preserves the override path', () => {
    expect(
      detectSourceFromText(
        'See this listing: https://m.facebook.com/marketplace/item/123?ref=bookmark, looks promising.',
      ),
    ).toEqual({
      source: 'facebook',
      url: 'https://m.facebook.com/marketplace/item/123?ref=bookmark',
    });
  });
});

describe('extractFirstUrlFromText', () => {
  it('returns embedded URLs even when they are not recognized sources', () => {
    expect(
      extractFirstUrlFromText(
        'See this listing: https://example.com/car/123, looks promising.',
      ),
    ).toBe('https://example.com/car/123');
  });
});
