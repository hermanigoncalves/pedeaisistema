import { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const UndoToast: React.FC = () => {
  const { undoAction, performUndo, clearUndo } = useApp();
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (!undoAction) {
      setTimeLeft(5);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearUndo();
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [undoAction, clearUndo]);

  if (!undoAction) return null;

  const getActionText = () => {
    switch (undoAction.type) {
      case 'deliver_order':
        return 'Pedido marcado como entregue';
      case 'close_table':
        return 'Mesa encerrada';
      case 'resolve_alert':
        return 'Alerta resolvido';
      default:
        return 'Ação realizada';
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-in-right">
      <div className="flex items-center gap-3 bg-foreground text-background px-4 py-3 rounded-xl shadow-2xl">
        <span className="font-medium">{getActionText()}</span>
        
        <button
          onClick={performUndo}
          className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          DESFAZER ({timeLeft}s)
        </button>

        <button
          onClick={clearUndo}
          className="p-1 hover:bg-background/20 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default UndoToast;
