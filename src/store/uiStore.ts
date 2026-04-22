import { create } from 'zustand';

interface UIState {
  selectedVehicleId: string | null;
  isDetailDrawerOpen: boolean;
  isSellScenarioDrawerOpen: boolean;
  isAssumptionsPanelOpen: boolean;
  isAddDialogOpen: boolean;
  isAddCurrentCarDialogOpen: boolean;
  isCompareModalOpen: boolean;
  searchQuery: string;

  selectVehicle: (id: string) => void;
  clearSelection: () => void;
  openDetailDrawer: (vehicleId: string) => void;
  closeDetailDrawer: () => void;
  openSellScenarioDrawer: () => void;
  closeSellScenarioDrawer: () => void;
  toggleAssumptionsPanel: () => void;
  closeAssumptionsPanel: () => void;
  openAddDialog: () => void;
  closeAddDialog: () => void;
  openAddCurrentCarDialog: () => void;
  closeAddCurrentCarDialog: () => void;
  openCompareModal: () => void;
  closeCompareModal: () => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedVehicleId: null,
  isDetailDrawerOpen: false,
  isSellScenarioDrawerOpen: false,
  isAssumptionsPanelOpen: false,
  isAddDialogOpen: false,
  isAddCurrentCarDialogOpen: false,
  isCompareModalOpen: false,
  searchQuery: '',

  selectVehicle: (id) => set({ selectedVehicleId: id }),
  clearSelection: () => set({ selectedVehicleId: null }),

  openDetailDrawer: (vehicleId) => set({
    selectedVehicleId: vehicleId,
    isDetailDrawerOpen: true,
    isSellScenarioDrawerOpen: false,
  }),
  closeDetailDrawer: () => set({ isDetailDrawerOpen: false }),

  openSellScenarioDrawer: () => set({
    isSellScenarioDrawerOpen: true,
    isDetailDrawerOpen: false,
  }),
  closeSellScenarioDrawer: () => set({ isSellScenarioDrawerOpen: false }),

  toggleAssumptionsPanel: () => set((s) => ({
    isAssumptionsPanelOpen: !s.isAssumptionsPanelOpen,
  })),
  closeAssumptionsPanel: () => set({ isAssumptionsPanelOpen: false }),

  openAddDialog: () => set({ isAddDialogOpen: true }),
  closeAddDialog: () => set({ isAddDialogOpen: false }),

  openAddCurrentCarDialog: () => set({ isAddCurrentCarDialogOpen: true }),
  closeAddCurrentCarDialog: () => set({ isAddCurrentCarDialogOpen: false }),

  openCompareModal: () => set({ isCompareModalOpen: true }),
  closeCompareModal: () => set({ isCompareModalOpen: false }),

  setSearchQuery: (query) => set({ searchQuery: query }),
}));
