import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    description: string;
    action: () => void;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
    const handleKeyPress = useCallback(
        (event: KeyboardEvent) => {
            const shortcut = shortcuts.find(
                (s) =>
                    s.key.toLowerCase() === event.key.toLowerCase() &&
                    (s.ctrl === undefined || s.ctrl === event.ctrlKey) &&
                    (s.alt === undefined || s.alt === event.altKey) &&
                    (s.shift === undefined || s.shift === event.shiftKey)
            );

            if (shortcut) {
                event.preventDefault();
                shortcut.action();
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleKeyPress]);
};

/**
 * Hook para atalhos de navegação principais
 */
export const useNavigationShortcuts = () => {
    const navigate = useNavigate();

    const shortcuts: KeyboardShortcut[] = [
        {
            key: 'h',
            ctrl: true,
            description: 'Ir para Home/Dashboard',
            action: () => navigate('/'),
        },
        {
            key: 'm',
            ctrl: true,
            description: 'Ir para Mesas',
            action: () => navigate('/?tab=mesas'),
        },
        {
            key: 'p',
            ctrl: true,
            description: 'Ir para Produtos',
            action: () => navigate('/?tab=produtos'),
        },
        {
            key: 'c',
            ctrl: true,
            description: 'Ir para Clientes',
            action: () => navigate('/?tab=clientes'),
        },
        {
            key: 'a',
            ctrl: true,
            description: 'Ir para Analytics',
            action: () => navigate('/?tab=analytics'),
        },
    ];

    useKeyboardShortcuts(shortcuts);

    return shortcuts;
};

/**
 * Hook para atalhos de ações
 */
export const useActionShortcuts = (actions: {
    onNewOrder?: () => void;
    onSearch?: () => void;
    onSettings?: () => void;
    onHelp?: () => void;
    onEscape?: () => void;
}) => {
    const shortcuts: KeyboardShortcut[] = [
        {
            key: 'n',
            ctrl: true,
            description: 'Novo Pedido',
            action: () => actions.onNewOrder?.(),
        },
        {
            key: 'k',
            ctrl: true,
            description: 'Busca Rápida',
            action: () => actions.onSearch?.(),
        },
        {
            key: 's',
            ctrl: true,
            description: 'Configurações',
            action: () => actions.onSettings?.(),
        },
        {
            key: '?',
            ctrl: true,
            description: 'Ajuda',
            action: () => actions.onHelp?.(),
        },
        {
            key: 'Escape',
            description: 'Fechar/Cancelar',
            action: () => actions.onEscape?.(),
        },
    ].filter((s) => s.action !== undefined);

    useKeyboardShortcuts(shortcuts);

    return shortcuts;
};
