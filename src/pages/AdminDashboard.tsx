import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
    Users,
    Store,
    PlusCircle,
    LayoutDashboard,
    LogOut,
    Loader2,
    TrendingUp,
    Search,
    Circle,
    History,
    ChevronRight,
    RefreshCw,
    BarChart3,
    Phone,
    UserCircle,
    Edit3,
    Trash2,
    X,
    FileText,
    QrCode,
    Download,
    Printer,
    ChevronDown,
    ChevronUp,
    Settings,
    Save,
    Tag,
    Plus
} from 'lucide-react';
import SystemLogs from '@/components/admin/SystemLogs';
import Logo from '@/components/Logo';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';

const AdminDashboard: React.FC = () => {
    const { adminLogout } = useApp();
    const [stats, setStats] = useState({
        totalRestaurants: 0,
        totalUsers: 0,
    });
    const [restaurants, setRestaurants] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [globalSearch, setGlobalSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'dashboard' | 'restaurants' | 'qrcodes' | 'logs' | 'prompt' | 'categories-stations'>('dashboard');
    const [selectedQrRestaurant, setSelectedQrRestaurant] = useState<string>('');
    const [globalPrompt, setGlobalPrompt] = useState<string>('');
    const [globalPromptVendas, setGlobalPromptVendas] = useState<string>('');
    const [globalPromptServico, setGlobalPromptServico] = useState<string>('');
    const [promptSubTab, setPromptSubTab] = useState<'geral' | 'vendas' | 'servico'>('geral');
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);

    // Estados locais para Estações & Categorias dinâmicas no admin
    const [selectedSetupRestaurant, setSelectedSetupRestaurant] = useState<string>('');
    const [setupEstacoes, setSetupEstacoes] = useState<any[]>([]);
    const [setupCategorias, setSetupCategorias] = useState<any[]>([]);
    const [isLoadingSetup, setIsLoadingSetup] = useState(false);

    const [newSetupEstacaoNome, setNewSetupEstacaoNome] = useState('');
    const [newSetupCategoriaNome, setNewSetupCategoriaNome] = useState('');
    const [editingSetupEstacaoId, setEditingSetupEstacaoId] = useState<number | null>(null);
    const [editingSetupEstacaoNome, setEditingSetupEstacaoNome] = useState('');
    const [editingSetupCategoriaId, setEditingSetupCategoriaId] = useState<number | null>(null);
    const [editingSetupCategoriaNome, setEditingSetupCategoriaNome] = useState('');

    const fetchGlobalPrompt = async () => {
        try {
            const { data, error } = await supabase
                .from('ConfiguracoesGlobais' as any)
                .select('prompt_geral, prompt_vendas, prompt_servico')
                .eq('id', 1)
                .maybeSingle();
            if (error) {
                console.warn('Erro ao ler prompts globais, tabela pode não existir ou estar vazia:', error.message);
            } else {
                const d = data as any;
                if (d?.prompt_geral) setGlobalPrompt(d.prompt_geral.replace(/\\n/g, '\n'));
                if (d?.prompt_vendas) setGlobalPromptVendas(d.prompt_vendas.replace(/\\n/g, '\n'));
                if (d?.prompt_servico) setGlobalPromptServico(d.prompt_servico.replace(/\\n/g, '\n'));
            }
        } catch (err) {
            console.error('Error fetching global prompt:', err);
        }
    };

    const handleSaveGlobalPrompt = async () => {
        setIsSavingPrompt(true);
        try {
            const { error } = await supabase
                .from('ConfiguracoesGlobais' as any)
                .upsert({ 
                    id: 1, 
                    prompt_geral: globalPrompt,
                    prompt_vendas: globalPromptVendas,
                    prompt_servico: globalPromptServico
                });

            if (error) throw error;
            toast.success('Prompts globais do sistema atualizados com sucesso!');
        } catch (error: any) {
            console.error('Error saving global prompt:', error);
            toast.error(error.message || 'Erro ao salvar os prompts globais');
        } finally {
            setIsSavingPrompt(false);
        }
    };

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

    // New restaurant form state
    const [newRestaurant, setNewRestaurant] = useState({
        nome: '',
        email: '',
        senha: '',
        quantidade_mesas: '10',
        telefone: '',
        telefone_dono: '',
        evolution_instancia: '',
        evolution_apikey: '',
        personalidade_agente: '',
        exemplos_conversa: '',
        regras_estabelecimento: '',
        delivery_habilitado: true,
        evolution_instancia_delivery: '',
        evolution_apikey_delivery: '',
        personalidade_agente_delivery: '',
        exemplos_conversa_delivery: '',
        regras_estabelecimento_delivery: '',
    });
    const [editingRestaurant, setEditingRestaurant] = useState<any | null>(null);
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch restaurants
            const { data: resData, count: resCount } = await supabase
                .from('Restaurantes')
                .select('*', { count: 'exact' });

            // Fetch users - ensuring we get the count even if data is partial
            const { data: userData, count: usersCount, error: userError } = await supabase
                .from('Usuários')
                .select('id, id_restaurante', { count: 'exact' });

            if (userError) {
                console.error('Error fetching users:', userError);
                toast.error(`Erro Usuários: ${userError.message}`);
            }

            console.log('Admin Debug - Restaurants:', resData);
            console.log('Admin Debug - Users Data:', userData);
            console.log('Admin Debug - Users Count:', usersCount);

            const totalUsersCalculated = usersCount ?? userData?.length ?? 0;

            if (totalUsersCalculated === 0 && resCount && resCount > 0) {
                console.warn('Alerta: Restaurantes encontrados, mas usuários retornaram zero. Verifique as políticas de RLS no Supabase.');
            }

            setStats({
                totalRestaurants: resCount || 0,
                totalUsers: totalUsersCalculated,
            });
            setRestaurants(resData || []);

            // Process chart data: Users per restaurant
            const userCounts = (userData || []).reduce((acc: any, curr) => {
                const resId = curr.id_restaurante;
                if (resId) {
                    acc[resId] = (acc[resId] || 0) + 1;
                } else {
                    acc['unlinked'] = (acc['unlinked'] || 0) + 1;
                }
                return acc;
            }, {});

            const dataForChart = (resData || []).map(res => ({
                name: res.nome || 'Restaurante',
                users: userCounts[res.id] || 0
            }));

            // Add unlinked users to chart if any exist
            if (userCounts['unlinked']) {
                dataForChart.push({
                    name: 'Sem Restaurante',
                    users: userCounts['unlinked']
                });
            }

            const finalChartData = dataForChart
                .sort((a, b) => b.users - a.users)
                .slice(0, 10);

            setChartData(finalChartData);

        } catch (error) {
            console.error('Error fetching admin data:', error);
            toast.error('Erro ao carregar dados do painel');
        } finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
        fetchGlobalPrompt();
    }, []);

    // Busca as estações e categorias do restaurante selecionado
    const fetchSetupData = useCallback(async (resId: string) => {
        if (!resId) return;
        setIsLoadingSetup(true);
        try {
            const { data: estData, error: estErr } = await supabase
                .from('estacoes_restaurante' as any)
                .select('*')
                .eq('restaurante_id', resId)
                .order('nome', { ascending: true });

            if (estErr) throw estErr;

            const { data: catData, error: catErr } = await supabase
                .from('categorias_restaurante' as any)
                .select('*')
                .eq('restaurante_id', resId)
                .order('nome', { ascending: true });

            if (catErr) throw catErr;

            setSetupEstacoes(estData || []);
            setSetupCategorias(catData || []);
        } catch (err: any) {
            console.error('[AdminDashboard] Erro ao buscar estações/categorias:', err.message);
            toast.error('Erro ao carregar dados do restaurante: ' + err.message);
        } finally {
            setIsLoadingSetup(false);
        }
    }, []);

    // Aciona a busca ao alterar o restaurante selecionado
    useEffect(() => {
        if (selectedSetupRestaurant) {
            fetchSetupData(selectedSetupRestaurant);
        } else {
            setSetupEstacoes([]);
            setSetupCategorias([]);
        }
    }, [selectedSetupRestaurant, fetchSetupData]);

    // Realtime subscription para Estações e Categorias
    useEffect(() => {
        if (!selectedSetupRestaurant) return;

        const channelEst = supabase
            .channel('admin-estacoes-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'estacoes_restaurante',
                    filter: `restaurante_id=eq.${selectedSetupRestaurant}`,
                },
                () => {
                    fetchSetupData(selectedSetupRestaurant);
                }
            )
            .subscribe();

        const channelCat = supabase
            .channel('admin-categorias-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'categorias_restaurante',
                    filter: `restaurante_id=eq.${selectedSetupRestaurant}`,
                },
                () => {
                    fetchSetupData(selectedSetupRestaurant);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channelEst);
            supabase.removeChannel(channelCat);
        };
    }, [selectedSetupRestaurant, fetchSetupData]);


    const handleAddRestaurant = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (editingRestaurant) {
                const { error } = await supabase
                    .from('Restaurantes')
                    .update({
                        nome: newRestaurant.nome,
                        email: newRestaurant.email,
                        senha: newRestaurant.senha,
                        quantidade_mesas: newRestaurant.quantidade_mesas,
                        telefone: newRestaurant.telefone,
                        evolution_instancia: newRestaurant.evolution_instancia || null,
                        waha_session: newRestaurant.evolution_instancia || null,
                        evolution_apikey: newRestaurant.evolution_apikey || null,
                        waha_apikey: newRestaurant.evolution_apikey || null,
                        personalidade_agente: newRestaurant.personalidade_agente || null,
                        exemplos_conversa: newRestaurant.exemplos_conversa || null,
                        regras_estabelecimento: newRestaurant.regras_estabelecimento || null,
                        delivery_habilitado: newRestaurant.delivery_habilitado,
                        evolution_instancia_delivery: newRestaurant.evolution_instancia_delivery || null,
                        waha_session_delivery: newRestaurant.evolution_instancia_delivery || null,
                        evolution_apikey_delivery: newRestaurant.evolution_apikey_delivery || null,
                        waha_apikey_delivery: newRestaurant.evolution_apikey_delivery || null,
                        personalidade_agente_delivery: newRestaurant.personalidade_agente_delivery || null,
                        exemplos_conversa_delivery: newRestaurant.exemplos_conversa_delivery || null,
                        regras_estabelecimento_delivery: newRestaurant.regras_estabelecimento_delivery || null,
                    })
                    .eq('id', editingRestaurant.id);

                if (error) throw error;
                toast.success('Restaurante atualizado com sucesso!');
                setEditingRestaurant(null);
            } else {
                const { error } = await supabase
                    .from('Restaurantes')
                    .insert([
                        {
                            nome: newRestaurant.nome,
                            email: newRestaurant.email,
                            senha: newRestaurant.senha,
                            quantidade_mesas: newRestaurant.quantidade_mesas,
                            telefone: newRestaurant.telefone,
                            evolution_instancia: newRestaurant.evolution_instancia || null,
                            waha_session: newRestaurant.evolution_instancia || null,
                            evolution_apikey: newRestaurant.evolution_apikey || null,
                            waha_apikey: newRestaurant.evolution_apikey || null,
                            personalidade_agente: newRestaurant.personalidade_agente || null,
                            exemplos_conversa: newRestaurant.exemplos_conversa || null,
                            regras_estabelecimento: newRestaurant.regras_estabelecimento || null,
                            delivery_habilitado: newRestaurant.delivery_habilitado,
                            evolution_instancia_delivery: newRestaurant.evolution_instancia_delivery || null,
                            waha_session_delivery: newRestaurant.evolution_instancia_delivery || null,
                            evolution_apikey_delivery: newRestaurant.evolution_apikey_delivery || null,
                            waha_apikey_delivery: newRestaurant.evolution_apikey_delivery || null,
                            personalidade_agente_delivery: newRestaurant.personalidade_agente_delivery || null,
                            exemplos_conversa_delivery: newRestaurant.exemplos_conversa_delivery || null,
                            regras_estabelecimento_delivery: newRestaurant.regras_estabelecimento_delivery || null,
                        }
                    ]);

                if (error) throw error;
                toast.success('Restaurante cadastrado com sucesso!');
            }

            setNewRestaurant({ 
                nome: '', 
                email: '', 
                senha: '', 
                quantidade_mesas: '10', 
                telefone: '', 
                telefone_dono: '',
                evolution_instancia: '',
                evolution_apikey: '',
                personalidade_agente: '',
                exemplos_conversa: '',
                regras_estabelecimento: '',
                delivery_habilitado: true,
                evolution_instancia_delivery: '',
                evolution_apikey_delivery: '',
                personalidade_agente_delivery: '',
                exemplos_conversa_delivery: '',
                regras_estabelecimento_delivery: '',
            });
            fetchData();
        } catch (error: any) {
            console.error('Error saving restaurant:', error);
            toast.error(error.message || 'Erro ao processar solicitação');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (res: any) => {
        setEditingRestaurant(res);
        setNewRestaurant({
            nome: res.nome || '',
            email: res.email || '',
            senha: res.senha || '',
            quantidade_mesas: String(res.quantidade_mesas || '10'),
            telefone: res.telefone || '',
            telefone_dono: res.telefone_dono || '',
            evolution_instancia: res.evolution_instancia || '',
            evolution_apikey: res.evolution_apikey || '',
            personalidade_agente: res.personalidade_agente || '',
            exemplos_conversa: res.exemplos_conversa || '',
            regras_estabelecimento: res.regras_estabelecimento || '',
            delivery_habilitado: res.delivery_habilitado ?? true,
            evolution_instancia_delivery: res.evolution_instancia_delivery || '',
            evolution_apikey_delivery: res.evolution_apikey_delivery || '',
            personalidade_agente_delivery: res.personalidade_agente_delivery || '',
            exemplos_conversa_delivery: res.exemplos_conversa_delivery || '',
            regras_estabelecimento_delivery: res.regras_estabelecimento_delivery || '',
        });
        // Scroll to form if on mobile
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteRestaurant = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir o restaurante "${name}"?`)) return;

        try {
            const { error } = await supabase
                .from('Restaurantes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Restaurante removido com sucesso!');
            fetchData();
        } catch (error: any) {
            toast.error('Erro ao remover restaurante');
        }
    };

    const handleToggleDelivery = async (res: any) => {
        const newValue = res.delivery_habilitado === false ? true : false;
        try {
            const { error } = await supabase
                .from('Restaurantes')
                .update({ delivery_habilitado: newValue })
                .eq('id', res.id);

            if (error) throw error;
            toast.success(`Delivery ${newValue ? 'ativado' : 'desativado'} para "${res.nome}"!`);
            fetchData();
        } catch (error: any) {
            toast.error('Erro ao alterar status do Delivery: ' + error.message);
        }
    };

    const cancelEdit = () => {
        setEditingRestaurant(null);
        setNewRestaurant({ 
            nome: '', 
            email: '', 
            senha: '', 
            quantidade_mesas: '10', 
            telefone: '', 
            telefone_dono: '',
            evolution_instancia: '',
            evolution_apikey: '',
            personalidade_agente: '',
            exemplos_conversa: '',
            regras_estabelecimento: '',
            delivery_habilitado: true,
            evolution_instancia_delivery: '',
            evolution_apikey_delivery: '',
            personalidade_agente_delivery: '',
            exemplos_conversa_delivery: '',
            regras_estabelecimento_delivery: '',
        });
    };

    const generateRandomPassword = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let password = "";
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewRestaurant(prev => ({ ...prev, senha: password }));
        toast.info('Senha aleatória gerada!');
    };

    const filteredRestaurants = restaurants.filter(r => {
        const matchesSearch = r.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.email?.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (deliveryFilter === 'active') return r.delivery_habilitado !== false;
        if (deliveryFilter === 'inactive') return r.delivery_habilitado === false;
        return true;
    });

    // Operações CRUD para Estações (Admin)
    const handleAddSetupEstacao = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSetupRestaurant || !newSetupEstacaoNome.trim()) return;
        try {
            const { error } = await supabase
                .from('estacoes_restaurante' as any)
                .insert({ restaurante_id: selectedSetupRestaurant, nome: newSetupEstacaoNome.trim() });
            if (error) throw error;
            toast.success('Estação adicionada!');
            setNewSetupEstacaoNome('');
            fetchSetupData(selectedSetupRestaurant);
        } catch (err: any) {
            toast.error('Erro ao adicionar estação: ' + err.message);
        }
    };

    const handleUpdateSetupEstacao = async (id: number) => {
        if (!selectedSetupRestaurant || !editingSetupEstacaoNome.trim()) return;
        try {
            const { error } = await supabase
                .from('estacoes_restaurante' as any)
                .update({ nome: editingSetupEstacaoNome.trim() })
                .eq('id', id)
                .eq('restaurante_id', selectedSetupRestaurant);
            if (error) throw error;
            toast.success('Estação atualizada!');
            setEditingSetupEstacaoId(null);
            fetchSetupData(selectedSetupRestaurant);
        } catch (err: any) {
            toast.error('Erro ao atualizar estação: ' + err.message);
        }
    };

    const handleDeleteSetupEstacao = async (id: number, nome: string) => {
        if (!selectedSetupRestaurant) return;
        try {
            const normalizedNome = nome.trim().toLowerCase();
            
            // 1. Atualizar Produtos (muda para 'kitchen')
            const { error: errProd } = await supabase
                .from('Produtos')
                .update({ estacao: 'kitchen' })
                .eq('restaurante_id', selectedSetupRestaurant)
                .eq('estacao', normalizedNome);
            if (errProd) console.error('Erro ao atualizar produtos da estação:', errProd);

            // 2. Atualizar SaboresPizza (muda para 'kitchen')
            const { error: errPizza } = await supabase
                .from('SaboresPizza' as any)
                .update({ estacao: 'kitchen' })
                .eq('restaurante_id', selectedSetupRestaurant)
                .eq('estacao', normalizedNome);
            if (errPizza) console.error('Erro ao atualizar pizzas da estação:', errPizza);

            // 3. Deletar estação
            const { error } = await supabase
                .from('estacoes_restaurante' as any)
                .delete()
                .eq('id', id)
                .eq('restaurante_id', selectedSetupRestaurant);
            if (error) throw error;
            
            toast.success('Estação removida! Produtos vinculados foram movidos para "Cozinha".');
            fetchSetupData(selectedSetupRestaurant);
        } catch (err: any) {
            toast.error('Erro ao remover estação: ' + err.message);
        }
    };

    // Operações CRUD para Categorias (Admin)
    const handleAddSetupCategoria = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSetupRestaurant || !newSetupCategoriaNome.trim()) return;
        try {
            const { error } = await supabase
                .from('categorias_restaurante' as any)
                .insert({ restaurante_id: selectedSetupRestaurant, nome: newSetupCategoriaNome.trim() });
            if (error) throw error;
            toast.success('Categoria adicionada!');
            setNewSetupCategoriaNome('');
            fetchSetupData(selectedSetupRestaurant);
        } catch (err: any) {
            toast.error('Erro ao adicionar categoria: ' + err.message);
        }
    };

    const handleUpdateSetupCategoria = async (id: number) => {
        if (!selectedSetupRestaurant || !editingSetupCategoriaNome.trim()) return;
        try {
            const { error } = await supabase
                .from('categorias_restaurante' as any)
                .update({ nome: editingSetupCategoriaNome.trim() })
                .eq('id', id)
                .eq('restaurante_id', selectedSetupRestaurant);
            if (error) throw error;
            toast.success('Categoria atualizada!');
            setEditingSetupCategoriaId(null);
            fetchSetupData(selectedSetupRestaurant);
        } catch (err: any) {
            toast.error('Erro ao atualizar categoria: ' + err.message);
        }
    };

    const handleDeleteSetupCategoria = async (id: number, nome: string) => {
        if (!selectedSetupRestaurant) return;
        try {
            // 1. Atualizar Produtos (muda para 'Outros')
            const { error: errProd } = await supabase
                .from('Produtos')
                .update({ categoria: 'Outros' })
                .eq('restaurante_id', selectedSetupRestaurant)
                .eq('categoria', nome);
            if (errProd) console.error('Erro ao atualizar produtos da categoria:', errProd);

            // 2. Deletar categoria
            const { error } = await supabase
                .from('categorias_restaurante' as any)
                .delete()
                .eq('id', id)
                .eq('restaurante_id', selectedSetupRestaurant);
            if (error) throw error;

            toast.success('Categoria removida! Produtos vinculados foram movidos para "Outros".');
            fetchSetupData(selectedSetupRestaurant);
        } catch (err: any) {
            toast.error('Erro ao remover categoria: ' + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
            {/* Header - Matching original Topbar style */}
            <header className="h-16 bg-white border-b border-border px-6 flex items-center justify-between shadow-sm sticky top-0 z-50">
                {/* Left: Logo + Brand Name */}
                <div className="flex items-center gap-3 min-w-[140px]">
                    <Logo size="sm" />
                    <div className="h-6 w-px bg-border mx-1" />
                    <span className="font-semibold text-foreground text-sm">
                        Admin
                    </span>
                </div>

                {/* Center: Navigation Pill Buttons */}
                <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-full border border-border/50">
                    <Button
                        variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('dashboard')}
                        className={`rounded-full px-5 h-8 text-xs font-bold transition-all ${activeTab === 'dashboard'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                            }`}
                    >
                        Dashboard
                    </Button>
                    <Button
                        variant={activeTab === 'restaurants' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('restaurants')}
                        className={`rounded-full px-5 h-8 text-xs font-bold transition-all ${activeTab === 'restaurants'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                            }`}
                    >
                        Restaurantes
                    </Button>
                    <Button
                        variant={activeTab === 'qrcodes' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('qrcodes')}
                        className={`rounded-full px-5 h-8 text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'qrcodes'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                            }`}
                    >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Codes
                    </Button>
                    <Button
                        variant={activeTab === 'logs' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('logs')}
                        className={`rounded-full px-5 h-8 text-xs font-bold transition-all ${activeTab === 'logs'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                            }`}
                    >
                        Logs
                    </Button>
                    <Button
                        variant={activeTab === 'prompt' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('prompt')}
                        className={`rounded-full px-5 h-8 text-xs font-bold transition-all ${activeTab === 'prompt'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                            }`}
                    >
                        Prompt Geral
                    </Button>
                    <Button
                        variant={activeTab === 'categories-stations' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('categories-stations')}
                        className={`rounded-full px-5 h-8 text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'categories-stations'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                            }`}
                    >
                        Estações & Categorias
                    </Button>
                </div>

                {/* Right: Status, Search, Logout */}
                <div className="flex items-center gap-3 min-w-[140px] justify-end">
                    <div className="hidden md:flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                        <Circle className="w-2 h-2 fill-current animate-pulse" />
                        <span>Online</span>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={adminLogout}
                        className="rounded-full h-9 w-9 hover:bg-destructive/10 hover:text-destructive transition-colors group"
                        title="Sair"
                    >
                        <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 w-full space-y-6 overflow-y-auto bg-[#FAFAFA]">
                {activeTab === 'dashboard' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                                <p className="text-sm text-muted-foreground">Visão geral da plataforma</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchData}
                                className="gap-2 h-9"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Atualizar
                            </Button>
                        </div>

                        {/* Simple Metric Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {/* Estabelecimentos */}
                            <Card className="border-none shadow-sm bg-white">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                            <Store className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Total</span>
                                    </div>
                                    <div className="text-2xl font-bold text-foreground mb-1">{stats.totalRestaurants}</div>
                                    <div className="text-xs text-muted-foreground">Estabelecimentos</div>
                                </CardContent>
                            </Card>

                            {/* Delivery Ativo */}
                            <Card className="border-none shadow-sm bg-white border-l-4 border-l-emerald-500">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                            <span className="text-lg">🛵</span>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                            {stats.totalRestaurants > 0 
                                                ? `${((restaurants.filter(r => r.delivery_habilitado !== false).length / stats.totalRestaurants) * 100).toFixed(0)}%` 
                                                : '0%'}
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold text-foreground mb-1">
                                        {restaurants.filter(r => r.delivery_habilitado !== false).length}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-semibold">Lojas com Delivery Ativo</div>
                                </CardContent>
                            </Card>

                            {/* Usuários */}
                            <Card className="border-none shadow-sm bg-white">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                            <Users className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">+8%</span>
                                    </div>
                                    <div className="text-2xl font-bold text-foreground mb-1">{stats.totalUsers}</div>
                                    <div className="text-xs text-muted-foreground">Usuários Ativos</div>
                                </CardContent>
                            </Card>

                            {/* Média */}
                            <Card className="border-none shadow-sm bg-white">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                                            <BarChart3 className="w-5 h-5 text-purple-600" />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-foreground mb-1">
                                        {stats.totalRestaurants > 0 ? (stats.totalUsers / stats.totalRestaurants).toFixed(1) : 0}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Média por Loja</div>
                                </CardContent>
                            </Card>

                            {/* Taxa de Engajamento */}
                            <Card className="border-none shadow-sm bg-white">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">+5%</span>
                                    </div>
                                    <div className="text-2xl font-bold text-foreground mb-1">
                                        {stats.totalRestaurants > 0 ? ((stats.totalUsers / stats.totalRestaurants) * 10).toFixed(0) : 0}%
                                    </div>
                                    <div className="text-xs text-muted-foreground">Taxa de Engajamento</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Chart - Takes 2 columns */}
                            <Card className="lg:col-span-2 border-none shadow-sm bg-white">
                                <CardHeader className="border-b px-6 py-4">
                                    <CardTitle className="text-base font-semibold">Distribuição de Usuários</CardTitle>
                                    <CardDescription className="text-xs">Top 10 restaurantes por número de usuários</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={80}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                                                    cursor={{ fill: '#f8f9fa' }}
                                                />
                                                <Bar dataKey="users" radius={[6, 6, 0, 0]} fill="#3b82f6">
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quick Stats - Takes 1 column */}
                            <Card className="border-none shadow-sm bg-white">
                                <CardHeader className="border-b px-6 py-4">
                                    <CardTitle className="text-base font-semibold">Estatísticas Rápidas</CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Total de Mesas</span>
                                        <span className="text-sm font-bold text-foreground">
                                            {restaurants.reduce((acc, r) => acc + (parseInt(r.quantidade_mesas) || 0), 0)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Média Mesas/Loja</span>
                                        <span className="text-sm font-bold text-foreground">
                                            {stats.totalRestaurants > 0
                                                ? (restaurants.reduce((acc, r) => acc + (parseInt(r.quantidade_mesas) || 0), 0) / stats.totalRestaurants).toFixed(0)
                                                : 0
                                            }
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">Novos Este Mês</span>
                                        <span className="text-sm font-bold text-emerald-600">+2</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-sm text-muted-foreground">Status Geral</span>
                                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Operacional</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Activity */}
                        <Card className="border-none shadow-sm bg-white">
                            <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b">
                                <div>
                                    <CardTitle className="text-base font-semibold">Cadastros Recentes</CardTitle>
                                    <CardDescription className="text-xs">Últimos estabelecimentos adicionados</CardDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('restaurants')}
                                    className="text-xs font-medium text-primary hover:bg-primary/5"
                                >
                                    Ver Todos
                                    <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {restaurants.slice(0, 5).map((res) => (
                                        <div key={res.id} className="px-6 py-4 hover:bg-secondary/5 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                        {res.nome?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-semibold text-foreground">{res.nome}</p>
                                                            {res.delivery_habilitado !== false ? (
                                                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1 shadow-2xs">
                                                                    🛵 Delivery On
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                                                    Delivery Off
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{res.email}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">{new Date(res.created_at).toLocaleDateString('pt-BR')}</p>
                                                    <p className="text-xs font-medium text-foreground">{res.quantidade_mesas} mesas</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'qrcodes' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                    <QrCode className="w-6 h-6 text-primary" />
                                    QR Codes das Mesas
                                </h1>
                                <p className="text-sm text-muted-foreground">Gere e imprima QR codes para os clientes escanearem</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={selectedQrRestaurant}
                                    onChange={(e) => setSelectedQrRestaurant(e.target.value)}
                                    className="h-10 rounded-full bg-white border border-border px-4 text-xs font-bold focus:ring-primary focus:border-primary"
                                >
                                    <option value="">Todos os restaurantes</option>
                                    {restaurants.map((r) => (
                                        <option key={r.id} value={r.id}>{r.nome}</option>
                                    ))}
                                </select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-9 rounded-full"
                                    onClick={() => window.print()}
                                >
                                    <Printer className="w-4 h-4" />
                                    Imprimir Todos
                                </Button>
                            </div>
                        </div>

                        {(selectedQrRestaurant ? restaurants.filter(r => r.id === selectedQrRestaurant) : restaurants).map((res) => (
                            <Card key={res.id} className="shadow-md border-border bg-card overflow-hidden">
                                <CardHeader className="px-6 py-4 border-b border-border/40 bg-secondary/5">
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Store className="w-5 h-5 text-primary" />
                                        {res.nome}
                                        <span className="text-xs font-normal text-muted-foreground ml-2">
                                            ({res.quantidade_mesas} mesas)
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                        {Array.from({ length: Number(res.quantidade_mesas) || 0 }, (_, i) => i + 1).map((mesa) => {
                                            const checkinUrl = `${window.location.origin}/checkin?mesa=${mesa}&restaurante=${res.id}`;
                                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkinUrl)}`;
                                            return (
                                                <div key={mesa} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-md transition-all bg-white group">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Mesa</div>
                                                    <div className="text-2xl font-black text-primary">{mesa}</div>
                                                    <img
                                                        src={qrUrl}
                                                        alt={`QR Code Mesa ${mesa}`}
                                                        className="w-28 h-28 rounded-lg border border-border/30"
                                                        loading="lazy"
                                                    />
                                                    <a
                                                        href={qrUrl}
                                                        download={`qr-${res.nome}-mesa-${mesa}.png`}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        Baixar
                                                    </a>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <SystemLogs />
                    </div>
                )}

                {activeTab === 'restaurants' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 items-start">
                        {/* Add Restaurant Form */}
                        <Card className="lg:col-span-4 shadow-md border-border bg-card overflow-hidden sticky top-24">
                            <CardHeader className="px-6 py-5 border-b border-border/40 bg-secondary/5">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                                        {editingRestaurant ? <Edit3 className="w-5 h-5 text-primary" /> : <PlusCircle className="w-5 h-5 text-primary" />}
                                        {editingRestaurant ? 'Editar Restaurante' : 'Novo Restaurante'}
                                    </CardTitle>
                                    {editingRestaurant && (
                                        <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8 rounded-full text-muted-foreground">
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                <CardDescription className="text-xs">
                                    {editingRestaurant ? `Editando: ${editingRestaurant.nome}` : 'Expandir rede de estabelecimentos.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <form onSubmit={handleAddRestaurant} className="space-y-5">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="res-name" className="font-black text-[10px] uppercase text-muted-foreground/70 tracking-tight pl-1">Nome Comercial</Label>
                                        <Input
                                            id="res-name"
                                            placeholder="Ex: Pizzaria Real"
                                            value={newRestaurant.nome}
                                            onChange={e => setNewRestaurant({ ...newRestaurant, nome: e.target.value })}
                                            className="bg-secondary/30 border-none rounded-xl h-12 text-sm focus-visible:ring-primary shadow-inner"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="res-email" className="font-black text-[10px] uppercase text-muted-foreground/70 tracking-tight pl-1">Email de Acesso</Label>
                                        <Input
                                            id="res-email"
                                            type="email"
                                            placeholder="restaurante@pedeai.com"
                                            value={newRestaurant.email}
                                            onChange={e => setNewRestaurant({ ...newRestaurant, email: e.target.value })}
                                            className="bg-secondary/30 border-none rounded-xl h-12 text-sm focus-visible:ring-primary shadow-inner"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="res-phone" className="font-black text-[10px] uppercase text-muted-foreground/70 tracking-tight pl-1">Telefone Principal</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                                <Input
                                                    id="res-phone"
                                                    placeholder="(00) 00000-0000"
                                                    value={newRestaurant.telefone}
                                                    onChange={e => setNewRestaurant({ ...newRestaurant, telefone: e.target.value })}
                                                    className="bg-secondary/30 border-none rounded-xl h-12 pl-10 text-sm focus-visible:ring-primary shadow-inner"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="owner-phone" className="font-black text-[10px] uppercase text-muted-foreground/70 tracking-tight pl-1">Telefone do Dono</Label>
                                            <div className="relative">
                                                <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                                <Input
                                                    id="owner-phone"
                                                    placeholder="(00) 00000-0000"
                                                    value={newRestaurant.telefone_dono}
                                                    onChange={e => setNewRestaurant({ ...newRestaurant, telefone_dono: e.target.value })}
                                                    className="bg-secondary/30 border-none rounded-xl h-12 pl-10 text-sm focus-visible:ring-primary shadow-inner"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="res-pass" className="font-black text-[10px] uppercase text-muted-foreground/70 tracking-tight pl-1">Senha de Acesso</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="res-pass"
                                                type="text"
                                                placeholder="••••••••"
                                                value={newRestaurant.senha}
                                                onChange={e => setNewRestaurant({ ...newRestaurant, senha: e.target.value })}
                                                className="bg-secondary/30 border-none rounded-xl h-12 text-sm flex-1 focus-visible:ring-primary shadow-inner"
                                                required
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="icon"
                                                onClick={generateRandomPassword}
                                                className="shrink-0 rounded-xl h-12 w-12 shadow-sm border border-border/50 hover:bg-white transition-colors"
                                                title="Gerar senha aleatória"
                                            >
                                                <RefreshCw className="w-4 h-4 text-primary" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="res-tables" className="font-black text-[10px] uppercase text-muted-foreground/70 tracking-tight pl-1">Quantidade de Mesas</Label>
                                        <Input
                                            id="res-tables"
                                            type="number"
                                            value={newRestaurant.quantidade_mesas}
                                            onChange={e => setNewRestaurant({ ...newRestaurant, quantidade_mesas: e.target.value })}
                                            className="bg-secondary/30 border-none rounded-xl h-12 text-sm focus-visible:ring-primary shadow-inner"
                                            required
                                        />
                                    </div>
                                    
                                    {/* Configurações Avançadas de SaaS & IA */}
                                    <div className="space-y-3 pt-1">
                                        <div 
                                            onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                                            className="flex items-center justify-between w-full px-4 py-3 bg-secondary/20 hover:bg-secondary/40 rounded-xl text-[10px] uppercase tracking-wider font-black text-muted-foreground/80 transition-all cursor-pointer border border-border/10 select-none"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Settings className="w-3.5 h-3.5 text-primary" />
                                                Configurações de SaaS & IA
                                            </span>
                                            {showAdvancedConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>

                                        {showAdvancedConfig && (
                                            <div className="space-y-4 p-4 bg-secondary/10 border border-border/20 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                                                <div className="space-y-3">
                                                    <h4 className="text-[10px] font-black uppercase text-primary tracking-wider pl-1">Conexão WAHA (WhatsApp API)</h4>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="evolution-instance" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Sessão WAHA</Label>
                                                        <Input
                                                            id="evolution-instance"
                                                            placeholder="Ex: default"
                                                            value={newRestaurant.evolution_instancia}
                                                            onChange={e => setNewRestaurant({ ...newRestaurant, evolution_instancia: e.target.value })}
                                                            className="bg-white border border-border/40 rounded-xl h-10 text-xs focus-visible:ring-primary shadow-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="evolution-apikey" className="font-black text-[9px] uppercase text-muted-foreground pl-1">WAHA API Key</Label>
                                                        <Input
                                                            id="evolution-apikey"
                                                            placeholder="Deixe em branco para usar a chave global"
                                                            value={newRestaurant.evolution_apikey}
                                                            onChange={e => setNewRestaurant({ ...newRestaurant, evolution_apikey: e.target.value })}
                                                            className="bg-white border border-border/40 rounded-xl h-10 text-xs focus-visible:ring-primary shadow-sm"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-2 border-t border-border/30">
                                                    <h4 className="text-[10px] font-black uppercase text-primary tracking-wider pl-1">Comportamento do Robô</h4>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="agent-personality" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Personalidade & Tom de Voz</Label>
                                                        <textarea
                                                            id="agent-personality"
                                                            placeholder="Ex: Fale de forma amigável, utilize emojis de pizza..."
                                                            value={newRestaurant.personalidade_agente}
                                                            onChange={e => setNewRestaurant({ ...newRestaurant, personalidade_agente: e.target.value })}
                                                            className="flex min-h-[60px] w-full rounded-xl border border-border/40 bg-white px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="agent-rules" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Regras do Estabelecimento</Label>
                                                        <textarea
                                                            id="agent-rules"
                                                            placeholder="Ex: Tempo de entrega: 40 a 50 min. Estacionamento gratuito..."
                                                            value={newRestaurant.regras_estabelecimento}
                                                            onChange={e => setNewRestaurant({ ...newRestaurant, regras_estabelecimento: e.target.value })}
                                                            className="flex min-h-[60px] w-full rounded-xl border border-border/40 bg-white px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                            rows={3}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="agent-examples" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Exemplos de Diálogo</Label>
                                                        <textarea
                                                            id="agent-examples"
                                                            placeholder="Cliente: Qual o valor da entrega?&#10;IA: Olá! A nossa entrega é grátis para compras acima de R$ 50."
                                                            value={newRestaurant.exemplos_conversa}
                                                            onChange={e => setNewRestaurant({ ...newRestaurant, exemplos_conversa: e.target.value })}
                                                            className="flex min-h-[60px] w-full rounded-xl border border-border/40 bg-white px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                            rows={3}
                                                        />
                                                    </div>

                                                    {/* CONFIGURAÇÕES DEDICADAS DO AGENTE DE DELIVERY */}
                                                    {newRestaurant.delivery_habilitado !== false && (
                                                        <div className="pt-4 border-t border-border/40 space-y-3">
                                                            <div className="flex items-center gap-1.5 text-emerald-600">
                                                                <span className="text-sm">🛵</span>
                                                                <h4 className="text-[10px] font-black uppercase tracking-wider">Agente de Delivery (Configurações Dedicadas)</h4>
                                                            </div>

                                                            <div className="space-y-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                                                <h5 className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Conexão WAHA (Delivery)</h5>
                                                                <div className="space-y-1.5">
                                                                    <Label htmlFor="evolution-instancia-delivery" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Sessão WAHA Delivery</Label>
                                                                    <Input
                                                                        id="evolution-instancia-delivery"
                                                                        placeholder="Ex: default"
                                                                        value={newRestaurant.evolution_instancia_delivery}
                                                                        onChange={e => setNewRestaurant({ ...newRestaurant, evolution_instancia_delivery: e.target.value })}
                                                                        className="bg-white border border-border/40 rounded-xl h-10 text-xs focus-visible:ring-primary shadow-sm"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label htmlFor="evolution-apikey-delivery" className="font-black text-[9px] uppercase text-muted-foreground pl-1">WAHA API Key (Delivery)</Label>
                                                                    <Input
                                                                        id="evolution-apikey-delivery"
                                                                        placeholder="Deixe em branco para usar a chave global"
                                                                        value={newRestaurant.evolution_apikey_delivery}
                                                                        onChange={e => setNewRestaurant({ ...newRestaurant, evolution_apikey_delivery: e.target.value })}
                                                                        className="bg-white border border-border/40 rounded-xl h-10 text-xs focus-visible:ring-primary shadow-sm"
                                                                    />
                                                                </div>

                                                                <h5 className="text-[9px] font-black uppercase text-emerald-700 tracking-wider pt-2">Comportamento do Robô de Delivery</h5>
                                                                <div className="space-y-1.5">
                                                                    <Label htmlFor="agent-personality-delivery" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Personalidade & Tom de Voz (Delivery)</Label>
                                                                    <textarea
                                                                        id="agent-personality-delivery"
                                                                        placeholder="Ex: Atenda rápido, peça o endereço completo e o troco..."
                                                                        value={newRestaurant.personalidade_agente_delivery}
                                                                        onChange={e => setNewRestaurant({ ...newRestaurant, personalidade_agente_delivery: e.target.value })}
                                                                        className="flex min-h-[60px] w-full rounded-xl border border-border/40 bg-white px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                                        rows={2}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label htmlFor="agent-rules-delivery" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Regras de Entrega / Estabelecimento</Label>
                                                                    <textarea
                                                                        id="agent-rules-delivery"
                                                                        placeholder="Ex: Taxa de entrega fixa R$ 5,00. Raio de entrega 10km..."
                                                                        value={newRestaurant.regras_estabelecimento_delivery}
                                                                        onChange={e => setNewRestaurant({ ...newRestaurant, regras_estabelecimento_delivery: e.target.value })}
                                                                        className="flex min-h-[60px] w-full rounded-xl border border-border/40 bg-white px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <Label htmlFor="agent-examples-delivery" className="font-black text-[9px] uppercase text-muted-foreground pl-1">Exemplos de Diálogo (Delivery)</Label>
                                                                    <textarea
                                                                        id="agent-examples-delivery"
                                                                        placeholder="Cliente: Qual o prazo de entrega?&#10;IA: Nosso tempo médio de entrega é de 40 a 50 minutos!"
                                                                        value={newRestaurant.exemplos_conversa_delivery}
                                                                        onChange={e => setNewRestaurant({ ...newRestaurant, exemplos_conversa_delivery: e.target.value })}
                                                                        className="flex min-h-[60px] w-full rounded-xl border border-border/40 bg-white px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full mt-2 bg-primary text-white font-black h-14 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] transition-all uppercase text-xs tracking-widest"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : editingRestaurant ? 'Atualizar Dados' : 'Finalizar Cadastro'}
                                    </Button>
                                    {editingRestaurant && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={cancelEdit}
                                            className="w-full text-muted-foreground font-bold text-[10px] uppercase tracking-widest mt-2"
                                        >
                                            Cancelar Edição
                                        </Button>
                                    )}
                                </form>
                            </CardContent>
                        </Card>

                        {/* List Column */}
                        <Card className="lg:col-span-8 shadow-md border-border bg-card overflow-hidden flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between px-8 py-5 border-b border-border/40 bg-secondary/5">
                                <div>
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <Store className="w-5 h-5 text-primary" />
                                        Gestão de Lojas
                                    </CardTitle>
                                    <CardDescription className="text-xs">Lista completa de parceiros integrados.</CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    {/* Filtros Rápidos por Status de Delivery */}
                                    <div className="inline-flex items-center p-1 bg-white rounded-full border border-border shadow-sm text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setDeliveryFilter('all')}
                                            className={`px-3 py-1 rounded-full font-bold transition-all ${
                                                deliveryFilter === 'all' 
                                                    ? 'bg-primary text-white shadow-sm' 
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Todos ({restaurants.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeliveryFilter('active')}
                                            className={`px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                                                deliveryFilter === 'active' 
                                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                                    : 'text-emerald-600 hover:bg-emerald-50'
                                            }`}
                                        >
                                            <span>🛵 Delivery On</span>
                                            <span className="text-[10px] bg-emerald-700/30 text-white px-1.5 py-0.2 rounded-full">
                                                {restaurants.filter(r => r.delivery_habilitado !== false).length}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeliveryFilter('inactive')}
                                            className={`px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                                                deliveryFilter === 'inactive' 
                                                    ? 'bg-destructive text-white shadow-sm' 
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <span>Delivery Off</span>
                                            <span className="text-[10px] bg-secondary px-1.5 py-0.2 rounded-full">
                                                {restaurants.filter(r => r.delivery_habilitado === false).length}
                                            </span>
                                        </button>
                                    </div>

                                    <div className="relative w-64">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                        <Input
                                            placeholder="Buscar por nome ou email..."
                                            className="pl-10 h-10 rounded-full bg-white border-border shadow-sm text-xs focus-visible:ring-primary"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1">
                                <div className="overflow-x-auto h-full">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/20 font-black tracking-widest sticky top-0 z-10">
                                            <tr>
                                                <th className="px-8 py-5 border-b border-border/50">Restaurante</th>
                                                <th className="px-8 py-5 border-b border-border/50">Contato Administrativo</th>
                                                <th className="px-8 py-5 border-b border-border/50 text-center">Mesas</th>
                                                <th className="px-8 py-5 border-b border-border/50 text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {isLoading ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-24 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                                                            <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">Sincronizando Banco...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredRestaurants.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-24 text-center">
                                                        <p className="text-sm font-bold text-muted-foreground/40 italic">Nenhum resultado para "{searchTerm}"</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRestaurants.map((res) => (
                                                    <tr key={res.id} className="hover:bg-secondary/5 transition-colors group">
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                                                                    {res.nome?.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    <p className="font-bold text-foreground transition-colors">{res.nome}</p>
                                                                    <p className="text-[9px] uppercase font-black text-muted-foreground/40 tracking-wider">Início: {new Date(res.created_at).toLocaleDateString()}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <p className="text-foreground font-bold text-xs">{res.email}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] text-muted-foreground font-mono bg-secondary/40 px-2 py-0.5 rounded border border-border/30">L: {res.senha}</span>
                                                                {res.telefone && <span className="text-[10px] text-primary/70 font-bold flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {res.telefone}</span>}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleDelivery(res)}
                                                                    title={res.delivery_habilitado !== false ? 'Clique para Desativar o Delivery' : 'Clique para Ativar o Delivery'}
                                                                    className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded border transition-all cursor-pointer hover:scale-105 ${
                                                                        res.delivery_habilitado !== false 
                                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20' 
                                                                            : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                                                                    }`}
                                                                >
                                                                    {res.delivery_habilitado !== false ? '🛵 Delivery On' : '🚫 Delivery Off'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            <span className="font-black text-xs text-foreground bg-secondary/50 px-4 py-1.5 rounded-xl border border-border/30 shadow-sm">{res.quantidade_mesas}</span>
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleEditClick(res)}
                                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5"
                                                                    title="Editar"
                                                                >
                                                                    <Edit3 className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteRestaurant(res.id, res.nome)}
                                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                                                    title="Excluir"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                                <div className="w-px h-4 bg-border/50 mx-1" />
                                                                <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 rounded-full h-8 px-4 border border-transparent hover:border-primary/20 transition-all">
                                                                    Aceder
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'prompt' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className="shadow-md border-border bg-card overflow-hidden">
                            <CardHeader className="px-6 py-5 border-b border-border/40 bg-secondary/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                                            <Settings className="w-5 h-5 text-primary" />
                                            Prompts Padrão do Garçom Digital (IA)
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Estes prompts servem de base padrão para as instruções de inteligência artificial de todos os restaurantes.
                                        </CardDescription>
                                    </div>
                                    <Button 
                                        onClick={handleSaveGlobalPrompt} 
                                        disabled={isSavingPrompt}
                                        className="rounded-full px-5 h-9 text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/95 flex items-center gap-1.5"
                                    >
                                        {isSavingPrompt ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-3.5 h-3.5" />
                                                Salvar Alterações
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="flex gap-2 mb-6 border-b border-border/40 pb-2">
                                    <button
                                        type="button"
                                        onClick={() => setPromptSubTab('geral')}
                                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                                            promptSubTab === 'geral'
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'text-muted-foreground hover:bg-secondary/40'
                                        }`}
                                    >
                                        Prompt Geral
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPromptSubTab('vendas')}
                                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                                            promptSubTab === 'vendas'
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'text-muted-foreground hover:bg-secondary/40'
                                        }`}
                                    >
                                        Prompt Vendas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPromptSubTab('servico')}
                                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                                            promptSubTab === 'servico'
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'text-muted-foreground hover:bg-secondary/40'
                                        }`}
                                    >
                                        Prompt Serviços (Contas)
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {promptSubTab === 'geral' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="global-prompt-editor-geral" className="font-black text-[10px] uppercase text-muted-foreground tracking-wider pl-1">Editor do Prompt Geral Base</Label>
                                            <textarea
                                                id="global-prompt-editor-geral"
                                                value={globalPrompt}
                                                onChange={(e) => setGlobalPrompt(e.target.value)}
                                                rows={22}
                                                className="font-mono text-xs w-full p-4 rounded-xl border border-border bg-secondary/15 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner leading-relaxed"
                                                placeholder="Digite aqui as instruções gerais do agente de IA..."
                                            />
                                        </div>
                                    )}
                                    {promptSubTab === 'vendas' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="global-prompt-editor-vendas" className="font-black text-[10px] uppercase text-muted-foreground tracking-wider pl-1">Editor do Prompt de Vendas Base</Label>
                                            <textarea
                                                id="global-prompt-editor-vendas"
                                                value={globalPromptVendas}
                                                onChange={(e) => setGlobalPromptVendas(e.target.value)}
                                                rows={22}
                                                className="font-mono text-xs w-full p-4 rounded-xl border border-border bg-secondary/15 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner leading-relaxed"
                                                placeholder="Digite aqui as instruções de vendas e cardápio base..."
                                            />
                                        </div>
                                    )}
                                    {promptSubTab === 'servico' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="global-prompt-editor-servico" className="font-black text-[10px] uppercase text-muted-foreground tracking-wider pl-1">Editor do Prompt de Serviços Base</Label>
                                            <textarea
                                                id="global-prompt-editor-servico"
                                                value={globalPromptServico}
                                                onChange={(e) => setGlobalPromptServico(e.target.value)}
                                                rows={22}
                                                className="font-mono text-xs w-full p-4 rounded-xl border border-border bg-secondary/15 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-inner leading-relaxed"
                                                placeholder="Digite aqui as instruções de serviços e contas base..."
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'categories-stations' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                    <Tag className="w-6 h-6 text-primary animate-pulse" />
                                    Estações & Categorias de Comida
                                </h1>
                                <p className="text-sm text-muted-foreground">Configure estações de preparo e categorias do cardápio de cada estabelecimento.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={selectedSetupRestaurant}
                                    onChange={(e) => setSelectedSetupRestaurant(e.target.value)}
                                    className="h-11 rounded-full bg-white border border-border px-5 text-xs font-bold focus:ring-primary focus:border-primary shadow-sm min-w-[240px] text-foreground"
                                >
                                    <option value="">Selecione um restaurante...</option>
                                    {restaurants.map((r) => (
                                        <option key={r.id} value={r.id}>{r.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        {!selectedSetupRestaurant ? (
                            <Card className="border-none shadow-sm bg-white p-16 text-center">
                                <div className="max-w-md mx-auto space-y-4">
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                                        <Store className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground">Nenhum Restaurante Selecionado</h3>
                                    <p className="text-sm text-muted-foreground">Escolha um estabelecimento no seletor de lojas acima para gerenciar as estações e categorias deste restaurante.</p>
                                </div>
                            </Card>
                        ) : isLoadingSetup ? (
                            <Card className="border-none shadow-sm bg-white p-24 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                                    <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">Buscando Configurações...</span>
                                </div>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                {/* Painel de Estações */}
                                <Card className="shadow-sm border-none bg-white overflow-hidden flex flex-col h-[55vh]">
                                    <CardHeader className="px-6 py-4 border-b border-border/40 bg-secondary/5 flex-shrink-0">
                                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Printer className="w-4 h-4 text-primary" />
                                            Estações de Preparo
                                        </CardTitle>
                                        <CardDescription className="text-xs">Direcionamento de pedidos para impressão e preparo do restaurante.</CardDescription>
                                    </CardHeader>
                                    
                                    <form onSubmit={handleAddSetupEstacao} className="p-4 border-b border-border/50 bg-secondary/5 flex gap-2 flex-shrink-0">
                                        <Input
                                            placeholder="Nova estação (Ex: Copa, Forno, Sushi)..."
                                            value={newSetupEstacaoNome}
                                            onChange={(e) => setNewSetupEstacaoNome(e.target.value)}
                                            className="flex-1 bg-white border border-border rounded-xl h-10 text-xs focus-visible:ring-primary shadow-sm"
                                            required
                                        />
                                        <Button type="submit" size="sm" className="gap-1.5 h-10 px-4 rounded-xl text-xs font-bold bg-primary text-white">
                                            <Plus className="w-4 h-4" />
                                            Adicionar
                                        </Button>
                                    </form>
                                    
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                        {setupEstacoes.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground text-sm">
                                                Nenhuma estação cadastrada para este restaurante.
                                            </div>
                                        ) : (
                                            setupEstacoes.map((est) => (
                                                <div key={est.id} className="flex items-center justify-between p-3 bg-secondary/15 rounded-xl border border-border/40 hover:border-primary/20 transition-all">
                                                    {editingSetupEstacaoId === est.id ? (
                                                        <div className="flex-1 flex gap-2 items-center">
                                                            <Input
                                                                value={editingSetupEstacaoNome}
                                                                onChange={(e) => setEditingSetupEstacaoNome(e.target.value)}
                                                                className="h-8 bg-white border border-border rounded-lg text-xs"
                                                                autoFocus
                                                            />
                                                            <Button size="sm" className="h-8 py-1 px-3 text-xs font-bold" onClick={() => handleUpdateSetupEstacao(est.id)}>Salvar</Button>
                                                            <Button size="sm" variant="outline" className="h-8 py-1 px-3 text-xs" onClick={() => setEditingSetupEstacaoId(null)}>Cancelar</Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="font-bold text-xs text-foreground bg-white border px-3 py-1.5 rounded-lg shadow-sm">{est.nome}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        setEditingSetupEstacaoId(est.id);
                                                                        setEditingSetupEstacaoNome(est.nome);
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg hover:bg-white text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        if (confirm(`Ao excluir a estação "${est.nome}", todos os produtos e pizzas vinculados serão remapeados para "Cozinha". Confirmar exclusão?`)) {
                                                                            handleDeleteSetupEstacao(est.id, est.nome);
                                                                        }
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>

                                {/* Painel de Categorias */}
                                <Card className="shadow-sm border-none bg-white overflow-hidden flex flex-col h-[55vh]">
                                    <CardHeader className="px-6 py-4 border-b border-border/40 bg-secondary/5 flex-shrink-0">
                                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-primary" />
                                            Categorias de Produtos
                                        </CardTitle>
                                        <CardDescription className="text-xs">Divisão de produtos e organização do cardápio digital do restaurante.</CardDescription>
                                    </CardHeader>
                                    
                                    <form onSubmit={handleAddSetupCategoria} className="p-4 border-b border-border/50 bg-secondary/5 flex gap-2 flex-shrink-0">
                                        <Input
                                            placeholder="Nova categoria (Ex: Entradas, Sobremesas, Vinhos)..."
                                            value={newSetupCategoriaNome}
                                            onChange={(e) => setNewSetupCategoriaNome(e.target.value)}
                                            className="flex-1 bg-white border border-border rounded-xl h-10 text-xs focus-visible:ring-primary shadow-sm"
                                            required
                                        />
                                        <Button type="submit" size="sm" className="gap-1.5 h-10 px-4 rounded-xl text-xs font-bold bg-primary text-white">
                                            <Plus className="w-4 h-4" />
                                            Adicionar
                                        </Button>
                                    </form>
                                    
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                        {setupCategorias.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground text-sm">
                                                Nenhuma categoria cadastrada para este restaurante.
                                            </div>
                                        ) : (
                                            setupCategorias.map((cat) => (
                                                <div key={cat.id} className="flex items-center justify-between p-3 bg-secondary/15 rounded-xl border border-border/40 hover:border-primary/20 transition-all">
                                                    {editingSetupCategoriaId === cat.id ? (
                                                        <div className="flex-1 flex gap-2 items-center">
                                                            <Input
                                                                value={editingSetupCategoriaNome}
                                                                onChange={(e) => setEditingSetupCategoriaNome(e.target.value)}
                                                                className="h-8 bg-white border border-border rounded-lg text-xs"
                                                                autoFocus
                                                            />
                                                            <Button size="sm" className="h-8 py-1 px-3 text-xs font-bold" onClick={() => handleUpdateSetupCategoria(cat.id)}>Salvar</Button>
                                                            <Button size="sm" variant="outline" className="h-8 py-1 px-3 text-xs" onClick={() => setEditingSetupCategoriaId(null)}>Cancelar</Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="font-bold text-xs text-foreground bg-white border px-3 py-1.5 rounded-lg shadow-sm">{cat.nome}</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        setEditingSetupCategoriaId(cat.id);
                                                                        setEditingSetupCategoriaNome(cat.nome);
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg hover:bg-white text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        if (confirm(`Ao excluir a categoria "${cat.nome}", todos os produtos vinculados serão remapeados para "Outros". Confirmar exclusão?`)) {
                                                                            handleDeleteSetupCategoria(cat.id, cat.nome);
                                                                        }
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
