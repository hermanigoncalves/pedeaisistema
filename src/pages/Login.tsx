import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';

const Login: React.FC = () => {
    const { login, isAuthenticated, loadingData } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated && !loadingData) {
            navigate('/');
        }
    }, [isAuthenticated, loadingData, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Preencha todos os campos');
            return;
        }

        setIsLoading(true);
        try {
            const result = await login(email, password);
            if (result.success) {
                toast.success('Bem-vindo de volta!');
                navigate('/');
            } else {
                toast.error(result.error || 'Credenciais inválidas');
            }
        } catch (error) {
            toast.error('Ocorreu um erro ao tentar entrar');
        } finally {
            setIsLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex overflow-hidden bg-[#0F172A] relative">
            {/* Background Ornaments */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />

            {/* Left Side - Visual/Branding (Hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 flex-col justify-center items-center p-12 relative z-10">
                <div className="max-w-md text-center">
                    <div className="mb-8 inline-block p-4 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
                        <Logo size="xl" />
                    </div>
                    <h1 className="text-5xl font-black text-white mb-6 leading-tight tracking-tight">
                        Gestão Inteligente para o seu <span className="text-primary italic">Restaurante</span>
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Controle pedidos, estoque e mesas em tempo real com a plataforma mais rápida e intuitiva do mercado.
                    </p>

                    <div className="mt-12 grid grid-cols-2 gap-4 text-left">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <div className="text-primary font-bold text-xl mb-1">100%</div>
                            <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Sincronizado</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <div className="text-primary font-bold text-xl mb-1">Rápido</div>
                            <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Performance</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
                <div className="w-full max-w-md h-fit">
                    <div className="lg:hidden flex justify-center mb-8">
                        <Logo size="lg" />
                    </div>

                    <div className="bg-slate-900/50 backdrop-blur-2xl p-8 lg:p-10 rounded-[2.5rem] border border-white/5 shadow-2xl ring-1 ring-white/10">
                        <div className="mb-10 text-center lg:text-left">
                            <h2 className="text-3xl font-bold text-white mb-2">Entrar</h2>
                            <p className="text-slate-400">Acesse sua conta para gerenciar seu negócio</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-300 ml-1 text-sm font-medium">Email Profissional</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="exemplo@restaurante.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-14 pl-12 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all text-lg"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Sua Senha</Label>
                                    <button type="button" className="text-xs text-primary hover:underline font-medium">Esqueceu?</button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-14 pl-12 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus:ring-primary/20 focus:border-primary transition-all text-lg"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(234,22,22,0.3)] flex items-center justify-center gap-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>
                                        Acessar Painel
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </Button>

                            <div className="pt-4 text-center">
                                <p className="text-slate-500 text-sm">
                                    Ainda não tem conta? <span className="text-primary font-bold cursor-pointer hover:underline">Fale conosco</span>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
