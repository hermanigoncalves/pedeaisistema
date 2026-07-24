import React, { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesChart, PeakHoursChart, TableOccupancyChart } from './Charts';
import ComparisonMetrics from './ComparisonMetrics';
import ExportReports from './ExportReports';
import {
    getSalesChartData,
    getPeakHoursData,
    getTableOccupancyData,
    getWeeklyComparison,
    getMonthlyComparison,
} from '@/lib/analytics-utils';
import { BarChart3 } from 'lucide-react';

const AnalyticsDashboard: React.FC = () => {
    const { pedidos, tables, products } = useApp();

    // Dados dos gráficos
    const salesData = useMemo(() => getSalesChartData(pedidos, 7), [pedidos]);
    const peakHoursData = useMemo(() => getPeakHoursData(pedidos), [pedidos]);
    const occupancyData = useMemo(() => getTableOccupancyData(tables), [tables]);

    // Comparações
    const weeklyComparison = useMemo(() => getWeeklyComparison(pedidos), [pedidos]);
    const monthlyComparison = useMemo(() => getMonthlyComparison(pedidos), [pedidos]);

    // Dados para exportação
    const exportData = useMemo(() => {
        const orders = pedidos.map(p => ({
            id: String(p.id),
            date: new Date(p.created_at).toLocaleString('pt-BR'),
            table: Number(p.mesa) || 0,
            items: p.itens?.map((i: any) => `${i.quantidade}x ${i.nome}`).join(', ') || '',
            total: p.itens?.reduce((sum: number, i: any) => sum + (i.preco * i.quantidade), 0) || 0,
        }));

        const topProducts = products
            .map(product => {
                const quantity = pedidos.reduce((sum, order) => {
                    const productInOrder = order.itens?.find((i: any) => i.nome === product.name);
                    return sum + (productInOrder?.quantidade || 0);
                }, 0);
                const revenue = quantity * product.price;
                return { name: product.name, quantity, revenue };
            })
            .filter(p => p.quantity > 0)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        return {
            title: 'Relatório de Vendas',
            period: `${new Date().toLocaleDateString('pt-BR')}`,
            metrics: {
                totalSales: weeklyComparison.current.sales,
                totalOrders: weeklyComparison.current.orders,
                averageTicket: weeklyComparison.current.averageTicket,
                topProducts,
            },
            orders,
        };
    }, [pedidos, products, weeklyComparison]);

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-background">
            <div className="w-full space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-primary" />
                            Analytics
                        </h1>
                        <p className="text-muted-foreground">Análise detalhada do seu negócio</p>
                    </div>
                    <ExportReports data={exportData} />
                </div>

                {/* Comparações */}
                <Tabs defaultValue="weekly" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="weekly">Semanal</TabsTrigger>
                        <TabsTrigger value="monthly">Mensal</TabsTrigger>
                    </TabsList>
                    <TabsContent value="weekly" className="mt-6">
                        <ComparisonMetrics
                            current={weeklyComparison.current}
                            previous={weeklyComparison.previous}
                            growth={weeklyComparison.growth}
                            periodLabel="Semanal"
                        />
                    </TabsContent>
                    <TabsContent value="monthly" className="mt-6">
                        <ComparisonMetrics
                            current={monthlyComparison.current}
                            previous={monthlyComparison.previous}
                            growth={monthlyComparison.growth}
                            periodLabel="Mensal"
                        />
                    </TabsContent>
                </Tabs>

                {/* Gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="lg:col-span-2">
                        <SalesChart data={salesData} />
                    </div>
                    <PeakHoursChart data={peakHoursData} />
                    <TableOccupancyChart data={occupancyData} />
                </div>

                {/* Insights Rápidos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-card border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Produto Mais Vendido
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xl font-bold text-foreground">
                                {exportData.metrics.topProducts[0]?.name || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {exportData.metrics.topProducts[0]?.quantity || 0} vendidos
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Horário de Pico
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xl font-bold text-foreground">
                                {peakHoursData.reduce((max, curr) => curr.pedidos > max.pedidos ? curr : max, peakHoursData[0])?.hour || 'N/A'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Maior movimento
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Taxa de Ocupação
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xl font-bold text-foreground">
                                {tables.length > 0
                                    ? ((tables.filter(t => t.status === 'occupied').length / tables.length) * 100).toFixed(0)
                                    : 0}%
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Mesas ocupadas
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
