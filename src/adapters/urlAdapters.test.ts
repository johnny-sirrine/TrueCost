import { describe, expect, it } from 'vitest';
import { carsComAdapter } from './carsComAdapter';
import { facebookAdapter } from './facebookAdapter';
import { kslAdapter } from './kslAdapter';

describe('URL adapters', () => {
  it('do not fabricate canonical fields for KSL URLs', async () => {
    const result = await kslAdapter.parse('https://cars.ksl.com/listing/123456');

    expect(result.canonical).toEqual({});
    expect(result.listing.sourceUrl).toBe('https://cars.ksl.com/listing/123456');
  });

  it('do not fabricate canonical fields for Facebook URLs', async () => {
    const result = await facebookAdapter.parse('https://www.facebook.com/marketplace/item/123');

    expect(result.canonical).toEqual({});
    expect(result.listing.sourceUrl).toBe('https://www.facebook.com/marketplace/item/123');
  });

  it('do not fabricate canonical fields for Cars.com URLs', async () => {
    const result = await carsComAdapter.parse('https://www.cars.com/vehicledetail/123');

    expect(result.canonical).toEqual({});
    expect(result.listing.sourceUrl).toBe('https://www.cars.com/vehicledetail/123');
  });
});
