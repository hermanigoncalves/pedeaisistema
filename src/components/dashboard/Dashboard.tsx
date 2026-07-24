import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import Topbar from './Topbar';
import DashboardHome from './DashboardHome';
import TableGrid from './TableGrid';
import OrderQueue from './OrderQueue';
import ConversationsView from './ConversationsView';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import UndoToast from './UndoToast';

const Dashboard: React.FC = () => {
  const { filter, setFilter } = useApp();
  const [activeView, setActiveView] = useState<'dashboard' | 'operation' | 'conversations' | 'analytics'>('operation');

  return (
    <div className="h-screen flex flex-col bg-background" data-tour="dashboard">
      <Topbar activeView={activeView} onViewChange={setActiveView} />

      {activeView === 'dashboard' && <DashboardHome />}

      {activeView === 'operation' && (
        <div className="flex-1 flex overflow-hidden w-full bg-white" data-tour="mesas">
          <div className="flex-1 min-w-0">
            <TableGrid />
          </div>
          <div className="w-80 flex-shrink-0 lg:w-96 border-l border-border/50 bg-secondary/5" data-tour="pedidos">
            <OrderQueue />
          </div>
        </div>
      )}

      {activeView === 'conversations' && (
        <>
          {console.log('[Dashboard] Attempting to render ConversationsView')}
          <ConversationsView />
        </>
      )}

      {activeView === 'analytics' && (
        <div className="flex-1 overflow-y-auto" data-tour="analytics">
          <AnalyticsDashboard />
        </div>
      )}

      <UndoToast />
    </div>
  );
};

export default Dashboard;

