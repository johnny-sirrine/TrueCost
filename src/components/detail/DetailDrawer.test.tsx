// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GlobalAssumptions, VehicleRow } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { db } from '../../db';
import { DetailDrawer } from './DetailDrawer';

let currentVehicle: VehicleRow;

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

function makeVehicle(): VehicleRow {
  return {
    id: 'vehicle-1',
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    listing: {
      source: 'facebook',
      sourceUrl: 'https://facebook.com/marketplace/item/123',
      location: 'Salt Lake City, UT',
    },
    canonical: {
      year: 2018,
      make: 'Subaru',
      model: 'Outback',
      trim: 'Premium',
      bodyStyle: 'wagon',
      drivetrain: 'awd',
      engineType: 'gas',
      transmissionType: 'automatic',
      vehicleClass: 'midsize_crossover',
      epaCombinedMpg: 25,
    },
    user: {
      listingPrice: 9251,
      mileage: 130777,
      titleStatus: 'clean',
      conditionLevel: 'average',
      modificationLevel: 'stock',
      catchUpCost: 0,
      feesCost: 0,
      notes: '',
      tags: [],
      pinned: false,
      archived: false,
      isCurrentCar: false,
      depreciationProfileId: 'normal_midlife',
      overrides: {},
    },
    fieldMeta: {},
  };
}

function applyNestedChanges(target: Record<string, unknown>, changes: Record<string, unknown>) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split('.');
    let cursor: Record<string, unknown> = target;

    for (const part of parts.slice(0, -1)) {
      const next = cursor[part];
      if (!next || typeof next !== 'object') {
        cursor[part] = {};
      }
      cursor = cursor[part] as Record<string, unknown>;
    }

    cursor[parts.at(-1)!] = value;
  }
}

vi.mock('../../db', () => ({
  db: {
    vehicles: {
      update: vi.fn(async (_id: string, changes: Record<string, unknown>) => {
        applyNestedChanges(currentVehicle as unknown as Record<string, unknown>, changes);
        return 1;
      }),
    },
  },
}));

vi.mock('../../hooks/useVehicles', () => ({
  useVehicleById: (id: string | null) => (id ? currentVehicle : undefined),
}));

vi.mock('../../hooks/useAssumptions', () => ({
  useAssumptions: () => assumptions,
}));

vi.mock('../../hooks/useVehicleActions', () => ({
  useVehicleActions: () => ({
    duplicateVehicle: vi.fn(async () => 'copy-id'),
    removeVehicle: vi.fn(async () => {}),
    togglePin: vi.fn(async () => {}),
    toggleArchive: vi.fn(async () => {}),
    setCurrentCar: vi.fn(async () => {}),
  }),
}));

vi.mock('../../store/toastStore', () => ({
  useToastStore: (selector: (state: { showToast: (...args: unknown[]) => void }) => unknown) =>
    selector({ showToast: vi.fn() }),
}));

vi.mock('../../engine', () => ({
  computeEvaluation: () => ({
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
  }),
}));

vi.mock('../../engine/resale', () => ({
  computeResale: () => ({
    currentMarketValueEstimate: 9000,
  }),
}));

vi.mock('../../engine/insurance', () => ({
  computeInsurance: () => ({
    coverageMode: 'liability_only',
    liabilityMonthly: 125,
    compCollisionMonthly: 0,
  }),
}));

vi.mock('../shared/FieldStatusBadge', () => ({
  FieldStatusBadge: () => null,
}));

vi.mock('../shared/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('./EditableField', () => ({
  EditableField: () => null,
}));

vi.mock('./HistorySection', () => ({
  HistorySection: () => null,
}));

