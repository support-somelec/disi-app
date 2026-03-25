import React, { useState } from "react";
import { useGetUsers, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useGetDirections } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useAuth, ROLE_LABELS } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Pencil, Trash2, X, Check, Loader2, Search, UserPlus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_ROLES = [
  "direction",
  "controle_technique",
  "dga",
  "directeur_general",
  "dmg",
  "da",
  "controle_financier",
  "direction_financiere",
  "admin",
];

const ROLES_WITH_DIRECTION = ["direction", "direction_financiere", "dga", "directeur_general", "controle_technique"];

const ROLE_COLOR: Record<string, string> = {
  directeur_general: "bg-purple-100 text-purple-700",
  dga: "bg-indigo-100 text-indigo-700",
  controle_technique: "bg-amber-100 text-amber-700",
  direction: "bg-blue-100 text-blue-700",
  dmg: "bg-cyan-100 text-cyan-700",
  da: "bg-teal-100 text-teal-700",
  controle_financier: "bg-orange-100 text-orange-700",
  direction_financiere: "bg-emerald-100 text-emerald-700",
  admin: "bg-rose-100 text-rose-700",
};

interface EditState {
  userId: number;
  role: string;
  directionId: number | null;
}

export default function AdminUsers() {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const { data: users, refetch } = useGetUsers();
  const { data: directions } = useGetDirections();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [search, setSearch] = useState("");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

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

  const handleEdit = (user: User) => {
    setEditState({ userId: user.id, role: user.role, directionId: user.directionId ?? null });
    setConfirmDelete(null);
  };

  const handleSave = async () => {
    if (!editState) return;
    setSaving(true);
    try {
      await updateUser.mutateAsync({
        id: editState.userId,
        data: {
          role: editState.role,
          directionId: editState.directionId,
        },
      });
      await refetch();
      setEditState(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await deleteUser.mutateAsync({ id });
      await refetch();
      setConfirmDelete(null);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des Utilisateurs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {users?.length ?? 0} compte{(users?.length ?? 0) !== 1 ? "s" : ""} enregistré{(users?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => navigate("/register")}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un utilisateur
        </button>
      </div>

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
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-muted-foreground">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            )}
            {filtered.map(user => {
              const isEditing = editState?.userId === user.id;
              const isCurrentUser = user.id === currentUser?.id;
              const isDeleting = deleting === user.id;
              const isConfirmingDelete = confirmDelete === user.id;

              return (
                <tr key={user.id} className={cn("hover:bg-muted/30 transition-colors", isEditing && "bg-blue-50/50")}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {user.prenom} {user.nom}
                    </div>
                    {isCurrentUser && (
                      <span className="text-[10px] text-muted-foreground">(vous)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editState.role}
                        onChange={e => setEditState(s => s ? { ...s, role: e.target.value, directionId: ROLES_WITH_DIRECTION.includes(e.target.value) ? s.directionId : null } : null)}
                        className="px-2 py-1 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full max-w-[200px]"
                      >
                        {ALL_ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", ROLE_COLOR[user.role] ?? "bg-gray-100 text-gray-700")}>
                        <Shield className="h-3 w-3" />
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {isEditing && ROLES_WITH_DIRECTION.includes(editState.role) ? (
                      <select
                        value={editState.directionId ?? ""}
                        onChange={e => setEditState(s => s ? { ...s, directionId: e.target.value ? Number(e.target.value) : null } : null)}
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-60"
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Enregistrer
                          </button>
                          <button
                            onClick={() => setEditState(null)}
                            className="flex items-center gap-1 px-3 py-1.5 border border-border hover:bg-muted rounded-md text-xs font-medium transition-colors"
                          >
                            <X className="h-3 w-3" />
                            Annuler
                          </button>
                        </>
                      ) : isConfirmingDelete ? (
                        <>
                          <span className="text-xs text-red-600 font-medium">Confirmer ?</span>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={isDeleting}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-60"
                          >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Oui, supprimer"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1.5 border border-border hover:bg-muted rounded-md text-xs font-medium transition-colors"
                          >
                            Non
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {!isCurrentUser && (
                            <button
                              onClick={() => { setConfirmDelete(user.id); setEditState(null); }}
                              className="p-1.5 rounded-md hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
                              title="Supprimer"
                            >
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
    </div>
  );
}
