import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ComparisonMetricsProps {
    current: {
        sales: number;
        orders: number;
        averageTicket: number;
    };
    previous: {
        sales: number;
        orders: number;
        averageTicket: number;
    };
    growth: {
        sales: number;
        orders: number;
        averageTicket: number;
    };
    periodLabel: string;
}

const ComparisonMetrics: React.FC<ComparisonMetricsProps> = ({
    current,
    previous,
    growth,
    periodLabel,
}) => {
    const getGrowthIcon = (value: number) => {
        if (value > 0) return <TrendingUp className="w-4 h-4 text-success" />;
        if (value < 0) return <TrendingDown className="w-4 h-4 text-destructive" />;
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    };

    const getGrowthColor = (value: number) => {
        if (value > 0) return 'text-success';
        if (value < 0) return 'text-destructive';
        return 'text-muted-foreground';
    };

    const metrics = [
        {
            label: 'Vendas',
            current: `R$ ${current.sales.toFixed(2)}`,
            previous: `R$ ${previous.sales.toFixed(2)}`,
            growth: growth.sales,
        },
        {
            label: 'Pedidos',
            current: current.orders.toString(),
            previous: previous.orders.toString(),
            growth: growth.orders,
        },
        {
            label: 'Ticket Médio',
            current: `R$ ${current.averageTicket.toFixed(2)}`,
            previous: `R$ ${previous.averageTicket.toFixed(2)}`,
            growth: growth.averageTicket,
        },
    ];

    return (
        <Card className="bg-card border-border">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                    Comparação {periodLabel}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {metrics.map((metric, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                            <div className="flex-1">
                                <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-bold text-foreground">{metric.current}</p>
                                    <p className="text-xs text-muted-foreground">vs {metric.previous}</p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 ${getGrowthColor(metric.growth)}`}>
                                {getGrowthIcon(metric.growth)}
                                <span className="text-lg font-semibold">
                                    {metric.growth > 0 && '+'}
                                    {metric.growth.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default ComparisonMetrics;
