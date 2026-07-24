import React, { useMemo } from 'react';
import {
  TrendingUp, DollarSign, ShoppingBag, Users,
  ArrowUpRight, ArrowDownRight, Package, Inbox
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const DashboardHome: React.FC = () => {
  const {
    orders,
    products,
    tables,
    customers,
    stockMovements,
    restaurantId,
    pedidos,
    // dailyMetrics, // REMOVED
    getMetrics,   // ADDED
    loadingPedidos: loading
  } = useApp();

  const [dateFilter, setDateFilter] = React.useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [dateRange, setDateRange] = React.useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date()
  });

  // Update date range when filter changes
  React.useEffect(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (dateFilter) {
      case 'today':
        start = new Date();
        end = new Date();
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        end = new Date();
        break;
      case 'month':
        start.setDate(now.getDate() - 30);
        end = new Date();
        break;
    }
    setDateRange({ start, end });
  }, [dateFilter]);

  // Calculate metrics from Supabase data
  const metrics = useMemo(() => {
    const stats = getMetrics(dateRange.start, dateRange.end);

    const occupiedTables = tables.filter(t => t.status === 'occupied').length;

    return {
      totalSales: stats.totalSales,
      topProducts: stats.topProducts,
      occupiedTables,
      totalTables: tables.length,
      pendingOrders: stats.pendingOrders,
      totalOrders: stats.totalOrders,
      totalCustomers: customers.length,
    };
  }, [getMetrics, tables, customers, dateRange]);

  // Recent stock movements
  const recentMovements = stockMovements.slice(0, 5);

  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-background animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full space-y-8">
        {/* Header and Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Resumo do período</p>
          </div>
          <div className="flex gap-2 bg-secondary/30 p-1 rounded-lg">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dateFilter === 'today' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Hoje
            </button>
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dateFilter === 'yesterday' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Ontem
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dateFilter === 'week' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dateFilter === 'month' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              30 Dias
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Sales */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas do Dia
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                R$ {metrics.totalSales.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {metrics.totalOrders} pedidos hoje
              </div>
            </CardContent>
          </Card>

          {/* Occupied Tables */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mesas Ocupadas
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {metrics.occupiedTables}/{metrics.totalTables}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {metrics.totalTables > 0 ? ((metrics.occupiedTables / metrics.totalTables) * 100).toFixed(0) : 0}% ocupação
              </div>
            </CardContent>
          </Card>

          {/* Pending Orders */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pedidos Pendentes
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {metrics.pendingOrders}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Aguardando preparo
              </div>
            </CardContent>
          </Card>

          {/* Total Customers */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Clientes Cadastrados
              </CardTitle>
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {metrics.totalCustomers}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Cadastrados no sistema
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Produtos Mais Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.topProducts.length > 0 ? (
                <div className="space-y-4">
                  {metrics.topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-primary/20 text-primary' :
                          index === 1 ? 'bg-info/20 text-info' :
                            index === 2 ? 'bg-warning/20 text-warning' :
                              'bg-secondary text-muted-foreground'
                          }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.quantity} vendidos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">R$ {product.revenue.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma venda registrada hoje</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity / Stock Movements */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Movimentação Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMovements.length > 0 ? (
                  recentMovements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${movement.type === 'in' ? 'bg-success/20' : 'bg-destructive/20'
                          }`}>
                          {movement.type === 'in' ? (
                            <ArrowUpRight className="w-4 h-4 text-success" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{movement.productName}</p>
                          <p className="text-sm text-muted-foreground">{movement.reason}</p>
                        </div>
                      </div>
                      <Badge variant={movement.type === 'in' ? 'default' : 'destructive'}>
                        {movement.type === 'in' ? '+' : '-'}{movement.quantity}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma movimentação recente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Bar */}
        <Card className="bg-card border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-around divide-x divide-border">
              <div className="text-center px-4">
                <p className="text-2xl font-bold text-primary">{products.filter(p => p.isActive).length}</p>
                <p className="text-sm text-muted-foreground">Produtos Ativos</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl font-bold text-warning">{products.filter(p => p.stock <= (p.minStock || 10)).length}</p>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
