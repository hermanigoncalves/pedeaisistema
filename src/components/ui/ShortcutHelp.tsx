import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface ShortcutHelpProps {
    open: boolean;
    onClose: () => void;
}

const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ open, onClose }) => {
    const shortcuts = [
        {
            category: 'Navegação',
            items: [
                { keys: ['Ctrl', 'H'], description: 'Ir para Home/Dashboard' },
                { keys: ['Ctrl', 'M'], description: 'Ir para Mesas' },
                { keys: ['Ctrl', 'P'], description: 'Ir para Produtos' },
                { keys: ['Ctrl', 'C'], description: 'Ir para Clientes' },
                { keys: ['Ctrl', 'A'], description: 'Ir para Analytics' },
            ],
        },
        {
            category: 'Ações',
            items: [
                { keys: ['Ctrl', 'N'], description: 'Novo Pedido' },
                { keys: ['Ctrl', 'K'], description: 'Busca Rápida' },
                { keys: ['Ctrl', 'S'], description: 'Abrir Configurações' },
                { keys: ['Ctrl', '?'], description: 'Mostrar Ajuda' },
                { keys: ['Esc'], description: 'Fechar Modal/Cancelar' },
            ],
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="w-5 h-5" />
                        Atalhos de Teclado
                    </DialogTitle>
                    <DialogDescription>
                        Use estes atalhos para navegar mais rapidamente pelo sistema
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {shortcuts.map((section, idx) => (
                        <div key={idx}>
                            <h3 className="text-sm font-semibold text-foreground mb-3">
                                {section.category}
                            </h3>
                            <div className="space-y-2">
                                {section.items.map((shortcut, itemIdx) => (
                                    <div
                                        key={itemIdx}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/20"
                                    >
                                        <span className="text-sm text-muted-foreground">
                                            {shortcut.description}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {shortcut.keys.map((key, keyIdx) => (
                                                <React.Fragment key={keyIdx}>
                                                    <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-secondary border border-border rounded">
                                                        {key}
                                                    </kbd>
                                                    {keyIdx < shortcut.keys.length - 1 && (
                                                        <span className="text-muted-foreground">+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 p-4 bg-secondary/20 rounded-lg">
                    <p className="text-xs text-muted-foreground text-center">
                        💡 Dica: Pressione <kbd className="px-1 py-0.5 text-xs bg-secondary border border-border rounded">Ctrl</kbd> + <kbd className="px-1 py-0.5 text-xs bg-secondary border border-border rounded">?</kbd> a qualquer momento para ver esta ajuda
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ShortcutHelp;
