import { Order, Product } from '@/contexts/AppContext';

export interface PeriodComparison {
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
}

/**
 * Calcula métricas para um período específico
 */
export const calculatePeriodMetrics = (
    orders: any[],
    startDate: Date,
    endDate: Date
) => {
    const periodOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate && orderDate <= endDate;
    });

    const totalSales = periodOrders.reduce((sum, order) => {
        const orderTotal = order.itens?.reduce((itemSum: number, item: any) =>
            itemSum + (item.preco * item.quantidade), 0) || 0;
        return sum + orderTotal;
    }, 0);

    const totalOrders = periodOrders.length;
    const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    return {
        sales: totalSales,
        orders: totalOrders,
        averageTicket,
    };
};

/**
 * Compara dois períodos e retorna crescimento percentual
 */
export const comparePeriods = (
    orders: any[],
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
): PeriodComparison => {
    const current = calculatePeriodMetrics(orders, currentStart, currentEnd);
    const previous = calculatePeriodMetrics(orders, previousStart, previousEnd);

    const calculateGrowth = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
    };

    return {
        current,
        previous,
        growth: {
            sales: calculateGrowth(current.sales, previous.sales),
            orders: calculateGrowth(current.orders, previous.orders),
            averageTicket: calculateGrowth(current.averageTicket, previous.averageTicket),
        },
    };
};

/**
 * Obtém dados para gráfico de vendas por dia
 */
export const getSalesChartData = (orders: any[], days: number = 7) => {
    const data: Array<{ date: string; sales: number; orders: number }> = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayOrders = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= date && orderDate < nextDate;
        });

        const sales = dayOrders.reduce((sum, order) => {
            const orderTotal = order.itens?.reduce((itemSum: number, item: any) =>
                itemSum + (item.preco * item.quantidade), 0) || 0;
            return sum + orderTotal;
        }, 0);

        data.push({
            date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            sales,
            orders: dayOrders.length,
        });
    }

    return data;
};

/**
 * Obtém dados para gráfico de horários de pico
 */
export const getPeakHoursData = (orders: any[]) => {
    const hourlyData: { [key: number]: number } = {};

    // Inicializa todas as horas
    for (let i = 0; i < 24; i++) {
        hourlyData[i] = 0;
    }

    // Conta pedidos por hora
    orders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourlyData[hour]++;
    });

    return Object.entries(hourlyData).map(([hour, count]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        pedidos: count,
    }));
};

/**
 * Obtém dados para gráfico de ocupação de mesas
 */
export const getTableOccupancyData = (tables: any[]) => {
    const occupied = tables.filter(t => t.status === 'occupied').length;
    const free = tables.filter(t => t.status === 'free').length;

    return [
        { name: 'Ocupadas', value: occupied, color: '#ef4444' },
        { name: 'Livres', value: free, color: '#22c55e' },
    ];
};

/**
 * Calcula crescimento semanal
 */
export const getWeeklyComparison = (orders: any[]): PeriodComparison => {
    const now = new Date();

    // Semana atual
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(now);

    // Semana anterior
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setMilliseconds(-1);

    return comparePeriods(
        orders,
        currentWeekStart,
        currentWeekEnd,
        previousWeekStart,
        previousWeekEnd
    );
};

/**
 * Calcula crescimento mensal
 */
export const getMonthlyComparison = (orders: any[]): PeriodComparison => {
    const now = new Date();

    // Mês atual
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now);

    // Mês anterior
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    return comparePeriods(
        orders,
        currentMonthStart,
        currentMonthEnd,
        previousMonthStart,
        previousMonthEnd
    );
};
