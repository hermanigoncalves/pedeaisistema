import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import Topbar from '@/components/dashboard/Topbar';
import UndoToast from '@/components/dashboard/UndoToast';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import TourGuide from '@/components/onboarding/TourGuide';
import ShortcutHelp from '@/components/ui/ShortcutHelp';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import PasswordModal from '@/components/dashboard/PasswordModal';
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

// Protected routes that require password
const PROTECTED_ROUTES = new Set(['/dashboard', '/analytics', '/conversas']);

const ROUTE_LABELS: Record<string, { title: string; description: string }> = {
  '/dashboard': { title: 'Acesso ao Dashboard', description: 'Digite a senha do restaurante para acessar o dashboard' },
  '/analytics': { title: 'Acesso ao Analytics', description: 'Digite a senha do restaurante para ver analytics' },
  '/conversas': { title: 'Acesso às Conversas', description: 'Digite a senha do restaurante para ver as conversas' },
};

const AppLayout: React.FC = () => {
  const { isAuthenticated, loadingData, restaurantId } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const [runTour, setRunTour] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const { requestPermission, isEnabled } = useNotifications();

  // Password protection
  const [unlockedRoutes, setUnlockedRoutes] = useState<Set<string>>(new Set());
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

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

  // Check route protection on navigation
  useEffect(() => {
    const path = location.pathname;
    if (PROTECTED_ROUTES.has(path) && !unlockedRoutes.has(path)) {
      setPendingRoute(path);
      setIsPasswordModalOpen(true);
      // Navigate back to home while password modal is open
      navigate('/', { replace: true });
    }
  }, [location.pathname, unlockedRoutes, navigate]);

  const handlePasswordSuccess = () => {
    if (pendingRoute) {
      setUnlockedRoutes(prev => new Set([...prev, pendingRoute]));
      navigate(pendingRoute);
      setPendingRoute(null);
    }
    setIsPasswordModalOpen(false);
  };

  const handlePasswordClose = () => {
    setIsPasswordModalOpen(false);
    setPendingRoute(null);
  };

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

  const pendingLabel = pendingRoute ? ROUTE_LABELS[pendingRoute] : null;

  return (
    <div className="h-screen flex flex-col bg-background" data-tour="dashboard">
      <Topbar unlockedRoutes={unlockedRoutes} onRequestUnlock={(route) => {
        setPendingRoute(route);
        setIsPasswordModalOpen(true);
      }} />

      <Outlet />

      <UndoToast />
      <WelcomeModal onStartTour={() => setRunTour(true)} />
      <TourGuide run={runTour} onFinish={() => setRunTour(false)} />
      <ShortcutHelp open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
      <OfflineIndicator />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={handlePasswordClose}
        onSuccess={handlePasswordSuccess}
        title={pendingLabel?.title || 'Área Restrita'}
        description={pendingLabel?.description || 'Digite a senha do restaurante para acessar'}
      />
    </div>
  );
};

export default AppLayout;
