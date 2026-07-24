import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Printer {
  id: string; // Salvo como string no frontend para compatibilidade (BIGINT do DB)
  name: string;
  type: 'bar' | 'kitchen' | 'receipt' | 'all';
  connectionType?: 'bluetooth' | 'rawbt' | 'deeplink' | 'browser' | 'tcp' | 'usb';
  ipAddress: string;  // IP (ex: '192.168.1.169')
  port?: number;      // Porta TCP (ex: 9100)
  usbPath?: string;   // Caminho USB/Porta COM (ex: '\\.\COM3')
  isActive: boolean;
  larguraBobina?: '58mm' | '80mm';
}

export const useImpressoras = (restaurantId: string | null) => {
  const [dbPrinters, setDbPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchImpressoras = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!restaurantId) return;
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('Impressoras' as any)
        .select('*')
        .eq('restaurante_id', restaurantId)
        .order('nome', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          console.warn('[useImpressoras] Tabela Impressoras não existe no banco de dados ainda.');
        } else {
          throw error;
        }
      } else {
        const savedWidths = localStorage.getItem('pedeai_printer_widths');
        const widthsMap = savedWidths ? JSON.parse(savedWidths) : {};

        const mappedPrinters: Printer[] = (data || []).map((row: any) => ({
          id: row.id.toString(),
          name: row.nome,
          type: row.tipo,
          connectionType: row.conexao,
          ipAddress: row.ip || '',
          port: row.porta || 9100,
          usbPath: row.usb_path || '',
          isActive: row.ativo,
          larguraBobina: widthsMap[row.id.toString()] || (row.nome.toLowerCase().includes('58mm') ? '58mm' : '80mm')
        }));
        setDbPrinters(mappedPrinters);
      }
    } catch (err: any) {
      console.error('[useImpressoras] Erro ao buscar impressoras:', err.message);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const addImpressora = useCallback(async (printer: Omit<Printer, 'id' | 'isActive'>): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      let finalName = printer.name;
      if (printer.larguraBobina === '58mm') {
        if (!finalName.toLowerCase().includes('58mm')) {
          finalName = `${finalName} (58mm)`;
        }
      } else {
        finalName = finalName.replace(/\s*\(58mm\)/gi, '').replace(/\s*58mm/gi, '');
      }

      const { error } = await supabase
        .from('Impressoras' as any)
        .insert({
          restaurante_id: restaurantId,
          nome: finalName,
          tipo: printer.type,
          conexao: printer.connectionType,
          ip: printer.ipAddress || null,
          porta: printer.port || null,
          usb_path: printer.usbPath || null,
          ativo: true
        });

      if (error) throw error;
      toast.success('Impressora cadastrada com sucesso!');
      await fetchImpressoras({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao adicionar impressora: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchImpressoras]);

  const updateImpressora = useCallback(async (id: string, updates: Partial<Omit<Printer, 'id'>>): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      // Salvar a largura da bobina localmente no localStorage
      if (updates.larguraBobina !== undefined) {
        const savedWidths = localStorage.getItem('pedeai_printer_widths');
        const widthsMap = savedWidths ? JSON.parse(savedWidths) : {};
        widthsMap[id] = updates.larguraBobina;
        localStorage.setItem('pedeai_printer_widths', JSON.stringify(widthsMap));
      }

      const savedWidths = localStorage.getItem('pedeai_printer_widths');
      const widthsMap = savedWidths ? JSON.parse(savedWidths) : {};
      const targetWidth = updates.larguraBobina || widthsMap[id] || '80mm';

      const dbUpdates: any = {};
      if (updates.name !== undefined) {
        let finalName = updates.name;
        if (targetWidth === '58mm') {
          if (!finalName.toLowerCase().includes('58mm')) {
            finalName = `${finalName} (58mm)`;
          }
        } else {
          finalName = finalName.replace(/\s*\(58mm\)/gi, '').replace(/\s*58mm/gi, '');
        }
        dbUpdates.nome = finalName;
      } else if (updates.larguraBobina !== undefined) {
        const currentPrinter = dbPrinters.find(p => p.id === id);
        if (currentPrinter) {
          let baseName = currentPrinter.name.replace(/\s*\(58mm\)/gi, '').replace(/\s*58mm/gi, '');
          if (updates.larguraBobina === '58mm') {
            dbUpdates.nome = `${baseName} (58mm)`;
          } else {
            dbUpdates.nome = baseName;
          }
        }
      }

      if (updates.type !== undefined) dbUpdates.tipo = updates.type;
      if (updates.connectionType !== undefined) dbUpdates.conexao = updates.connectionType;
      if (updates.ipAddress !== undefined) dbUpdates.ip = updates.ipAddress;
      if (updates.port !== undefined) dbUpdates.porta = updates.port;
      if (updates.usbPath !== undefined) dbUpdates.usb_path = updates.usbPath;
      if (updates.isActive !== undefined) dbUpdates.ativo = updates.isActive;

      // Executa atualização no banco apenas se houver propriedades mapeadas do banco
      const hasDbUpdates = Object.keys(dbUpdates).length > 0;
      if (hasDbUpdates) {
        const { error } = await supabase
          .from('Impressoras' as any)
          .update(dbUpdates)
          .eq('id', parseInt(id, 10))
          .eq('restaurante_id', restaurantId);

        if (error) throw error;
      }

      toast.success('Impressora atualizada!');
      await fetchImpressoras({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao atualizar impressora: ' + err.message);
      return false;
    }
  }, [restaurantId, dbPrinters, fetchImpressoras]);

  const deleteImpressora = useCallback(async (id: string): Promise<boolean> => {
    if (!restaurantId) return false;
    try {
      const { error } = await supabase
        .from('Impressoras' as any)
        .delete()
        .eq('id', parseInt(id, 10))
        .eq('restaurante_id', restaurantId);

      if (error) throw error;
      toast.success('Impressora removida!');
      await fetchImpressoras({ silent: true });
      return true;
    } catch (err: any) {
      toast.error('Erro ao remover impressora: ' + err.message);
      return false;
    }
  }, [restaurantId, fetchImpressoras]);

  useEffect(() => {
    fetchImpressoras();
  }, [fetchImpressoras]);

  return {
    dbPrinters,
    loading,
    addImpressora,
    updateImpressora,
    deleteImpressora,
    refetchImpressoras: fetchImpressoras
  };
};
