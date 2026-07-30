import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import Topbar from '@/components/dashboard/Topbar';
import UndoToast from '@/components/dashboard/UndoToast';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import TourGuide from '@/components/onboarding/TourGuide';
import ShortcutHelp from '@/components/ui/ShortcutHelp';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import { useNavigationShortcuts, useActionShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNotifications } from '@/hooks/useNotifications';
import { backupService } from '@/lib/backup-service';
import { offlineService } from '@/lib/offline-service';
import { Navigate } from 'react-router-dom';

// Map route paths to view names
const ROUTE_MAP: Record<string, string> = {
  '/': 'operation',
  '/dashboard': 'dashboard',
  '/analytics': 'analytics',
  '/conversas': 'conversations',
};

// AppLayout sem exigência repetitiva de senha para usuários autenticados
const AppLayout: React.FC = () => {
  const { isAuthenticated, loadingData, restaurantId } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [runTour, setRunTour] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const { requestPermission, isEnabled } = useNotifications();

  // Shortcuts
  useNavigationShortcuts();
  useActionShortcuts({
    onHelp: () => setShowShortcutHelp(true),
    onEscape: () => setShowShortcutHelp(false),
  });

  // Request notification permission
  useEffect(() => {
    if (isAuthenticated && !isEnabled) {
      requestPermission();
    }
  }, [isAuthenticated, isEnabled, requestPermission]);

  // Auto backup
  useEffect(() => {
    if (isAuthenticated && restaurantId) {
      const cleanup = backupService.setupAutoBackup(restaurantId, 24);
      return cleanup;
    }
  }, [isAuthenticated, restaurantId]);

  // Clear old cache
  useEffect(() => {
    if (isAuthenticated) {
      offlineService.clearOldCache();
    }
  }, [isAuthenticated]);

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen flex flex-col bg-background" data-tour="dashboard">
      <Topbar />

      <Outlet />

      <UndoToast />
      <WelcomeModal onStartTour={() => setRunTour(true)} />
      <TourGuide run={runTour} onFinish={() => setRunTour(false)} />
      <ShortcutHelp open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
      <OfflineIndicator />
    </div>
  );
};

export default AppLayout;
