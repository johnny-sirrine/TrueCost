// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComputedVehicle } from '../../hooks/useComputedBoard';
import type { GlobalAssumptions } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { BoardTable } from './BoardTable';

const updateVehicle = vi.fn(async () => {});

const assumptions: GlobalAssumptions = {
  id: 'default',
  annualMiles: 11000,
  gasPrice: 4,
  salesTaxRate: 0.0725,
  ownershipYears: 5,
  usagePattern: 'mixed',
  defaultCondition: 'average',
  optimismLevel: 'neutral',
  insuranceCoverageDefault: 'liability_only',
  driverAgeRange: '25_39',
  drivingRecord: 'clean',
  annualRegistrationFees: 200,
  monthlyParkingAndTolls: 0,
  includeMajorRepairReserveInFirstYear: true,
  includeMajorRepairReserveInTotalCost: true,
};

const DEFAULT_VISIBILITY = {
  rating: false,
  fuel: false,
  routine: false,
  repairs: false,
  registration: false,
  parking: false,
  baseline: false,
  insurance: false,
  reserve: false,
  catchUp: false,
  fees: false,
  salesTax: false,
  resaleLoss: false,
  resale: false,
  confidence: false,
};

vi.mock('../../hooks/useAssumptions', () => ({
  useAssumptions: () => assumptions,
}));

vi.mock('../../hooks/useVehicleActions', () => ({
  useVehicleActions: () => ({
    addVehicle: vi.fn(async () => {}),
    updateVehicle,
    removeVehicle: vi.fn(async () => {}),
    duplicateVehicle: vi.fn(async () => ''),
    togglePin: vi.fn(async () => {}),
    toggleArchive: vi.fn(async () => {}),
    setCurrentCar: vi.fn(async () => {}),
  }),
}));

vi.mock('../../store/toastStore', () => ({
  useToastStore: (selector: (state: { showToast: (...args: unknown[]) => void }) => unknown) =>
    selector({ showToast: vi.fn() }),
}));

vi.mock('./CellTooltip', () => ({
  CellTooltip: ({ children }: { children: unknown }) => <>{children}</>,
}));

function makeComputedVehicle(args: {
  id: string;
  isCurrentCar: boolean;
  location?: string;
  notes: string;
  titleStatus?: 'clean' | 'rebuilt';
  make?: string;
  model?: string;
  price?: number;
  mileage?: number;
  feesCost?: number;
  catchUpCost?: number;
  pinned?: boolean;
}): ComputedVehicle {
  const make = args.make ?? (args.isCurrentCar ? 'Honda' : 'Subaru');
  const model = args.model ?? (args.isCurrentCar ? 'CR-V' : 'Outback');
  const price = args.price ?? (args.isCurrentCar ? 0 : 9251);
  const mileage = args.mileage ?? (args.isCurrentCar ? 145000 : 130777);
  return {
    vehicle: {
      id: args.id,
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
      listing: {
        source: 'facebook',
        sourceUrl: `https://facebook.com/marketplace/item/${args.id}`,
        location: args.location,
        sellerType: 'unknown',
      },
      canonical: {
        year: args.isCurrentCar ? 2016 : 2018,
        make,
        model,
        trim: args.isCurrentCar ? 'EX' : 'Premium',
        drivetrain: 'awd',
        engineType: 'gas',
        transmissionType: 'automatic',
        vehicleClass: 'midsize_crossover',
        epaCombinedMpg: 25,
        bodyStyle: 'wagon',
      },
      user: {
        listingPrice: price,
        mileage,
        titleStatus: args.titleStatus ?? 'clean',
        conditionLevel: 'average',
        modificationLevel: 'stock',
        catchUpCost: args.catchUpCost ?? 0,
        feesCost: args.feesCost ?? 0,
        notes: args.notes,
        tags: [],
        pinned: args.pinned ?? false,
        archived: false,
        isCurrentCar: args.isCurrentCar,
        overrides: {},
      },
      fieldMeta: {},
    },
    computed: {
      dealQuality: 'Fair+',
      confidence: 'high',
      dealExplanation: ['Looks solid'],
      realisticMpg: 25,
      mpgFactors: { base: 1, age: 1, condition: 1, usage: 1 },
      baselineMonthly: 300,
      fuelMonthly: 100,
      routineMonthly: 50,
      expectedRepairsMonthly: 25,
      registrationMonthly: 0,
      parkingAndTollsMonthly: 0,
      insuranceMonthly: 125,
      majorRepairReserveMonthly: 15,
      allInMonthly: 440,
      firstYearCost: 12483,
      totalCostAtHorizon: 27243,
      currentMarketValueEstimate: 9000,
      futureResaleValueEstimate: 4500,
      resaleLoss: 4500,
      dimensions: {
        capability: {
          value: 5.5,
          label: 'Moderate',
          factors: [],
        },
      },
    },
  } as unknown as ComputedVehicle;
}

