import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) navigate({ to: "/dashboard" });
  }, [session, authLoading, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já está logado.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) {
      toast.error("Falha no login com Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Lado visual */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-background via-card to-background border-r border-border p-12 flex-col justify-between">
        <div className="absolute inset-0 opacity-30" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-[var(--gold-deep)] grid place-items-center text-primary-foreground font-bold shadow-gold">N</div>
            <div>
              <div className="font-semibold tracking-tight">Nicolini</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Manager</div>
            </div>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-md"
        >
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Gestão financeira <span className="text-gradient-gold">premium</span>, sem complicação.
          </h1>
          <p className="mt-4 text-muted-foreground">
            Vendas rápidas, fornecedores, cartões e fluxo de caixa em um único painel — feito para quem quer simplicidade.
          </p>
        </motion.div>
        <div className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nicolini Manager
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-[var(--gold-deep)] grid place-items-center text-primary-foreground font-bold shadow-gold">N</div>
            <div className="font-semibold tracking-tight">Nicolini Manager</div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Acesse seu painel financeiro." : "Comece em segundos, é grátis."}
            </p>
          </div>

          <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full h-11">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.9h5.27c-.23 1.5-1.74 4.4-5.27 4.4-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.78 4.13 14.74 3.2 12.18 3.2c-4.95 0-8.95 4.01-8.95 8.95s4 8.95 8.95 8.95c5.16 0 8.59-3.62 8.59-8.74 0-.59-.07-1.04-.42-1.26z"/></svg>
            Continuar com Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou e-mail <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Seu nome" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 shadow-gold">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="text-sm text-center text-muted-foreground">
            {mode === "signin" ? (
              <>Sem conta?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">Criar conta</button>
              </>
            ) : (
              <>Já tem conta?{" "}
                <button onClick={() => setMode("signin")} className="text-primary hover:underline font-medium">Entrar</button>
              </>
            )}
          </div>
          <div className="text-center">
            <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">Voltar</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
