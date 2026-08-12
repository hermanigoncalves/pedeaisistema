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
  Server,
  Bluetooth,
  Download
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useImpressoras, Printer } from '@/hooks/useImpressoras';
import { 
  getConnectedDeviceName, 
  connectBluetoothPrinter, 
  printToDevice, 
  isPrinterConnected,
  PrintOrderData 
} from '@/services/printerService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PRINT_AGENT_URL = import.meta.env.VITE_PRINT_AGENT_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

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
  const { restaurantId, settings } = useApp();
  const { dbPrinters, refetchImpressoras } = useImpressoras(restaurantId);
  const [isAgentConnected, setIsAgentConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isConnectingBt, setIsConnectingBt] = useState(false);

  const btDeviceName = typeof getConnectedDeviceName === 'function' ? getConnectedDeviceName() : null;
  const allPrinters = React.useMemo(() => {
    const combined: Printer[] = [...dbPrinters];
    const dbIds = new Set(dbPrinters.map(p => p.id));
    const dbNames = new Set(dbPrinters.map(p => p.name.trim().toLowerCase()));

    (settings.printers || []).forEach((p: any) => {
      const pNameLower = (p.name || '').trim().toLowerCase();
      if (!dbIds.has(p.id) && !dbNames.has(pNameLower)) {
        combined.push({
          id: p.id || `local-${pNameLower}`,
          name: p.name || 'Impressora Local',
          type: p.type || 'receipt',
          connectionType: p.connectionType || 'bluetooth',
          ipAddress: p.ipAddress || '',
          port: p.port || 9100,
          usbPath: p.usbPath || '',
          isActive: p.isActive ?? true,
          larguraBobina: p.larguraBobina || '80mm'
        });
      }
    });
    return combined;
  }, [dbPrinters, settings.printers]);

  const activePrinters = allPrinters.filter((p) => p.isActive);

  const checkAgentHealth = React.useCallback(async () => {
    setIsChecking(true);
    try {
      const agentUrl = PRINT_AGENT_URL.replace(/\/$/, '');
      const res = await fetch(`${agentUrl}/api/printers`, { signal: AbortSignal.timeout(3000) });
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
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkAgentHealth();
      refetchImpressoras();
    }
  }, [isOpen, checkAgentHealth, refetchImpressoras]);

  const handleDownloadPrintAgent = () => {
    const batContent = `@echo off
title PedeAi - Agente de Impressao Local
echo ========================================================
echo   Iniciando Agente de Impressao PedeAi (Porta 3001)
echo ========================================================
echo.
cd /d "%~dp0print-agent"
if not exist "node_modules" (
    echo Instalando dependencias do Agente de Impressao...
    npm install
)
echo.
echo Conectando agente de impressao...
node index.js
pause
`;
    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'INICIAR_AGENTE_IMPRESSAO.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download do script INICIAR_AGENTE_IMPRESSAO.bat iniciado!');
  };

  const handleConnectBluetooth = async (printerId: string = 'default') => {
    setIsConnectingBt(true);
    try {
      toast.info('Buscando dispositivos Bluetooth próximos...');
      const res = await connectBluetoothPrinter(printerId);
      if (res.success) {
        toast.success(`Impressora Bluetooth "${res.deviceName || 'KA-1445'}" conectada com sucesso!`);
        refetchImpressoras();
      } else {
        toast.error('Nenhuma impressora selecionada ou conexão cancelada.');
      }
    } catch (err: any) {
      toast.error('Erro ao conectar Bluetooth: ' + (err.message || err));
    } finally {
      setIsConnectingBt(false);
    }
  };

  const handleTestPrint = async (printer: Printer) => {
    try {
      toast.info(`Enviando teste para ${printer.name}...`);

      const mockOrder: PrintOrderData = {
        id: "TESTE-001",
        mesa: "00",
        created_at: new Date(),
        total: 50.00,
        subtotal: 50.00,
        totalWithFee: 50.00,
        itens: [
          { nome: `Teste - ${printer.name}`, quantidade: 1, preco: 50.00 }
        ],
        descricao: `Página de Teste - Estação: ${printer.type}`
      };

      // Se a impressora for Bluetooth e não estiver pareada no navegador, abre a tela de pareamento
      if (printer.connectionType === 'bluetooth' && !isPrinterConnected(printer.id) && !isPrinterConnected('default')) {
        toast.info(`Conectando à impressora ${printer.name}...`);
        const connRes = await connectBluetoothPrinter(printer.id);
        if (!connRes.success) {
          toast.error(`Falha ao conectar à impressora Bluetooth "${printer.name}".`);
          return;
        }
      }

      const success = await printToDevice(mockOrder, settings.restaurantName || 'San Pio', printer);

      if (success) {
        toast.success(`Teste impresso com sucesso em ${printer.name}!`);
      } else {
        // Fallback: se o agente Node local responder, tenta via API local
        if (isAgentConnected) {
          const agentUrl = PRINT_AGENT_URL.replace(/\/$/, '');
          const res = await fetch(`${agentUrl}/api/test-print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: printer.connectionType || 'tcp',
              host: printer.ipAddress || '192.168.1.169',
              port: printer.port || 9100,
              station: printer.type || 'kitchen'
            }),
          });
          if (res.ok) {
            toast.success(`Teste impresso via Agente Local em ${printer.name}!`);
            return;
          }
        }
        toast.error(`Erro ao imprimir em ${printer.name}. Verifique se o Agente de Impressão (Node.js) está rodando.`);
      }
    } catch (err: any) {
      console.error('Erro no teste de impressão:', err);
      toast.error(`Erro no teste: ${err.message || err}`);
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
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPrintAgent}
                  className="h-7 text-xs px-2 gap-1.5 rounded-lg border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
                  title="Baixar o arquivo executavel INICIAR_AGENTE_IMPRESSAO.bat para o Windows"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Agente (.bat)</span>
                </Button>
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

          {/* Impressora Bluetooth Web (Direct Connection Card) */}
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {btDeviceName || 'Web Bluetooth (Navegador)'}
                    </span>
                    <Badge className={btDeviceName ? "bg-emerald-500 text-white text-[9px] font-extrabold px-2" : "bg-muted text-muted-foreground text-[9px] font-extrabold px-2"}>
                      {btDeviceName ? 'BLUETOOTH ATIVO' : 'BLUETOOTH DISPONÍVEL'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                    {btDeviceName 
                      ? 'Conectado e pareado diretamente no Navegador (Web Bluetooth)'
                      : 'Conecte sua impressora térmica Bluetooth (ex: KA-1445) diretamente por aqui'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20">
              <span className="text-xs text-muted-foreground font-medium">
                {btDeviceName ? '🟢 Pronta para Imprimir' : '⚪ Impressora não pareada no navegador'}
              </span>
              <Button
                variant={btDeviceName ? "outline" : "default"}
                size="sm"
                onClick={() => handleConnectBluetooth()}
                disabled={isConnectingBt}
                className="h-8 text-xs px-3 rounded-lg gap-1.5 font-bold"
              >
                <Bluetooth className={`w-3.5 h-3.5 ${isConnectingBt ? 'animate-spin' : ''}`} />
                <span>{btDeviceName ? 'Reconectar / Parear Outra' : 'Conectar Bluetooth Direct'}</span>
              </Button>
            </div>
          </div>

          {/* Lista de Impressoras Cadastradas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Impressoras Cadastradas ({activePrinters.length} Ativas)
              </h4>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {allPrinters.length} Total
              </Badge>
            </div>

            {allPrinters.length === 0 && !btDeviceName ? (
              <div className="p-6 text-center border border-dashed border-border rounded-xl space-y-2">
                <PrinterIcon className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma impressora cadastrada ainda.
                </p>
                <div className="flex justify-center gap-2 mt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConnectBluetooth()}
                    disabled={isConnectingBt}
                    className="text-xs rounded-xl gap-1.5"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    Conectar Bluetooth
                  </Button>
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
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {allPrinters.map((printer) => {
                  const isBtConnected = printer.connectionType === 'bluetooth' && (isPrinterConnected(printer.id) || isPrinterConnected('default'));

                  return (
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
                              {printer.connectionType === 'bluetooth' && (
                                <Badge 
                                  variant="outline"
                                  className={`text-[9px] font-bold px-1.5 py-0 ${
                                    isBtConnected 
                                      ? 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10' 
                                      : 'text-amber-600 border-amber-500/40 bg-amber-500/10'
                                  }`}
                                >
                                  {isBtConnected ? 'PAREADA' : 'DESCONECTADA'}
                                </Badge>
                              )}
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
                                  : printer.connectionType?.toUpperCase() || 'BLUETOOTH'}
                              </span>
                              <span>•</span>
                              <span className="font-semibold text-foreground">
                                {printer.larguraBobina || '80mm'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {printer.connectionType === 'bluetooth' && !isBtConnected && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnectBluetooth(printer.id)}
                              disabled={isConnectingBt}
                              className="h-8 text-xs px-2 rounded-lg gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                            >
                              <Bluetooth className="w-3 h-3" />
                              Conectar
                            </Button>
                          )}
                          {printer.isActive && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleTestPrint(printer)}
                              className="h-8 text-xs px-2.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all font-semibold"
                            >
                              Testar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

