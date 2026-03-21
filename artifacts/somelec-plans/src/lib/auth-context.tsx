import React, { createContext, useContext, useState, useEffect } from "react";
import { useGetUsers } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  availableUsers: User[];
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "somelec_user";

// Role → visibility rule
export const ROLES_SEE_ALL = ["directeur_general", "controle_technique", "dmg", "da", "controle_financier", "direction_financiere"];

// Category → responsible role mapping
export const CATEGORY_ROLE: Record<string, string> = {
  carburant: "dmg",
  materiel: "da",
  prime: "controle_financier",
  logement: "direction_financiere",
  indemnite_journaliere: "direction_financiere",
  logistique: "direction_financiere",
};

export const ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  controle_technique: "Contrôle Technique",
  directeur_general: "Directeur Général",
  dmg: "Direction Matériel & Garage",
  da: "Direction des Approvisionnements",
  controle_financier: "Contrôle Financier",
  direction_financiere: "Direction Financière",
};

const MOCK_USERS: User[] = [
  { id: 1, nom: "", prenom: "DG", email: "dg@somelec.mr", role: "directeur_general", directionId: 1, directionNom: "Direction Générale" },
  { id: 2, nom: "", prenom: "CT", email: "ct@somelec.mr", role: "controle_technique", directionId: 1, directionNom: "Direction Générale" },
  { id: 3, nom: "", prenom: "DT", email: "dt@somelec.mr", role: "direction", directionId: 2, directionNom: "Direction Technique" },
  { id: 4, nom: "Ould Mohamed", prenom: "Ahmed", email: "ahmed.mohamed@somelec.mr", role: "direction", directionId: 6, directionNom: "Direction de la Production" },
  { id: 5, nom: "Diallo", prenom: "Aminata", email: "aminata.diallo@somelec.mr", role: "direction", directionId: 3, directionNom: "Direction Commerciale" },
  { id: 6, nom: "Ba", prenom: "Oumar", email: "oumar.ba@somelec.mr", role: "direction", directionId: 4, directionNom: "Direction Financière" },
  { id: 7, nom: "Ould Salem", prenom: "Moctar", email: "moctar.salem@somelec.mr", role: "direction", directionId: 5, directionNom: "Direction des Ressources Humaines" },
  { id: 8, nom: "", prenom: "DMG", email: "dmg@somelec.mr", role: "dmg" },
  { id: 9, nom: "", prenom: "DA", email: "da@somelec.mr", role: "da" },
  { id: 10, nom: "", prenom: "CF", email: "cf@somelec.mr", role: "controle_financier" },
  { id: 11, nom: "", prenom: "DF", email: "df@somelec.mr", role: "direction_financiere", directionId: 4, directionNom: "Direction Financière" },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: apiUsers, isLoading } = useGetUsers();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const users = apiUsers?.length ? apiUsers : MOCK_USERS;

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!password || password.length < 4) {
      return { success: false, error: "Mot de passe incorrect." };
    }
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      return { success: false, error: "Aucun compte trouvé avec cet email." };
    }
    if (password !== "somelec2026") {
      return { success: false, error: "Mot de passe incorrect." };
    }
    setCurrentUser(found);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(found));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: currentUser !== null, login, logout, availableUsers: users, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
