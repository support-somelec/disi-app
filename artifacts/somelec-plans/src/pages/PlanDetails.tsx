import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPlan, useGetPlanMoyens, useGetPlanAttachments,
  useValidatePlan, useConsommerMoyen, useCloturerPlan, useAddAttachment, useDemanderMoyen
} from "@workspace/api-client-react";
import type { Moyen } from "@workspace/api-client-react";
import { useAuth, CATEGORY_ROLE, ROLE_LABELS } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import {
  Calendar, Building, Clock, CheckCircle2, FileText, Activity,
  AlertCircle, FileDigit, Download, ShieldCheck, TrendingDown, Fuel,
  Package, Home, DollarSign, BadgeDollarSign, Loader2, ChevronRight,
  Lock, FilePlus, Trash2, UploadCloud, PlayCircle, Hourglass, CheckCheck, Send, TriangleAlert
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
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
  brouillon:      { label: "Brouillon",    variant: "secondary" },
  en_attente_ct:  { label: "Attente CT",   variant: "warning" },
  en_attente_dga: { label: "Attente DGA",  variant: "warning" },
  en_attente_dg:  { label: "Attente DG",   variant: "info" },
  approuve:       { label: "Approuvé",     variant: "success" },
  rejete:         { label: "Rejeté",       variant: "destructive" },
  ouvert:         { label: "Plan Ouvert",  variant: "success" },
  cloture:        { label: "Clôturé",      variant: "default" },
};

const VALIDATION_STEPS = [
  { key: "creation",      label: "Direction",  sub: "Création",        statuts: ["brouillon"] },
  { key: "ct",            label: "CT",         sub: "Contrôle Tech.",  statuts: ["en_attente_ct"] },
  { key: "dga",           label: "DGA",        sub: "Dir. Gén. Adj.",  statuts: ["en_attente_dga"] },
  { key: "dg",            label: "DG",         sub: "Directeur Gén.",  statuts: ["en_attente_dg"] },
  { key: "ouvert",        label: "Ouvert",     sub: "En exécution",    statuts: ["ouvert"] },
  { key: "cloture",       label: "Clôture",    sub: "Terminé",         statuts: ["cloture"] },
];

