import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPlan, useGetPlanMoyens, useGetPlanAttachments,
  useValidatePlan, useConsommerMoyen, useCloturerPlan, useAddAttachment, useDemanderMoyen,
  useGetDirections
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
  Lock, FilePlus, Trash2, UploadCloud, PlayCircle, Hourglass, CheckCheck, Send, TriangleAlert, Car
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CATEGORIE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  materiel:             { label: "Matériel",             icon: Package,        color: "text-blue-600 bg-blue-50" },
  outillage:            { label: "Outillage",            icon: Package,        color: "text-sky-600 bg-sky-50" },
  accessoire:           { label: "Accessoire",           icon: Package,        color: "text-indigo-600 bg-indigo-50" },
  carburant:            { label: "Carburant",            icon: Fuel,           color: "text-orange-600 bg-orange-50" },
  location:             { label: "Location Véhicule",    icon: Car,            color: "text-cyan-600 bg-cyan-50" },
  logement:             { label: "Logement",             icon: Home,           color: "text-purple-600 bg-purple-50" },
  logistique:           { label: "Logistique",           icon: Activity,       color: "text-teal-600 bg-teal-50" },
  prime:                { label: "Prime",                icon: DollarSign,     color: "text-green-600 bg-green-50" },
  indemnite_journaliere:{ label: "Indemnité journalière",icon: BadgeDollarSign,color: "text-amber-600 bg-amber-50" },
  autres:               { label: "Autres",               icon: Activity,       color: "text-gray-600 bg-gray-100" },
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
  const [beneficiairesMap, setBeneficiairesMap] = useState<Record<number, { id: number; nom: string; matricule: string | null; nni: string | null; montant: number }[]>>({});
  const [expandedBenef, setExpandedBenef] = useState<Record<number, boolean>>({});
  const { data: directions = [] } = useGetDirections();

  // Materiel workflow state
  const [materielItemsMap, setMaterielItemsMap] = useState<Record<number, Array<{ id: number; item: string; quantiteInitiale: number; quantiteRestante: number }>>>({});
  const [materielDemandesMap, setMaterielDemandesMap] = useState<Record<number, Array<{ id: number; statut: string; itemsJson: string; items: Array<{ item: string; quantiteDemandee: number; montantUnitaire?: number; montantTotal?: number }>; montantTotal: number | null; bonNumber: string | null; daValidatedAt: string | null; dcgaiValidatedAt: string | null; createdAt: string }>>>({});
  const [expandedMaterielMoyen, setExpandedMaterielMoyen] = useState<Record<number, boolean>>({});
  // Direction demande dialog
  const [materielDemandeDialog, setMaterielDemandeDialog] = useState<number | null>(null); // moyenId
  const [materielQtySels, setMaterielQtySels] = useState<Record<number, string>>({}); // itemId -> qty
  const [materielLoading, setMaterielLoading] = useState(false);
  // DA traiter dialog
  const [daTraiterDialog, setDaTraiterDialog] = useState<{ moyenId: number; demandeId: number; items: Array<{ item: string; quantiteDemandee: number }> } | null>(null);
  const [daPrices, setDaPrices] = useState<Record<number, string>>({});
  const [daLoading, setDaLoading] = useState(false);
  // DCGAI state
  const [dcgaiValidating, setDcgaiValidating] = useState<number | null>(null);

  // Location véhicule workflow state
  type LocItem = { id: number; typeEngin: string; nbJoursTotal: number; nbJoursRestants: number };
  type LocDemande = { id: number; statut: string; items: Array<{ locationItemId: number; typeEngin: string; nbJoursDemandes: number; montant?: number }>; montantTotal: number | null; dmgValidatedAt: string | null; createdAt: string };
  const [locationItemsMap, setLocationItemsMap] = useState<Record<number, LocItem[]>>({});
  const [locationDemandesMap, setLocationDemandesMap] = useState<Record<number, LocDemande[]>>({});
  const [expandedLocationMoyen, setExpandedLocationMoyen] = useState<Record<number, boolean>>({});
  // Direction demande dialog
  const [locationDemandeDialog, setLocationDemandeDialog] = useState<number | null>(null); // moyenId
  const [locationJoursSels, setLocationJoursSels] = useState<Record<number, string>>({}); // itemId -> nbJours
  const [locationDemLoading, setLocationDemLoading] = useState(false);
  // DMG validation dialog
  const [dmgValiderDialog, setDmgValiderDialog] = useState<{ moyenId: number; demandeId: number; items: Array<{ locationItemId: number; typeEngin: string; nbJoursDemandes: number }> } | null>(null);
  const [dmgMontants, setDmgMontants] = useState<Record<number, string>>({});
  const [dmgLoading, setDmgLoading] = useState(false);
  // Décharge files
  const [daDechargeFile, setDaDechargeFile] = useState<File | null>(null);
  const [dmgDechargeFile, setDmgDechargeFile] = useState<File | null>(null);

  // ── Carburant workflow state ──
  type CarburantDemande = { id: number; moyenId: number; statut: string; montantDemande: number; montantValide: number | null; createdAt: string };
  const [carburantDemandesMap, setCarburantDemandesMap] = useState<Record<number, CarburantDemande[]>>({});
  const [expandedCarburantMoyen, setExpandedCarburantMoyen] = useState<Record<number, boolean>>({});
  const [carburantDemandeDialog, setCarburantDemandeDialog] = useState<number | null>(null);
  const [carburantMontantInput, setCarburantMontantInput] = useState("");
  const [carburantDemLoading, setCarburantDemLoading] = useState(false);
  const [cadValiderDialog, setCadValiderDialog] = useState<{ moyenId: number; demandeId: number; montantDemande: number } | null>(null);
  const [cadMontantInput, setCadMontantInput] = useState("");
  const [cadDechargeFile, setCadDechargeFile] = useState<File | null>(null);
  const [cadLoading, setCadLoading] = useState(false);

  // ── Dépenses workflow state (prime/logement/logistique/indemnite/autres) ──
  type DepenseDemande = { id: number; moyenId: number; statut: string; montantDemande: number; nomBeneficiaire: string; matriculeBeneficiaire?: string; montantPaye: number | null; pieceReference?: string; dcgaiValidatedAt?: string; dfcValidatedAt?: string; createdAt: string };
  const [depenseDemandesMap, setDepenseDemandesMap] = useState<Record<number, DepenseDemande[]>>({});
  const [expandedDepenseMoyen, setExpandedDepenseMoyen] = useState<Record<number, boolean>>({});
  const [depenseDemandeDialog, setDepenseDemandeDialog] = useState<number | null>(null);
  const [depenseMontantInput, setDepenseMontantInput] = useState("");
  const [depenseNomBenef, setDepenseNomBenef] = useState("");
  const [depenseMatricule, setDepenseMatricule] = useState("");
  const [depenseDemLoading, setDepenseDemLoading] = useState(false);
  const [dcgaiDepenseLoading, setDcgaiDepenseLoading] = useState<number | null>(null);
  const [dfcPayerDialog, setDfcPayerDialog] = useState<{ moyenId: number; demandeId: number; demande: DepenseDemande } | null>(null);
  const [dfcMontantInput, setDfcMontantInput] = useState("");
  const [dfcLoading, setDfcLoading] = useState(false);

  const BASE_URL = import.meta.env.BASE_URL ?? "/somelec-plans/";

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const DEPENSE_CATS = ["prime", "logement", "indemnite_journaliere", "logistique", "autres"];

  const loadCarburantData = async (moyenId: number) => {
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/carburant-demandes`);
      const data = await res.json();
      setCarburantDemandesMap(prev => ({ ...prev, [moyenId]: data }));
    } catch { /* ignore */ }
  };

  const handleDemanderCarburant = async (moyenId: number) => {
    if (!currentUser) return;
    const montant = Number(carburantMontantInput);
    if (!montant || montant <= 0) { alert("Montant invalide."); return; }
    setCarburantDemLoading(true);
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/carburant-demandes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdById: currentUser.id, montantDemande: montant }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur"); return; }
      await loadCarburantData(moyenId);
      setCarburantDemandeDialog(null);
      setCarburantMontantInput("");
    } catch { alert("Erreur réseau"); }
    finally { setCarburantDemLoading(false); }
  };

  const handleCadValider = async () => {
    if (!cadValiderDialog || !currentUser) return;
    const { moyenId, demandeId } = cadValiderDialog;
    const montant = Number(cadMontantInput);
    if (!montant || montant <= 0) { alert("Montant invalide."); return; }
    setCadLoading(true);
    try {
      let decharge: { nom: string; mimeType: string; taille: number; data: string } | undefined;
      if (cadDechargeFile) {
        decharge = { nom: cadDechargeFile.name, mimeType: cadDechargeFile.type, taille: cadDechargeFile.size, data: await toBase64(cadDechargeFile) };
      }
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/carburant-demandes/${demandeId}/cad-valider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadUserId: currentUser.id, montantValide: montant, decharge }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur"); return; }
      await Promise.all([loadCarburantData(moyenId), refetchMoyens()]);
      setCadValiderDialog(null);
      setCadMontantInput("");
      setCadDechargeFile(null);
    } catch { alert("Erreur réseau"); }
    finally { setCadLoading(false); }
  };

  const loadDepenseData = async (moyenId: number) => {
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/depense-demandes`);
      const data = await res.json();
      setDepenseDemandesMap(prev => ({ ...prev, [moyenId]: data }));
    } catch { /* ignore */ }
  };

  const handleDemanderDepense = async (moyenId: number) => {
    if (!currentUser) return;
    const montant = Number(depenseMontantInput);
    if (!montant || montant <= 0) { alert("Montant invalide."); return; }
    if (!depenseNomBenef.trim()) { alert("Veuillez saisir le nom du bénéficiaire."); return; }
    setDepenseDemLoading(true);
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/depense-demandes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdById: currentUser.id, montantDemande: montant, nomBeneficiaire: depenseNomBenef.trim(), matriculeBeneficiaire: depenseMatricule.trim() || undefined }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur"); return; }
      await loadDepenseData(moyenId);
      setDepenseDemandeDialog(null);
      setDepenseMontantInput("");
      setDepenseNomBenef("");
      setDepenseMatricule("");
    } catch { alert("Erreur réseau"); }
    finally { setDepenseDemLoading(false); }
  };

  const handleDcgaiDepenseValider = async (moyenId: number, demandeId: number) => {
    if (!currentUser) return;
    setDcgaiDepenseLoading(demandeId);
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/depense-demandes/${demandeId}/dcgai-valider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dcgaiUserId: currentUser.id }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur"); return; }
      await loadDepenseData(moyenId);
    } catch { alert("Erreur réseau"); }
    finally { setDcgaiDepenseLoading(null); }
  };

  const handleDfcPayer = async () => {
    if (!dfcPayerDialog || !currentUser) return;
    const { moyenId, demandeId } = dfcPayerDialog;
    const montant = Number(dfcMontantInput);
    if (!montant || montant <= 0) { alert("Montant invalide."); return; }
    setDfcLoading(true);
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/depense-demandes/${demandeId}/dfc-payer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dfcUserId: currentUser.id, montantPaye: montant }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur"); return; }
      const updated = await res.json();
      await Promise.all([loadDepenseData(moyenId), refetchMoyens()]);
      downloadPiece(updated, plan.reference ?? `PLAN-${plan.id}`);
      setDfcPayerDialog(null);
      setDfcMontantInput("");
    } catch { alert("Erreur réseau"); }
    finally { setDfcLoading(false); }
  };

  const downloadPiece = (demande: DepenseDemande, planRef: string) => {
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Pièce de paiement ${demande.pieceReference ?? ""}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;} .box{border:2px solid #333;border-radius:8px;padding:20px;max-width:600px;margin:auto;} h1{font-size:20px;text-align:center;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{border:1px solid #ccc;padding:8px;font-size:13px;} th{background:#f0f0f0;text-align:left;} .footer{margin-top:30px;display:flex;justify-content:space-between;} .sign{border-top:1px solid #333;width:180px;text-align:center;padding-top:4px;font-size:12px;}</style>
    </head><body><div class="box">
    <h1>PIÈCE DE PAIEMENT</h1>
    <p style="text-align:center;font-size:13px;color:#555;">Réf. : <strong>${demande.pieceReference ?? "—"}</strong> &nbsp;|&nbsp; Plan : <strong>${planRef}</strong></p>
    <table>
      <tr><th>Bénéficiaire</th><td>${demande.nomBeneficiaire}</td></tr>
      ${demande.matriculeBeneficiaire ? `<tr><th>Matricule</th><td>${demande.matriculeBeneficiaire}</td></tr>` : ""}
      <tr><th>Montant demandé</th><td>${demande.montantDemande.toLocaleString("fr-MR")} MRU</td></tr>
      <tr><th>Montant payé</th><td><strong>${(demande.montantPaye ?? 0).toLocaleString("fr-MR")} MRU</strong></td></tr>
      <tr><th>Date paiement</th><td>${new Date().toLocaleDateString("fr-MR")}</td></tr>
    </table>
    <div class="footer"><div class="sign">Directeur Financier</div><div class="sign">Bénéficiaire</div></div>
    </div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${demande.pieceReference ?? "piece"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleBeneficiaires = async (moyenId: number) => {
    if (expandedBenef[moyenId]) {
      setExpandedBenef(prev => ({ ...prev, [moyenId]: false }));
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/beneficiaires`);
      const data = await res.json();
      setBeneficiairesMap(prev => ({ ...prev, [moyenId]: data }));
    } catch { /* ignore */ }
    setExpandedBenef(prev => ({ ...prev, [moyenId]: true }));
  };

  // Closure state
  const [rapportCloture, setRapportCloture] = useState("");
  const [clotureFiles, setClotureFiles] = useState<Array<{ file: File; base64: string }>>([]);
  const [isClosing, setIsClosing] = useState(false);

  const loadMaterielData = async (moyenId: number) => {
    try {
      const [itemsRes, demandesRes] = await Promise.all([
        fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/materiel-items`),
        fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/materiel-demandes`),
      ]);
      const items = await itemsRes.json();
      const demandes = await demandesRes.json();
      setMaterielItemsMap(prev => ({ ...prev, [moyenId]: items }));
      setMaterielDemandesMap(prev => ({ ...prev, [moyenId]: demandes }));
    } catch { /* ignore */ }
  };

  const loadLocationData = async (moyenId: number) => {
    try {
      const [itemsRes, demandesRes] = await Promise.all([
        fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/location-items`),
        fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/location-demandes`),
      ]);
      const items = await itemsRes.json();
      const demandes = await demandesRes.json();
      setLocationItemsMap(prev => ({ ...prev, [moyenId]: items }));
      setLocationDemandesMap(prev => ({ ...prev, [moyenId]: demandes }));
    } catch { /* ignore */ }
  };

  // Auto-load specialist data based on role
  useEffect(() => {
    if (!currentUser || !moyens.length) return;
    const role = currentUser.role;
    if (role === "da" || role === "dcgai") {
      const materielMoyenIds = moyens.filter(m => m.categorie === "materiel").map(m => m.id);
      materielMoyenIds.forEach(mid => loadMaterielData(mid));
    }
    if (role === "dmg") {
      const locationMoyenIds = moyens.filter(m => m.categorie === "location").map(m => m.id);
      locationMoyenIds.forEach(mid => loadLocationData(mid));
    }
    if (role === "cad") {
      const carburantIds = moyens.filter(m => m.categorie === "carburant").map(m => m.id);
      carburantIds.forEach(mid => loadCarburantData(mid));
    }
    if (role === "dcgai" || role === "direction_financiere") {
      const DCATS = ["prime", "logement", "indemnite_journaliere", "logistique", "autres"];
      const depIds = moyens.filter(m => DCATS.includes(m.categorie)).map(m => m.id);
      depIds.forEach(mid => loadDepenseData(mid));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moyens.length, currentUser?.role]);

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

    // Client-side budget check (except logistique, materiel, outillage, accessoire)
    const CATS_DEPASSEMENT_OK = ["logistique", "materiel", "outillage", "accessoire"];
    const budget = Number(moyen.budget);
    if (!CATS_DEPASSEMENT_OK.includes(moyen.categorie ?? "") && val > budget) {
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

  const handleDemanderMateriel = async (moyenId: number) => {
    if (!currentUser) return;
    const selections = Object.entries(materielQtySels)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([itemIdStr, qty]) => {
        const itemId = Number(itemIdStr);
        const stockItem = (materielItemsMap[moyenId] ?? []).find(i => i.id === itemId);
        return stockItem ? { materielItemId: itemId, item: stockItem.item, quantiteDemandee: Number(qty) } : null;
      })
      .filter(Boolean) as Array<{ materielItemId: number; item: string; quantiteDemandee: number }>;

    if (selections.length === 0) return;
    setMaterielLoading(true);
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/materiel-demandes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdById: currentUser.id, items: selections }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erreur lors de la demande.");
        return;
      }
      setMaterielDemandeDialog(null);
      setMaterielQtySels({});
      await loadMaterielData(moyenId);
    } catch (e) {
      alert("Erreur réseau.");
    } finally {
      setMaterielLoading(false);
    }
  };

  const handleDATraiter = async () => {
    if (!daTraiterDialog || !currentUser) return;
    const { moyenId, demandeId, items } = daTraiterDialog;
    const enriched = items.map((item, i) => ({
      item: item.item,
      quantiteDemandee: item.quantiteDemandee,
      montantUnitaire: Number(daPrices[i] ?? 0),
    }));
    if (enriched.some(e => !e.montantUnitaire || e.montantUnitaire <= 0)) {
      alert("Veuillez saisir le montant unitaire pour tous les articles.");
      return;
    }
    setDaLoading(true);
    try {
      let decharge: { nom: string; mimeType: string; taille: number; data: string } | undefined;
      if (daDechargeFile) {
        decharge = {
          nom: daDechargeFile.name,
          mimeType: daDechargeFile.type,
          taille: daDechargeFile.size,
          data: await toBase64(daDechargeFile),
        };
      }
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/materiel-demandes/${demandeId}/da-soumettre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daUserId: currentUser.id, items: enriched, decharge }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erreur.");
        return;
      }
      setDaTraiterDialog(null);
      setDaPrices({});
      setDaDechargeFile(null);
      await loadMaterielData(moyenId);
    } catch { alert("Erreur réseau."); } finally { setDaLoading(false); }
  };

  const handleDcgaiValider = async (moyenId: number, demandeId: number) => {
    if (!currentUser) return;
    setDcgaiValidating(demandeId);
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/materiel-demandes/${demandeId}/dcgai-valider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dcgaiUserId: currentUser.id }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur."); return; }
      await Promise.all([loadMaterielData(moyenId), refetchMoyens()]);
    } catch { alert("Erreur réseau."); } finally { setDcgaiValidating(null); }
  };

  const downloadBon = (demande: { bonNumber: string | null; items: Array<{ item: string; quantiteDemandee: number; montantUnitaire?: number; montantTotal?: number }>; montantTotal: number | null }, planRef: string) => {
    const rows = demande.items.map(it => `<tr><td>${it.item}</td><td style="text-align:center">${it.quantiteDemandee}</td><td style="text-align:right">${it.montantUnitaire?.toLocaleString("fr-MR") ?? "—"} MRU</td><td style="text-align:right">${it.montantTotal?.toLocaleString("fr-MR") ?? "—"} MRU</td></tr>`).join("");
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bon de consommation ${demande.bonNumber ?? ""}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ddd;padding:8px;} th{background:#f0f0f0;} .total{font-weight:bold;} h1{font-size:18px;} p{font-size:13px;color:#555;}</style>
    </head><body><h1>Bon de Consommation Matériel</h1><p>Réf. Bon : <strong>${demande.bonNumber ?? "—"}</strong> — Plan : <strong>${planRef}</strong></p>
    <table><thead><tr><th>Article</th><th>Quantité</th><th>P.U.</th><th>Total</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr class="total"><td colspan="3" style="text-align:right">TOTAL</td><td style="text-align:right">${demande.montantTotal?.toLocaleString("fr-MR") ?? "—"} MRU</td></tr></tfoot></table>
    <p style="margin-top:30px">Date : ${new Date().toLocaleDateString("fr-MR")}</p></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${demande.bonNumber ?? "bon"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
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
  const canDemanderMoyen = (m: { categorie: string }) =>
    m.categorie === "prime"
      ? isOwnDirectionPlan && plan.statut === "cloture"
      : canDemanderExecution;

  const myRole = currentUser?.role ?? "";
  const isDcgai = myRole === "dcgai";
  const isDA = myRole === "da";
  const myCategories = Object.entries(CATEGORY_ROLE).filter(([, role]) => role === myRole).map(([cat]) => cat);
  const isFunctionalRole = myCategories.length > 0;
  const myMoyensAll = isFunctionalRole ? moyens.filter(m => myCategories.includes(m.categorie)) : [];
  // For DA: exclude materiel from normal saisir consommation (handled separately)
  const myMoyens = myMoyensAll.filter(m =>
    m.categorie !== "materiel" &&
    m.demandeStatus === "demandee" &&
    (m.categorie === "prime" ? plan.statut === "cloture" : plan.statut === "ouvert")
  );
  const canSaisirConsommation = isFunctionalRole && myMoyens.length > 0;
  // Materiel moyens in this plan (for DA and DCGAI panels)
  const materielMoyens = moyens.filter(m => m.categorie === "materiel");
  // Location moyens
  const isDMG = myRole === "dmg";
  const locationMoyens = moyens.filter(m => m.categorie === "location");
  const isCAD = myRole === "cad";
  const isDFC = myRole === "direction_financiere";
  const carburantMoyens = moyens.filter(m => m.categorie === "carburant");
  const depenseMoyens = moyens.filter(m => ["prime", "logement", "indemnite_journaliere", "logistique", "autres"].includes(m.categorie));

  const handleDemanderLocation = async (moyenId: number) => {
    if (!currentUser) return;
    const selections = Object.entries(locationJoursSels)
      .filter(([, jours]) => Number(jours) > 0)
      .map(([itemIdStr, jours]) => {
        const itemId = Number(itemIdStr);
        const item = (locationItemsMap[moyenId] ?? []).find(i => i.id === itemId);
        return { locationItemId: itemId, typeEngin: item?.typeEngin ?? "", nbJoursDemandes: Number(jours) };
      })
      .filter(s => s.typeEngin);
    if (!selections.length) return;
    setLocationDemLoading(true);
    try {
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/location-demandes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdById: currentUser.id, items: selections }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur"); return; }
      await loadLocationData(moyenId);
      setLocationDemandeDialog(null);
      setLocationJoursSels({});
    } catch { alert("Erreur réseau"); }
    finally { setLocationDemLoading(false); }
  };

  const handleDmgValider = async () => {
    if (!dmgValiderDialog || !currentUser) return;
    const { moyenId, demandeId, items } = dmgValiderDialog;
    const itemsMontants = items.map(it => ({
      ...it,
      montant: Number(dmgMontants[it.locationItemId]) || 0,
    }));
    setDmgLoading(true);
    try {
      let decharge: { nom: string; mimeType: string; taille: number; data: string } | undefined;
      if (dmgDechargeFile) {
        decharge = {
          nom: dmgDechargeFile.name,
          mimeType: dmgDechargeFile.type,
          taille: dmgDechargeFile.size,
          data: await toBase64(dmgDechargeFile),
        };
      }
      const res = await fetch(`${BASE_URL}api/plans/${id}/moyens/${moyenId}/location-demandes/${demandeId}/dmg-valider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dmgUserId: currentUser.id, itemsMontants, decharge }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Erreur"); return; }
      await Promise.all([loadLocationData(moyenId), refetchMoyens(), refetchPlan(), invalidatePlans()]);
      setDmgValiderDialog(null);
      setDmgMontants({});
      setDmgDechargeFile(null);
    } catch { alert("Erreur réseau"); }
    finally { setDmgLoading(false); }
  };

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
                    const moyenDecharge = attachments.find(a => a.moyenId === m.id && a.type !== "liste_materiel");
                    const listeMaterielAtt = attachments.find(a => a.moyenId === m.id && a.type === "liste_materiel");
                    const listeMaterielRows: Array<{ item: string; quantite: number }> =
                      (m as any).listeMaterielJson ? JSON.parse((m as any).listeMaterielJson) : [];
                    const isDemanderLoading = demandingMoyen === m.id;
                    return (
                      <React.Fragment key={m.id}>
                      <tr className={cn("hover:bg-muted/10", over ? "bg-destructive/5" : "")}>
                        <td className="px-5 py-4">
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", cat.color)}>
                            <Icon className="w-3.5 h-3.5" /> {cat.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-muted-foreground">{m.description}</div>
                          {m.categorie === "autres" && (m as any).autresDirectionId && (
                            <div className="text-xs text-blue-600 mt-0.5">
                              Direction : {directions.find(d => d.id === (m as any).autresDirectionId)?.nom ?? `ID ${(m as any).autresDirectionId}`}
                            </div>
                          )}
                          {m.categorie === "location" && (() => {
                            const locItems: Array<{ typeEngin: string; nbJours: number }> =
                              (m as any).listeMaterielJson ? JSON.parse((m as any).listeMaterielJson) : [];
                            return locItems.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {locItems.map((it, li) => (
                                  <span key={li} className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 rounded px-2 py-0.5 font-medium">
                                    🚗 {it.typeEngin} — {it.nbJours} j.
                                  </span>
                                ))}
                              </div>
                            ) : null;
                          })()}
                          {(m.categorie === "indemnite_journaliere" || m.categorie === "prime") && (
                            <button
                              className="text-xs text-primary underline mt-0.5 hover:text-primary/70 transition-colors"
                              onClick={() => toggleBeneficiaires(m.id)}
                            >
                              {expandedBenef[m.id] ? "Masquer" : "Voir"} bénéficiaires
                              {beneficiairesMap[m.id] ? ` (${beneficiairesMap[m.id].length})` : ""}
                            </button>
                          )}
                          {/* Liste matériel for materiel/outillage/accessoire */}
                          {["materiel","outillage","accessoire"].includes(m.categorie) && listeMaterielRows.length > 0 && (
                            <div className="mt-2">
                              <button
                                className="text-xs text-primary underline hover:text-primary/70 transition-colors"
                                onClick={() => setExpandedBenef(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                              >
                                {expandedBenef[m.id] ? "Masquer" : "Voir"} liste matériel ({listeMaterielRows.length} articles)
                              </button>
                              {listeMaterielAtt && (
                                <a
                                  href={`${BASE_URL}api/plans/${plan.id}/attachments/${listeMaterielAtt.id}/download`}
                                  download={listeMaterielAtt.nom}
                                  className="ml-3 text-xs text-green-700 underline hover:text-green-500"
                                >
                                  ↓ Télécharger Excel
                                </a>
                              )}
                              {expandedBenef[m.id] && (
                                <div className="mt-2 border rounded-lg overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/40">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">ITEM</th>
                                        <th className="px-2 py-1.5 text-center font-semibold text-muted-foreground">QTÉ</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {listeMaterielRows.map((r, ri) => (
                                        <tr key={ri} className="bg-white">
                                          <td className="px-2 py-1.5 font-medium">{r.item}</td>
                                          <td className="px-2 py-1.5 text-center text-muted-foreground font-semibold">{r.quantite}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                          {(m.categorie === "indemnite_journaliere" || m.categorie === "prime") && expandedBenef[m.id] && beneficiairesMap[m.id] && (
                            <div className="mt-2 border rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/40">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">NOM</th>
                                    <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">MATRIC.</th>
                                    <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground">NNI</th>
                                    <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">MONTANT</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {beneficiairesMap[m.id].length === 0 ? (
                                    <tr><td colSpan={4} className="px-2 py-2 text-center text-muted-foreground">Aucun bénéficiaire.</td></tr>
                                  ) : beneficiairesMap[m.id].map((b, bi) => (
                                    <tr key={bi} className="bg-white">
                                      <td className="px-2 py-1.5 font-medium">{b.nom}</td>
                                      <td className="px-2 py-1.5 text-muted-foreground">{b.matricule ?? "—"}</td>
                                      <td className="px-2 py-1.5 text-muted-foreground">{b.nni ?? "—"}</td>
                                      <td className="px-2 py-1.5 text-right font-semibold text-primary">{b.montant.toLocaleString("fr-MR")} MRU</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
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
                          {m.categorie === "materiel" ? (
                            canDemanderExecution ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={async () => {
                                  await loadMaterielData(m.id);
                                  setMaterielQtySels({});
                                  setMaterielDemandeDialog(m.id);
                                }}
                              >
                                <Package className="w-3 h-3" /> Dem. matériel
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )
                          ) : m.categorie === "location" ? (
                            canDemanderExecution ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 px-2 border-sky-300 text-sky-700 hover:bg-sky-50"
                                onClick={async () => {
                                  await loadLocationData(m.id);
                                  setLocationJoursSels({});
                                  setLocationDemandeDialog(m.id);
                                }}
                              >
                                🚗 Dem. location
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )
                          ) : m.categorie === "carburant" ? (
                            canDemanderExecution ? (
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs gap-1 px-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                                onClick={() => { setCarburantMontantInput(""); setCarburantDemandeDialog(m.id); }}
                              >
                                <Fuel className="w-3 h-3" /> Dem. carburant
                              </Button>
                            ) : <span className="text-muted-foreground text-xs">—</span>
                          ) : DEPENSE_CATS.includes(m.categorie) ? (
                            canDemanderExecution ? (
                              <Button
                                size="sm" variant="outline"
                                className="h-7 text-xs gap-1 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => { setDepenseMontantInput(""); setDepenseNomBenef(""); setDepenseMatricule(""); setDepenseDemandeDialog(m.id); }}
                              >
                                <DollarSign className="w-3 h-3" /> Dem. dépense
                              </Button>
                            ) : <span className="text-muted-foreground text-xs">—</span>
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
                      {/* Materiel demandes expandable sub-row */}
                      {m.categorie === "materiel" && isOwnDirectionPlan && (
                        <tr>
                          <td colSpan={7} className="bg-blue-50/40 px-5 py-2">
                            <button
                              className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-medium"
                              onClick={async () => {
                                if (!expandedMaterielMoyen[m.id]) await loadMaterielData(m.id);
                                setExpandedMaterielMoyen(prev => ({ ...prev, [m.id]: !prev[m.id] }));
                              }}
                            >
                              <Package className="w-3 h-3" />
                              {expandedMaterielMoyen[m.id] ? "Masquer" : "Voir"} les demandes matériel
                              {(materielDemandesMap[m.id] ?? []).length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-800 text-xs">{materielDemandesMap[m.id].length}</span>
                              )}
                            </button>
                            {expandedMaterielMoyen[m.id] && (
                              <div className="mt-2 space-y-2">
                                {(materielDemandesMap[m.id] ?? []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-1">Aucune demande matériel soumise.</p>
                                ) : (materielDemandesMap[m.id] ?? []).map(dem => (
                                  <div key={dem.id} className="border border-blue-200 rounded-lg bg-white p-3 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-blue-900">
                                        {dem.bonNumber ? `Bon : ${dem.bonNumber}` : `Demande #${dem.id}`}
                                      </span>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-xs font-medium",
                                        dem.statut === "validee" ? "bg-green-100 text-green-700" :
                                        dem.statut === "en_attente_dcgai" ? "bg-purple-100 text-purple-700" :
                                        "bg-orange-100 text-orange-700"
                                      )}>
                                        {dem.statut === "validee" ? "Validé" : dem.statut === "en_attente_dcgai" ? "Attente DCGAI" : "Attente DA"}
                                      </span>
                                    </div>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                      {dem.items.map((it, ii) => (
                                        <li key={ii}>{it.item} × {it.quantiteDemandee}{it.montantTotal ? ` — ${it.montantTotal.toLocaleString("fr-MR")} MRU` : ""}</li>
                                      ))}
                                    </ul>
                                    {dem.statut === "validee" && dem.montantTotal && (
                                      <div className="flex items-center justify-between pt-1">
                                        <span className="font-semibold text-success">Total : {dem.montantTotal.toLocaleString("fr-MR")} MRU</span>
                                        <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2" onClick={() => downloadBon(dem, plan.reference ?? `PLAN-${plan.id}`)}>
                                          <Download className="w-3 h-3" /> Bon
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      {/* Location demandes expandable sub-row */}
                      {m.categorie === "location" && isOwnDirectionPlan && (
                        <tr>
                          <td colSpan={7} className="bg-sky-50/40 px-5 py-2">
                            <button
                              className="flex items-center gap-1.5 text-xs text-sky-700 hover:text-sky-900 font-medium"
                              onClick={async () => {
                                if (!expandedLocationMoyen[m.id]) await loadLocationData(m.id);
                                setExpandedLocationMoyen(prev => ({ ...prev, [m.id]: !prev[m.id] }));
                              }}
                            >
                              🚗
                              {expandedLocationMoyen[m.id] ? "Masquer" : "Voir"} les demandes location
                              {(locationDemandesMap[m.id] ?? []).length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sky-200 text-sky-800 text-xs">{locationDemandesMap[m.id].length}</span>
                              )}
                            </button>
                            {expandedLocationMoyen[m.id] && (
                              <div className="mt-2 space-y-2">
                                {(locationDemandesMap[m.id] ?? []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-1">Aucune demande location soumise.</p>
                                ) : (locationDemandesMap[m.id] ?? []).map(dem => (
                                  <div key={dem.id} className="border border-sky-200 rounded-lg bg-white p-3 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-sky-900">Demande #{dem.id}</span>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-xs font-medium",
                                        dem.statut === "validee" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                      )}>
                                        {dem.statut === "validee" ? "Validée" : "Attente DMG"}
                                      </span>
                                    </div>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                      {dem.items.map((it, ii) => (
                                        <li key={ii}>{it.typeEngin} — {it.nbJoursDemandes} jour(s){it.montant ? ` — ${it.montant.toLocaleString("fr-MR")} MRU` : ""}</li>
                                      ))}
                                    </ul>
                                    {dem.statut === "validee" && dem.montantTotal && (
                                      <div className="pt-1 font-semibold text-success">Total : {dem.montantTotal.toLocaleString("fr-MR")} MRU</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      {/* Carburant demandes expandable sub-row */}
                      {m.categorie === "carburant" && isOwnDirectionPlan && (
                        <tr>
                          <td colSpan={7} className="bg-orange-50/40 px-5 py-2">
                            <button
                              className="flex items-center gap-1.5 text-xs text-orange-700 hover:text-orange-900 font-medium"
                              onClick={async () => {
                                if (!expandedCarburantMoyen[m.id]) await loadCarburantData(m.id);
                                setExpandedCarburantMoyen(prev => ({ ...prev, [m.id]: !prev[m.id] }));
                              }}
                            >
                              <Fuel className="w-3 h-3" />
                              {expandedCarburantMoyen[m.id] ? "Masquer" : "Voir"} les demandes carburant
                              {(carburantDemandesMap[m.id] ?? []).length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-200 text-orange-800 text-xs">{carburantDemandesMap[m.id].length}</span>
                              )}
                            </button>
                            {expandedCarburantMoyen[m.id] && (
                              <div className="mt-2 space-y-2">
                                {(carburantDemandesMap[m.id] ?? []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-1">Aucune demande carburant soumise.</p>
                                ) : (carburantDemandesMap[m.id] ?? []).map(dem => (
                                  <div key={dem.id} className="border border-orange-200 rounded-lg bg-white p-3 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-orange-900">Demande #{dem.id}</span>
                                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                                        dem.statut === "validee" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
                                        {dem.statut === "validee" ? "Validée CAD" : "Attente CAD"}
                                      </span>
                                    </div>
                                    <div className="text-muted-foreground">Montant demandé : <span className="font-semibold text-foreground">{dem.montantDemande.toLocaleString("fr-MR")} MRU</span></div>
                                    {dem.montantValide !== null && <div className="text-success font-semibold">Montant validé : {dem.montantValide.toLocaleString("fr-MR")} MRU</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      {/* Dépense demandes expandable sub-row */}
                      {DEPENSE_CATS.includes(m.categorie) && isOwnDirectionPlan && (
                        <tr>
                          <td colSpan={7} className="bg-emerald-50/40 px-5 py-2">
                            <button
                              className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-medium"
                              onClick={async () => {
                                if (!expandedDepenseMoyen[m.id]) await loadDepenseData(m.id);
                                setExpandedDepenseMoyen(prev => ({ ...prev, [m.id]: !prev[m.id] }));
                              }}
                            >
                              <DollarSign className="w-3 h-3" />
                              {expandedDepenseMoyen[m.id] ? "Masquer" : "Voir"} les demandes dépense
                              {(depenseDemandesMap[m.id] ?? []).length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-xs">{depenseDemandesMap[m.id].length}</span>
                              )}
                            </button>
                            {expandedDepenseMoyen[m.id] && (
                              <div className="mt-2 space-y-2">
                                {(depenseDemandesMap[m.id] ?? []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-1">Aucune demande dépense soumise.</p>
                                ) : (depenseDemandesMap[m.id] ?? []).map(dem => (
                                  <div key={dem.id} className="border border-emerald-200 rounded-lg bg-white p-3 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-emerald-900">Demande #{dem.id} — {dem.nomBeneficiaire}{dem.matriculeBeneficiaire ? ` (${dem.matriculeBeneficiaire})` : ""}</span>
                                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                                        dem.statut === "payee" ? "bg-green-100 text-green-700" :
                                        dem.statut === "en_attente_dfc" ? "bg-blue-100 text-blue-700" :
                                        "bg-orange-100 text-orange-700")}>
                                        {dem.statut === "payee" ? "Payée" : dem.statut === "en_attente_dfc" ? "Attente DFC" : "Attente DCGAI"}
                                      </span>
                                    </div>
                                    <div className="text-muted-foreground">Montant demandé : <span className="font-semibold text-foreground">{dem.montantDemande.toLocaleString("fr-MR")} MRU</span></div>
                                    {dem.statut === "payee" && <div className="text-success font-semibold">Montant payé : {(dem.montantPaye ?? 0).toLocaleString("fr-MR")} MRU — Réf : {dem.pieceReference}</div>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

          {/* DA — Materiel demandes panel */}
          {isDA && plan.statut === "ouvert" && materielMoyens.length > 0 && (
            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardHeader className="border-b border-indigo-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-indigo-800 font-bold">
                  <Package className="w-5 h-5" /> Bons de Consommation Matériel
                </CardTitle>
                <p className="text-xs text-indigo-700 mt-1">Traitez les demandes matériel de la direction en saisissant les prix unitaires.</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {materielMoyens.map(m => {
                  const pendingDemandes = (materielDemandesMap[m.id] ?? []).filter(d => d.statut === "en_attente_da");
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-xs font-semibold text-indigo-800">{m.description}</p>
                      {pendingDemandes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucune demande en attente.</p>
                      ) : pendingDemandes.map(dem => (
                        <div key={dem.id} className="border border-indigo-200 rounded-lg bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-indigo-700">Demande #{dem.id}</span>
                            <Button
                              size="sm"
                              className="h-6 text-xs gap-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                              onClick={() => {
                                setDaTraiterDialog({ moyenId: m.id, demandeId: dem.id, items: dem.items });
                                setDaPrices({});
                              }}
                            >
                              <FileText className="w-3 h-3" /> Traiter
                            </Button>
                          </div>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            {dem.items.map((it, ii) => <li key={ii}>{it.item} × {it.quantiteDemandee}</li>)}
                          </ul>
                        </div>
                      ))}
                      {!materielDemandesMap[m.id] && (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => loadMaterielData(m.id)}>
                          <Loader2 className="w-3 h-3 mr-1" /> Charger les demandes
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* DCGAI — Bons validation panel */}
          {isDcgai && materielMoyens.length > 0 && (
            <Card className="border-purple-200 bg-purple-50/40">
              <CardHeader className="border-b border-purple-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-purple-800 font-bold">
                  <ShieldCheck className="w-5 h-5" /> Validation Bons Matériel
                </CardTitle>
                <p className="text-xs text-purple-700 mt-1">Validez les bons de consommation générés par la DA.</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {materielMoyens.map(m => {
                  const pendingBons = (materielDemandesMap[m.id] ?? []).filter(d => d.statut === "en_attente_dcgai");
                  const validatedBons = (materielDemandesMap[m.id] ?? []).filter(d => d.statut === "validee");
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-xs font-semibold text-purple-800">{m.description}</p>
                      {!materielDemandesMap[m.id] ? (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => loadMaterielData(m.id)}>
                          <Loader2 className="w-3 h-3 mr-1" /> Charger
                        </Button>
                      ) : pendingBons.length === 0 && validatedBons.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun bon en attente.</p>
                      ) : null}
                      {pendingBons.map(dem => (
                        <div key={dem.id} className="border border-purple-200 rounded-lg bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-purple-800">{dem.bonNumber ?? `BON-${dem.id}`}</span>
                            <span className="text-xs font-bold text-primary">{dem.montantTotal?.toLocaleString("fr-MR") ?? "—"} MRU</span>
                          </div>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            {dem.items.map((it, ii) => (
                              <li key={ii}>{it.item} × {it.quantiteDemandee} — {it.montantUnitaire?.toLocaleString("fr-MR") ?? "—"} MRU/u</li>
                            ))}
                          </ul>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2" onClick={() => downloadBon(dem, plan.reference ?? `PLAN-${plan.id}`)}>
                              <Download className="w-3 h-3" /> Bon
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-xs gap-1 px-2 bg-purple-700 hover:bg-purple-800 text-white"
                              disabled={dcgaiValidating === dem.id}
                              onClick={() => handleDcgaiValider(m.id, dem.id)}
                            >
                              {dcgaiValidating === dem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Valider
                            </Button>
                          </div>
                        </div>
                      ))}
                      {validatedBons.map(dem => (
                        <div key={dem.id} className="border border-green-200 rounded-lg bg-green-50/40 p-2 flex items-center justify-between">
                          <span className="text-xs text-green-800 font-semibold">{dem.bonNumber} — {dem.montantTotal?.toLocaleString("fr-MR") ?? "—"} MRU</span>
                          <span className="text-xs text-green-700 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Validé</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* DMG — Location demandes panel */}
          {isDMG && plan.statut === "ouvert" && locationMoyens.length > 0 && (
            <Card className="border-sky-200 bg-sky-50/40">
              <CardHeader className="border-b border-sky-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-sky-800 font-bold">
                  🚗 Demandes Location Véhicule
                </CardTitle>
                <p className="text-xs text-sky-700 mt-1">Validez les demandes de location en saisissant le montant par engin.</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {locationMoyens.map(m => {
                  const pendingDemandes = (locationDemandesMap[m.id] ?? []).filter(d => d.statut === "en_attente_dmg");
                  const validatedDemandes = (locationDemandesMap[m.id] ?? []).filter(d => d.statut === "validee");
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-xs font-semibold text-sky-800">{m.description}</p>
                      {!locationDemandesMap[m.id] ? (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => loadLocationData(m.id)}>
                          <Loader2 className="w-3 h-3 mr-1" /> Charger
                        </Button>
                      ) : pendingDemandes.length === 0 && validatedDemandes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucune demande en attente.</p>
                      ) : null}
                      {pendingDemandes.map(dem => (
                        <div key={dem.id} className="border border-sky-200 rounded-lg bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-sky-700">Demande #{dem.id}</span>
                            <Button
                              size="sm"
                              className="h-6 text-xs gap-1 px-2 bg-sky-600 hover:bg-sky-700 text-white"
                              onClick={() => {
                                setDmgValiderDialog({ moyenId: m.id, demandeId: dem.id, items: dem.items });
                                setDmgMontants({});
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" /> Valider & Saisir montants
                            </Button>
                          </div>
                          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                            {dem.items.map((it, ii) => <li key={ii}>{it.typeEngin} — {it.nbJoursDemandes} jour(s)</li>)}
                          </ul>
                        </div>
                      ))}
                      {validatedDemandes.map(dem => (
                        <div key={dem.id} className="border border-green-200 rounded-lg bg-green-50/40 p-2 flex items-center justify-between">
                          <span className="text-xs text-green-800 font-semibold">Demande #{dem.id} — {dem.montantTotal?.toLocaleString("fr-MR") ?? "—"} MRU</span>
                          <span className="text-xs text-green-700 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Validée</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* CAD — Carburant demandes panel */}
          {isCAD && plan.statut === "ouvert" && carburantMoyens.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="border-b border-orange-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-orange-800 font-bold">
                  <Fuel className="w-4 h-4" /> Demandes Carburant à valider
                </CardTitle>
                <p className="text-xs text-orange-700 mt-1">Saisissez le montant accordé et joignez la décharge.</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {carburantMoyens.map(m => {
                  const pending = (carburantDemandesMap[m.id] ?? []).filter(d => d.statut === "en_attente_cad");
                  const validated = (carburantDemandesMap[m.id] ?? []).filter(d => d.statut === "validee");
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-xs font-semibold text-orange-800">{m.description}</p>
                      {!carburantDemandesMap[m.id] ? (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => loadCarburantData(m.id)}>
                          <Loader2 className="w-3 h-3 mr-1" /> Charger
                        </Button>
                      ) : pending.length === 0 && validated.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucune demande en attente.</p>
                      ) : null}
                      {pending.map(dem => (
                        <div key={dem.id} className="border border-orange-200 rounded-lg bg-white p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-orange-700">Demande #{dem.id} — {dem.montantDemande.toLocaleString("fr-MR")} MRU</span>
                            <Button size="sm" className="h-6 text-xs gap-1 px-2 bg-orange-600 hover:bg-orange-700 text-white"
                              onClick={() => { setCadValiderDialog({ moyenId: m.id, demandeId: dem.id, montantDemande: dem.montantDemande }); setCadMontantInput(""); setCadDechargeFile(null); }}>
                              <CheckCircle2 className="w-3 h-3" /> Valider
                            </Button>
                          </div>
                        </div>
                      ))}
                      {validated.map(dem => (
                        <div key={dem.id} className="border border-green-200 rounded-lg bg-green-50/40 p-2 flex items-center justify-between">
                          <span className="text-xs text-green-800 font-semibold">#{dem.id} — {dem.montantValide?.toLocaleString("fr-MR") ?? "—"} MRU validés</span>
                          <span className="text-xs text-green-700 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Validée</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* DCGAI — Dépenses à valider panel */}
          {isDcgai && plan.statut === "ouvert" && depenseMoyens.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardHeader className="border-b border-emerald-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-800 font-bold">
                  <DollarSign className="w-4 h-4" /> Demandes Dépenses à valider (DCGAI)
                </CardTitle>
                <p className="text-xs text-emerald-700 mt-1">Validez les demandes de dépense avant envoi à la DFC pour paiement.</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {depenseMoyens.map(m => {
                  const pending = (depenseDemandesMap[m.id] ?? []).filter(d => d.statut === "en_attente_dcgai");
                  const rest = (depenseDemandesMap[m.id] ?? []).filter(d => d.statut !== "en_attente_dcgai");
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-xs font-semibold text-emerald-800">{CATEGORIE_LABELS[m.categorie]?.label ?? m.categorie} — {m.description}</p>
                      {!depenseDemandesMap[m.id] ? (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => loadDepenseData(m.id)}>
                          <Loader2 className="w-3 h-3 mr-1" /> Charger
                        </Button>
                      ) : pending.length === 0 && rest.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucune demande.</p>
                      ) : null}
                      {pending.map(dem => (
                        <div key={dem.id} className="border border-emerald-200 rounded-lg bg-white p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-emerald-900">{dem.nomBeneficiaire}{dem.matriculeBeneficiaire ? ` — ${dem.matriculeBeneficiaire}` : ""}</p>
                              <p className="text-xs text-muted-foreground">Montant demandé : <span className="font-semibold text-foreground">{dem.montantDemande.toLocaleString("fr-MR")} MRU</span></p>
                            </div>
                            <Button size="sm" className="h-6 text-xs gap-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={dcgaiDepenseLoading === dem.id}
                              onClick={() => handleDcgaiDepenseValider(m.id, dem.id)}>
                              {dcgaiDepenseLoading === dem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Valider
                            </Button>
                          </div>
                        </div>
                      ))}
                      {rest.map(dem => (
                        <div key={dem.id} className="border rounded-lg bg-white/60 p-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{dem.nomBeneficiaire} — {dem.montantDemande.toLocaleString("fr-MR")} MRU</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium",
                            dem.statut === "payee" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>
                            {dem.statut === "payee" ? "Payée" : "En attente DFC"}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* DFC — Paiements à effectuer panel */}
          {isDFC && plan.statut === "ouvert" && depenseMoyens.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardHeader className="border-b border-blue-200/60 pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-blue-800 font-bold">
                  <DollarSign className="w-4 h-4" /> Paiements à effectuer (DFC)
                </CardTitle>
                <p className="text-xs text-blue-700 mt-1">Saisissez le montant payé et générez la pièce de paiement.</p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {depenseMoyens.map(m => {
                  const pending = (depenseDemandesMap[m.id] ?? []).filter(d => d.statut === "en_attente_dfc");
                  const paid = (depenseDemandesMap[m.id] ?? []).filter(d => d.statut === "payee");
                  return (
                    <div key={m.id} className="space-y-2">
                      <p className="text-xs font-semibold text-blue-800">{CATEGORIE_LABELS[m.categorie]?.label ?? m.categorie} — {m.description}</p>
                      {!depenseDemandesMap[m.id] ? (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => loadDepenseData(m.id)}>
                          <Loader2 className="w-3 h-3 mr-1" /> Charger
                        </Button>
                      ) : pending.length === 0 && paid.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Aucun paiement en attente.</p>
                      ) : null}
                      {pending.map(dem => (
                        <div key={dem.id} className="border border-blue-200 rounded-lg bg-white p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-blue-900">{dem.nomBeneficiaire}{dem.matriculeBeneficiaire ? ` — ${dem.matriculeBeneficiaire}` : ""}</p>
                              <p className="text-xs text-muted-foreground">Montant demandé : <span className="font-semibold text-foreground">{dem.montantDemande.toLocaleString("fr-MR")} MRU</span></p>
                            </div>
                            <Button size="sm" className="h-6 text-xs gap-1 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => { setDfcPayerDialog({ moyenId: m.id, demandeId: dem.id, demande: dem }); setDfcMontantInput(""); }}>
                              <DollarSign className="w-3 h-3" /> Saisir paiement
                            </Button>
                          </div>
                        </div>
                      ))}
                      {paid.map(dem => (
                        <div key={dem.id} className="border border-green-200 rounded-lg bg-green-50/40 p-2 flex items-center justify-between">
                          <span className="text-xs text-green-800 font-semibold">{dem.nomBeneficiaire} — {(dem.montantPaye ?? 0).toLocaleString("fr-MR")} MRU — {dem.pieceReference}</span>
                          <span className="text-xs text-green-700 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Payée</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Specialist waiting panel — has categories but no pending demands (exclude DA when only materiel moyens; exclude DMG when only location moyens) */}
          {isFunctionalRole && plan.statut === "ouvert" && myMoyensAll.length > 0 && myMoyens.length === 0
            && !(isDA && myMoyensAll.every(m => m.categorie === "materiel"))
            && !(isDMG && myMoyensAll.every(m => m.categorie === "location")) && (
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
                      {["logistique", "materiel", "outillage", "accessoire"].includes(m.categorie ?? "") && (
                        <p className="text-[11px] text-blue-600 italic">
                          ℹ️ Cette catégorie autorise le dépassement du budget prévu.
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

      {/* ─── Direction: Demande matériel dialog ─── */}
      <Dialog open={materielDemandeDialog !== null} onOpenChange={(open) => { if (!open) setMaterielDemandeDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-blue-600" /> Demander des articles du stock</DialogTitle>
            <DialogDescription>Sélectionnez les articles et indiquez les quantités souhaitées.</DialogDescription>
          </DialogHeader>
          {materielDemandeDialog !== null && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {(materielItemsMap[materielDemandeDialog] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun article disponible en stock.</p>
              ) : (materielItemsMap[materielDemandeDialog] ?? []).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.item}</p>
                    <p className="text-xs text-muted-foreground">Stock disponible : <span className="font-semibold text-primary">{item.quantiteRestante}</span></p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={item.quantiteRestante}
                    placeholder="0"
                    value={materielQtySels[item.id] ?? ""}
                    onChange={e => setMaterielQtySels(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-20 px-2 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-center"
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMaterielDemandeDialog(null)} disabled={materielLoading}>Annuler</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={materielLoading || !Object.values(materielQtySels).some(q => Number(q) > 0)}
              onClick={() => materielDemandeDialog !== null && handleDemanderMateriel(materielDemandeDialog)}
            >
              {materielLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DA: Traiter demande dialog ─── */}
      <Dialog open={!!daTraiterDialog} onOpenChange={(open) => { if (!open) { setDaTraiterDialog(null); setDaPrices({}); setDaDechargeFile(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600" /> Saisir les prix — Génération du bon</DialogTitle>
            <DialogDescription>Indiquez le montant unitaire pour chaque article afin de générer le bon de consommation.</DialogDescription>
          </DialogHeader>
          {daTraiterDialog && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {daTraiterDialog.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.item}</p>
                    <p className="text-xs text-muted-foreground">Quantité demandée : <span className="font-semibold">{item.quantiteDemandee}</span></p>
                  </div>
                  <div className="text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="P.U. MRU"
                      value={daPrices[i] ?? ""}
                      onChange={e => setDaPrices(prev => ({ ...prev, [i]: e.target.value }))}
                      className="w-28 px-2 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 text-right"
                    />
                    {daPrices[i] && Number(daPrices[i]) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Total : <span className="font-semibold text-primary">{(Number(daPrices[i]) * item.quantiteDemandee).toLocaleString("fr-MR")} MRU</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {daTraiterDialog.items.every((_, i) => daPrices[i] && Number(daPrices[i]) > 0) && (
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-sm font-semibold text-indigo-800 text-right">
                  TOTAL : {daTraiterDialog.items.reduce((s, item, i) => s + Number(daPrices[i] ?? 0) * item.quantiteDemandee, 0).toLocaleString("fr-MR")} MRU
                </div>
              )}
            </div>
          )}
          {/* Décharge upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-500" /> Décharge (facultatif)
            </label>
            <label className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${daDechargeFile ? "border-indigo-400 bg-indigo-50" : "border-border hover:border-indigo-300 bg-muted/30"}`}>
              <input type="file" className="hidden" onChange={e => setDaDechargeFile(e.target.files?.[0] ?? null)} />
              {daDechargeFile ? (
                <span className="text-sm text-indigo-700 font-medium truncate flex-1">📎 {daDechargeFile.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Cliquez pour joindre un fichier (PDF, image...)</span>
              )}
              {daDechargeFile && (
                <button type="button" className="text-xs text-red-500 hover:text-red-700 shrink-0" onClick={e => { e.preventDefault(); setDaDechargeFile(null); }}>✕</button>
              )}
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDaTraiterDialog(null); setDaPrices({}); setDaDechargeFile(null); }} disabled={daLoading}>Annuler</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={daLoading}
              onClick={handleDATraiter}
            >
              {daLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Générer le bon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Direction: Demande location dialog ─── */}
      <Dialog open={locationDemandeDialog !== null} onOpenChange={(open) => { if (!open) setLocationDemandeDialog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">🚗 Demander une location de véhicule</DialogTitle>
            <DialogDescription>Sélectionnez les engins et indiquez le nombre de jours souhaités (ne peut pas dépasser le disponible).</DialogDescription>
          </DialogHeader>
          {locationDemandeDialog !== null && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {(locationItemsMap[locationDemandeDialog] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun engin disponible.</p>
              ) : (locationItemsMap[locationDemandeDialog] ?? []).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">🚗 {item.typeEngin}</p>
                    <p className="text-xs text-muted-foreground">Jours disponibles : <span className="font-semibold text-primary">{item.nbJoursRestants}</span> / {item.nbJoursTotal}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={item.nbJoursRestants}
                    placeholder="0"
                    value={locationJoursSels[item.id] ?? ""}
                    onChange={e => setLocationJoursSels(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="w-20 px-2 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-center"
                  />
                  <span className="text-xs text-muted-foreground">j.</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLocationDemandeDialog(null)} disabled={locationDemLoading}>Annuler</Button>
            <Button
              className="bg-sky-600 hover:bg-sky-700 text-white"
              disabled={locationDemLoading || !Object.values(locationJoursSels).some(j => Number(j) > 0)}
              onClick={() => locationDemandeDialog !== null && handleDemanderLocation(locationDemandeDialog)}
            >
              {locationDemLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DMG: Valider demande location dialog ─── */}
      <Dialog open={!!dmgValiderDialog} onOpenChange={(open) => { if (!open) { setDmgValiderDialog(null); setDmgMontants({}); setDmgDechargeFile(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">🚗 Valider la demande — Saisir les montants</DialogTitle>
            <DialogDescription>Indiquez le montant total de location pour chaque engin demandé.</DialogDescription>
          </DialogHeader>
          {dmgValiderDialog && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {dmgValiderDialog.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">🚗 {item.typeEngin}</p>
                    <p className="text-xs text-muted-foreground">Durée : <span className="font-semibold">{item.nbJoursDemandes} jour(s)</span></p>
                  </div>
                  <div className="text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Montant MRU"
                      value={dmgMontants[item.locationItemId] ?? ""}
                      onChange={e => setDmgMontants(prev => ({ ...prev, [item.locationItemId]: e.target.value }))}
                      className="w-28 px-2 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">MRU</p>
                  </div>
                </div>
              ))}
              <div className="bg-sky-50 rounded-lg p-3 text-sm font-semibold text-sky-800 flex justify-between">
                <span>Total</span>
                <span>{Object.values(dmgMontants).reduce((s, v) => s + (Number(v) || 0), 0).toLocaleString("fr-MR")} MRU</span>
              </div>
            </div>
          )}
          {/* Décharge upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-500" /> Décharge (facultatif)
            </label>
            <label className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${dmgDechargeFile ? "border-sky-400 bg-sky-50" : "border-border hover:border-sky-300 bg-muted/30"}`}>
              <input type="file" className="hidden" onChange={e => setDmgDechargeFile(e.target.files?.[0] ?? null)} />
              {dmgDechargeFile ? (
                <span className="text-sm text-sky-700 font-medium truncate flex-1">📎 {dmgDechargeFile.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Cliquez pour joindre un fichier (PDF, image...)</span>
              )}
              {dmgDechargeFile && (
                <button type="button" className="text-xs text-red-500 hover:text-red-700 shrink-0" onClick={e => { e.preventDefault(); setDmgDechargeFile(null); }}>✕</button>
              )}
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDmgValiderDialog(null); setDmgMontants({}); setDmgDechargeFile(null); }} disabled={dmgLoading}>Annuler</Button>
            <Button
              className="bg-sky-600 hover:bg-sky-700 text-white"
              disabled={dmgLoading}
              onClick={handleDmgValider}
            >
              {dmgLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Valider & Déduire du budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Direction: Demande carburant dialog ─── */}
      <Dialog open={carburantDemandeDialog !== null} onOpenChange={(open) => { if (!open) { setCarburantDemandeDialog(null); setCarburantMontantInput(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Fuel className="w-5 h-5 text-orange-600" /> Demander du carburant</DialogTitle>
            <DialogDescription>Indiquez le montant souhaité (partiel ou total du budget).</DialogDescription>
          </DialogHeader>
          {carburantDemandeDialog !== null && (() => {
            const m = moyens.find(mo => mo.id === carburantDemandeDialog);
            return m ? (
              <div className="space-y-3">
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">{m.description}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Budget : {formatCurrency(Number(m.budget))} — Consommé : {formatCurrency(Number(m.montantConsomme ?? 0))}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Montant demandé (MRU)</label>
                  <input type="number" min={0} max={Number(m.budget)} step={0.01}
                    placeholder="Saisir le montant" value={carburantMontantInput}
                    onChange={e => setCarburantMontantInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>
            ) : null;
          })()}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setCarburantDemandeDialog(null); setCarburantMontantInput(""); }} disabled={carburantDemLoading}>Annuler</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={carburantDemLoading || !Number(carburantMontantInput) || Number(carburantMontantInput) <= 0}
              onClick={() => carburantDemandeDialog !== null && handleDemanderCarburant(carburantDemandeDialog)}>
              {carburantDemLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CAD: Valider demande carburant dialog ─── */}
      <Dialog open={!!cadValiderDialog} onOpenChange={(open) => { if (!open) { setCadValiderDialog(null); setCadMontantInput(""); setCadDechargeFile(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Fuel className="w-5 h-5 text-orange-600" /> Valider — Saisir le montant carburant</DialogTitle>
            <DialogDescription>Indiquez le montant accordé et joignez la décharge si disponible.</DialogDescription>
          </DialogHeader>
          {cadValiderDialog && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-orange-50 p-3 text-sm">
                <p className="text-orange-700">Montant demandé : <span className="font-bold">{cadValiderDialog.montantDemande.toLocaleString("fr-MR")} MRU</span></p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Montant validé (MRU)</label>
                <input type="number" min={0} step={0.01} placeholder="Montant accordé"
                  value={cadMontantInput} onChange={e => setCadMontantInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1.5"><FileText className="w-4 h-4 text-orange-500" /> Décharge (facultatif)</label>
                <label className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${cadDechargeFile ? "border-orange-400 bg-orange-50" : "border-border hover:border-orange-300 bg-muted/30"}`}>
                  <input type="file" className="hidden" onChange={e => setCadDechargeFile(e.target.files?.[0] ?? null)} />
                  {cadDechargeFile ? <span className="text-sm text-orange-700 font-medium truncate flex-1">📎 {cadDechargeFile.name}</span>
                    : <span className="text-sm text-muted-foreground">Cliquez pour joindre un fichier</span>}
                  {cadDechargeFile && <button type="button" className="text-xs text-red-500 shrink-0" onClick={e => { e.preventDefault(); setCadDechargeFile(null); }}>✕</button>}
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setCadValiderDialog(null); setCadMontantInput(""); setCadDechargeFile(null); }} disabled={cadLoading}>Annuler</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" disabled={cadLoading || !Number(cadMontantInput)} onClick={handleCadValider}>
              {cadLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Valider & Déduire du budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Direction: Demande dépense dialog ─── */}
      <Dialog open={depenseDemandeDialog !== null} onOpenChange={(open) => { if (!open) { setDepenseDemandeDialog(null); setDepenseMontantInput(""); setDepenseNomBenef(""); setDepenseMatricule(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-600" /> Demande de dépense</DialogTitle>
            <DialogDescription>Indiquez le montant et les informations du bénéficiaire.</DialogDescription>
          </DialogHeader>
          {depenseDemandeDialog !== null && (() => {
            const m = moyens.find(mo => mo.id === depenseDemandeDialog);
            return m ? (
              <div className="space-y-3">
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">{m.description}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Budget : {formatCurrency(Number(m.budget))} — Consommé : {formatCurrency(Number(m.montantConsomme ?? 0))}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Montant demandé (MRU)</label>
                  <input type="number" min={0} step={0.01} placeholder="Montant" value={depenseMontantInput}
                    onChange={e => setDepenseMontantInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nom du bénéficiaire <span className="text-destructive">*</span></label>
                  <input type="text" placeholder="Nom complet" value={depenseNomBenef}
                    onChange={e => setDepenseNomBenef(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Matricule (facultatif)</label>
                  <input type="text" placeholder="Matricule agent" value={depenseMatricule}
                    onChange={e => setDepenseMatricule(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>
            ) : null;
          })()}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDepenseDemandeDialog(null); setDepenseMontantInput(""); setDepenseNomBenef(""); setDepenseMatricule(""); }} disabled={depenseDemLoading}>Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={depenseDemLoading || !Number(depenseMontantInput) || !depenseNomBenef.trim()}
              onClick={() => depenseDemandeDialog !== null && handleDemanderDepense(depenseDemandeDialog)}>
              {depenseDemLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Envoyer au DCGAI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DFC: Saisir paiement dialog ─── */}
      <Dialog open={!!dfcPayerDialog} onOpenChange={(open) => { if (!open) { setDfcPayerDialog(null); setDfcMontantInput(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-600" /> Saisir le paiement</DialogTitle>
            <DialogDescription>Indiquez le montant réellement payé. Une pièce de paiement sera générée automatiquement.</DialogDescription>
          </DialogHeader>
          {dfcPayerDialog && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-blue-50 p-3 text-sm space-y-1">
                <p className="font-semibold text-blue-900">{dfcPayerDialog.demande.nomBeneficiaire}</p>
                {dfcPayerDialog.demande.matriculeBeneficiaire && <p className="text-xs text-muted-foreground">Matricule : {dfcPayerDialog.demande.matriculeBeneficiaire}</p>}
                <p className="text-xs text-muted-foreground">Montant demandé : <span className="font-semibold text-foreground">{dfcPayerDialog.demande.montantDemande.toLocaleString("fr-MR")} MRU</span></p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Montant payé (MRU)</label>
                <input type="number" min={0} step={0.01} placeholder="Montant effectivement payé"
                  value={dfcMontantInput} onChange={e => setDfcMontantInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDfcPayerDialog(null); setDfcMontantInput(""); }} disabled={dfcLoading}>Annuler</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={dfcLoading || !Number(dfcMontantInput)} onClick={handleDfcPayer}>
              {dfcLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Enregistrer & Générer la pièce
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
