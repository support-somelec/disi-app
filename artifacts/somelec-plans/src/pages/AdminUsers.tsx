import React, { useState } from "react";
import {
  useGetUsers, useUpdateUser, useDeleteUser,
  useGetDirections, useCreateDirection, useUpdateDirection, useDeleteDirection,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useAuth, ROLE_LABELS } from "@/lib/auth-context";
import { useLocation } from "wouter";
import {
  Pencil, Trash2, X, Check, Loader2, Search, UserPlus, Shield,
  Building2, Plus, AlertTriangle, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_ROLES = [
  "en_attente",
  "direction",
  "controle_technique",
  "dga",
  "directeur_general",
  "dmg",
  "da",
  "controle_financier",
  "dcgai",
  "direction_financiere",
  "cad",
  "rh",
  "admin",
];

const ROLES_WITH_DIRECTION = ["direction", "direction_financiere", "dga", "directeur_general", "controle_technique"];

const ROLE_COLOR: Record<string, string> = {
  en_attente:          "bg-amber-100 text-amber-700 border border-amber-200",
  directeur_general:   "bg-purple-100 text-purple-700",
  dga:                 "bg-indigo-100 text-indigo-700",
  controle_technique:  "bg-amber-100 text-amber-700",
  direction:           "bg-blue-100 text-blue-700",
  dmg:                 "bg-cyan-100 text-cyan-700",
  da:                  "bg-teal-100 text-teal-700",
  controle_financier:  "bg-orange-100 text-orange-700",
  dcgai:               "bg-violet-100 text-violet-700",
  direction_financiere:"bg-emerald-100 text-emerald-700",
  cad:                 "bg-yellow-100 text-yellow-700",
  rh:                  "bg-pink-100 text-pink-700",
  admin:               "bg-rose-100 text-rose-700",
};

interface UserEditState {
  userId: number;
  role: string;
  directionId: number | null;
  niveau: string;
}

interface DirEditState {
  id: number | null;
  nom: string;
  code: string;
}

type Tab = "utilisateurs" | "directions";

export default function AdminUsers() {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const { data: users, refetch: refetchUsers } = useGetUsers();
  const { data: directions, refetch: refetchDirs } = useGetDirections();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const createDirection = useCreateDirection();
  const updateDirection = useUpdateDirection();
  const deleteDirection = useDeleteDirection();

  const [tab, setTab] = useState<Tab>("utilisateurs");
  const [search, setSearch] = useState("");
  const [userEdit, setUserEdit] = useState<UserEditState | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<number | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState<number | null>(null);

  const [dirEdit, setDirEdit] = useState<DirEditState | null>(null);
  const [confirmDeleteDir, setConfirmDeleteDir] = useState<number | null>(null);
  const [savingDir, setSavingDir] = useState(false);
  const [deletingDir, setDeletingDir] = useState<number | null>(null);
  const [dirError, setDirError] = useState("");

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  const filtered = (users ?? []).filter(u => {
    const q = search.toLowerCase();
    return (
      u.prenom.toLowerCase().includes(q) ||
      u.nom.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (ROLE_LABELS[u.role] ?? u.role).toLowerCase().includes(q)
    );
  });

  const pendingCount = (users ?? []).filter(u => u.role === "en_attente").length;

  /* ── User handlers ── */
  const handleUserEdit = (user: User) => {
    setUserEdit({ userId: user.id, role: user.role, directionId: user.directionId ?? null, niveau: user.niveau ?? "standard" });
    setConfirmDeleteUser(null);
  };

  const handleUserSave = async () => {
    if (!userEdit) return;
    setSavingUser(true);
    try {
      await updateUser.mutateAsync({ id: userEdit.userId, data: { role: userEdit.role, directionId: userEdit.directionId, niveau: userEdit.niveau } });
      await refetchUsers();
      setUserEdit(null);
    } finally {
      setSavingUser(false);
    }
  };

  const handleUserDelete = async (id: number) => {
    setDeletingUser(id);
    try {
      await deleteUser.mutateAsync({ id });
      await refetchUsers();
      setConfirmDeleteUser(null);
    } finally {
      setDeletingUser(null);
    }
  };

  /* ── Direction handlers ── */
  const handleDirSave = async () => {
    if (!dirEdit) return;
    setDirError("");
    if (!dirEdit.nom.trim() || !dirEdit.code.trim()) { setDirError("Le nom et le code sont obligatoires."); return; }
    setSavingDir(true);
    try {
      if (dirEdit.id === null) {
        await createDirection.mutateAsync({ data: { nom: dirEdit.nom.trim(), code: dirEdit.code.trim().toUpperCase() } });
      } else {
        await updateDirection.mutateAsync({ id: dirEdit.id, data: { nom: dirEdit.nom.trim(), code: dirEdit.code.trim().toUpperCase() } });
      }
      await refetchDirs();
      setDirEdit(null);
    } catch {
      setDirError("Erreur lors de l'enregistrement.");
    } finally {
      setSavingDir(false);
    }
  };

  const handleDirDelete = async (id: number) => {
    setDeletingDir(id);
    try {
      await deleteDirection.mutateAsync({ id });
      await refetchDirs();
      setConfirmDeleteDir(null);
    } finally {
      setDeletingDir(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administration</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des utilisateurs et des directions</p>
        </div>
        {tab === "utilisateurs" && (
          <button
            onClick={() => navigate("/register")}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un utilisateur
          </button>
        )}
        {tab === "directions" && (
          <button
            onClick={() => { setDirEdit({ id: null, nom: "", code: "" }); setDirError(""); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Ajouter une direction
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        <button
          onClick={() => setTab("utilisateurs")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "utilisateurs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Shield className="h-4 w-4" />
          Utilisateurs
          {pendingCount > 0 && (
            <span className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab("directions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "directions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="h-4 w-4" />
          Directions
          <span className="ml-1 text-xs text-muted-foreground">({directions?.length ?? 0})</span>
        </button>
      </div>

      {/* ══════════════ ONGLET UTILISATEURS ══════════════ */}
      {tab === "utilisateurs" && (
        <>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <span><strong>{pendingCount}</strong> compte{pendingCount > 1 ? "s" : ""} en attente d'affectation de rôle.</span>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email ou rôle…"
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">E-mail</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Rôle</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Direction</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Niveau</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">Aucun utilisateur trouvé.</td>
                  </tr>
                )}
                {filtered.map(user => {
                  const isEditing = userEdit?.userId === user.id;
                  const isCurrentUser = user.id === currentUser?.id;
                  const isPending = user.role === "en_attente";

                  return (
                    <tr key={user.id} className={cn("hover:bg-muted/30 transition-colors", isEditing && "bg-blue-50/50", isPending && !isEditing && "bg-amber-50/40")}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{user.prenom} {user.nom}</div>
                        {isCurrentUser && <span className="text-[10px] text-muted-foreground">(vous)</span>}
                        {isPending && !isCurrentUser && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                            <Clock className="h-3 w-3" /> Rôle non affecté
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={userEdit.role}
                            onChange={e => setUserEdit(s => s ? { ...s, role: e.target.value, directionId: ROLES_WITH_DIRECTION.includes(e.target.value) ? s.directionId : null } : null)}
                            className="px-2 py-1 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full max-w-[220px]"
                          >
                            {ALL_ROLES.map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", ROLE_COLOR[user.role] ?? "bg-gray-100 text-gray-700")}>
                            {isPending ? <Clock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                            {ROLE_LABELS[user.role] ?? user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {isEditing && ROLES_WITH_DIRECTION.includes(userEdit.role) ? (
                          <select
                            value={userEdit.directionId ?? ""}
                            onChange={e => setUserEdit(s => s ? { ...s, directionId: e.target.value ? Number(e.target.value) : null } : null)}
                            className="px-2 py-1 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full max-w-[220px]"
                          >
                            <option value="">— Aucune —</option>
                            {directions?.map(d => (
                              <option key={d.id} value={d.id}>{d.nom}</option>
                            ))}
                          </select>
                        ) : (
                          user.directionNom ?? <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {isEditing ? (
                          <select
                            value={userEdit.niveau}
                            onChange={e => setUserEdit(s => s ? { ...s, niveau: e.target.value } : null)}
                            className="px-2 py-1 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full max-w-[180px]"
                          >
                            <option value="standard">Standard</option>
                            <option value="directeur_centrale">Directeur Centrale</option>
                          </select>
                        ) : (
                          user.niveau === "directeur_centrale"
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Dir. Centrale</span>
                            : <span className="text-muted-foreground/50 text-xs">Standard</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button onClick={handleUserSave} disabled={savingUser}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-60">
                                {savingUser ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Enregistrer
                              </button>
                              <button onClick={() => setUserEdit(null)}
                                className="flex items-center gap-1 px-3 py-1.5 border border-border hover:bg-muted rounded-md text-xs font-medium transition-colors">
                                <X className="h-3 w-3" /> Annuler
                              </button>
                            </>
                          ) : confirmDeleteUser === user.id ? (
                            <>
                              <span className="text-xs text-red-600 font-medium">Confirmer ?</span>
                              <button onClick={() => handleUserDelete(user.id)} disabled={deletingUser === user.id}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-60">
                                {deletingUser === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Oui, supprimer"}
                              </button>
                              <button onClick={() => setConfirmDeleteUser(null)}
                                className="px-3 py-1.5 border border-border hover:bg-muted rounded-md text-xs font-medium transition-colors">Non</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => handleUserEdit(user)}
                                className={cn("p-1.5 rounded-md transition-colors", isPending ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "hover:bg-blue-50 text-blue-600 hover:text-blue-700")}
                                title={isPending ? "Affecter un rôle" : "Modifier"}>
                                {isPending ? <Shield className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                              </button>
                              {!isCurrentUser && (
                                <button onClick={() => { setConfirmDeleteUser(user.id); setUserEdit(null); }}
                                  className="p-1.5 rounded-md hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors" title="Supprimer">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════ ONGLET DIRECTIONS ══════════════ */}
      {tab === "directions" && (
        <>
          {/* Formulaire ajout/modification */}
          {dirEdit !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-900">
                {dirEdit.id === null ? "Nouvelle direction" : "Modifier la direction"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-blue-800">Nom de la direction <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={dirEdit.nom}
                    onChange={e => setDirEdit(s => s ? { ...s, nom: e.target.value } : null)}
                    placeholder="Ex: Direction Technique"
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-blue-800">Code (sigle) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={dirEdit.code}
                    onChange={e => setDirEdit(s => s ? { ...s, code: e.target.value } : null)}
                    placeholder="Ex: DT"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                  />
                </div>
              </div>
              {dirError && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {dirError}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleDirSave} disabled={savingDir}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                  {savingDir ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {dirEdit.id === null ? "Créer" : "Enregistrer"}
                </button>
                <button onClick={() => { setDirEdit(null); setDirError(""); }}
                  className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                  <X className="h-4 w-4" /> Annuler
                </button>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Nom de la direction</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Code</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(directions ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-muted-foreground">
                      Aucune direction enregistrée.
                    </td>
                  </tr>
                )}
                {(directions ?? []).map(dir => (
                  <tr key={dir.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{dir.nom}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold">{dir.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {confirmDeleteDir === dir.id ? (
                          <>
                            <span className="text-xs text-red-600 font-medium">Confirmer la suppression ?</span>
                            <button onClick={() => handleDirDelete(dir.id)} disabled={deletingDir === dir.id}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-60">
                              {deletingDir === dir.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Oui"}
                            </button>
                            <button onClick={() => setConfirmDeleteDir(null)}
                              className="px-3 py-1.5 border border-border hover:bg-muted rounded-md text-xs font-medium transition-colors">Non</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setDirEdit({ id: dir.id, nom: dir.nom, code: dir.code }); setDirError(""); }}
                              className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors" title="Modifier">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setConfirmDeleteDir(dir.id); setDirEdit(null); }}
                              className="p-1.5 rounded-md hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors" title="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
