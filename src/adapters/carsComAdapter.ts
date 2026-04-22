import type { ListingAdapter, ParseResult } from '../types';

export const carsComAdapter: ListingAdapter = {
  id: 'carscom',
  name: 'Cars.com',
  canHandle: (input: string) => {
    return input.includes('cars.com');
  },
  parse: async (input: string): Promise<ParseResult> => {
    return {
      listing: {
        source: 'carscom',
        sourceUrl: input.trim(),
      },
      canonical: { year: 2020, make: '', model: '' },
      fieldMeta: {},
      warnings: [
        'Cars.com URL detected but automatic scraping is not available in v1.',
        'Please paste the listing text or enter vehicle details manually.',
      ],
    };
  },
};
