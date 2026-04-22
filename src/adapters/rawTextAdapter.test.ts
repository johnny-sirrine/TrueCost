import { describe, expect, it } from 'vitest';
import { rawTextAdapter } from './rawTextAdapter';

describe('rawTextAdapter', () => {
  it('parses k-suffixed mileage as full miles', async () => {
    const result = await rawTextAdapter.parse(`
      2018 Honda CR-V EX-L AWD
      $22,500
      120k mi
      Clean title
    `);

    expect(result.suggestedMileage).toBe(120000);
    expect(result.listing.rawMileage).toBe(120000);
    expect(result.fieldMeta.mileage).toMatchObject({
      origin: 'extracted',
      confidence: 'medium',
    });
  });

  it('keeps raw_text and adds explicit warnings for unrecognized embedded URLs', async () => {
    const result = await rawTextAdapter.parse(`
      2018 Honda CR-V EX-L AWD
      $22,500
      120k mi
      See more: https://example.com/car/123
    `);

    expect(result.listing.source).toBe('raw_text');
    expect(result.listing.sourceUrl).toBeUndefined();
    expect(result.warnings).toContain('An embedded URL doesn’t match a supported source we can identify confidently.');
    expect(result.warnings).toContain('We kept the URL, but did not infer the source.');
    expect(result.warnings).toContain('The listing will stay labeled as Pasted Text unless you enter a recognized source URL.');
  });

  it('still lets recognized embedded URLs override raw_text', async () => {
    const result = await rawTextAdapter.parse(`
      2018 Honda CR-V EX-L AWD
      $22,500
      120k mi
      See more: https://m.facebook.com/marketplace/item/123?ref=bookmark
    `);

    expect(result.listing.source).toBe('facebook');
    expect(result.listing.sourceUrl).toBe('https://m.facebook.com/marketplace/item/123?ref=bookmark');
  });
});
