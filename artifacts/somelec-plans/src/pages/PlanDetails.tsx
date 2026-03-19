import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetPlan, useGetPlanMoyens, useGetPlanAttachments, useValidatePlan, useConsommerMoyen } from "@workspace/api-client-react";
import type { Moyen } from "@workspace/api-client-react";
import { useAuth, CATEGORY_ROLE, ROLE_LABELS } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import {
  Calendar, Building, Clock, CheckCircle2, FileText, Activity,
  AlertCircle, FileDigit, Download, ShieldCheck, TrendingDown, Fuel,
  Package, Home, DollarSign, BadgeDollarSign, Loader2, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CATEGORIE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  materiel:             { label: "Matériel",             icon: Package,        color: "text-blue-600 bg-blue-50" },
  carburant:            { label: "Carburant",            icon: Fuel,           color: "text-orange-600 bg-orange-50" },
  logement:             { label: "Logement",             icon: Home,           color: "text-purple-600 bg-purple-50" },
  logistique:           { label: "Logistique",           icon: Activity,       color: "text-teal-600 bg-teal-50" },
  prime:                { label: "Prime",                icon: DollarSign,     color: "text-green-600 bg-green-50" },
  indemnite_journaliere:{ label: "Indemnité journalière",icon: BadgeDollarSign,color: "text-amber-600 bg-amber-50" },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "secondary"|"warning"|"info"|"success"|"destructive"|"default" }> = {
  brouillon:     { label: 'Brouillon',   variant: 'secondary' },
  en_attente_ct: { label: 'En attente CT', variant: 'warning' },
  en_attente_dg: { label: 'En attente DG', variant: 'info' },
  approuve:      { label: 'Approuvé',    variant: 'success' },
  rejete:        { label: 'Rejeté',      variant: 'destructive' },
  ouvert:        { label: 'Plan Ouvert', variant: 'success' },
};

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("w-full bg-muted rounded-full h-1.5", className)}>
      <div
        className={cn("h-1.5 rounded-full transition-all", pct >= 90 ? "bg-destructive" : pct >= 60 ? "bg-warning" : "bg-success")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PlanDetails() {
  const [, params] = useRoute("/plans/:id");
  const id = parseInt(params?.id || "0", 10);
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  const { data: plan, isLoading, refetch: refetchPlan } = useGetPlan(id);
  const { data: moyens = [], refetch: refetchMoyens } = useGetPlanMoyens(id);
  const { data: attachments = [] } = useGetPlanAttachments(id);
  const validateMutation = useValidatePlan();
  const consommerMutation = useConsommerMoyen();

  const [commentaire, setCommentaire] = useState("");
  const [consommationValues, setConsommationValues] = useState<Record<number, string>>({});
  const [savingMoyen, setSavingMoyen] = useState<number | null>(null);

  if (isLoading || !plan) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin text-primary"><Activity size={48} /></div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[plan.statut] ?? { label: plan.statut, variant: "default" as const };
  const budgetTotal = moyens.reduce((s, m) => s + Number(m.budget), 0) || plan.budgetTotal || 0;
  const montantConsomme = moyens.reduce((s, m) => s + Number(m.montantConsomme ?? 0), 0);

  const handleValidate = async (action: "approuver" | "rejeter") => {
    if (!currentUser) return;
    await validateMutation.mutateAsync({ id, data: { action, validatedById: currentUser.id, commentaire: commentaire || undefined } });
    setCommentaire("");
    refetchPlan();
  };

  const handleConsommer = async (moyen: Moyen) => {
    const val = parseFloat(consommationValues[moyen.id] ?? "");
    if (isNaN(val) || val < 0) return;
    setSavingMoyen(moyen.id);
    try {
      await consommerMutation.mutateAsync({ id, moyenId: moyen.id, data: { montant: val } });
      setConsommationValues(prev => ({ ...prev, [moyen.id]: "" }));
      refetchMoyens();
      refetchPlan();
    } finally {
      setSavingMoyen(null);
    }
  };

  const canValidateCT = currentUser?.role === "controle_technique" && plan.statut === "en_attente_ct";
  const canValidateDG = currentUser?.role === "directeur_general" && plan.statut === "en_attente_dg";
  const isDG = currentUser?.role === "directeur_general";

  // For functional roles: get their responsible categories
  const myRole = currentUser?.role ?? "";
  const myCategories = Object.entries(CATEGORY_ROLE)
    .filter(([, role]) => role === myRole)
    .map(([cat]) => cat);
  const isFunctionalRole = myCategories.length > 0;
  const myMoyens = isFunctionalRole ? moyens.filter(m => myCategories.includes(m.categorie)) : [];
  const canSaisirConsommation = isFunctionalRole && ["ouvert", "approuve"].includes(plan.statut) && myMoyens.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="space-y-3 relative z-10">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-muted-foreground">#{plan.id.toString().padStart(4, "0")}</Badge>
            <Badge variant={statusConfig.variant} className="px-3 py-1 text-sm">{statusConfig.label}</Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground leading-tight">{plan.titre}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> {plan.directionNom ?? `Dir. ${plan.directionId}`}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {format(new Date(plan.dateDebut), "dd MMM yyyy", { locale: fr })}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {plan.duree} Jours</span>
          </div>
        </div>

        <div className="bg-muted/30 p-5 rounded-xl border border-border/50 min-w-[220px] relative z-10 space-y-3">
          <div className="text-right">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Budget Total Estimé</div>
            <div className="text-3xl font-bold text-primary">{formatCurrency(budgetTotal)}</div>
          </div>
          {montantConsomme > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consommé</span>
                <span className="font-semibold text-warning">{formatCurrency(montantConsomme)}</span>
              </div>
              <ProgressBar value={montantConsomme} max={budgetTotal} />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Restant</span>
                <span className="font-semibold text-success">{formatCurrency(budgetTotal - montantConsomme)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Description du Plan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-foreground leading-relaxed whitespace-pre-wrap">{plan.description}</CardContent>
          </Card>

          {/* Moyens Table */}
          <Card>
            <CardHeader className="border-b border-border/50 pb-4 flex flex-row justify-between items-center">
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Moyens Nécessaires</CardTitle>
              <Badge variant="secondary">{moyens.length} éléments</Badge>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3">Catégorie</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Qté</th>
                    <th className="px-5 py-3 text-right">Budget</th>
                    <th className="px-5 py-3 text-right">Consommé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {moyens.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Aucun moyen défini.</td></tr>
                  ) : moyens.map((m) => {
                    const cat = CATEGORIE_LABELS[m.categorie] ?? { label: m.categorie, icon: Activity, color: "text-gray-600 bg-gray-50" };
                    const Icon = cat.icon;
                    const consomme = Number(m.montantConsomme ?? 0);
                    return (
                      <tr key={m.id} className="hover:bg-muted/10">
                        <td className="px-5 py-4">
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", cat.color)}>
                            <Icon className="w-3.5 h-3.5" /> {cat.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{m.description}</td>
                        <td className="px-5 py-4 text-muted-foreground">{m.quantite ? `${m.quantite} ${m.unite ?? ""}` : "-"}</td>
                        <td className="px-5 py-4 text-right font-semibold text-primary">{formatCurrency(Number(m.budget))}</td>
                        <td className="px-5 py-4 text-right">
                          {consomme > 0 ? (
                            <div>
                              <span className={cn("font-semibold", consomme > Number(m.budget) ? "text-destructive" : "text-warning")}>
                                {formatCurrency(consomme)}
                              </span>
                              <ProgressBar value={consomme} max={Number(m.budget)} className="mt-1 w-20 ml-auto" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pièces jointes */}
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><FileDigit className="w-5 h-5 text-primary" /> Pièces Jointes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {attachments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucune pièce jointe.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <li key={att.id} className="flex items-center gap-3 p-3 border rounded-xl hover:shadow-md transition-shadow bg-white">
                      <div className="bg-primary/10 text-primary p-3 rounded-lg"><FileText className="w-5 h-5" /></div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-semibold truncate">{att.nom}</p>
                        <p className="text-xs text-muted-foreground uppercase">{att.type.split("/")[1] ?? "Fichier"} • {((att.taille ?? 0) / 1024).toFixed(0)} KB</p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary">
                        <Download className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Validation panel - CT or DG */}
          {(canValidateCT || canValidateDG) && (
            <Card className="border-warning/30 bg-warning/5 shadow-lg">
              <CardHeader className="border-b border-warning/20 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-warning-foreground font-bold">
                  <ShieldCheck className="w-5 h-5" /> Action Requise
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm text-foreground">
                  Ce plan attend votre validation en tant que <strong>{ROLE_LABELS[currentUser?.role ?? ""] ?? currentUser?.role}</strong>.
                </p>
                <textarea
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Commentaire (obligatoire en cas de rejet)..."
                  rows={3}
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button
                    variant="destructive" className="flex-1"
                    onClick={() => handleValidate("rejeter")}
                    disabled={validateMutation.isPending || !commentaire}
                  >
                    Rejeter
                  </Button>
                  <Button
                    className="flex-1 bg-success hover:bg-success/90 text-white"
                    onClick={() => handleValidate("approuver")}
                    disabled={validateMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approuver
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Consumption Panel for functional roles */}
          {canSaisirConsommation && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="border-b border-orange-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-orange-800 font-bold">
                  <TrendingDown className="w-5 h-5" /> Saisir Consommation
                </CardTitle>
                <p className="text-xs text-orange-700 mt-1">
                  {ROLE_LABELS[myRole]} — {myCategories.map(c => CATEGORIE_LABELS[c]?.label).join(", ")}
                </p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {myMoyens.map((m) => {
                  const cat = CATEGORIE_LABELS[m.categorie] ?? { label: m.categorie, icon: Activity, color: "" };
                  const Icon = cat.icon;
                  const current = Number(m.montantConsomme ?? 0);
                  const budget = Number(m.budget);
                  return (
                    <div key={m.id} className="bg-white rounded-xl border border-orange-100 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-semibold text-foreground">{m.description}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Budget : <span className="font-semibold text-primary">{formatCurrency(budget)}</span></span>
                        <span>Actuel : <span className="font-semibold text-warning">{formatCurrency(current)}</span></span>
                      </div>
                      <ProgressBar value={current} max={budget} />
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder={`Nouveau montant (UM)`}
                          value={consommationValues[m.id] ?? ""}
                          onChange={e => setConsommationValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-lg border border-orange-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleConsommer(m)}
                          disabled={savingMoyen === m.id || !consommationValues[m.id]}
                          className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                        >
                          {savingMoyen === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* DG Financial Summary */}
          {isDG && moyens.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-5 h-5 text-primary" /> Suivi Financier</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {moyens.map(m => {
                  const cat = CATEGORIE_LABELS[m.categorie] ?? { label: m.categorie, icon: Activity, color: "text-gray-600 bg-gray-50" };
                  const Icon = cat.icon;
                  const consomme = Number(m.montantConsomme ?? 0);
                  const budget = Number(m.budget);
                  const pct = budget > 0 ? Math.round((consomme / budget) * 100) : 0;
                  return (
                    <div key={m.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", cat.color)}>
                          <Icon className="w-3 h-3" /> {cat.label}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(consomme)} / {formatCurrency(budget)}</span>
                      </div>
                      <ProgressBar value={consomme} max={budget} />
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-border/50 flex justify-between font-semibold text-sm">
                  <span>Total consommé</span>
                  <span className="text-warning">{((budgetTotal > 0 ? montantConsomme / budgetTotal : 0) * 100).toFixed(1)}% — {formatCurrency(montantConsomme)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejection note */}
          {plan.statut === "rejete" && plan.commentaireRejet && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-destructive">Motif du rejet</h4>
                    <p className="text-sm text-foreground mt-1 leading-relaxed">{plan.commentaireRejet}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Validation Circuit */}
          <Card>
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-base">Circuit de Validation</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <ol className="space-y-4">
                {[
                  { label: "Direction", sub: "Création du plan", done: true, active: false },
                  {
                    label: "Contrôle Technique",
                    sub: "Vérification technique",
                    done: !["brouillon", "en_attente_ct"].includes(plan.statut) && plan.statut !== "rejete",
                    active: plan.statut === "en_attente_ct",
                    rejected: plan.statut === "rejete" && ["en_attente_ct"].includes(plan.statut),
                  },
                  {
                    label: "Directeur Général",
                    sub: "Approbation finale",
                    done: ["ouvert"].includes(plan.statut),
                    active: plan.statut === "en_attente_dg",
                  },
                  {
                    label: "Plan Ouvert",
                    sub: "Exécution en cours",
                    done: plan.statut === "ouvert",
                    active: false,
                  },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={cn(
                      "mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold border-2 border-white",
                      step.done ? "bg-success" :
                      step.active ? "bg-warning animate-pulse" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {step.done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs">{i + 1}</span>}
                    </div>
                    <div>
                      <p className={cn("text-sm font-semibold", step.active ? "text-warning" : step.done ? "text-success" : "text-muted-foreground")}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.sub}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
