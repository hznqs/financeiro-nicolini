import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "gold" | "success" | "warning" | "destructive";
  loading?: boolean;
}) {
  const toneMap = {
    default: "text-foreground",
    gold: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  } as const;

  return (
    <div className="relative rounded-2xl border border-border bg-gradient-card p-5 shadow-elegant overflow-hidden group transition-all hover:border-primary/30">
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition" />
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </div>
          {loading ? (
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
          ) : (
            <div className={cn("text-2xl font-semibold tracking-tight", toneMap[tone])}>
              {value}
            </div>
          )}
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className="h-9 w-9 rounded-lg bg-accent/50 grid place-items-center">
          <Icon className={cn("h-4 w-4", toneMap[tone])} />
        </div>
      </div>
    </div>
  );
}
