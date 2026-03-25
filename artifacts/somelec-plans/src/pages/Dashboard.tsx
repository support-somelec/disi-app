import React, { useState } from "react";
import { Link } from "wouter";
import { useGetPlans } from "@workspace/api-client-react";
import { useAuth, ROLES_SEE_ALL, ROLE_LABELS } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilePlus, Clock, CheckCircle2, ShieldCheck, Activity, Search, AlertCircle, TrendingDown, AlertTriangle, CalendarX } from "lucide-react";
import { format, addDays, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "secondary" | "warning" | "info" | "success" | "destructive" | "default"; icon: React.ElementType }> = {
  brouillon:      { label: "Brouillon",   variant: "secondary",   icon: Clock },
  en_attente_ct:  { label: "Attente CT",  variant: "warning",     icon: ShieldCheck },
  en_attente_dga: { label: "Attente DGA", variant: "warning",     icon: ShieldCheck },
  en_attente_dg:  { label: "Attente DG",  variant: "info",        icon: ShieldCheck },
  approuve:       { label: "Approuvé",    variant: "success",     icon: CheckCircle2 },
  rejete:         { label: "Rejeté",      variant: "destructive", icon: AlertCircle },
  ouvert:         { label: "Ouvert",      variant: "success",     icon: Activity },
  cloture:        { label: "Clôturé",     variant: "default",     icon: CheckCircle2 },
};

