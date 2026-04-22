import { describe, it, expect } from 'vitest';
import { decodeVin, validateVin } from './vinDecoder';

describe('validateVin', () => {
  it('accepts a well-known valid VIN', () => {
    // 2003 Honda Accord EX V6 — canonical ISO 3779 check-digit example.
    const result = validateVin('1HGCM82633A004352');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('1HGCM82633A004352');
  });

  it('rejects VINs of the wrong length', () => {
    expect(validateVin('1HGCM82633A00435').valid).toBe(false);
    expect(validateVin('1HGCM82633A0043520').valid).toBe(false);
  });

  it('rejects VINs containing disallowed I/O/Q characters', () => {
    const result = validateVin('1HGCM82633A00I352');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid character/i);
  });

  it('rejects VINs that fail the check-digit math', () => {
    // Flip the check-digit from 3 to 4 — everything else legal.
    const result = validateVin('1HGCM82644A004352');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/check digit/i);
  });

  it('normalizes case and trims whitespace', () => {
    const result = validateVin('  1hgcm82633a004352  ');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('1HGCM82633A004352');
  });
});

describe('decodeVin', () => {
  it('returns null for a locally-invalid VIN without calling the network', async () => {
    const fetchImpl = () => Promise.reject(new Error('network should not be called'));
    const result = await decodeVin('not-a-vin', { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toBeNull();
  });

  it('maps vPIC response fields onto the canonical result shape', async () => {
    const fakeResponse = {
      Results: [
        {
          ModelYear: '2018',
          Make: 'HONDA',
          Model: 'CR-V',
          Trim: 'EX-L',
          Series: 'EX',
          BodyClass: 'Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)',
          DriveType: 'AWD/All-Wheel Drive',
          FuelTypePrimary: 'Gasoline',
          EngineCylinders: '4',
        },
      ],
    };
    const fetchImpl = () =>
      Promise.resolve(
        new Response(JSON.stringify(fakeResponse), { status: 200 }),
      );

    const result = await decodeVin('1HGCM82633A004352', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).not.toBeNull();
    expect(result?.year).toBe(2018);
    expect(result?.make).toBe('HONDA');
    expect(result?.model).toBe('CR-V');
    // Trim preferred over Series when both present.
    expect(result?.trim).toBe('EX-L');
    expect(result?.drivetrain).toBe('awd');
    expect(result?.engineType).toBe('gas');
    expect(result?.cylinders).toBe(4);
  });

  it('prefers 4WD over AWD when DriveType says 4-Wheel Drive', async () => {
    const fakeResponse = {
      Results: [
        {
          ModelYear: '2010',
          Make: 'TOYOTA',
          Model: '4Runner',
          DriveType: '4WD/4-Wheel Drive/4x4',
        },
      ],
    };
    const fetchImpl = () =>
      Promise.resolve(
        new Response(JSON.stringify(fakeResponse), { status: 200 }),
      );

    const result = await decodeVin('1HGCM82633A004352', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result?.drivetrain).toBe('4wd');
  });

  it('returns null on non-ok HTTP responses', async () => {
    const fetchImpl = () =>
      Promise.resolve(new Response('', { status: 500 }));
    const result = await decodeVin('1HGCM82633A004352', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('returns null when fetch rejects (e.g. network down)', async () => {
    const fetchImpl = () => Promise.reject(new Error('offline'));
    const result = await decodeVin('1HGCM82633A004352', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('maps plug-in fuel types to phev', async () => {
    const fakeResponse = {
      Results: [
        { ModelYear: '2020', Make: 'TOYOTA', Model: 'RAV4', FuelTypePrimary: 'Plug-in Hybrid Electric (PHEV)' },
      ],
    };
    const fetchImpl = () =>
      Promise.resolve(new Response(JSON.stringify(fakeResponse), { status: 200 }));
    const result = await decodeVin('1HGCM82633A004352', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result?.engineType).toBe('phev');
  });
});
