import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer } from 'lucide-react';

interface PrintItem {
    nome: string;
    quantidade: number;
    preco: number;
    descricao?: string;
}

interface PrintData {
    id: string | number;
    mesa: string | number;
    created_at: string | Date;
    itens: PrintItem[];
    subtotal: number;
    serviceFee: number;
    totalWithFee: number;
    descricao?: string;
}

interface PrinterSimulatorProps {
    open: boolean;
    onClose: () => void;
    data: PrintData | null;
    restaurantName: string;
}

export const PrinterSimulator: React.FC<PrinterSimulatorProps> = ({
    open,
    onClose,
    data,
    restaurantName
}) => {
    if (!data) return null;

    const formatDate = (date: string | Date) => {
        return new Date(date).toLocaleString('pt-BR');
    };

    const formatCurrency = (value: number) => {
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm bg-zinc-100 p-0 overflow-hidden">
                <DialogHeader className="p-4 bg-white border-b">
                    <DialogTitle className="flex items-center gap-2 text-zinc-800">
                        <Printer className="w-5 h-5" />
                        Simulador de Impressão
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[500px] w-full bg-zinc-200 p-4">
                    <div className="bg-[#fffcf0] text-black font-mono text-xs p-4 shadow-lg mx-auto w-full max-w-[300px] border-t-4 border-zinc-800">
                        {/* Header */}
                        <div className="text-center mb-4">
                            <div className="font-bold text-lg mb-1">{restaurantName}</div>
                            <div className="text-[10px]">{formatDate(data.created_at)}</div>
                            <div className="border-b border-black border-dashed my-2"></div>
                            <div className="font-bold text-base">MESA {data.mesa}</div>
                            <div>Pedido #{data.id}</div>
                            <div className="border-b border-black border-dashed my-2"></div>
                        </div>

                        {/* Items */}
                        <div className="mb-4">
                            <div className="font-bold mb-2">ITENS:</div>
                            <div className="space-y-2">
                                {data.itens.map((item, idx) => (
                                    <div key={idx} className="flex flex-col">
                                        <div className="flex justify-between">
                                            <span>{item.quantidade}x {item.nome}</span>
                                        </div>
                                        {item.descricao && (
                                            <div className="text-[10px] italic pl-2">({item.descricao})</div>
                                        )}
                                        {data.descricao?.includes('Conta') && (
                                            <div className="flex justify-between text-[10px] pl-2 text-zinc-600">
                                                <span>{formatCurrency(item.preco)} un</span>
                                                <span className="text-black font-semibold">{formatCurrency(item.preco * item.quantidade)}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-b border-black border-dashed my-2"></div>

                        {/* Totals */}
                        {data.descricao?.includes('Conta') && (
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(data.subtotal)}</span>
                                </div>
                                {data.serviceFee > 0 && (
                                    <div className="flex justify-between">
                                        <span>Taxa de Serviço:</span>
                                        <span>{formatCurrency(data.serviceFee)}</span>
                                    </div>
                                )}

                                <div className="my-2 text-center text-lg font-bold border-y-2 border-black py-1 mt-2">
                                    TOTAL: {formatCurrency(data.totalWithFee)}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="text-center mt-6 text-[10px]">
                            {data.descricao && (
                                <div className="mb-4 italic">OBS: {data.descricao}</div>
                            )}
                            <div>Obrigado pela preferência!</div>
                        </div>

                        {/* Cut Line */}
                        <div className="mt-8 border-b-2 border-dashed border-zinc-400 relative">
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#fffcf0] px-2 text-zinc-400">corte aqui</span>
                        </div>

                    </div>
                </ScrollArea>

                <div className="p-4 bg-white border-t flex justify-end">
                    <Button onClick={onClose}>Fechar Simulação</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
