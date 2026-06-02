import React, { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  Fuel, Package, Truck, CreditCard, ExternalLink, Trash2,
  Clock, CheckCircle2, ChevronDown, ChevronUp, Search, RefreshCw, AlertTriangle,
  Users, Layers, FileWarning, Download,
} from "lucide-react";
import { cn, fmtMRU } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/somelec-plans/";

export const DEMANDES_ROLES = [
  "cad", "da", "dmg", "dcgai", "direction_financiere",
  "admin", "dga", "directeur_general", "controle_technique",
];

const READ_ONLY_ROLES = ["dga", "directeur_general", "controle_technique"];
const ADMIN_ROLES = ["admin"];

interface DemandeItem {
  type: "carburant" | "materiel" | "location" | "depense";
  id: number;
  batchRef: string | null;
  isBatch: boolean;
  nbBeneficiaires?: number;
  nbItems?: number;
  planId: number;
  planReference: string | null;
  planTitre: string;
  directionNom: string;
  moyenId: number;
  moyenDescription: string;
  moyenCategorie: string;
  statut: string;
  montant: number | null;
  montantValide?: number | null;
  montantPaye?: number | null;
  nomBeneficiaire?: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; border: string }> = {
  carburant: { label: "Carburant", icon: Fuel, bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  materiel:  { label: "Matériel",  icon: Package, bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  location:  { label: "Location",  icon: Truck, bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  depense:   { label: "Dépense",   icon: CreditCard, bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

const STATUT_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  en_attente_cad:   { label: "En attente CAD",   bg: "bg-amber-100",   text: "text-amber-800",   icon: Clock },
  en_attente_da:    { label: "En attente DA",     bg: "bg-amber-100",   text: "text-amber-800",   icon: Clock },
  en_attente_dmg:   { label: "En attente DMG",    bg: "bg-amber-100",   text: "text-amber-800",   icon: Clock },
  en_attente_dcgai: { label: "En attente DCGAI",  bg: "bg-blue-100",    text: "text-blue-800",    icon: Clock },
  en_attente_dfc:           { label: "En attente DFC",        bg: "bg-purple-100",  text: "text-purple-800",  icon: Clock },
  en_attente_justificatif:  { label: "Attente justificatif",  bg: "bg-amber-100",   text: "text-amber-800",   icon: FileWarning },
  validee:                  { label: "Validée",               bg: "bg-green-100",   text: "text-green-800",   icon: CheckCircle2 },
  payee:                    { label: "Payée",                 bg: "bg-green-100",   text: "text-green-800",   icon: CheckCircle2 },
};

const PENDING_STATUTS = ["en_attente_cad", "en_attente_da", "en_attente_dmg", "en_attente_dcgai", "en_attente_dfc", "en_attente_justificatif"];
const DONE_STATUTS = ["validee", "payee"];

const CATEGORIE_LABELS: Record<string, string> = {
  prime: "Prime", logement: "Logement", indemnite_journaliere: "Indemnité journalière",
  logistique: "Logistique", autres: "Autres", carburant: "Carburant",
  materiel: "Matériel", location: "Location",
};

function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CONFIG[statut] ?? { label: statut, bg: "bg-gray-100", text: "text-gray-700", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, icon: Layers, bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.bg, cfg.text, cfg.border)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function DeleteConfirmDialog({ item, onConfirm, onCancel, loading }: {
  item: DemandeItem;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Supprimer la demande ?</h2>
            <p className="text-sm text-gray-500">Cette action est irréversible.</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm text-gray-700 space-y-1">
          <div><span className="font-medium">Plan :</span> {item.planReference ?? `#${item.planId}`} — {item.planTitre}</div>
          <div><span className="font-medium">Type :</span> {TYPE_CONFIG[item.type]?.label ?? item.type}</div>
          <div><span className="font-medium">Statut :</span> {STATUT_CONFIG[item.statut]?.label ?? item.statut}</div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemandesDashboard() {
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"demandes" | "justificatifs">("demandes");
  const [filterStatut, setFilterStatut] = useState<"all" | "pending" | "done">("pending");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"createdAt" | "statut" | "type" | "planReference">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [deleteTarget, setDeleteTarget] = useState<DemandeItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: demandes = [], isLoading, error, refetch } = useQuery<DemandeItem[]>({
    queryKey: ["demandes-globales"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/demandes-globales`);
      if (!res.ok) throw new Error("Erreur chargement");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const isDFCOrAdmin = currentUser?.role === "direction_financiere" || ADMIN_ROLES.includes(currentUser?.role ?? "");

  interface NonJustifieeItem {
    id: number; planId: number; moyenId: number; batchRef: string | null;
    nomBeneficiaire: string; matriculeBeneficiaire: string | null;
    montantDemande: number; montantPaye: number | null; pieceReference: string | null;
    dfcValidatedAt: string | null; createdAt: string;
    planReference: string | null; planTitre: string | null;
    directionNom: string | null; moyenDescription: string | null; moyenCategorie: string | null;
  }

  const { data: nonJustifiees = [], isLoading: njLoading, refetch: njRefetch } = useQuery<NonJustifieeItem[]>({
    queryKey: ["depenses-non-justifiees"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}api/depenses/non-justifiees`);
      if (!res.ok) throw new Error("Erreur chargement");
      return res.json();
    },
    enabled: isDFCOrAdmin,
    refetchInterval: 60_000,
  });

  if (!currentUser || !DEMANDES_ROLES.includes(currentUser.role)) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Accès non autorisé.
      </div>
    );
  }

  const isReadOnly = READ_ONLY_ROLES.includes(currentUser.role);
  const isAdmin = ADMIN_ROLES.includes(currentUser.role);

  const roleTypeFilter = (() => {
    switch (currentUser.role) {
      case "cad": return ["carburant"];
      case "da": return ["materiel"];
      case "dmg": return ["location"];
      case "dcgai": return ["depense"];
      case "direction_financiere": return ["depense"];
      default: return ["carburant", "materiel", "location", "depense"];
    }
  })();

  const roleStatutFilter = (() => {
    if (currentUser.role === "dcgai") return ["en_attente_dcgai"];
    if (currentUser.role === "direction_financiere") return ["en_attente_dfc"];
    return null;
  })();

  const filtered = demandes.filter(d => {
    if (!roleTypeFilter.includes(d.type)) return false;
    if (roleStatutFilter && filterStatut === "pending" && !roleStatutFilter.includes(d.statut)) {
      if (!PENDING_STATUTS.includes(d.statut)) return false;
    }
    if (filterStatut === "pending" && !PENDING_STATUTS.includes(d.statut)) return false;
    if (filterStatut === "done" && !DONE_STATUTS.includes(d.statut)) return false;
    if (filterType !== "all" && d.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !d.planTitre.toLowerCase().includes(q) &&
        !(d.planReference ?? "").toLowerCase().includes(q) &&
        !d.directionNom.toLowerCase().includes(q) &&
        !d.moyenDescription.toLowerCase().includes(q) &&
        !(d.nomBeneficiaire ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va: string | number = "";
    let vb: string | number = "";
    if (sortField === "createdAt") { va = a.createdAt; vb = b.createdAt; }
    else if (sortField === "statut") { va = a.statut; vb = b.statut; }
    else if (sortField === "type") { va = a.type; vb = b.type; }
    else if (sortField === "planReference") { va = a.planReference ?? ""; vb = b.planReference ?? ""; }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const pendingCount = demandes.filter(d => {
    if (!roleTypeFilter.includes(d.type)) return false;
    if (roleStatutFilter) return roleStatutFilter.includes(d.statut);
    return PENDING_STATUTS.includes(d.statut);
  }).length;

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      let url = "";
      if (deleteTarget.type === "carburant") url = `${BASE_URL}api/admin/demandes/carburant/${deleteTarget.id}`;
      else if (deleteTarget.type === "materiel") url = `${BASE_URL}api/admin/demandes/materiel/${deleteTarget.id}`;
      else if (deleteTarget.type === "location") url = `${BASE_URL}api/admin/demandes/location/${deleteTarget.id}`;
      else if (deleteTarget.type === "depense") {
        if (deleteTarget.isBatch && deleteTarget.batchRef) {
          url = `${BASE_URL}api/admin/demandes/depense-batch/${deleteTarget.batchRef}`;
        } else {
          url = `${BASE_URL}api/admin/demandes/depense/${deleteTarget.id}`;
        }
      }
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error ?? "Erreur lors de la suppression.");
        return;
      }
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["demandes-globales"] });
    } catch {
      alert("Erreur réseau.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const availableTypes = roleTypeFilter.length > 1 ? roleTypeFilter : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Tableau des Demandes
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vue centralisée de toutes les demandes en attente de traitement
          </p>
        </div>
        <button
          onClick={() => activeTab === "demandes" ? refetch() : njRefetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
        >
          <RefreshCw className={cn("w-4 h-4", (isLoading || njLoading) && "animate-spin")} />
          Actualiser
        </button>
      </div>

      {/* DFC tabs */}
      {isDFCOrAdmin && (
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm w-fit">
          <button
            onClick={() => setActiveTab("demandes")}
            className={cn("px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2",
              activeTab === "demandes" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <CreditCard className="w-4 h-4" /> Demandes
          </button>
          <button
            onClick={() => setActiveTab("justificatifs")}
            className={cn("px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2",
              activeTab === "justificatifs" ? "bg-amber-600 text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <FileWarning className="w-4 h-4" />
            Justificatifs en attente
            {nonJustifiees.length > 0 && (
              <span className={cn("inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-xs font-bold",
                activeTab === "justificatifs" ? "bg-white text-amber-700" : "bg-amber-500 text-white"
              )}>
                {nonJustifiees.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Justificatifs tab — DFC only */}
      {isDFCOrAdmin && activeTab === "justificatifs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              {nonJustifiees.length === 0
                ? "Aucune dépense en attente de justificatif."
                : `${nonJustifiees.length} dépense(s) payée(s) sans justificatif.`}
            </p>
            <a
              href={`${BASE_URL}api/depenses/non-justifiees/excel`}
              download
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Télécharger Excel
            </a>
          </div>

          {njLoading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              Chargement…
            </div>
          ) : nonJustifiees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-gray-300" />
              <p className="text-sm font-medium">Toutes les dépenses ont un justificatif</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-200">
                      <th className="text-left px-4 py-3 font-semibold text-amber-800">Plan</th>
                      <th className="text-left px-4 py-3 font-semibold text-amber-800 hidden md:table-cell">Direction</th>
                      <th className="text-left px-4 py-3 font-semibold text-amber-800 hidden lg:table-cell">Catégorie / Moyen</th>
                      <th className="text-left px-4 py-3 font-semibold text-amber-800">Bénéficiaire</th>
                      <th className="text-right px-4 py-3 font-semibold text-amber-800 hidden sm:table-cell">Montant payé</th>
                      <th className="text-left px-4 py-3 font-semibold text-amber-800 hidden md:table-cell">Réf. pièce</th>
                      <th className="text-left px-4 py-3 font-semibold text-amber-800 hidden md:table-cell">Date paiement</th>
                      <th className="text-right px-4 py-3 font-semibold text-amber-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nonJustifiees.map((item, idx) => (
                      <tr key={`nj-${item.id}-${idx}`} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{item.planReference ?? `Plan #${item.planId}`}</div>
                          <div className="text-xs text-gray-500 max-w-40 truncate">{item.planTitre ?? ""}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{item.directionNom ?? "—"}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="text-xs text-gray-700">{CATEGORIE_LABELS[item.moyenCategorie ?? ""] ?? item.moyenCategorie ?? "—"}</div>
                          <div className="text-xs text-gray-400 truncate max-w-36">{item.moyenDescription ?? ""}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{item.nomBeneficiaire}</div>
                          {item.matriculeBeneficiaire && <div className="text-xs text-gray-400">{item.matriculeBeneficiaire}</div>}
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className="font-semibold text-gray-900">{(item.montantPaye ?? 0).toLocaleString("fr-FR")}</span>
                          <span className="text-xs text-gray-400 ml-1">MRU</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">{item.pieceReference ?? "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 whitespace-nowrap">
                          {item.dfcValidatedAt ? new Date(item.dfcValidatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/plans/${item.planId}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ouvrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                {nonJustifiees.length} dépense(s) non justifiée(s) — montant total payé :{" "}
                <strong className="text-gray-700">
                  {nonJustifiees.reduce((s, r) => s + (r.montantPaye ?? 0), 0).toLocaleString("fr-FR")} MRU
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main demandes tab */}
      {(!isDFCOrAdmin || activeTab === "demandes") && (<>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
          {(["all", "pending", "done"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatut(f)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                filterStatut === f ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {f === "all" ? "Toutes" : f === "pending" ? "En attente" : "Traitées"}
            </button>
          ))}
        </div>

        {availableTypes.length > 1 && (
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => setFilterType("all")}
              className={cn("px-3 py-2 text-sm font-medium transition-colors", filterType === "all" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50")}
            >
              Tous types
            </button>
            {availableTypes.map(t => {
              const cfg = TYPE_CONFIG[t];
              const Icon = cfg?.icon;
              return (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={cn("px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1", filterType === t ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50")}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {cfg?.label ?? t}
                </button>
              );
            })}
          </div>
        )}

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher plan, direction, moyen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Chargement des demandes…
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-40 gap-3 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          Erreur de chargement. <button onClick={() => refetch()} className="underline">Réessayer</button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <CheckCircle2 className="w-10 h-10 text-gray-300" />
          <p className="text-sm font-medium">
            {filterStatut === "pending" ? "Aucune demande en attente" : "Aucune demande trouvée"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">
                    <button className="flex items-center gap-1 hover:text-gray-900" onClick={() => handleSort("type")}>
                      Type <SortIcon field="type" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    <button className="flex items-center gap-1 hover:text-gray-900" onClick={() => handleSort("planReference")}>
                      Plan <SortIcon field="planReference" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Direction</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Moyen / Catégorie</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Montant</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">
                    <button className="flex items-center gap-1 hover:text-gray-900" onClick={() => handleSort("createdAt")}>
                      Date <SortIcon field="createdAt" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    <button className="flex items-center gap-1 hover:text-gray-900" onClick={() => handleSort("statut")}>
                      Statut <SortIcon field="statut" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((item, idx) => (
                  <tr key={`${item.type}-${item.id}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <TypeBadge type={item.type} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {item.planReference ?? `Plan #${item.planId}`}
                      </div>
                      <div className="text-xs text-gray-500 max-w-48 truncate">{item.planTitre}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs max-w-36 truncate">
                      {item.directionNom}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-gray-700 max-w-40 truncate text-xs">{item.moyenDescription}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {CATEGORIE_LABELS[item.moyenCategorie] ?? item.moyenCategorie}
                        {item.isBatch && item.nbBeneficiaires && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-violet-600">
                            <Users className="w-3 h-3" />{item.nbBeneficiaires} bénéf.
                          </span>
                        )}
                        {item.nbItems != null && item.nbItems > 0 && (
                          <span className="ml-1 text-blue-600">{item.nbItems} article(s)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {item.montant != null ? (
                        <div className="font-semibold text-gray-900">
                          {item.montant.toLocaleString("fr-FR")} <span className="text-xs font-normal text-gray-400">MRU</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                      {item.montantValide != null && item.statut === "validee" && (
                        <div className="text-xs text-green-600">Validé : {item.montantValide.toLocaleString("fr-FR")}</div>
                      )}
                      {item.montantPaye != null && item.statut === "payee" && (
                        <div className="text-xs text-green-600">Payé : {item.montantPaye.toLocaleString("fr-FR")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <StatutBadge statut={item.statut} />
                      {item.nomBeneficiaire && !item.isBatch && (
                        <div className="text-xs text-gray-400 mt-0.5 max-w-28 truncate">{item.nomBeneficiaire}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/plans/${item.planId}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ouvrir
                        </button>
                        {isAdmin && PENDING_STATUTS.includes(item.statut) && (
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
            <span>{sorted.length} demande(s) affichée(s)</span>
            <span>Total en attente : <strong className="text-gray-700">{pendingCount}</strong></span>
          </div>
        </div>
      )}
      </>)}

      {deleteTarget && (
        <DeleteConfirmDialog
          item={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