const STATUS_ORDER = ["brouillon", "en_attente_ct", "en_attente_dga", "en_attente_dg", "ouvert", "cloture"];

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

  const queryClient = useQueryClient();
  const { data: plan, isLoading, refetch: refetchPlan } = useGetPlan(id);
  const { data: moyens = [], refetch: refetchMoyens } = useGetPlanMoyens(id);
  const { data: attachments = [], refetch: refetchAttachments } = useGetPlanAttachments(id);
  const validateMutation = useValidatePlan();
  const consommerMutation = useConsommerMoyen();
  const cloturerMutation = useCloturerPlan();
  const addAttachmentMutation = useAddAttachment();
  const demanderMutation = useDemanderMoyen();

  const invalidatePlans = () => queryClient.invalidateQueries({ queryKey: ["/api/plans"] });

  const [commentaire, setCommentaire] = useState("");
  const [consommationValues, setConsommationValues] = useState<Record<number, string>>({});
  const [consommeErrors, setConsommeErrors] = useState<Record<number, string>>({});
  const [savingMoyen, setSavingMoyen] = useState<number | null>(null);
  const [demandingMoyen, setDemandingMoyen] = useState<number | null>(null);
  const [demandConfirm, setDemandConfirm] = useState<Moyen | null>(null);
  const [dechargeFiles, setDechargeFiles] = useState<Record<number, { file: File; base64: string } | null>>({});

  // Closure state
  const [rapportCloture, setRapportCloture] = useState("");
  const [clotureFiles, setClotureFiles] = useState<Array<{ file: File; base64: string }>>([]);
  const [isClosing, setIsClosing] = useState(false);

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
  const isOverBudget = montantConsomme > budgetTotal && budgetTotal > 0;

  const currentStatusIndex = STATUS_ORDER.indexOf(plan.statut);

  const handleValidate = async (action: "approuver" | "rejeter") => {
    if (!currentUser) return;
    await validateMutation.mutateAsync({ id, data: { action, validatedById: currentUser.id, commentaire: commentaire || undefined } });
    setCommentaire("");
    await Promise.all([refetchPlan(), invalidatePlans()]);
  };

  const handleDechargeChange = (moyenId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setDechargeFiles(prev => ({ ...prev, [moyenId]: { file, base64: evt.target!.result!.toString() } }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleConsommer = async (moyen: Moyen) => {
    const val = parseFloat(consommationValues[moyen.id] ?? "");
    if (isNaN(val) || val < 0) return;
    const decharge = dechargeFiles[moyen.id];
    if (!decharge) return;

    // Client-side budget check (except logistique)
    const budget = Number(moyen.budget);
    if (moyen.categorie !== "logistique" && val > budget) {
      setConsommeErrors(prev => ({
        ...prev,
        [moyen.id]: `Dépassement non autorisé : ${val.toLocaleString("fr-MR")} MRU saisi > ${budget.toLocaleString("fr-MR")} MRU prévu.`,
      }));
      return;
    }
    setConsommeErrors(prev => ({ ...prev, [moyen.id]: "" }));

    setSavingMoyen(moyen.id);
    try {
      await addAttachmentMutation.mutateAsync({
        id,
        data: { moyenId: moyen.id, nom: decharge.file.name, type: decharge.file.type, taille: decharge.file.size, data: decharge.base64 },
      });
      await consommerMutation.mutateAsync({ id, moyenId: moyen.id, data: { montant: val } });
      setConsommationValues(prev => ({ ...prev, [moyen.id]: "" }));
      setDechargeFiles(prev => ({ ...prev, [moyen.id]: null }));
      await Promise.all([refetchMoyens(), refetchPlan(), refetchAttachments(), invalidatePlans()]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      setConsommeErrors(prev => ({ ...prev, [moyen.id]: msg }));
    } finally {
      setSavingMoyen(null);
    }
  };

  const handleClotureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setClotureFiles(prev => [...prev, { file, base64: event.target!.result!.toString() }]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCloturer = async () => {
    if (!currentUser || !rapportCloture.trim()) return;
    setIsClosing(true);
    try {
      for (const att of clotureFiles) {
        await addAttachmentMutation.mutateAsync({
          id,
          data: { nom: att.file.name, type: att.file.type, taille: att.file.size, data: att.base64 }
        });
      }
      await cloturerMutation.mutateAsync({ id, data: { rapportCloture: rapportCloture.trim(), cloturedById: currentUser.id } });
      await Promise.all([refetchPlan(), refetchAttachments(), invalidatePlans()]);
    } finally {
      setIsClosing(false);
    }
  };

  const handleDemander = async (moyen: Moyen) => {
    if (!currentUser) return;
    setDemandingMoyen(moyen.id);
    try {
      await demanderMutation.mutateAsync({ id, moyenId: moyen.id, data: { demandeById: currentUser.id } });
      await Promise.all([refetchMoyens(), refetchPlan(), invalidatePlans()]);
    } catch (e) {
      console.error("Demande failed:", e);
    } finally {
      setDemandingMoyen(null);
    }
  };

  const canValidateCT  = currentUser?.role === "controle_technique" && plan.statut === "en_attente_ct";
  const canValidateDGA = currentUser?.role === "dga"                && plan.statut === "en_attente_dga";
  const canValidateDG  = currentUser?.role === "directeur_general"  && plan.statut === "en_attente_dg";
  const canCloturer    = plan.statut === "ouvert" && (plan.createdById === currentUser?.id || (currentUser?.role === "direction" && currentUser?.directionId === plan.directionId));
  const isDG = currentUser?.role === "directeur_general" || currentUser?.role === "dga";

  const isOwnDirectionPlan = currentUser?.role === "direction" &&
    (plan.createdById === currentUser?.id || currentUser?.directionId === plan.directionId);
  const canDemanderExecution = isOwnDirectionPlan && plan.statut === "ouvert";

  const myRole = currentUser?.role ?? "";
  const myCategories = Object.entries(CATEGORY_ROLE).filter(([, role]) => role === myRole).map(([cat]) => cat);
  const isFunctionalRole = myCategories.length > 0;
  const myMoyensAll = isFunctionalRole ? moyens.filter(m => myCategories.includes(m.categorie)) : [];
  const myMoyens = myMoyensAll.filter(m => m.demandeStatus === "demandee");
  const canSaisirConsommation = isFunctionalRole && plan.statut === "ouvert" && myMoyens.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="font-mono text-muted-foreground text-xs">
                {plan.reference ?? `#${plan.id.toString().padStart(4, "0")}`}
              </Badge>
              <Badge variant={isOverBudget ? "destructive" : statusConfig.variant} className="px-3 py-1 text-sm">
                {statusConfig.label}
              </Badge>
              {isOverBudget && <Badge variant="destructive" className="gap-1">⚠ Dépassement budget</Badge>}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">{plan.titre}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Building className="w-4 h-4" /> {plan.directionNom ?? `Dir. ${plan.directionId}`}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {format(new Date(plan.dateDebut), "dd MMM yyyy", { locale: fr })}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {plan.duree} Jours</span>
            </div>
          </div>

          <div className={cn("bg-muted/30 p-5 rounded-xl border min-w-[200px] space-y-3", isOverBudget ? "border-destructive/30 bg-destructive/5" : "border-border/50")}>
            <div className="text-right">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Budget Total</div>
              <div className={cn("text-3xl font-bold", isOverBudget ? "text-destructive" : "text-primary")}>{formatCurrency(budgetTotal)}</div>
            </div>
            {montantConsomme > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Consommé</span>
                  <span className={cn("font-semibold", isOverBudget ? "text-destructive" : "text-warning")}>{formatCurrency(montantConsomme)}</span>
                </div>
                <ProgressBar value={montantConsomme} max={budgetTotal} />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Restant</span>
                  <span className={cn("font-semibold", isOverBudget ? "text-destructive" : "text-success")}>{formatCurrency(budgetTotal - montantConsomme)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Horizontal Validation Stepper */}
        <div className="mt-6 pt-6 border-t border-border/50 relative z-10">
          <div className="flex items-center justify-between gap-1">
            {VALIDATION_STEPS.map((step, idx) => {
              const stepStatusIndex = STATUS_ORDER.indexOf(step.statuts[0]);
              const isDone = plan.statut !== "rejete"
                ? (stepStatusIndex === 0 || currentStatusIndex > stepStatusIndex || (step.key === "cloture" && plan.statut === "cloture"))
                : stepStatusIndex === 0;
              const isActive = step.statuts.includes(plan.statut);
              const isRejected = plan.statut === "rejete" && isActive;

              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      isDone ? "bg-success border-success text-white" :
                      isActive ? "bg-warning border-warning text-white animate-pulse" :
                      isRejected ? "bg-destructive border-destructive text-white" :
                      "bg-muted border-border text-muted-foreground"
                    )}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : <span>{idx + 1}</span>}
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className={cn("text-xs font-semibold leading-none",
                        isDone ? "text-success" :
                        isActive ? "text-warning" :
                        "text-muted-foreground"
                      )}>{step.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">{step.sub}</div>
                    </div>
                  </div>
                  {idx < VALIDATION_STEPS.length - 1 && (
                    <div className={cn(
                      "h-0.5 flex-1 max-w-[40px] rounded transition-all",
                      currentStatusIndex > STATUS_ORDER.indexOf(step.statuts[0]) && plan.statut !== "rejete"
                        ? "bg-success" : "bg-muted"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
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
                    <th className="px-5 py-3 text-center">Exécution</th>
                    <th className="px-5 py-3 text-center">Décharge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {moyens.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">Aucun moyen défini.</td></tr>
                  ) : moyens.map((m) => {
                    const cat = CATEGORIE_LABELS[m.categorie] ?? { label: m.categorie, icon: Activity, color: "text-gray-600 bg-gray-50" };
                    const Icon = cat.icon;
                    const consomme = Number(m.montantConsomme ?? 0);
                    const over = consomme > Number(m.budget) && Number(m.budget) > 0;
                    const moyenDecharge = attachments.find(a => a.moyenId === m.id);
                    const isDemanderLoading = demandingMoyen === m.id;
                    return (
                      <tr key={m.id} className={cn("hover:bg-muted/10", over ? "bg-destructive/5" : "")}>
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
                              <span className={cn("font-semibold", over ? "text-destructive" : "text-warning")}>{formatCurrency(consomme)}</span>
                              <ProgressBar value={consomme} max={Number(m.budget)} className="mt-1 w-20 ml-auto" />
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {m.demandeStatus === "consommee" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              <CheckCheck className="w-3 h-3" /> Traitée
                            </span>
                          ) : m.demandeStatus === "demandee" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                              <Hourglass className="w-3 h-3" /> En attente
                            </span>
                          ) : canDemanderExecution ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 px-2"
                              disabled={isDemanderLoading}
                              onClick={() => setDemandConfirm(m)}
                            >
                              {isDemanderLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Demander
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {moyenDecharge ? (
                            <a href={`/api/plans/${plan.id}/attachments/${moyenDecharge.id}/download`} download={moyenDecharge.nom} title={moyenDecharge.nom}>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors cursor-pointer">
                                <Download className="w-3 h-3" /> OK
                              </span>
                            </a>
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
                      <a
                        href={`/api/plans/${plan.id}/attachments/${att.id}/download`}
                        download={att.nom}
                        className="shrink-0"
                      >
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" title="Télécharger">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Closure info (when closed) */}
          {plan.statut === "cloture" && plan.rapportCloture && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="border-b border-green-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-green-800"><Lock className="w-5 h-5" /> Rapport de Clôture</CardTitle>
                {plan.dateCloture && (
                  <p className="text-xs text-green-700 mt-1">Clôturé le {format(new Date(plan.dateCloture), "dd MMMM yyyy", { locale: fr })}</p>
                )}
              </CardHeader>
              <CardContent className="p-6 text-foreground leading-relaxed whitespace-pre-wrap text-sm">{plan.rapportCloture}</CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Validation panel - CT, DGA, DG */}
          {(canValidateCT || canValidateDGA || canValidateDG) && (
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
                  >Rejeter</Button>
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

          {/* Closure panel - creating direction */}
          {canCloturer && (
            <Card className="border-primary/30 bg-primary/5 shadow-lg">
              <CardHeader className="border-b border-primary/20 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-primary font-bold">
                  <Lock className="w-5 h-5" /> Clôturer le Plan
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Ajoutez le rapport et le PV de réception.</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Rapport de Clôture *</label>
                  <textarea
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
                    placeholder="Décrivez les résultats, bilan et observations..."
                    value={rapportCloture}
                    onChange={(e) => setRapportCloture(e.target.value)}
                  />
                </div>

                {/* File upload for closure docs */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Pièces jointes (Rapport, PV...)</label>
                  <div className="relative border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-4 text-center bg-white cursor-pointer">
                    <input type="file" onChange={handleClotureFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <UploadCloud className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Cliquez pour ajouter</p>
                  </div>
                  {clotureFiles.length > 0 && (
                    <ul className="space-y-1.5">
                      {clotureFiles.map((att, i) => (
                        <li key={i} className="flex items-center gap-2 p-2 border rounded-lg bg-white text-sm">
                          <FilePlus className="w-4 h-4 text-primary shrink-0" />
                          <span className="flex-1 truncate text-xs">{att.file.name}</span>
                          <button onClick={() => setClotureFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  onClick={handleCloturer}
                  disabled={isClosing || !rapportCloture.trim()}
                  isLoading={isClosing}
                >
                  <Lock className="w-4 h-4 mr-2" /> Clôturer le Plan
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Specialist waiting panel — has categories but no pending demands */}
          {isFunctionalRole && plan.statut === "ouvert" && myMoyensAll.length > 0 && myMoyens.length === 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-5 flex items-start gap-3">
                <Hourglass className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">En attente d'une demande d'exécution</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Vous avez {myMoyensAll.length} moyen(s) dans ce plan ({myCategories.map(c => CATEGORIE_LABELS[c]?.label).join(", ")}).
                    La direction doit d'abord initier une demande d'exécution pour chaque moyen avant que vous puissiez saisir la consommation.
                  </p>
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
                  const decharge = dechargeFiles[m.id];
                  const canSave = !!consommationValues[m.id] && !!decharge;
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
                          type="number" min={0} step={0.01}
                          placeholder="Nouveau montant (MRU)"
                          value={consommationValues[m.id] ?? ""}
                          onChange={e => {
                            setConsommationValues(prev => ({ ...prev, [m.id]: e.target.value }));
                            setConsommeErrors(prev => ({ ...prev, [m.id]: "" }));
                          }}
                          className={cn(
                            "flex-1 px-3 py-2 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2",
                            consommeErrors[m.id]
                              ? "border-destructive focus:ring-destructive/40"
                              : "border-orange-200 focus:ring-orange-300"
                          )}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleConsommer(m)}
                          disabled={savingMoyen === m.id || !canSave}
                          title={!decharge ? "Joignez d'abord la décharge" : "Enregistrer"}
                          className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                        >
                          {savingMoyen === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </div>
                      {consommeErrors[m.id] && (
                        <div className="flex items-start gap-1.5 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{consommeErrors[m.id]}</span>
                        </div>
                      )}
                      {m.categorie === "logistique" && (
                        <p className="text-[11px] text-blue-600 italic">
                          ℹ️ Catégorie Logistique : un dépassement du budget est autorisé.
                        </p>
                      )}
                      {/* Décharge obligatoire */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide flex items-center gap-1">
                          <FilePlus className="w-3 h-3" /> Décharge (obligatoire)
                        </label>
                        {decharge ? (
                          <div className="flex items-center gap-2 p-2 border border-orange-200 rounded-lg bg-orange-50 text-xs">
                            <FilePlus className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                            <span className="flex-1 truncate text-orange-800 font-medium">{decharge.file.name}</span>
                            <button onClick={() => setDechargeFiles(prev => ({ ...prev, [m.id]: null }))} className="text-muted-foreground hover:text-destructive shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative border border-dashed border-orange-300 hover:border-orange-500 transition-colors rounded-lg p-2.5 text-center cursor-pointer bg-orange-50/40">
                            <input type="file" onChange={e => handleDechargeChange(m.id, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                            <div className="flex items-center justify-center gap-1.5 text-xs text-orange-600">
                              <UploadCloud className="w-3.5 h-3.5" /> Joindre la décharge
                            </div>
                          </div>
                        )}
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
                  <span className={cn(isOverBudget ? "text-destructive" : "text-warning")}>
                    {((budgetTotal > 0 ? montantConsomme / budgetTotal : 0) * 100).toFixed(1)}% — {formatCurrency(montantConsomme)}
                  </span>
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
        </div>
      </div>

      {/* ─── Demande d'exécution — popup de confirmation ─── */}
      <Dialog open={!!demandConfirm} onOpenChange={(open) => { if (!open) setDemandConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Confirmer la demande d'exécution
            </DialogTitle>
            <DialogDescription className="pt-2">
              Vous êtes sur le point d'initier une demande d'exécution pour le moyen suivant. Cette action notifiera le service responsable par e-mail.
            </DialogDescription>
          </DialogHeader>

          {demandConfirm && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
              {(() => {
                const cat = CATEGORIE_LABELS[demandConfirm.categorie] ?? { label: demandConfirm.categorie, icon: Activity, color: "" };
                const CatIcon = cat.icon;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", cat.color)}>
                        <CatIcon className="w-3.5 h-3.5" /> {cat.label}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">{demandConfirm.description}</p>
                    <p className="text-muted-foreground">
                      Budget prévu : <span className="font-semibold text-primary">{formatCurrency(Number(demandConfirm.budget))}</span>
                    </p>
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDemandConfirm(null)}
              disabled={!!demandingMoyen}
            >
              Annuler
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={!!demandingMoyen}
              onClick={async () => {
                if (!demandConfirm) return;
                const m = demandConfirm;
                setDemandConfirm(null);
                await handleDemander(m);
              }}
            >
              {demandingMoyen ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Confirmer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
