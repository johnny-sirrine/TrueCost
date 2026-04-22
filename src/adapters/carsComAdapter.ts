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
      canonical: {},
      fieldMeta: {},
      warnings: [
        'Cars.com URL detected, but automatic extraction from pasted URLs is not supported yet.',
        'We only saved the source URL from this step.',
        'Paste the listing text on the Text tab or enter the vehicle details manually before saving.',
      ],
    };
  },
};
