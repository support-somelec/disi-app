export const ROLES_SEE_ALL = ["directeur_general", "dga", "controle_technique", "dmg", "da", "controle_financier", "direction_financiere", "rh", "admin"];

export const CATEGORY_ROLE: Record<string, string> = {
  carburant: "dmg",
  materiel: "da",
  outillage: "da",
  accessoire: "da",
  prime: "controle_financier",
  logement: "direction_financiere",
  indemnite_journaliere: "direction_financiere",
  logistique: "direction_financiere",
  autres: "direction_financiere",
};

export const ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  controle_technique: "Contrôle Technique",
  dga: "Directeur Général Adjoint",
  directeur_general: "Directeur Général",
  dmg: "Direction Matériel & Garage",
  da: "Direction des Approvisionnements",
  controle_financier: "Contrôle Financier",
  direction_financiere: "Direction Financière",
  rh: "Direction des Ressources Humaines",
  admin: "Administrateur",
};
