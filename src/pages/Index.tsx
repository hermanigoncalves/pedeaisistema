import React, { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import Dashboard from '@/components/dashboard/Dashboard';
import { Navigate } from 'react-router-dom';
import WelcomeModal from '@/components/onboarding/WelcomeModal';
import TourGuide from '@/components/onboarding/TourGuide';
import ShortcutHelp from '@/components/ui/ShortcutHelp';
import OfflineIndicator from '@/components/ui/OfflineIndicator';
import { useNavigationShortcuts, useActionShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useNotifications } from '@/hooks/useNotifications';
import { backupService } from '@/lib/backup-service';
import { offlineService } from '@/lib/offline-service';

const AppContent: React.FC = () => {
  const { isAuthenticated, loadingData, restaurantId } = useApp();
  const [runTour, setRunTour] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const { requestPermission, isEnabled } = useNotifications();

  // Configurar atalhos de navegação
  useNavigationShortcuts();

  // Configurar atalhos de ações
  useActionShortcuts({
    onHelp: () => setShowShortcutHelp(true),
    onEscape: () => setShowShortcutHelp(false),
  });

  // Solicitar permissão de notificações ao carregar
  useEffect(() => {
    if (isAuthenticated && !isEnabled) {
      requestPermission();
    }
  }, [isAuthenticated, isEnabled, requestPermission]);

  // Configurar backup automático (diário)
  useEffect(() => {
    if (isAuthenticated && restaurantId) {
      const cleanup = backupService.setupAutoBackup(restaurantId, 24);
      return cleanup;
    }
  }, [isAuthenticated, restaurantId]);

  // Limpar cache antigo periodicamente
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
    <>
      <Dashboard />
      <WelcomeModal onStartTour={() => setRunTour(true)} />
      <TourGuide run={runTour} onFinish={() => setRunTour(false)} />
      <ShortcutHelp open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
      <OfflineIndicator />
    </>
  );
};

const Index: React.FC = () => <AppContent />;

export default Index;

