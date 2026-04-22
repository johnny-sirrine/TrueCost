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
      canonical: {},
      fieldMeta: {},
      warnings: [
        'Facebook Marketplace URL detected, but automatic extraction from pasted URLs is not supported yet.',
        'We only saved the source URL from this step.',
        'Paste the listing text on the Text tab or enter the vehicle details manually before saving.',
      ],
    };
  },
};
