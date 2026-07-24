import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Verifica se um item é um marcador de sistema (não deve ser exibido na UI)
 */
export const isSystemMarkerItem = (itemName: string): boolean => {
  const systemMarkers = [
    'Atendimento Iniciado',
    'Mesa aberta',
    'Mesa Aberta',
    'atendimento iniciado',
    'mesa aberta',
    'Chamado de Garçom',
    'Chamado de Garcom',
    'chamado de garçom',
    'chamado de garcom',
    'Fechamento de Conta',
    'Fechamento de conta',
    'fechamento de conta',
  ];

  return systemMarkers.some(marker =>
    (itemName || '').toLowerCase().includes(marker.toLowerCase())
  );
};

/**
 * Filtra itens de sistema de uma lista de itens
 */
export const filterSystemItems = <T extends { nome?: string; productName?: string }>(
  items: T[]
): T[] => {
  return items.filter(item => {
    const name = item.nome || item.productName || '';
    return !isSystemMarkerItem(name);
  });
};
