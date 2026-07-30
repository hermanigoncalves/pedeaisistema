import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Settings, Circle, LogOut, Wifi } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getConnectedDeviceName } from '@/services/printerService';
import Logo from '@/components/Logo';
import SettingsModal from './SettingsModal';

interface TopbarProps {}

const navItems = [
  { path: '/', label: 'Operação' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/conversas', label: 'Conversas' },
] as const;

const Topbar: React.FC<TopbarProps> = () => {
  const { settings, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnline] = useState(true);

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="h-16 bg-card border-b border-border shadow-sm px-6 flex items-center justify-between flex-shrink-0">
        {/* Left: Logo + Restaurant Name */}
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div className="h-6 w-px bg-border" />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm leading-none">
              {settings.restaurantName}
            </span>
            <span className="text-[9px] text-muted-foreground font-semibold tracking-wider mt-0.5 uppercase">
              v2.0
            </span>
          </div>
        </div>

        {/* Center: Navigation */}
        <div className="flex items-center gap-2">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant={isActive(item.path) ? 'default' : 'secondary'}
              size="sm"
              onClick={() => handleNavClick(item.path)}
              className={`rounded-full px-4 transition-all ${isActive(item.path)
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* Right: Status, Search, Settings */}
        <div className="hidden md:flex items-center gap-4 border-r border-border pr-4">
          {/* Bluetooth Status */}
          <div className="flex items-center gap-1.5">
            {getConnectedDeviceName() ? (
              <div className="flex items-center gap-1.5 text-success animate-pulse">
                <Wifi className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Impressora OK</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground opacity-50">
                <Wifi className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Sem Impressora</span>
              </div>
            )}
          </div>

          {/* Online Status */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
                <Circle className="w-2.5 h-2.5 fill-current" />
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-destructive text-sm font-medium">
                <Circle className="w-2.5 h-2.5 fill-current" />
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Offline</span>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-40 h-9 rounded-full bg-secondary border-none text-xs"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSettingsClick}
            className="rounded-full hover:bg-secondary w-9 h-9"
          >
            <Settings className="w-4 h-4 text-foreground" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="rounded-full w-9 h-9 hover:bg-destructive/10 hover:text-destructive group"
            title="Sair"
          >
            <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </Button>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};

export default Topbar;
