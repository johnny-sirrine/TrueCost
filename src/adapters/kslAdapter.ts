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
      canonical: {},
      fieldMeta: {},
      warnings: [
        'KSL URL detected, but automatic extraction from pasted URLs is not supported yet.',
        'We only saved the source URL from this step.',
        'Paste the listing text on the Text tab or enter the vehicle details manually before saving.',
        listingId ? `KSL listing ID: ${listingId}` : '',
      ].filter(Boolean),
    };
  },
};
