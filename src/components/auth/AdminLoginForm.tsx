import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Logo from '@/components/Logo';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminLoginForm: React.FC = () => {
    const { adminLogin, loadingData } = useApp();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const result = await adminLogin(email, password);

        if (result.success) {
            toast.success('Login administrativo realizado!');
            navigate('/admin');
        } else {
            toast.error(result.error || 'Erro ao realizar login admin');
        }

        setIsLoading(false);
    };

    if (loadingData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-muted-foreground">Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="bg-card rounded-2xl shadow-xl p-8 animate-fade-in border border-border">
                    <div className="flex justify-center mb-6">
                        <Logo size="lg" />
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-2">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl font-bold text-center text-foreground">
                            Painel Admin PedeAI
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-center mb-8">
                        Acesso restrito para administradores
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground font-medium">
                                Email Admin
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@pedeai.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-12 rounded-xl border-border bg-secondary/50 focus:ring-primary"
                                disabled={isLoading}
                                maxLength={255}
                                autoComplete="email"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-foreground font-medium">
                                Senha
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 rounded-xl border-border bg-secondary/50 focus:ring-primary"
                                disabled={isLoading}
                                maxLength={128}
                                autoComplete="current-password"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                'Entrar no Painel'
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-border text-center">
                        <button
                            onClick={() => navigate('/')}
                            className="text-muted-foreground hover:text-primary transition-colors text-sm"
                        >
                            Voltar para Login de Restaurante
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLoginForm;
