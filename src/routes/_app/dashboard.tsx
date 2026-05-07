import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart, TrendingUp, Wallet, AlertCircle, ArrowUpRight, CalendarClock } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { useDashboard } from "@/hooks/useDashboard";
import { brl, fmtDate, PAYMENT_LABELS } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const { data, isLoading } = useDashboard();

  return (
    <div className="space-y-8">
      <PageHeader title="Painel" subtitle="Visão geral do seu negócio em tempo real" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Vendas hoje" value={brl(data?.todayTotal)} icon={ShoppingCart} tone="gold" loading={isLoading} />
        <StatCard label="Vendas no mês" value={brl(data?.monthTotal)} icon={TrendingUp} tone="success" loading={isLoading} />
        <StatCard label="Compras no mês" value={brl(data?.purchasesMonth)} icon={Wallet} loading={isLoading} />
        <StatCard label="A pagar" value={brl(data?.toPay)} icon={AlertCircle} tone="warning" loading={isLoading} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm font-medium">Vendas no mês</div>
              <div className="text-xs text-muted-foreground mt-0.5">Receita diária acumulada</div>
            </div>
            <div className="text-2xl font-semibold text-gradient-gold">{brl(data?.monthTotal)}</div>
          </div>
          <div className="h-64">
            {(data?.chart?.length ?? 0) === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem vendas neste mês ainda</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.chart}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.13 85)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.78 0.13 85)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="oklch(0.55 0.01 90)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="oklch(0.55 0.01 90)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.18 0.006 270)", border: "1px solid oklch(0.24 0.006 270)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => brl(v)}
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Area type="monotone" dataKey="total" stroke="oklch(0.78 0.13 85)" strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Upcoming */}
        <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <div className="flex items-center gap-2 mb-5">
            <CalendarClock className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium">Próximos vencimentos</div>
          </div>
          {(data?.upcoming?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nada nos próximos 7 dias 🎉</div>
          ) : (
            <ul className="space-y-3">
              {data?.upcoming.map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{u.label}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(u.due_date)}</div>
                  </div>
                  <div className="text-sm font-medium text-warning">{brl(u.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Movement grids */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent sales */}
        <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <div className="flex items-center justify-between mb-5">
            <div className="text-sm font-medium">Últimas vendas</div>
            <ArrowUpRight className="h-4 w-4 text-success" />
          </div>
          {(data?.recentSales?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Sem vendas registradas</div>
          ) : (
            <ul className="divide-y divide-border/30">
              {data?.recentSales.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3.5 group">
                  <div className="min-w-0">
                    <div className="text-sm font-medium group-hover:text-primary transition-colors">{s.customer || "Venda avulsa"}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {fmtDate(s.sale_date)} · {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-success">+{brl(s.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent purchases */}
        <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
          <div className="flex items-center justify-between mb-5">
            <div className="text-sm font-medium">Últimas compras</div>
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
          </div>
          {(data?.recentPurchases?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Sem compras registradas</div>
          ) : (
            <ul className="divide-y divide-border/30">
              {data?.recentPurchases.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between py-3.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{p.supplier_name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {fmtDate(p.purchase_date)}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-warning">-{brl(p.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
