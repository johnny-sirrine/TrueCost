import type { ListingAdapter, ParseResult } from '../types';

// KSL adapter stub. In v1, this does NOT scrape.
// It accepts KSL URLs and returns a minimal result prompting the user to paste listing text.
export const kslAdapter: ListingAdapter = {
  id: 'ksl',
  name: 'KSL Cars',
  canHandle: (input: string) => {
    return input.includes('ksl.com/listing') || input.includes('cars.ksl.com');
  },
  parse: async (input: string): Promise<ParseResult> => {
    // Extract listing ID from URL for reference
    const idMatch = input.match(/listing\/(\d+)/);
    const listingId = idMatch ? idMatch[1] : undefined;

    return {
      listing: {
        source: 'ksl',
        sourceUrl: input.trim(),
      },
      canonical: {
        year: 2020,
        make: '',
        model: '',
      },
      fieldMeta: {},
      warnings: [
        'KSL URL detected but automatic scraping is not available in v1.',
        'Please paste the listing text or enter vehicle details manually.',
        listingId ? `KSL listing ID: ${listingId}` : '',
      ].filter(Boolean),
    };
  },
};
