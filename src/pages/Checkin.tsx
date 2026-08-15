import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
    Loader2,
    User,
    Phone,
    MapPin,
    CheckCircle2,
    UtensilsCrossed,
    Sparkles,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-config';

const Checkin: React.FC = () => {
    const [searchParams] = useSearchParams();
    const mesa = searchParams.get('mesa') || '0';
    const restauranteId = searchParams.get('restaurante') || '';

    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [restauranteNome, setRestauranteNome] = useState('');
    const [loadingPage, setLoadingPage] = useState(true);
    const [error, setError] = useState('');

    // Buscar nome do restaurante
    useEffect(() => {
        const fetchRestaurante = async () => {
            if (!restauranteId) {
                setError('Restaurante não encontrado. QR Code inválido.');
                setLoadingPage(false);
                return;
            }
            try {
                const { data, error: err } = await supabase
                    .from('Restaurantes')
                    .select('nome')
                    .eq('id', restauranteId)
                    .single();

                if (err || !data) {
                    setError('Restaurante não encontrado.');
                } else {
                    setRestauranteNome(data.nome);
                }
            } catch {
                setError('Erro ao carregar dados.');
            } finally {
                setLoadingPage(false);
            }
        };
        fetchRestaurante();
    }, [restauranteId]);

    // Formatar telefone
    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        if (digits.length <= 11)
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTelefone(formatPhone(e.target.value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!nome.trim()) {
            toast.error('Digite seu nome');
            return;
        }
        if (!telefone || telefone.replace(/\D/g, '').length < 10) {
            toast.error('Digite um telefone válido');
            return;
        }

        setIsLoading(true);

        try {
            const phoneDigits = '55' + telefone.replace(/\D/g, '');

            // 1. Verifica se o usuário já existe
            const { data: existingUser, error: selectError } = await supabase
                .from('Usuários')
                .select('*')
                .eq('telefone', phoneDigits)
                .eq('id_restaurante', restauranteId)
                .maybeSingle();

            if (selectError) {
                console.error('[Checkin] Erro ao buscar usuário:', selectError);
            }

            let visits = 1;
            let isFirstVisit = true;

            if (existingUser) {
                // 1. Inativar qualquer outra sessão desse telefone em outros restaurantes
                const { error: deactivateError } = await supabase
                    .from('Usuários')
                    .update({ Status: 'Inativo' })
                    .eq('telefone', phoneDigits)
                    .neq('id_restaurante', restauranteId);

                if (deactivateError) {
                    console.error('[Checkin] Erro ao desativar sessões antigas:', deactivateError);
                }

                // Usuário recorrente — atualizar mesa, visitas e status
                visits = Number(existingUser.quantas_vezes_foi || 0) + 1;
                isFirstVisit = false;

                const { error: updateError } = await supabase
                    .from('Usuários')
                    .update({
                        mesa_atual: mesa,
                        quantas_vezes_foi: String(visits),
                        nome: nome.trim(),
                        Status: 'Ativo',
                        ultimo_checkin: new Date().toISOString(),
                    })
                    .eq('id', existingUser.id);

                if (updateError) {
                    console.error('[Checkin] Erro ao atualizar usuário:', updateError);
                    throw updateError;
                }
                console.log('[Checkin] ✅ Usuário atualizado:', existingUser.id);
            } else {
                // Novo usuário — criar
                // 1. Inativar qualquer outra sessão desse telefone em outros restaurantes (para garantir caso seja novo em outro restaurante)
                const { error: deactivateError } = await supabase
                    .from('Usuários')
                    .update({ Status: 'Inativo' })
                    .eq('telefone', phoneDigits)
                    .neq('id_restaurante', restauranteId);

                if (deactivateError) {
                    console.error('[Checkin] Erro ao desativar sessões antigas:', deactivateError);
                }

                const { data: insertData, error: insertError } = await supabase
                    .from('Usuários')
                    .insert({
                        nome: nome.trim(),
                        telefone: phoneDigits,
                        id_restaurante: restauranteId,
                        mesa_atual: mesa,
                        Status: 'Ativo',
                        quantas_vezes_foi: '1',
                        ultimo_checkin: new Date().toISOString(),
                    })
                    .select();

                if (insertError) {
                    console.error('[Checkin] ❌ Erro ao inserir usuário:', insertError);
                    toast.error(`Erro ao registrar: ${insertError.message}`);
                    throw insertError;
                }
                console.log('[Checkin] ✅ Novo usuário criado:', insertData);
            }

            // 2. Chamar webhook de primeira mensagem (saudação via WhatsApp)
            try {
                const webhookResponse = await apiFetch('/webhook/leadpedeaichegou', {
                    method: 'POST',
                    body: JSON.stringify({
                        nome: nome.trim(),
                        telefone: phoneDigits,
                        restauranteId,
                        restauranteNome,
                        mesaId: Number(mesa),
                        isFirstVisit,
                        visits,
                        timestamp: new Date().toISOString(),
                    }),
                });
                console.log('[Checkin] Webhook response status:', webhookResponse.status);
            } catch (webhookErr) {
                // Não bloquear se o webhook falhar
                console.warn('[Checkin] ⚠️ Webhook de saudação falhou:', webhookErr);
            }

            setIsSuccess(true);
        } catch (err: any) {
            console.error('[Checkin] ❌ Erro geral:', err);
            toast.error(err?.message || 'Ocorreu um erro. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    // Loading
    if (loadingPage) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    // Erro (QR inválido)
    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-center">
                <Logo size="lg" />
                <p className="text-red-400 text-lg font-semibold mt-8">{error}</p>
                <p className="text-slate-500 text-sm mt-2">
                    Peça ao garçom um novo QR code ou tente novamente.
                </p>
            </div>
        );
    }

    // Sucesso
    if (isSuccess) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-center">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />

                <div className="relative z-10 animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/10">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>

                    <h1 className="text-3xl font-black text-white mb-3">
                        Bem-vindo, {nome.split(' ')[0]}! 🎉
                    </h1>
                    <p className="text-slate-400 text-base mb-2">
                        Você está na <span className="text-primary font-bold">Mesa {mesa}</span> do{' '}
                        <span className="text-white font-semibold">{restauranteNome}</span>
                    </p>
                    <p className="text-slate-500 text-sm mt-4 max-w-sm mx-auto">
                        Enviamos uma mensagem no seu WhatsApp. <br />
                        Use o chat para fazer seus pedidos! 📱
                    </p>

                    <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10 max-w-xs mx-auto">
                        <div className="flex items-center gap-3 text-left">
                            <UtensilsCrossed className="w-8 h-8 text-primary" />
                            <div>
                                <p className="text-white font-semibold text-sm">Pronto para pedir?</p>
                                <p className="text-slate-500 text-xs">
                                    Abra o WhatsApp e converse conosco
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Formulário de check-in
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 relative overflow-hidden">
            {/* Background orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />

            <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-6 duration-700">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-block p-3 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl mb-6">
                        <Logo size="lg" />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-1">
                        {restauranteNome}
                    </h1>
                    <div className="flex items-center justify-center gap-2 mt-3">
                        <div className="flex items-center gap-1.5 bg-primary/10 text-primary font-bold text-sm px-4 py-2 rounded-full border border-primary/20">
                            <MapPin className="w-4 h-4" />
                            Mesa {mesa}
                        </div>
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-slate-900/50 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/5 shadow-2xl ring-1 ring-white/10">
                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold text-white mb-1 flex items-center justify-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            Faça seu Check-in
                        </h2>
                        <p className="text-slate-500 text-sm">
                            Preencha seus dados para começar a pedir
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="nome" className="text-slate-300 ml-1 text-sm font-medium">
                                Seu Nome
                            </Label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                                    <User size={18} />
                                </div>
                                <Input
                                    id="nome"
                                    type="text"
                                    placeholder="Como devemos te chamar?"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="h-14 pl-12 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all text-lg"
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="telefone" className="text-slate-300 ml-1 text-sm font-medium">
                                WhatsApp
                            </Label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                                    <Phone size={18} />
                                </div>
                                <Input
                                    id="telefone"
                                    type="tel"
                                    placeholder="(33) 99999-9999"
                                    value={telefone}
                                    onChange={handlePhoneChange}
                                    className="h-14 pl-12 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all text-lg"
                                    disabled={isLoading}
                                    maxLength={15}
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(234,22,22,0.3)] flex items-center justify-center gap-2 mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    Entrar na Mesa
                                    <UtensilsCrossed size={20} />
                                </>
                            )}
                        </Button>
                    </form>

                    <p className="text-slate-600 text-[10px] text-center mt-4 uppercase tracking-wider font-semibold">
                        Powered by PedeAi
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Checkin;
