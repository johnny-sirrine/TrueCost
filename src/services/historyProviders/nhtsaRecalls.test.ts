import { describe, it, expect } from 'vitest';
import { fetchRecalls } from './nhtsaRecalls';

describe('fetchRecalls', () => {
  it('maps NHTSA recall results to HistoryFlag shape', async () => {
    const fakeResponse = {
      Count: 1,
      results: [
        {
          NHTSACampaignNumber: '23V001000',
          Component: 'FUEL SYSTEM, GASOLINE',
          Summary: 'The fuel pump may fail.',
          Consequence: 'A fuel pump failure could cause an engine stall, increasing the risk of a crash.',
          Remedy: 'Dealers will replace the fuel pump, free of charge.',
        },
      ],
    };
    const fetchImpl = () =>
      Promise.resolve(new Response(JSON.stringify(fakeResponse), { status: 200 }));

    const flags = await fetchRecalls(
      { year: 2014, make: 'Chevrolet', model: 'Captiva' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(flags).toHaveLength(1);
    const flag = flags[0];
    expect(flag.source).toBe('nhtsa_recalls');
    expect(flag.category).toBe('open_recall');
    expect(flag.identifier).toBe('23V001000');
    expect(flag.title).toMatch(/fuel/i);
    // Mentions of "crash" should escalate to critical severity.
    expect(flag.severity).toBe('critical');
    expect(flag.link).toContain('nhtsaId=23V001000');
    expect(flag.detail).toContain('Remedy');
  });

  it('classifies non-crash consequences as watch, not critical', async () => {
    const fakeResponse = {
      results: [
        {
          NHTSACampaignNumber: '23V999000',
          Component: 'BACKUP CAMERA',
          Summary: 'The backup camera image may be delayed.',
          Consequence: 'A delayed image may reduce visibility during reversing.',
        },
      ],
    };
    const fetchImpl = () =>
      Promise.resolve(new Response(JSON.stringify(fakeResponse), { status: 200 }));

    const flags = await fetchRecalls(
      { year: 2020, make: 'Ford', model: 'Escape' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(flags[0].severity).toBe('watch');
  });

  it('returns an empty array when NHTSA reports no recalls', async () => {
    const fakeResponse = { Count: 0, results: [] };
    const fetchImpl = () =>
      Promise.resolve(new Response(JSON.stringify(fakeResponse), { status: 200 }));

    const flags = await fetchRecalls(
      { year: 2024, make: 'Toyota', model: 'Corolla' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(flags).toEqual([]);
  });

  it('throws on non-ok HTTP responses so the resolver can surface the error', async () => {
    const fetchImpl = () =>
      Promise.resolve(new Response('', { status: 503 }));

    await expect(
      fetchRecalls(
        { year: 2020, make: 'Honda', model: 'CR-V' },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/503/);
  });

  it('falls back to a generic NHTSA search URL when no campaign number is present', async () => {
    const fakeResponse = {
      results: [
        {
          Component: 'ENGINE',
          Summary: 'Partial data.',
          Consequence: 'Unknown.',
        },
      ],
    };
    const fetchImpl = () =>
      Promise.resolve(new Response(JSON.stringify(fakeResponse), { status: 200 }));

    const flags = await fetchRecalls(
      { year: 2005, make: 'Nissan', model: 'Frontier' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(flags[0].link).toContain('vehicleModelYear=2005');
    expect(flags[0].link).toContain('vehicleMake=Nissan');
    expect(flags[0].identifier).toBeUndefined();
  });
});
