import React, { useState, useEffect } from 'react';
import {
  Printer as PrinterIcon,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Settings,
  X,
  Radio,
  Server
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useImpressoras, Printer } from '@/hooks/useImpressoras';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface PrinterStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const PrinterStatusModal: React.FC<PrinterStatusModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings
}) => {
  const { restaurantId } = useApp();
  const { dbPrinters, refetchImpressoras } = useImpressoras(restaurantId);
  const [isAgentConnected, setIsAgentConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkAgentHealth = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('http://localhost:3001/api/printers', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setIsAgentConnected(true);
      } else {
        setIsAgentConnected(false);
      }
    } catch {
      setIsAgentConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkAgentHealth();
      refetchImpressoras();
    }
  }, [isOpen, refetchImpressoras]);

  const activePrinters = dbPrinters.filter((p) => p.isActive);

  const handleTestPrint = async (printer: Printer) => {
    try {
      toast.info(`Enviando impressão de teste para ${printer.name}...`);
      const res = await fetch('http://localhost:3001/api/print-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerId: printer.id, printerName: printer.name, type: printer.type }),
      });
      if (res.ok) {
        toast.success(`Teste impresso com sucesso em ${printer.name}!`);
      } else {
        toast.warning(`Comando enviado para ${printer.name}. Verifique a impressora.`);
      }
    } catch {
      toast.info(`Solicitação enviada. Verifique se o agente local imprimiu a página de teste.`);
    }
  };

  const getStationLabel = (type: string) => {
    const types = type.split(',').map((t) => t.trim().toLowerCase());
    if (types.includes('all')) return '🧾 Todas as Estações (Geral)';
    const labels: string[] = [];
    types.forEach((t) => {
      if (t === 'kitchen' || t === 'cozinha') labels.push('🍽️ Cozinha');
      else if (t === 'bar') labels.push('🍺 Bar');
      else if (t === 'receipt' || t === 'conta' || t === 'recibo') labels.push('🧾 Conta');
      else labels.push(t);
    });
    return labels.join(' + ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-card-foreground shadow-2xl rounded-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-muted/40 p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Conexão com Impressoras
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Status em tempo real das impressoras e do Agente Local
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full w-8 h-8 hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Card do Agente Local */}
          <div className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Agente Local de Impressão (Node.js)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={checkAgentHealth}
                disabled={isChecking}
                className="h-7 text-xs px-2 gap-1 rounded-lg hover:bg-muted"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                <span>Verificar</span>
              </Button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {isAgentConnected === true ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      Conectado (localhost:3001)
                    </span>
                  </>
                ) : isAgentConnected === false ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      Servidor Nuvem (Supabase Realtime Ativo)
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground animate-ping" />
                    <span className="text-sm font-semibold text-muted-foreground">
                      Verificando conexão...
                    </span>
                  </>
                )}
              </div>

              <Badge variant="outline" className="text-[10px] font-bold">
                Porta 3001 / Realtime
              </Badge>
            </div>
          </div>

          {/* Lista de Impressoras Cadastradas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Impressoras Cadastradas ({activePrinters.length} Ativas)
              </h4>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {dbPrinters.length} Total
              </Badge>
            </div>

            {dbPrinters.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-border rounded-xl space-y-2">
                <PrinterIcon className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma impressora cadastrada ainda.
                </p>
                {onOpenSettings && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onOpenSettings();
                    }}
                    className="mt-2 text-xs rounded-xl"
                  >
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    Cadastrar Impressora
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {dbPrinters.map((printer) => (
                  <div
                    key={printer.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      printer.isActive
                        ? 'border-border bg-card shadow-sm'
                        : 'border-border/50 bg-muted/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            printer.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <PrinterIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {printer.name}
                            </span>
                            <Badge
                              variant={printer.isActive ? 'default' : 'secondary'}
                              className="text-[9px] font-bold px-1.5 py-0"
                            >
                              {printer.isActive ? 'ATIVA' : 'INATIVA'}
                            </Badge>
                          </div>

                          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                            {getStationLabel(printer.type)}
                          </p>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="font-mono">
                              {printer.connectionType === 'tcp'
                                ? `TCP: ${printer.ipAddress}:${printer.port || 9100}`
                                : printer.connectionType === 'usb'
                                ? `USB/COM: ${printer.usbPath || 'COM'}`
                                : printer.connectionType?.toUpperCase() || 'REDES'}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-foreground">
                              {printer.larguraBobina || '80mm'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {printer.isActive && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTestPrint(printer)}
                          className="h-8 text-xs px-2.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                        >
                          Testar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-muted/40 p-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Escuta Supabase Realtime Ativa</span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="text-xs rounded-xl"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                Configurações
              </Button>
            )}
            <Button size="sm" onClick={onClose} className="text-xs rounded-xl">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrinterStatusModal;
