import React, { createContext, useContext, useState, useEffect } from "react";
import { useGetUsers } from "@workspace/api-client-react";
import type { User, UserRole } from "@workspace/api-client-react";

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  availableUsers: User[];
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fallback mock users in case the database is empty
const MOCK_USERS: User[] = [
  { id: 1, nom: "Dupont", prenom: "Jean", email: "j.dupont@somelec.mr", role: "direction", directionId: 1, directionNom: "Direction Production" },
  { id: 2, nom: "Martin", prenom: "Sophie", email: "s.martin@somelec.mr", role: "controle_technique" },
  { id: 3, nom: "Diallo", prenom: "Amadou", email: "a.diallo@somelec.mr", role: "directeur_general" },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: apiUsers, isLoading } = useGetUsers();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const users = apiUsers?.length ? apiUsers : MOCK_USERS;

  // Auto-login first user for demo purposes
  useEffect(() => {
    if (!currentUser && users.length > 0) {
      setCurrentUser(users[0]);
    }
  }, [users, currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, availableUsers: users, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
