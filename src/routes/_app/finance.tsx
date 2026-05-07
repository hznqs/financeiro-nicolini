import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wallet, Check, Trash2, CalendarDays, CreditCard } from "lucide-react";
import { supabase } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/finance")({ component: FinancePage });

type ExpenseRow = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  category: string | null;
  expense_type: string;
  status: string;
  paid_at: string | null;
};

function FinancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "paid" | "all">("pending");
  const [type, setType] = useState<"all" | "personal" | "corporate">("all");
  const [open, setOpen] = useState(false);

  const { data: expenses = [], isLoading } = useQuery<ExpenseRow[]>({
    queryKey: ["finance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("due_date");
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["finance-installments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("installments")
        .select("*, purchases(description, suppliers(name), card_id)")
        .order("due_date");
      return data ?? [];
    },
  });

  const filtered = expenses.filter((e) => {
    if (tab !== "all" && e.status !== tab) return false;
    if (type !== "all" && e.expense_type !== type) return false;
    return true;
  });

  const filteredInst = installments.filter((i) => {
    if (tab !== "all" && i.status !== tab) return false;
    return true;
  });

  const totalPending = expenses.filter((e) => e.status === "pending").reduce((a, b) => a + Number(b.amount), 0);
  const totalPaid = expenses.filter((e) => e.status === "paid").reduce((a, b) => a + Number(b.amount), 0);

  const togglePaid = useMutation({
    mutationFn: async (e: ExpenseRow) => {
      const next = e.status === "paid" ? { status: "pending", paid_at: null } : { status: "paid", paid_at: new Date().toISOString() };
      const { error } = await supabase.from("expenses").update(next).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const toggleInstPaid = useMutation({
    mutationFn: async (i: any) => {
      const next = i.status === "paid" ? { status: "pending", paid_at: null } : { status: "paid", paid_at: new Date().toISOString() };
      const { error } = await supabase.from("installments").update(next).eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["finance-installments"] }); 
      qc.invalidateQueries({ queryKey: ["dashboard"] }); 
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance"] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financeiro"
        subtitle="Contas a pagar, pagas e fluxo de caixa"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-gold"><Plus className="h-4 w-4 mr-1.5" /> Nova despesa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
              <ExpenseForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-gradient-card p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">A pagar</div>
          <div className="text-2xl font-semibold text-warning mt-2">{brl(totalPending)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-card p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Pago no histórico</div>
          <div className="text-2xl font-semibold text-success mt-2">{brl(totalPaid)}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "paid" | "all")}>
          <TabsList>
            <TabsTrigger value="pending">A pagar</TabsTrigger>
            <TabsTrigger value="paid">Pagas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={type} onValueChange={(v) => setType(v as "all" | "personal" | "corporate")}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="personal">Pessoal</SelectItem>
            <SelectItem value="corporate">Corporativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 && filteredInst.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhuma despesa" description="Adicione contas a pagar para acompanhar." />
      ) : (
        <div className="space-y-6">
          {filtered.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground">
                <Wallet className="h-4 w-4" /> Despesas Fixas / Variáveis
              </div>
              <div className="rounded-2xl border border-border bg-gradient-card overflow-hidden">
                <ul className="divide-y divide-border/50">
                  {filtered.map((e) => {
                    const overdue = e.status === "pending" && e.due_date < todayISO();
                    return (
                      <li key={e.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition group">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => togglePaid.mutate(e)}
                            className={cn(
                              "h-8 w-8 rounded-lg border grid place-items-center transition",
                              e.status === "paid" ? "bg-success/20 border-success/30 text-success" : "border-border hover:border-primary"
                            )}
                            aria-label="Marcar como paga"
                          >
                            {e.status === "paid" && <Check className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0">
                            <div className={cn("font-medium truncate", e.status === "paid" && "line-through text-muted-foreground")}>
                              {e.description}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {fmtDate(e.due_date)} · {e.expense_type === "corporate" ? "Corporativo" : "Pessoal"}
                              {e.category && ` · ${e.category}`}
                              {overdue && <span className="text-destructive font-medium"> · vencida</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={cn("font-semibold", e.status === "paid" ? "text-muted-foreground" : overdue ? "text-destructive" : "text-warning")}>
                            {brl(e.amount)}
                          </div>
                          <button onClick={() => del.mutate(e.id)} className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {filteredInst.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" /> Parcelas de Compras
              </div>
              <div className="rounded-2xl border border-border bg-gradient-card overflow-hidden">
                <ul className="divide-y divide-border/50">
                  {filteredInst.map((i) => {
                    const overdue = i.status === "pending" && i.due_date < todayISO();
                    const title = (i as any).purchases?.description || (i as any).purchases?.suppliers?.name || "Parcela";
                    const isCard = !!(i as any).purchases?.card_id;
                    return (
                      <li key={i.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition group">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => toggleInstPaid.mutate(i)}
                            className={cn(
                              "h-8 w-8 rounded-lg border grid place-items-center transition",
                              i.status === "paid" ? "bg-success/20 border-success/30 text-success" : "border-border hover:border-primary"
                            )}
                          >
                            {i.status === "paid" && <Check className="h-4 w-4" />}
                          </button>
                          <div className="min-w-0">
                            <div className={cn("font-medium truncate", i.status === "paid" && "line-through text-muted-foreground")}>
                              {title} <span className="text-xs opacity-60 ml-1">({i.installment_number}ª parc.)</span>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              {fmtDate(i.due_date)}
                              {isCard && <CreditCard className="h-3 w-3 inline" />}
                              {overdue && <span className="text-destructive font-medium"> · vencida</span>}
                            </div>
                          </div>
                        </div>
                        <div className={cn("font-semibold", i.status === "paid" ? "text-muted-foreground" : overdue ? "text-destructive" : "text-warning")}>
                          {brl(i.amount)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"personal" | "corporate">("personal");
  const [method, setMethod] = useState("cash");
  const [cardId, setCardId] = useState<string | undefined>(undefined);

  const { data: cards = [] } = useQuery({
    queryKey: ["cards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("cards").select("id, name, bank").order("name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const value = parseFloat(amount.replace(",", "."));
      if (!value || value <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id, description, amount: value, due_date: dueDate,
        category: category || null, expense_type: type, status: "pending",
        payment_method: method, card_id: cardId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Despesa criada"); onDone(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
      <div className="space-y-1.5"><Label>Descrição</Label><Input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Valor</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required /></div>
        <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Aluguel, energia..." /></div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as "personal" | "corporate")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Pessoal</SelectItem>
              <SelectItem value="corporate">Corporativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Forma Pagamento</Label>
          <Select value={method} onValueChange={(v) => { setMethod(v); if (v !== "credit") setCardId(undefined); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Dinheiro</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="debit">Débito</SelectItem>
              <SelectItem value="credit">Crédito</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Aluguel" />
        </div>
      </div>
      {method === "credit" && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
          <Label>Cartão Utilizado</Label>
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger><SelectValue placeholder="Selecione um cartão" /></SelectTrigger>
            <SelectContent>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.bank ? `${c.bank} - ${c.name}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" disabled={create.isPending} className="w-full h-11 shadow-gold">{create.isPending ? "Salvando..." : "Salvar despesa"}</Button>
    </form>
  );
}
