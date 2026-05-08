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
  insurance: false,
  baseline: false,
  salesTax: false,
  resaleLoss: false,
  fuel: false,
  routine: false,
  repairs: false,
  reserve: false,
  catchUp: false,
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
}): ComputedVehicle {
  return {
    vehicle: {
      id: args.id,
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
      listing: {
        source: 'facebook',
        sourceUrl: `https://facebook.com/marketplace/item/${args.id}`,
        location: args.location,
      },
      canonical: {
        year: args.isCurrentCar ? 2016 : 2018,
        make: args.isCurrentCar ? 'Honda' : 'Subaru',
        model: args.isCurrentCar ? 'CR-V' : 'Outback',
        trim: args.isCurrentCar ? 'EX' : 'Premium',
        drivetrain: 'awd',
        engineType: 'gas',
        transmissionType: 'automatic',
        vehicleClass: 'midsize_crossover',
        epaCombinedMpg: 25,
        bodyStyle: 'wagon',
      },
      user: {
        listingPrice: args.isCurrentCar ? 0 : 9251,
        mileage: args.isCurrentCar ? 145000 : 130777,
        titleStatus: args.titleStatus ?? 'clean',
        conditionLevel: 'average',
        catchUpCost: 0,
        notes: args.notes,
        tags: [],
        pinned: false,
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

  it('keeps location as column 2 and notes as column 6 in the visible board columns', () => {
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

    expect(visibleHeaders.slice(0, 7)).toEqual([
      'Source',
      'Location',
      'Vehicle',
      'My Rating',
      'Price',
      'Notes',
      'Miles',
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
