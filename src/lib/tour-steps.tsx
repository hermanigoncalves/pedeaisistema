import { Step } from 'react-joyride';

export const tourSteps: Step[] = [
    {
        target: 'body',
        content: (
            <div>
                <h2 className="text-xl font-bold mb-2">Bem-vindo ao PedeAi! 🎉</h2>
                <p>Vamos fazer um tour rápido pelas principais funcionalidades do sistema.</p>
            </div>
        ),
        placement: 'center',
        disableBeacon: true,
    },
    {
        target: '[data-tour="dashboard"]',
        content: (
            <div>
                <h3 className="font-bold mb-2">Dashboard</h3>
                <p>Aqui você visualiza as métricas principais do seu restaurante: vendas, mesas ocupadas, pedidos pendentes e clientes.</p>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="mesas"]',
        content: (
            <div>
                <h3 className="font-bold mb-2">Gestão de Mesas</h3>
                <p>Visualize todas as mesas, veja quais estão ocupadas, e gerencie pedidos. Mesas com alertas piscam em amarelo (garçom) ou azul (conta).</p>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="pedidos"]',
        content: (
            <div>
                <h3 className="font-bold mb-2">Fila de Pedidos</h3>
                <p>Acompanhe todos os pedidos em tempo real. Filtre por estação (Bar/Cozinha) e atualize o status conforme prepara.</p>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="produtos"]',
        content: (
            <div>
                <h3 className="font-bold mb-2">Produtos</h3>
                <p>Gerencie seu cardápio: adicione produtos, configure preços, categorias e controle de estoque.</p>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="analytics"]',
        content: (
            <div>
                <h3 className="font-bold mb-2">Analytics</h3>
                <p>Analise o desempenho do seu negócio com gráficos detalhados, comparações de períodos e exporte relatórios.</p>
            </div>
        ),
        placement: 'bottom',
    },
    {
        target: '[data-tour="settings"]',
        content: (
            <div>
                <h3 className="font-bold mb-2">Configurações</h3>
                <p>Configure número de mesas, horários, taxa de serviço, impressão automática e muito mais.</p>
            </div>
        ),
        placement: 'left',
    },
    {
        target: 'body',
        content: (
            <div>
                <h2 className="text-xl font-bold mb-2">Pronto para começar! 🚀</h2>
                <p className="mb-2">Algumas dicas rápidas:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Use <kbd className="px-1 py-0.5 bg-secondary rounded">Ctrl+?</kbd> para ver atalhos de teclado</li>
                    <li>Ative notificações para receber alertas em tempo real</li>
                    <li>Configure a impressão automática nas configurações</li>
                </ul>
            </div>
        ),
        placement: 'center',
    },
];
