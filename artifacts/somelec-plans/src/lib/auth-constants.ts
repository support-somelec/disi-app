export const ROLES_SEE_ALL = ["directeur_general", "dga", "controle_technique", "dmg", "da", "controle_financier", "dcgai", "direction_financiere", "rh", "admin", "cad"];

export const CATEGORY_ROLE: Record<string, string> = {
  carburant: "cad",
  location: "dmg",
  materiel: "da",
  outillage: "da",
  accessoire: "da",
  prime: "dcgai",
  logement: "dcgai",
  indemnite_journaliere: "dcgai",
  logistique: "dcgai",
  autres: "dcgai",
};

export const DEPENSE_CATEGORIES = ["prime", "logement", "indemnite_journaliere", "logistique", "autres"];

export const ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  controle_technique: "Contrôle Technique",
  dga: "Directeur Général Adjoint",
  directeur_general: "Directeur Général",
  dmg: "Direction Matériel & Garage",
  da: "Direction des Approvisionnements",
  controle_financier: "Contrôle Financier",
  dcgai: "Direction Contrôle de Gestion & Audit Interne",
  direction_financiere: "Direction Financière & Comptabilité",
  cad: "Caisse et Approvisionnements & Distribution",
  rh: "Direction des Ressources Humaines",
  admin: "Administrateur",
};
