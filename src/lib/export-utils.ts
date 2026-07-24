import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportData {
    title: string;
    period: string;
    metrics: {
        totalSales: number;
        totalOrders: number;
        averageTicket: number;
        topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    };
    orders: Array<{
        id: string;
        date: string;
        table: number;
        items: string;
        total: number;
    }>;
}

/**
 * Exporta relatório para PDF
 */
export const exportToPDF = (data: ExportData) => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(20);
    doc.text(data.title, 14, 20);

    // Período
    doc.setFontSize(12);
    doc.text(`Período: ${data.period}`, 14, 30);

    // Métricas principais
    doc.setFontSize(14);
    doc.text('Resumo', 14, 45);

    doc.setFontSize(10);
    doc.text(`Total de Vendas: R$ ${data.metrics.totalSales.toFixed(2)}`, 14, 55);
    doc.text(`Total de Pedidos: ${data.metrics.totalOrders}`, 14, 62);
    doc.text(`Ticket Médio: R$ ${data.metrics.averageTicket.toFixed(2)}`, 14, 69);

    // Produtos mais vendidos
    if (data.metrics.topProducts.length > 0) {
        doc.setFontSize(14);
        doc.text('Produtos Mais Vendidos', 14, 85);

        autoTable(doc, {
            startY: 90,
            head: [['Produto', 'Quantidade', 'Receita']],
            body: data.metrics.topProducts.map(p => [
                p.name,
                p.quantity.toString(),
                `R$ ${p.revenue.toFixed(2)}`
            ]),
        });
    }

    // Pedidos
    if (data.orders.length > 0) {
        const finalY = (doc as any).lastAutoTable?.finalY || 120;

        doc.setFontSize(14);
        doc.text('Pedidos', 14, finalY + 15);

        autoTable(doc, {
            startY: finalY + 20,
            head: [['ID', 'Data', 'Mesa', 'Itens', 'Total']],
            body: data.orders.map(o => [
                o.id,
                o.date,
                o.table.toString(),
                o.items,
                `R$ ${o.total.toFixed(2)}`
            ]),
        });
    }

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
            `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString('pt-BR')}`,
            14,
            doc.internal.pageSize.height - 10
        );
    }

    // Download
    doc.save(`relatorio-${Date.now()}.pdf`);
};

/**
 * Exporta dados para Excel
 */
export const exportToExcel = (data: ExportData) => {
    const workbook = XLSX.utils.book_new();

    // Aba de Resumo
    const summaryData = [
        ['Relatório', data.title],
        ['Período', data.period],
        [''],
        ['Métrica', 'Valor'],
        ['Total de Vendas', `R$ ${data.metrics.totalSales.toFixed(2)}`],
        ['Total de Pedidos', data.metrics.totalOrders],
        ['Ticket Médio', `R$ ${data.metrics.averageTicket.toFixed(2)}`],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

    // Aba de Produtos
    if (data.metrics.topProducts.length > 0) {
        const productsData = [
            ['Produto', 'Quantidade', 'Receita'],
            ...data.metrics.topProducts.map(p => [
                p.name,
                p.quantity,
                p.revenue
            ])
        ];

        const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
        XLSX.utils.book_append_sheet(workbook, productsSheet, 'Produtos');
    }

    // Aba de Pedidos
    if (data.orders.length > 0) {
        const ordersData = [
            ['ID', 'Data', 'Mesa', 'Itens', 'Total'],
            ...data.orders.map(o => [
                o.id,
                o.date,
                o.table,
                o.items,
                o.total
            ])
        ];

        const ordersSheet = XLSX.utils.aoa_to_sheet(ordersData);
        XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Pedidos');
    }

    // Download
    XLSX.writeFile(workbook, `relatorio-${Date.now()}.xlsx`);
};

/**
 * Exporta dados para CSV
 */
export const exportToCSV = (data: ExportData) => {
    const csvData = [
        ['ID', 'Data', 'Mesa', 'Itens', 'Total'],
        ...data.orders.map(o => [
            o.id,
            o.date,
            o.table.toString(),
            o.items,
            o.total.toFixed(2)
        ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Exporta dados para JSON
 */
export const exportToJSON = (data: any) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `backup-${Date.now()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
