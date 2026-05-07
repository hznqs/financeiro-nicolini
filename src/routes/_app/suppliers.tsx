import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Phone, Trash2, Receipt } from "lucide-react";
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

export const Route = createFileRoute("/_app/suppliers")({ component: SuppliersPage });

const METHODS = ["cash", "pix", "debit", "credit", "transfer", "boleto"] as const;

function SuppliersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [purchaseFor, setPurchaseFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: totals = {} } = useQuery({
    queryKey: ["supplier-totals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("purchases").select("supplier_id,amount");
      const map: Record<string, number> = {};
      (data ?? []).forEach((p) => { if (p.supplier_id) map[p.supplier_id] = (map[p.supplier_id] ?? 0) + Number(p.amount); });
      return map;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Fornecedor removido"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastre fornecedores e registre compras"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-gold"><Plus className="h-4 w-4 mr-1.5" /> Novo fornecedor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader>
              <SupplierForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-card rounded-2xl animate-pulse" />)}</div>
      ) : suppliers.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum fornecedor" description="Adicione seu primeiro fornecedor para começar." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-gradient-card p-5 group hover:border-primary/30 transition">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  {s.category && <div className="text-xs text-muted-foreground mt-0.5">{s.category}</div>}
                </div>
                <button onClick={() => del.mutate(s.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {s.phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3"><Phone className="h-3 w-3" />{s.phone}</div>}
              <div className="border-t border-border/50 pt-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total gasto</div>
                  <div className="text-lg font-semibold text-gradient-gold">{brl(totals[s.id] ?? 0)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    Ver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPurchaseFor(s.id)}>
                    <Receipt className="h-3.5 w-3.5 mr-1" /> Compra
                  </Button>
                </div>
              </div>
              {expanded === s.id && <SupplierTimeline supplierId={s.id} />}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!purchaseFor} onOpenChange={(o) => !o && setPurchaseFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova compra</DialogTitle></DialogHeader>
          {purchaseFor && <PurchaseForm supplierId={purchaseFor} onDone={() => setPurchaseFor(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplierTimeline({ supplierId }: { supplierId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["supplier-purchases", supplierId],
    queryFn: async () => {
      const { data } = await supabase.from("purchases").select("*").eq("supplier_id", supplierId).order("purchase_date", { ascending: false }).limit(8);
      return data ?? [];
    },
  });
  if (data.length === 0) return <div className="mt-3 text-xs text-muted-foreground py-2">Nenhuma compra registrada.</div>;
  return (
    <ul className="mt-3 space-y-2 border-t border-border/50 pt-3 text-xs">
      {data.map((p) => (
        <li key={p.id} className="flex justify-between items-center">
          <span className="text-muted-foreground">{fmtDate(p.purchase_date)} · {PAYMENT_LABELS[p.payment_method]}{p.installments_count > 1 ? ` · ${p.installments_count}x` : ""}</span>
          <span className="font-medium">{brl(p.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function SupplierForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("suppliers").insert({
        user_id: user.id, name, phone: phone || null, category: category || null, notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Fornecedor criado"); onDone(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
      <div className="space-y-1.5"><Label>Nome</Label><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Alimentos" /></div>
      </div>
      <div className="space-y-1.5"><Label>Observação</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <Button type="submit" disabled={create.isPending} className="w-full h-11">{create.isPending ? "Salvando..." : "Salvar"}</Button>
    </form>
  );
}

function PurchaseForm({ supplierId, onDone }: { supplierId: string; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState("pix");
  const [type, setType] = useState<"corporate" | "personal">("corporate");
  const [installments, setInstallments] = useState("1");
  const [description, setDescription] = useState("");
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
      const inst = Math.max(1, parseInt(installments) || 1);
      if (!value || value <= 0) throw new Error("Valor inválido");

      const { data: purchase, error } = await supabase.from("purchases").insert({
        user_id: user.id, supplier_id: supplierId, amount: value, purchase_date: date,
        payment_method: method, expense_type: type, installments_count: inst,
        description: description || null, card_id: cardId || null,
      }).select().single();
      if (error) throw error;

      if (cardId) {
        const { data: card } = await supabase.from("cards").select("spent_amount").eq("id", cardId).single();
        const currentSpent = Number(card?.spent_amount ?? 0);
        await supabase.from("cards").update({ spent_amount: currentSpent + value }).eq("id", cardId);
      }

      if (inst > 1) {
        const per = +(value / inst).toFixed(2);
        const rows = Array.from({ length: inst }, (_, i) => {
          const due = new Date(date + "T00:00:00");
          due.setMonth(due.getMonth() + i);
          return {
            user_id: user.id, purchase_id: purchase.id,
            installment_number: i + 1, amount: per,
            due_date: due.toISOString().slice(0, 10), status: "pending",
          };
        });
        const { error: e2 } = await supabase.from("installments").insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier-purchases"] });
      qc.invalidateQueries({ queryKey: ["supplier-totals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast.success("Compra registrada");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
      <div className="space-y-1.5"><Label>Valor total</Label><Input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required className="h-12 text-lg font-semibold" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        <div className="space-y-1.5">
          <Label>Pagamento</Label>
          <Select value={method} onValueChange={(v) => { setMethod(v); if (v !== "credit") setCardId(undefined); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_LABELS[m]}</SelectItem>)}</SelectContent>
          </Select>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as "corporate" | "personal")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corporate">Corporativo</SelectItem>
              <SelectItem value="personal">Pessoal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Parcelas</Label><Input type="number" min={1} max={36} value={installments} onChange={(e) => setInstallments(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que foi comprado" /></div>
      <Button type="submit" disabled={create.isPending} className="w-full h-11 shadow-gold">{create.isPending ? "Salvando..." : "Registrar compra"}</Button>
    </form>
  );
}
