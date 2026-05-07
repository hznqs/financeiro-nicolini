import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/client";
import { useAuth } from "@/hooks/useAuth";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const in7days = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

export function useDashboard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const results = await Promise.all([
        supabase.from("sales").select("amount").eq("sale_date", today()),
        supabase.from("sales").select("amount").gte("sale_date", startOfMonth()),
        supabase.from("purchases").select("amount").gte("purchase_date", startOfMonth()),
        supabase.from("expenses").select("amount,due_date,description,status").eq("status", "pending").order("due_date"),
        supabase.from("installments").select("amount,due_date,status,purchases(description,suppliers(name))").eq("status", "pending").order("due_date"),
        supabase.from("expenses").select("amount").eq("status", "paid").gte("paid_at", startOfMonth()),
        supabase.from("sales").select("id,amount,sale_date,payment_method,customer").order("created_at", { ascending: false }).limit(5),
        supabase.from("sales").select("amount,sale_date").gte("sale_date", startOfMonth()),
        supabase.from("purchases").select("id,amount,purchase_date,description,suppliers(name)").order("created_at", { ascending: false }).limit(5),
      ]);

      const [todaySales, monthSales, purchases, pendingExp, pendingInst, paid, recentSales, monthChart, recentPurchases] = results;

      const sum = (res: { data: { amount: number }[] | null }) => (res.data ?? []).reduce((a, b) => a + Number(b.amount), 0);
      const upcoming = [
        ...(pendingExp.data ?? []).map((e) => ({ amount: Number(e.amount), due_date: e.due_date, label: e.description })),
        ...(pendingInst.data ?? []).map((i) => ({
          amount: Number(i.amount),
          due_date: i.due_date,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (i as any).purchases?.description ?? (i as any).purchases?.suppliers?.name ?? "Parcela",
        })),
      ].sort((a, b) => a.due_date.localeCompare(b.due_date));

      // monthly daily chart
      const byDay = new Map<string, number>();
      (monthChart.data ?? []).forEach((s) => {
        byDay.set(s.sale_date, (byDay.get(s.sale_date) ?? 0) + Number(s.amount));
      });
      const chart = Array.from(byDay.entries())
        .sort()
        .map(([date, total]) => ({ date: date.slice(8, 10), total }));

      const next7 = in7days();
      return {
        todayTotal: sum(todaySales),
        monthTotal: sum(monthSales),
        purchasesMonth: sum(purchases),
        toPay: sum(pendingExp) + sum(pendingInst),
        received: sum(paid),
        upcoming: upcoming.filter((u) => u.due_date <= next7).slice(0, 6),
        recentSales: recentSales.data ?? [],
        recentPurchases: (recentPurchases.data ?? []).map((p: any) => ({
          ...p,
          supplier_name: p.suppliers?.name || p.description || "Fornecedor",
        })),
        chart,
      };
    },
  });
}
