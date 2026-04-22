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
});
