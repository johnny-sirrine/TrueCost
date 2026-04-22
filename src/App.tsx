import * as Tooltip from '@radix-ui/react-tooltip';
import { Header } from './components/layout/Header';
import { AssumptionsSummaryBar } from './components/assumptions/AssumptionsSummaryBar';
import { BoardView } from './components/board/BoardView';
import { DetailDrawer } from './components/detail/DetailDrawer';
import { SellScenarioDrawer } from './components/detail/SellScenarioDrawer';
import { AssumptionsPanel } from './components/assumptions/AssumptionsPanel';
import { AddListingDialog } from './components/addListing/AddListingDialog';
import { AddCurrentCarDialog } from './components/addListing/AddCurrentCarDialog';
import { CompareModal } from './components/compare/CompareModal';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { ToastContainer } from './components/shared/ToastContainer';
import { useSeedData } from './hooks/useSeedData';
import { useEpaBackfill } from './hooks/useEpaBackfill';

export default function App() {
  // Seed database on first load
  useSeedData();
  // Backfill existing vehicles with EPA data
  useEpaBackfill();

  return (
    <ErrorBoundary>
      <Tooltip.Provider delayDuration={400} skipDelayDuration={100}>
        <div className="h-screen flex flex-col bg-slate-50 text-slate-800">
          <Header />
          <AssumptionsSummaryBar />
          <BoardView />
          <DetailDrawer />
          <SellScenarioDrawer />
          <AssumptionsPanel />
          <AddListingDialog />
          <AddCurrentCarDialog />
          <CompareModal />
          <ToastContainer />
        </div>
      </Tooltip.Provider>
    </ErrorBoundary>
  );
}
