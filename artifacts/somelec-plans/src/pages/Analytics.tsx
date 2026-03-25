import React from "react";
import { useGetPlansAnalytics } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { BarChart2, TrendingUp, Building, Activity, Fuel, Package, Home, DollarSign, BadgeDollarSign, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const CATEGORIE_META: Record<string, { label: string; icon: React.ElementType; color: string; bar: string }> = {
  materiel:              { label: "Matériel",              icon: Package,         color: "text-blue-700",   bar: "bg-blue-500" },
  carburant:             { label: "Carburant",             icon: Fuel,            color: "text-orange-700", bar: "bg-orange-500" },
  logement:              { label: "Logement",              icon: Home,            color: "text-purple-700", bar: "bg-purple-500" },
  logistique:            { label: "Logistique",            icon: Activity,        color: "text-teal-700",   bar: "bg-teal-500" },
  prime:                 { label: "Prime",                 icon: DollarSign,      color: "text-green-700",  bar: "bg-green-500" },
  indemnite_journaliere: { label: "Indemnité journalière", icon: BadgeDollarSign, color: "text-amber-700",  bar: "bg-amber-500" },
};

function MiniBar({ value, max, barClass }: { value: number; max: number; barClass: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max && max > 0;
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={cn("h-2 rounded-full transition-all", over ? "bg-destructive" : barClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function Analytics() {
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetPlansAnalytics();

  if (!currentUser || !["directeur_general", "dga"].includes(currentUser.role)) {
    navigate("/");
    return null;
  }

  const totalBudget   = data?.byDirection.reduce((s, r) => s + r.budgetTotal, 0) ?? 0;
  const totalConsomme = data?.byDirection.reduce((s, r) => s + r.montantConsomme, 0) ?? 0;
  const tauxGlobal = totalBudget > 0 ? (totalConsomme / totalBudget) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-primary/10 p-2.5 rounded-xl"><BarChart2 className="w-6 h-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Analyse des Dépenses</h1>
              <p className="text-sm text-muted-foreground">Vue consolidée de tous les plans d'action</p>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { label: "Budget Total", value: formatCurrency(totalBudget), sub: "Tous plans", color: "text-primary" },
              { label: "Total Consommé", value: formatCurrency(totalConsomme), sub: `${tauxGlobal.toFixed(1)}% du budget`, color: tauxGlobal > 90 ? "text-destructive" : "text-warning" },
              { label: "Disponible", value: formatCurrency(totalBudget - totalConsomme), sub: "Restant", color: "text-success" },
              { label: "Directions", value: String(data?.byDirection.length ?? 0), sub: "Avec plans actifs", color: "text-foreground" },
            ].map(kpi => (
              <div key={kpi.label} className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</div>
                <div className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="animate-spin text-primary"><Activity size={40} /></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* By Direction */}
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" /> Par Direction
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!data?.byDirection.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">Aucune donnée disponible</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {data.byDirection.map(row => {
                    const pct = row.budgetTotal > 0 ? (row.montantConsomme / row.budgetTotal) * 100 : 0;
                    const over = row.montantConsomme > row.budgetTotal && row.budgetTotal > 0;
                    return (
                      <div key={row.directionId} className="p-5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">{row.directionNom}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{row.directionCode}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{row.nombrePlans} plan{row.nombrePlans !== 1 ? "s" : ""}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={cn("text-sm font-bold", over ? "text-destructive" : "text-warning")}>
                              {formatCurrency(row.montantConsomme)}
                            </div>
                            <div className="text-xs text-muted-foreground">/ {formatCurrency(row.budgetTotal)}</div>
                          </div>
                        </div>
                        <MiniBar value={row.montantConsomme} max={row.budgetTotal} barClass="bg-primary" />
                        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                          <span className={cn("font-semibold", over ? "text-destructive" : pct > 70 ? "text-warning" : "text-success")}>
                            {pct.toFixed(1)}% consommé
                          </span>
                          <span>Reste : {formatCurrency(row.budgetTotal - row.montantConsomme)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Category */}
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Par Type de Dépense
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!data?.byCategorie.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">Aucune donnée disponible</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {data.byCategorie.map(row => {
                    const meta = CATEGORIE_META[row.categorie] ?? { label: row.categorie, icon: Activity, color: "text-gray-700", bar: "bg-gray-500" };
                    const Icon = meta.icon;
                    const pct = row.budgetTotal > 0 ? (row.montantConsomme / row.budgetTotal) * 100 : 0;
                    const over = row.montantConsomme > row.budgetTotal && row.budgetTotal > 0;
                    return (
                      <div key={row.categorie} className="p-5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("w-4 h-4", meta.color)} />
                              <span className="font-semibold text-sm text-foreground">{meta.label}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{row.nombreMoyens} ligne{row.nombreMoyens !== 1 ? "s" : ""} de budget</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={cn("text-sm font-bold", over ? "text-destructive" : "text-warning")}>
                              {formatCurrency(row.montantConsomme)}
                            </div>
                            <div className="text-xs text-muted-foreground">/ {formatCurrency(row.budgetTotal)}</div>
                          </div>
                        </div>
                        <MiniBar value={row.montantConsomme} max={row.budgetTotal} barClass={meta.bar} />
                        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                          <span className={cn("font-semibold", over ? "text-destructive" : pct > 70 ? "text-warning" : "text-success")}>
                            {pct.toFixed(1)}% consommé
                          </span>
                          <span>Reste : {formatCurrency(row.budgetTotal - row.montantConsomme)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
