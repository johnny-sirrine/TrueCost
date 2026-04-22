import type { ListingAdapter, ParseResult } from '../types';

export const facebookAdapter: ListingAdapter = {
  id: 'facebook',
  name: 'Facebook Marketplace',
  canHandle: (input: string) => {
    return input.includes('facebook.com/marketplace') || input.includes('fb.com');
  },
  parse: async (input: string): Promise<ParseResult> => {
    return {
      listing: {
        source: 'facebook',
        sourceUrl: input.trim(),
      },
      canonical: { year: 2020, make: '', model: '' },
      fieldMeta: {},
      warnings: [
        'Facebook Marketplace URL detected. Scraping is LOW reliability.',
        'Please paste the listing text or enter vehicle details manually.',
      ],
    };
  },
};
