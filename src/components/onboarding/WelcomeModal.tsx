import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles } from 'lucide-react';

interface WelcomeModalProps {
    onStartTour: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onStartTour }) => {
    const [open, setOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (!hasSeenWelcome) {
            setOpen(true);
        }
    }, []);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem('hasSeenWelcome', 'true');
        }
        setOpen(false);
    };

    const handleStartTour = () => {
        if (dontShowAgain) {
            localStorage.setItem('hasSeenWelcome', 'true');
        }
        setOpen(false);
        onStartTour();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Sparkles className="w-6 h-6 text-primary" />
                        Bem-vindo ao PedeAi!
                    </DialogTitle>
                    <DialogDescription className="text-base mt-4">
                        Estamos felizes em ter você aqui! O PedeAi é a plataforma completa para gestão do seu restaurante.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-6">
                    <div className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg">
                        <div className="text-2xl">📊</div>
                        <div>
                            <h4 className="font-semibold text-sm">Analytics em Tempo Real</h4>
                            <p className="text-xs text-muted-foreground">Acompanhe vendas, pedidos e métricas importantes</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg">
                        <div className="text-2xl">🖨️</div>
                        <div>
                            <h4 className="font-semibold text-sm">Impressão Automática</h4>
                            <p className="text-xs text-muted-foreground">Pedidos e contas impressos automaticamente</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-secondary/20 rounded-lg">
                        <div className="text-2xl">⚡</div>
                        <div>
                            <h4 className="font-semibold text-sm">Atalhos de Teclado</h4>
                            <p className="text-xs text-muted-foreground">Navegue rapidamente com atalhos (Ctrl+?)</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="dontShow"
                        checked={dontShowAgain}
                        onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
                    />
                    <label
                        htmlFor="dontShow"
                        className="text-sm text-muted-foreground cursor-pointer"
                    >
                        Não mostrar novamente
                    </label>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose}>
                        Começar Agora
                    </Button>
                    <Button onClick={handleStartTour} className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Fazer Tour Guiado
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default WelcomeModal;
