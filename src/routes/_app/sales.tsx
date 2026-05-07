import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShoppingCart, Search, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, fmtDate, todayISO, PAYMENT_LABELS } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sales")({ component: SalesPage });

const METHODS = ["cash", "pix", "debit", "credit", "transfer"] as const;

function SalesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").order("sale_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = sales.filter((s) =>
    !search ||
    s.customer?.toLowerCase().includes(search.toLowerCase()) ||
    s.notes?.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.reduce((a, s) => a + Number(s.amount), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Venda removida"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Vendas"
        subtitle="Registre vendas em segundos"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-gold"><Plus className="h-4 w-4 mr-1.5" /> Nova venda</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova venda</DialogTitle></DialogHeader>
              <SaleForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-gradient-card p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Total filtrado</div>
          <div className="text-2xl font-semibold text-gradient-gold mt-2">{brl(total)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-card p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Quantidade</div>
          <div className="text-2xl font-semibold mt-2">{filtered.length}</div>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-card p-5 col-span-2 lg:col-span-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Ticket médio</div>
          <div className="text-2xl font-semibold mt-2">{brl(filtered.length ? total / filtered.length : 0)}</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente ou observação..." className="pl-9 h-11" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma venda"
          description="Clique em 'Nova venda' para registrar."
        />
      ) : (
        <div className="rounded-2xl border border-border bg-gradient-card overflow-hidden">
          <ul className="divide-y divide-border/50">
            {filtered.map((s, idx) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                className="flex items-center justify-between p-4 hover:bg-accent/30 transition group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-success/10 grid place-items-center text-success font-medium text-xs">
                    {PAYMENT_LABELS[s.payment_method]?.slice(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.customer || "Venda avulsa"}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(s.sale_date)} · {PAYMENT_LABELS[s.payment_method]}
                      {s.notes && ` · ${s.notes}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-base font-semibold text-success">{brl(s.amount)}</div>
                  <button
                    onClick={() => del.mutate(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SaleForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("pix");
  const [date, setDate] = useState(todayISO());
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const value = parseFloat(amount.replace(",", "."));
      if (!value || value <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("sales").insert({
        user_id: user.id,
        amount: value,
        payment_method: method,
        sale_date: date,
        customer: customer || null,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Venda registrada!");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Valor</Label>
        <Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="h-12 text-lg font-semibold" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Forma de pagamento</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_LABELS[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Cliente <span className="text-muted-foreground">(opcional)</span></Label>
        <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome" />
      </div>
      <div className="space-y-1.5">
        <Label>Observação <span className="text-muted-foreground">(opcional)</span></Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={create.isPending} className="w-full h-11 shadow-gold">
        {create.isPending ? "Salvando..." : "Registrar venda"}
      </Button>
    </form>
  );
}
