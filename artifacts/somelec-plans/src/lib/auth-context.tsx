import React, { createContext, useContext, useState, useEffect } from "react";
import { useGetUsers } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { ROLES_SEE_ALL, CATEGORY_ROLE, ROLE_LABELS } from "./auth-constants";

export { ROLES_SEE_ALL, CATEGORY_ROLE, ROLE_LABELS };

const BASE_URL = import.meta.env.BASE_URL ?? "/somelec-plans/";

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  availableUsers: User[];
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = "somelec_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: apiUsers, isLoading } = useGetUsers();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const users = apiUsers ?? [];

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try { setCurrentUser(JSON.parse(saved)); } catch { sessionStorage.removeItem(SESSION_KEY); }
    }
  }, []);

  useEffect(() => {
    if (!apiUsers?.length) return;
    setCurrentUser(prev => {
      if (!prev) return prev;
      const fresh = apiUsers.find(u => u.id === prev.id);
      if (!fresh) return prev;
      const updated = { ...prev, ...fresh };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [apiUsers]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!password || password.length < 1) return { success: false, error: "Mot de passe requis." };
    try {
      const res = await fetch(`${BASE_URL}api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error ?? "Erreur de connexion." };
      }
      const user: User = await res.json();
      setCurrentUser(user);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return { success: true };
    } catch {
      return { success: false, error: "Impossible de contacter le serveur." };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: "Non connecté." };
    try {
      const res = await fetch(`${BASE_URL}api/users/${currentUser.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error ?? "Erreur lors du changement." };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Impossible de contacter le serveur." };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: currentUser !== null, login, logout, changePassword, availableUsers: users, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
