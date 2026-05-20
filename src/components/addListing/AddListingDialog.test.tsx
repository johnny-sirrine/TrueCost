// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '../../store/uiStore';
import { AddListingDialog } from './AddListingDialog';

const mocks = vi.hoisted(() => ({
  addVehicle: vi.fn(async (_vehicle: unknown) => {}),
  showToast: vi.fn(),
}));

vi.mock('../../hooks/useVehicleActions', () => ({
  useVehicleActions: () => ({
    addVehicle: mocks.addVehicle,
  }),
}));

vi.mock('../../store/toastStore', () => ({
  useToastStore: (selector: (state: { showToast: (...args: unknown[]) => void }) => unknown) =>
    selector({ showToast: mocks.showToast }),
}));

vi.mock('../../hooks/useVehicleLookup', () => ({
  useVehicleLookup: () => ({
    status: 'idle',
    data: undefined,
    candidates: [],
    selectedIndex: 0,
    selectCandidate: vi.fn(),
    isStaticFallback: false,
    epaOptionLabel: undefined,
  }),
}));

vi.mock('../../services/vehicleResolver', () => ({
  buildFieldMetaFromLookup: () => ({}),
}));

vi.mock('../../data/vehicleReference', () => ({
  inferDepreciationProfile: () => 'normal_midlife',
}));

vi.mock('./DerivedInfoPreview', () => ({
  DerivedInfoPreview: () => null,
}));

describe('AddListingDialog dealer fees', () => {
  beforeEach(() => {
    mocks.addVehicle.mockClear();
    mocks.showToast.mockClear();
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: vi.fn(() => 'vehicle-1'),
    });
    act(() => {
      useUIStore.setState({
        isAddDialogOpen: true,
      });
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    act(() => {
      useUIStore.setState({
        isAddDialogOpen: false,
      });
    });
  });

  it('auto-fills a $500 dealer fee only when fees are blank', async () => {
    const user = userEvent.setup();
    render(<AddListingDialog />);

    const dealerCheckbox = screen.getByRole('checkbox', { name: 'Sold by dealership' });
    const feesInput = screen.getByLabelText('Fees ($)') as HTMLInputElement;

    expect(feesInput.value).toBe('0');
    await user.click(dealerCheckbox);
    expect(feesInput.value).toBe('500');
    expect(screen.getByText(/Estimated dealer documentation\/processing fee/)).toBeTruthy();

    await user.clear(feesInput);
    await user.type(feesInput, '650');
    await user.click(dealerCheckbox);
    expect(feesInput.value).toBe('650');
    await user.click(dealerCheckbox);
    expect(feesInput.value).toBe('650');
  });

  it('saves checked dealer listings with assumed default fee provenance', async () => {
    const user = userEvent.setup();
    render(<AddListingDialog />);

    await user.click(screen.getByRole('tab', { name: /Manual Entry/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Sold by dealership' }));
    await user.type(screen.getByPlaceholderText('Toyota'), 'Toyota');
    await user.type(screen.getByPlaceholderText('4Runner'), '4Runner');

    const spinButtons = screen.getAllByRole('spinbutton');
    const priceInput = spinButtons[1];
    await user.clear(priceInput);
    await user.type(priceInput, '12000');
    const mileageInput = spinButtons[2];
    await user.clear(mileageInput);
    await user.type(mileageInput, '135000');

    await user.click(screen.getByRole('button', { name: 'Add to Board' }));

    await waitFor(() => {
      expect(mocks.addVehicle).toHaveBeenCalledTimes(1);
    });
    const saved = mocks.addVehicle.mock.calls[0][0] as any;
    expect(saved.listing.sellerType).toBe('dealer');
    expect(saved.user.feesCost).toBe(500);
    expect(saved.fieldMeta.feesCost).toEqual({
      origin: 'assumed',
      confidence: 'low',
      note: 'Flat dealer documentation/processing fee estimate',
    });
  });
});
