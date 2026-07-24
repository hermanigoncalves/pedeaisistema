import { useState, useMemo } from 'react';
import { useSystemLogs } from '@/hooks/useSystemLogs';
import { LogLevel, LogCategory } from '@/services/logger-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertCircle,
    AlertTriangle,
    Info,
    CheckCircle,
    Search,
    Download,
    RefreshCw,
    Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SystemLogs = () => {
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedLog, setExpandedLog] = useState<number | null>(null);

    const { logs, loading, stats, refetch } = useSystemLogs({
        level: levelFilter === 'all' ? undefined : levelFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        realtime: true,
    });

    // Filter logs by search query
    const filteredLogs = useMemo(() => {
        if (!searchQuery) return logs;
        const query = searchQuery.toLowerCase();
        return logs.filter(
            (log) =>
                log.message.toLowerCase().includes(query) ||
                log.category.toLowerCase().includes(query) ||
                JSON.stringify(log.details || '').toLowerCase().includes(query)
        );
    }, [logs, searchQuery]);

    const getLevelIcon = (level: LogLevel) => {
        switch (level) {
            case 'error':
                return <AlertCircle className="w-4 h-4" />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4" />;
            case 'info':
                return <Info className="w-4 h-4" />;
            case 'success':
                return <CheckCircle className="w-4 h-4" />;
        }
    };

    const getLevelColor = (level: LogLevel) => {
        switch (level) {
            case 'error':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'warning':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'info':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'success':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
        }
    };

    const exportLogs = () => {
        const dataStr = JSON.stringify(filteredLogs, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `system-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex-1 p-8 overflow-y-auto bg-background">
            <div className="w-full space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Filter className="w-6 h-6 text-primary" />
                            System Logs
                        </h1>
                        <p className="text-muted-foreground">
                            Monitoramento em tempo real de eventos do sistema
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refetch}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportLogs}>
                            <Download className="w-4 h-4 mr-2" />
                            Exportar
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Card className="bg-card border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-red-500/10 border-red-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                Erros
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-red-500">{stats.errors}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-yellow-500/10 border-yellow-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-yellow-500 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                Avisos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-yellow-500">{stats.warnings}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-500/10 border-blue-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-blue-500 flex items-center gap-1">
                                <Info className="w-4 h-4" />
                                Info
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-blue-500">{stats.info}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-green-500/10 border-green-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-green-500 flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" />
                                Sucesso
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-green-500">{stats.success}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar logs..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <Select
                                value={levelFilter}
                                onValueChange={(value) => setLevelFilter(value as LogLevel | 'all')}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por nível" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os níveis</SelectItem>
                                    <SelectItem value="error">Erros</SelectItem>
                                    <SelectItem value="warning">Avisos</SelectItem>
                                    <SelectItem value="info">Info</SelectItem>
                                    <SelectItem value="success">Sucesso</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={categoryFilter}
                                onValueChange={(value) => setCategoryFilter(value as LogCategory | 'all')}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as categorias</SelectItem>
                                    <SelectItem value="auth">Autenticação</SelectItem>
                                    <SelectItem value="order">Pedidos</SelectItem>
                                    <SelectItem value="payment">Pagamentos</SelectItem>
                                    <SelectItem value="system">Sistema</SelectItem>
                                    <SelectItem value="database">Database</SelectItem>
                                    <SelectItem value="product">Produtos</SelectItem>
                                    <SelectItem value="user">Usuários</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Logs List */}
                <Card className="bg-card border-border">
                    <CardContent className="p-0">
                        <div className="max-h-[600px] overflow-y-auto">
                            {loading && filteredLogs.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                                    Carregando logs...
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    Nenhum log encontrado
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {filteredLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                                            onClick={() =>
                                                setExpandedLog(expandedLog === log.id ? null : log.id)
                                            }
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg ${getLevelColor(log.level)}`}>
                                                    {getLevelIcon(log.level)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            {log.category}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                                                                locale: ptBR,
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {log.message}
                                                    </p>
                                                    {expandedLog === log.id && log.details && (
                                                        <pre className="mt-2 p-3 bg-secondary rounded-lg text-xs overflow-x-auto">
                                                            {JSON.stringify(
                                                                typeof log.details === 'string'
                                                                    ? JSON.parse(log.details)
                                                                    : log.details,
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SystemLogs;
