import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CreditCard, Trash2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cards")({ component: CardsPage });

const COLORS = ["#D4AF37", "#1f2937", "#7c2d12", "#064e3b", "#312e81", "#831843"];

function CardsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["cards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: usage = {} } = useQuery({
    queryKey: ["card-usage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // current open invoice = installments pending tied to purchases of this card OR purchases credit not paid
      const { data } = await supabase.from("purchases").select("card_id,amount").not("card_id", "is", null);
      const map: Record<string, number> = {};
      (data ?? []).forEach((p) => { if (p.card_id) map[p.card_id] = (map[p.card_id] ?? 0) + Number(p.amount); });
      return map;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Cartão removido"); },
  });

  const today = new Date().getDate();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cartões"
        subtitle="Acompanhe limite, fechamento e fatura"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-gold"><Plus className="h-4 w-4 mr-1.5" /> Novo cartão</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo cartão</DialogTitle></DialogHeader>
              <CardForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[...Array(3)].map((_, i) => <div key={i} className="h-56 bg-card rounded-2xl animate-pulse" />)}</div>
      ) : cards.length === 0 ? (
        <EmptyState icon={CreditCard} title="Nenhum cartão" description="Cadastre cartões para acompanhar limite e faturas." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((c, idx) => {
            const used = Number(c.spent_amount ?? 0);
            const limit = Math.max(1, Number(c.credit_limit));
            const available = limit - used;
            const pct = Math.min(100, (used / limit) * 100);
            const daysToClose = (c.closing_day - today + 31) % 31;
            const closingSoon = daysToClose <= 5;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="group relative rounded-2xl p-6 text-white shadow-elegant overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${c.color}, oklch(0.13 0.005 270))` }}
              >
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_-20%,white,transparent_60%)]" />
                <div className="relative flex justify-between items-start">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">{c.bank || "Cartão"}</div>
                    <div className="text-lg font-semibold mt-1">{c.name}</div>
                  </div>
                  <button onClick={() => del.mutate(c.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="relative mt-10 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider opacity-70">Fatura atual</div>
                    <div className="text-2xl font-bold mt-0.5">{brl(used)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider opacity-70">Disponível</div>
                    <div className="text-lg font-medium mt-0.5">{brl(available)}</div>
                  </div>
                </div>
                <div className="relative mt-4">
                  <div className="flex justify-between text-[10px] mb-1.5 opacity-70">
                    <span>Uso do limite</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden backdrop-blur-sm">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn("h-full bg-white", pct > 90 ? "bg-red-400" : pct > 70 ? "bg-orange-300" : "bg-white")} 
                    />
                  </div>
                </div>
                <div className="relative mt-4 flex justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {closingSoon && <AlertTriangle className="h-3 w-3 text-yellow-300" />}
                    <span className="opacity-80">Fecha dia {c.closing_day}</span>
                  </div>
                  <span className="opacity-80">Vence dia {c.due_day}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("1");
  const [dueDay, setDueDay] = useState("10");
  const [color, setColor] = useState(COLORS[0]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("cards").insert({
        user_id: user.id, name, bank: bank || null,
        credit_limit: parseFloat(limit.replace(",", ".")) || 0,
        closing_day: parseInt(closingDay), due_day: parseInt(dueDay), color,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Cartão criado"); onDone(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Nome</Label><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: Nubank Black" /></div>
        <div className="space-y-1.5"><Label>Banco</Label><Input value={bank} onChange={(e) => setBank(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Limite</Label><Input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Dia fechamento</Label><Input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} required /></div>
      </div>
      <div className="space-y-2">
        <Label>Cor</Label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-lg border-2 transition ${color === c ? "border-primary scale-110" : "border-transparent"}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>
      <Button type="submit" disabled={create.isPending} className="w-full h-11 shadow-gold">{create.isPending ? "Salvando..." : "Salvar cartão"}</Button>
    </form>
  );
}