describe('DetailDrawer', () => {
  beforeEach(() => {
    currentVehicle = makeVehicle();
    vi.mocked(db.vehicles.update).mockClear();
    act(() => {
      useUIStore.setState({
        selectedVehicleId: currentVehicle.id,
        isDetailDrawerOpen: true,
        isSellScenarioDrawerOpen: false,
      });
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      useUIStore.setState({
        selectedVehicleId: null,
        isDetailDrawerOpen: false,
        isSellScenarioDrawerOpen: false,
      });
    });
  });

  async function startEditingField(user: ReturnType<typeof userEvent.setup>, label: string) {
    const labelNode = screen.getByText(label);
    const row = labelNode.closest('div[title="Click to edit"]');
    expect(row).not.toBeNull();
    await user.click(row!);
  }

  async function reopenDrawer() {
    act(() => {
      useUIStore.getState().openDetailDrawer(currentVehicle.id);
    });
    await screen.findByRole('dialog');
  }

  it('saves title status immediately and keeps it after close and reopen', async () => {
    const user = userEvent.setup();
    render(<DetailDrawer />);

    await startEditingField(user, 'Title Status');
    await user.selectOptions(screen.getByRole('combobox'), 'rebuilt');

    await waitFor(() => {
      expect(currentVehicle.user.titleStatus).toBe('rebuilt');
    });

    await user.click(screen.getByLabelText('Close detail panel'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await reopenDrawer();

    expect(screen.getByText('Rebuilt')).toBeTruthy();
    expect(screen.getByText('rebuilt title')).toBeTruthy();
  });

  it('saves body style immediately and keeps it after close and reopen', async () => {
    const user = userEvent.setup();
    render(<DetailDrawer />);

    await startEditingField(user, 'Body Style');
    await user.selectOptions(screen.getByRole('combobox'), 'suv');

    await waitFor(() => {
      expect(currentVehicle.canonical.bodyStyle).toBe('suv');
    });

    await user.click(screen.getByLabelText('Close detail panel'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await reopenDrawer();

    expect(screen.getByText('suv')).toBeTruthy();
  });

  it('saves modification level immediately and keeps it after close and reopen', async () => {
    const user = userEvent.setup();
    render(<DetailDrawer />);

    await startEditingField(user, 'Modification Level');
    await user.selectOptions(screen.getByRole('combobox'), 'medium');

    await waitFor(() => {
      expect(currentVehicle.user.modificationLevel).toBe('medium');
    });

    await user.click(screen.getByLabelText('Close detail panel'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await reopenDrawer();

    expect(screen.getByText('Medium')).toBeTruthy();
  });

  it('persists a pending text edit when the backdrop closes the drawer', async () => {
    const user = userEvent.setup();
    render(<DetailDrawer />);

    await startEditingField(user, 'Trim');
    const input = screen.getByDisplayValue('Premium');
    await user.clear(input);
    await user.type(input, 'Touring XT');

    await user.click(screen.getByTestId('detail-drawer-backdrop'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(currentVehicle.canonical.trim).toBe('Touring XT');

    await reopenDrawer();

    expect(screen.getAllByText('Touring XT')).toHaveLength(2);
  });

  it('persists a pending text edit when Escape closes the drawer', async () => {
    const user = userEvent.setup();
    render(<DetailDrawer />);

    await startEditingField(user, 'Trim');
    const input = screen.getByDisplayValue('Premium');
    await user.clear(input);
    await user.type(input, 'Limited XT');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(currentVehicle.canonical.trim).toBe('Limited XT');

    await reopenDrawer();

    expect(screen.getAllByText('Limited XT')).toHaveLength(2);
  });

  it('persists listing location edits after close and reopen', async () => {
    const user = userEvent.setup();
    render(<DetailDrawer />);

    await startEditingField(user, 'Location');
    const input = screen.getByDisplayValue('Salt Lake City, UT');
    await user.clear(input);
    await user.type(input, 'Provo, UT');

    await user.click(screen.getByLabelText('Close detail panel'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(currentVehicle.listing.location).toBe('Provo, UT');

    await reopenDrawer();

    expect(screen.getByText('Provo, UT')).toBeTruthy();
  });

  it('does not save when a dropdown is opened and closed without a new selection', async () => {
    const user = userEvent.setup();
    render(<DetailDrawer />);

    await startEditingField(user, 'Title Status');
    await user.click(screen.getByLabelText('Close detail panel'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    expect(currentVehicle.user.titleStatus).toBe('clean');
    expect(vi.mocked(db.vehicles.update)).not.toHaveBeenCalled();
  });
});