function isOverDeadline(dateDebut: string, duree: number, statut: string): boolean {
  if (statut === "cloture" || statut === "brouillon") return false;
  const endDate = addDays(new Date(dateDebut), duree);
  return isAfter(new Date(), endDate);
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOverrun, setFilterOverrun] = useState<"" | "budget" | "delai" | "both">(""); 

  const seesAll = currentUser ? ROLES_SEE_ALL.includes(currentUser.role) : false;
  const queryParams = seesAll ? {} : { createdById: currentUser?.id };
  const { data: allPlans = [], isLoading } = useGetPlans(queryParams as Parameters<typeof useGetPlans>[0]);

  const overBudgetPlans = allPlans.filter(p => (p.montantConsomme ?? 0) > (p.budgetTotal ?? 0) && p.budgetTotal > 0);
  const overDeadlinePlans = allPlans.filter(p => isOverDeadline(p.dateDebut, p.duree, p.statut));

  const plans = allPlans.filter(p => {
    const overBudget = (p.montantConsomme ?? 0) > (p.budgetTotal ?? 0) && p.budgetTotal > 0;
    const overDelai = isOverDeadline(p.dateDebut, p.duree, p.statut);

    const matchSearch = !search
      || p.titre.toLowerCase().includes(search.toLowerCase())
      || (p.directionNom ?? "").toLowerCase().includes(search.toLowerCase())
      || (p.reference ?? "").toLowerCase().includes(search.toLowerCase());

    const matchStatus = !filterStatus || p.statut === filterStatus;

    const matchOverrun =
      filterOverrun === "" ? true :
      filterOverrun === "budget" ? overBudget :
      filterOverrun === "delai" ? overDelai :
      filterOverrun === "both" ? (overBudget || overDelai) : true;

    return matchSearch && matchStatus && matchOverrun;
  });

  const stats = {
    total: allPlans.length,
    active: allPlans.filter(p => p.statut === "ouvert").length,
    budgetTotal: allPlans.reduce((s, p) => s + (p.budgetTotal ?? 0), 0),
    consomme: allPlans.reduce((s, p) => s + (p.montantConsomme ?? 0), 0),
  };

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="animate-spin text-primary"><Activity size={48} /></div></div>;
  }

  const isDG = currentUser?.role === "directeur_general" || currentUser?.role === "dga";
  const isDirection = currentUser?.role === "direction";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tableau de Bord</h1>
          <p className="text-muted-foreground mt-1">
            {isDirection ? "Vos plans d'action" : `Vue ${ROLE_LABELS[currentUser?.role ?? ""] ?? "globale"}`}
          </p>
        </div>
        {isDirection && (
          <Link href="/plans/nouveau" className="inline-flex">
            <Button size="lg" className="gap-2"><FilePlus className="w-5 h-5" /> Nouveau Plan</Button>
          </Link>
        )}
      </div>

      {/* Alert banners */}
      <div className="space-y-2">
        {overBudgetPlans.length > 0 && (
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-5 py-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <span className="text-sm font-semibold text-destructive">
              {overBudgetPlans.length} plan{overBudgetPlans.length > 1 ? "s" : ""} en dépassement de budget
            </span>
            <button
              onClick={() => setFilterOverrun(v => v === "budget" ? "" : "budget")}
              className="ml-auto text-xs underline text-destructive font-semibold"
            >
              {filterOverrun === "budget" ? "Voir tout" : "Filtrer"}
            </button>
          </div>
        )}
        {overDeadlinePlans.length > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3">
            <CalendarX className="w-5 h-5 text-orange-600 shrink-0" />
            <span className="text-sm font-semibold text-orange-700">
              {overDeadlinePlans.length} plan{overDeadlinePlans.length > 1 ? "s" : ""} en dépassement de délai
            </span>
            <button
              onClick={() => setFilterOverrun(v => v === "delai" ? "" : "delai")}
              className="ml-auto text-xs underline text-orange-700 font-semibold"
            >
              {filterOverrun === "delai" ? "Voir tout" : "Filtrer"}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-white to-primary/5 border-primary/10">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Total Plans</p><h3 className="text-3xl font-bold text-foreground">{stats.total}</h3></div>
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Activity size={20} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Plans Ouverts</p><h3 className="text-3xl font-bold text-success">{stats.active}</h3></div>
              <div className="p-2.5 bg-success/10 rounded-xl text-success"><CheckCircle2 size={20} /></div>
            </div>
          </CardContent>
        </Card>

        {overBudgetPlans.length > 0 && (
          <Card className="bg-destructive/5 border-destructive/20 cursor-pointer" onClick={() => setFilterOverrun(v => v === "budget" ? "" : "budget")}>
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div><p className="text-xs font-medium text-muted-foreground mb-1">Dépass. Budget</p><h3 className="text-3xl font-bold text-destructive">{overBudgetPlans.length}</h3></div>
                <div className="p-2.5 bg-destructive/10 rounded-xl text-destructive"><AlertTriangle size={20} /></div>
              </div>
            </CardContent>
          </Card>
        )}

        {overDeadlinePlans.length > 0 && (
          <Card className="bg-orange-50 border-orange-200 cursor-pointer" onClick={() => setFilterOverrun(v => v === "delai" ? "" : "delai")}>
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div><p className="text-xs font-medium text-muted-foreground mb-1">Dépass. Délai</p><h3 className="text-3xl font-bold text-orange-600">{overDeadlinePlans.length}</h3></div>
                <div className="p-2.5 bg-orange-100 rounded-xl text-orange-600"><CalendarX size={20} /></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* DG Financial Overview */}
      {isDG && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-5 h-5 text-primary" />Vue Financière Globale</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-6 pt-2 pb-5">
            <div><p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Budget Total</p><p className="text-2xl font-bold text-foreground">{formatCurrency(stats.budgetTotal)}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Consommé</p><p className="text-2xl font-bold text-warning">{formatCurrency(stats.consomme)}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Restant</p><p className="text-2xl font-bold text-success">{formatCurrency(stats.budgetTotal - stats.consomme)}</p></div>
            <div className="col-span-3">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: stats.budgetTotal > 0 ? `${Math.min(100, (stats.consomme / stats.budgetTotal) * 100)}%` : "0%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.budgetTotal > 0 ? ((stats.consomme / stats.budgetTotal) * 100).toFixed(1) : 0}% consommé</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans Table */}
      <Card>
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Liste des Plans d'Action
              {filterOverrun && (
                <Badge variant="warning" className="text-xs font-semibold">
                  {filterOverrun === "budget" ? "⚠ Dépass. budget" : filterOverrun === "delai" ? "⏱ Dépass. délai" : "⚠ Tous dépassements"}
                  <button onClick={() => setFilterOverrun("")} className="ml-1.5 hover:opacity-70">×</button>
                </Badge>
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all w-full sm:w-44" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary text-muted-foreground">
                <option value="">Tous statuts</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterOverrun} onChange={e => setFilterOverrun(e.target.value as typeof filterOverrun)}
                className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-primary transition-colors ${
                  filterOverrun ? "border-warning bg-warning/10 text-warning-foreground font-semibold" : "border-border bg-white text-muted-foreground"
                }`}>
                <option value="">Tous dépassements</option>
                <option value="budget">⚠ Budget dépassé</option>
                <option value="delai">⏱ Délai dépassé</option>
                <option value="both">⚠⏱ Budget ou délai</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-5 py-4 font-semibold">Référence</th>
                <th className="px-5 py-4 font-semibold">Titre</th>
                <th className="px-5 py-4 font-semibold">Direction</th>
                <th className="px-5 py-4 font-semibold">Date Fin Prév.</th>
                {seesAll && <th className="px-5 py-4 font-semibold text-right">Budget / Consommé</th>}
                <th className="px-5 py-4 font-semibold">Statut</th>
                <th className="px-5 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {plans.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Aucun plan d'action trouvé.</td></tr>
              ) : plans.map((plan) => {
                const st = STATUS_CONFIG[plan.statut] ?? STATUS_CONFIG.brouillon;
                const Icon = st.icon;
                const isOverBudget = (plan.montantConsomme ?? 0) > (plan.budgetTotal ?? 0) && plan.budgetTotal > 0;
                const isOverDelai = isOverDeadline(plan.dateDebut, plan.duree, plan.statut);
                const endDate = addDays(new Date(plan.dateDebut), plan.duree);

                // Row color priority: budget overrun (red) > deadline overrun (orange)
                const rowClass = isOverBudget
                  ? "bg-destructive/5"
                  : isOverDelai
                  ? "bg-orange-50"
                  : "";

                return (
                  <tr key={plan.id} className={`hover:brightness-95 transition-all group ${rowClass}`}>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {plan.reference ?? `#${plan.id.toString().padStart(4, "0")}`}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className={`font-semibold flex items-center gap-1.5 flex-wrap ${isOverBudget ? "text-destructive" : isOverDelai ? "text-orange-700" : "text-foreground group-hover:text-primary transition-colors"}`}>
                        {isOverBudget && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                        {isOverDelai && !isOverBudget && <CalendarX className="w-3.5 h-3.5 shrink-0" />}
                        {plan.titre}
                      </div>
                      <div className="flex gap-2 mt-0.5">
                        {isOverBudget && <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Budget dépassé</span>}
                        {isOverDelai && <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Délai dépassé</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{plan.directionNom ?? `Dir. ${plan.directionId}`}</td>
                    <td className="px-5 py-4">
                      <span className={`text-sm ${isOverDelai ? "text-orange-600 font-semibold" : "text-muted-foreground"}`}>
                        {format(endDate, "dd MMM yyyy", { locale: fr })}
                      </span>
                    </td>
                    {seesAll && (
                      <td className="px-5 py-4 text-right">
                        <div className={`text-sm font-semibold ${isOverBudget ? "text-destructive" : "text-foreground"}`}>{formatCurrency(plan.budgetTotal ?? 0)}</div>
                        {(plan.montantConsomme ?? 0) > 0 && (
                          <div className={`text-xs font-medium ${isOverBudget ? "text-destructive font-bold" : "text-warning"}`}>
                            {formatCurrency(plan.montantConsomme ?? 0)} consommé
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <Badge variant={isOverBudget ? "destructive" : st.variant} className="gap-1.5 py-1">
                        <Icon className="w-3.5 h-3.5" />{st.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/plans/${plan.id}`}><Button variant="ghost" size="sm" className="font-semibold">Consulter</Button></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