describe('BoardTable', () => {
  beforeEach(() => {
    updateVehicle.mockClear();
    act(() => {
      useUIStore.setState({
        selectedVehicleId: null,
        isDetailDrawerOpen: false,
        isSellScenarioDrawerOpen: false,
        searchQuery: '',
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows resize handles for vehicle, location, and notes only', () => {
    const data = [
      makeComputedVehicle({ id: 'current', isCurrentCar: true, location: 'Denver, CO', notes: 'Current note' }),
      makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: 'Candidate note' }),
    ];

    render(
      <BoardTable
        data={data}
        columnVisibility={DEFAULT_VISIBILITY}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    expect(screen.getByTestId('resize-vehicle')).toBeTruthy();
    expect(screen.getByTestId('resize-location')).toBeTruthy();
    expect(screen.getByTestId('resize-notes')).toBeTruthy();
    expect(screen.queryByTestId('resize-price')).toBeNull();
  });

  it('hides My Rating by default and orders vehicle, miles, price, and upfront cost', () => {
    const data = [
      makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: 'Candidate note' }),
    ];

    render(
      <BoardTable
        data={data}
        columnVisibility={DEFAULT_VISIBILITY}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    const visibleHeaders = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim())
      .filter(Boolean);

    expect(visibleHeaders.slice(0, 8)).toEqual([
      'Source',
      'Location',
      'Vehicle',
      'Miles',
      'Price',
      'Up Front Cost',
      'Notes',
      'Drive',
    ]);
    expect(visibleHeaders).not.toContain('My Rating');
  });

  it('places My Rating immediately left of Vehicle when visible', () => {
    const data = [
      makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: 'Candidate note' }),
    ];

    render(
      <BoardTable
        data={data}
        columnVisibility={{
          ...DEFAULT_VISIBILITY,
          rating: true,
        }}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    const visibleHeaders = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim())
      .filter(Boolean);

    expect(visibleHeaders.slice(0, 6)).toEqual([
      'Source',
      'Location',
      'My Rating',
      'Vehicle',
      'Miles',
      'Price',
    ]);
  });

  it('expands Up Front Cost into tax, catch-up, and fees and includes price in the parent total', () => {
    const data = [
      makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: 'Candidate note' }),
    ];

    render(
      <BoardTable
        data={data}
        columnVisibility={{
          ...DEFAULT_VISIBILITY,
          salesTax: true,
          catchUp: true,
          fees: true,
        }}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    const visibleHeaders = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim())
      .filter(Boolean);
    const upFrontIndex = visibleHeaders.indexOf('Up Front Cost');

    expect(visibleHeaders.slice(upFrontIndex - 4, upFrontIndex + 2)).toEqual([
      'Price',
      'Tax',
      'Catch-Up',
      'Fees',
      'Up Front Cost',
      'Notes',
    ]);
    expect(screen.getByText('$9,922')).toBeTruthy();
  });

  it('expands All-In/mo into every monthly cost input immediately to its left', () => {
    const data = [
      makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: 'Candidate note' }),
    ];

    render(
      <BoardTable
        data={data}
        columnVisibility={{
          ...DEFAULT_VISIBILITY,
          fuel: true,
          routine: true,
          repairs: true,
          registration: true,
          parking: true,
          baseline: true,
          insurance: true,
          reserve: true,
        }}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    const visibleHeaders = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.trim())
      .filter(Boolean);
    const allInIndex = visibleHeaders.indexOf('All-In/mo');

    expect(visibleHeaders.slice(allInIndex - 8, allInIndex + 1)).toEqual([
      'Fuel/mo',
      'Routine/mo',
      'Repairs/mo',
      'Reg./mo',
      'Parking/mo',
      'Baseline/mo',
      'Ins./mo',
      'Reserve/mo',
      'All-In/mo',
    ]);
  });

  it('saves candidate location edits inline but keeps current-car location non-editable', async () => {
    const user = userEvent.setup();
    const current = makeComputedVehicle({ id: 'current', isCurrentCar: true, location: 'Denver, CO', notes: 'Current note' });
    const candidate = makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: 'Candidate note' });

    render(
      <BoardTable
        data={[current, candidate]}
        columnVisibility={DEFAULT_VISIBILITY}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    const candidateLocationButton = screen.getByRole('button', { name: 'Salt Lake City, UT' });
    expect(candidateLocationButton.className).toContain('border-transparent');

    await user.click(screen.getByText('Denver, CO'));
    expect(screen.queryByDisplayValue('Denver, CO')).toBeNull();

    await user.click(candidateLocationButton);
    const input = screen.getByDisplayValue('Salt Lake City, UT');
    await user.clear(input);
    await user.type(input, 'Provo, UT');
    await user.click(screen.getByText('Price'));

    await waitFor(() => {
      expect(updateVehicle).toHaveBeenCalledWith('candidate', {
        listing: {
          ...candidate.vehicle.listing,
          location: 'Provo, UT',
        },
      });
    });
  });

  it('saves candidate fees inline with override provenance', async () => {
    const user = userEvent.setup();
    const candidate = makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: 'Candidate note' });

    render(
      <BoardTable
        data={[candidate]}
        columnVisibility={{
          ...DEFAULT_VISIBILITY,
          fees: true,
        }}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add fees' }));
    const input = screen.getByLabelText('Add fees');
    await user.clear(input);
    await user.type(input, '650');
    await user.click(screen.getByText('Price'));

    await waitFor(() => {
      expect(updateVehicle).toHaveBeenCalledWith('candidate', {
        user: {
          ...candidate.vehicle.user,
          feesCost: 650,
        },
        fieldMeta: {
          ...candidate.vehicle.fieldMeta,
          feesCost: {
            origin: 'overridden',
            confidence: 'high',
          },
        },
      });
    });
  });

  it('keeps pinned candidates above unpinned candidates while sorting inside each group', async () => {
    const user = userEvent.setup();
    const pinnedHigh = makeComputedVehicle({
      id: 'pinned-high',
      isCurrentCar: false,
      location: 'Ogden, UT',
      notes: 'Pinned high price',
      model: 'Pinned',
      price: 20000,
      pinned: true,
    });
    const unpinnedLow = makeComputedVehicle({
      id: 'unpinned-low',
      isCurrentCar: false,
      location: 'Provo, UT',
      notes: 'Unpinned low price',
      model: 'Unpinned',
      price: 10000,
      pinned: false,
    });

    render(
      <BoardTable
        data={[unpinnedLow, pinnedHigh]}
        columnVisibility={DEFAULT_VISIBILITY}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    await user.click(screen.getByText('Price'));
    const rows = screen.getAllByRole('row').map((row) => row.textContent ?? '');
    const pinnedIndex = rows.findIndex((text) => text.includes('Subaru Pinned'));
    const unpinnedIndex = rows.findIndex((text) => text.includes('Subaru Unpinned'));

    expect(pinnedIndex).toBeGreaterThan(-1);
    expect(unpinnedIndex).toBeGreaterThan(-1);
    expect(pinnedIndex).toBeLessThan(unpinnedIndex);
  });

  it('shows notes clamped to four lines and saves inline notes edits', async () => {
    const user = userEvent.setup();
    const currentNotes = 'Current car note';
    const candidateNotes = 'This is a long candidate note that should wrap across multiple lines in the board cell without growing forever.';
    const current = makeComputedVehicle({ id: 'current', isCurrentCar: true, location: 'Denver, CO', notes: currentNotes });
    const candidate = makeComputedVehicle({ id: 'candidate', isCurrentCar: false, location: 'Salt Lake City, UT', notes: candidateNotes });

    render(
      <BoardTable
        data={[current, candidate]}
        columnVisibility={DEFAULT_VISIBILITY}
        onColumnVisibilityChange={() => {}}
        showSellScenario={false}
      />,
    );

    const candidateNoteText = screen.getByText(candidateNotes);
    expect(candidateNoteText.getAttribute('style')).toContain('-webkit-line-clamp: 4');

    await user.click(screen.getByRole('button', { name: currentNotes }));
    const textarea = screen.getByDisplayValue(currentNotes);
    expect(textarea.getAttribute('rows')).toBe('1');
    await user.clear(textarea);
    await user.type(textarea, 'Updated current-car note');
    await user.click(screen.getByText('Deal Rating'));

    await waitFor(() => {
      expect(updateVehicle).toHaveBeenCalledWith('current', {
        user: {
          ...current.vehicle.user,
          notes: 'Updated current-car note',
        },
      });
    });
  });
});
