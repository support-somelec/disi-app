import { pgTable, serial, text, integer, numeric, timestamp, date, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { directionsTable } from "./directions";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 30 }),
  titre: text("titre").notNull(),
  description: text("description").notNull(),
  dateDebut: date("date_debut").notNull(),
  duree: integer("duree").notNull(),
  directionId: integer("direction_id").notNull().references(() => directionsTable.id),
  statut: text("statut").notNull().default("brouillon"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  commentaireRejet: text("commentaire_rejet"),
  rapportCloture: text("rapport_cloture"),
  dateCloture: timestamp("date_cloture"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const moyensTable = pgTable("moyens", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  categorie: text("categorie").notNull(),
  description: text("description").notNull(),
  budget: numeric("budget", { precision: 12, scale: 2 }).notNull(),
  unite: text("unite"),
  quantite: numeric("quantite", { precision: 10, scale: 2 }),
  montantConsomme: numeric("montant_consomme", { precision: 12, scale: 2 }).default("0").notNull(),
  demandeStatus: text("demande_status"),
  demandeById: integer("demande_by_id").references(() => usersTable.id),
  demandeAt: timestamp("demande_at"),
  autresDirectionId: integer("autres_direction_id").references(() => directionsTable.id),
  listeMaterielJson: text("liste_materiel_json"),
  locationVehiculeSimple: integer("location_vehicule_simple"),
  locationEngin: integer("location_engin"),
});

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  moyenId: integer("moyen_id").references(() => moyensTable.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  type: text("type").notNull(),
  taille: integer("taille"),
  data: text("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employesTable = pgTable("employes", {
  id: serial("id").primaryKey(),
  matricule: varchar("matricule", { length: 30 }).notNull().unique(),
  nni: varchar("nni", { length: 20 }).unique(),
  nom: varchar("nom", { length: 100 }).notNull(),
  fonction: varchar("fonction", { length: 100 }),
});

export const beneficiairesMoyenTable = pgTable("beneficiaires_moyen", {
  id: serial("id").primaryKey(),
  moyenId: integer("moyen_id").notNull().references(() => moyensTable.id, { onDelete: "cascade" }),
  employeId: integer("employe_id").references(() => employesTable.id, { onDelete: "set null" }),
  nom: varchar("nom", { length: 100 }).notNull(),
  matricule: varchar("matricule", { length: 30 }),
  nni: varchar("nni", { length: 20 }),
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
});

export const materielItemsTable = pgTable("materiel_items", {
  id: serial("id").primaryKey(),
  moyenId: integer("moyen_id").notNull().references(() => moyensTable.id, { onDelete: "cascade" }),
  item: text("item").notNull(),
  quantiteInitiale: integer("quantite_initiale").notNull(),
  quantiteRestante: integer("quantite_restante").notNull(),
});

export const materielDemandesTable = pgTable("materiel_demandes", {
  id: serial("id").primaryKey(),
  moyenId: integer("moyen_id").notNull().references(() => moyensTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  statut: text("statut").notNull().default("en_attente_da"),
  itemsJson: text("items_json").notNull(),
  montantTotal: numeric("montant_total", { precision: 12, scale: 2 }),
  bonNumber: text("bon_number"),
  daValidatedById: integer("da_validated_by_id").references(() => usersTable.id),
  dcgaiValidatedById: integer("dcgai_validated_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  daValidatedAt: timestamp("da_validated_at"),
  dcgaiValidatedAt: timestamp("dcgai_validated_at"),
});

export const locationItemsTable = pgTable("location_items", {
  id: serial("id").primaryKey(),
  moyenId: integer("moyen_id").notNull().references(() => moyensTable.id, { onDelete: "cascade" }),
  typeEngin: text("type_engin").notNull(),
  nbJoursTotal: integer("nb_jours_total").notNull(),
  nbJoursRestants: integer("nb_jours_restants").notNull(),
});

export const locationDemandesTable = pgTable("location_demandes", {
  id: serial("id").primaryKey(),
  moyenId: integer("moyen_id").notNull().references(() => moyensTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  statut: text("statut").notNull().default("en_attente_dmg"),
  itemsJson: text("items_json").notNull(),
  montantTotal: numeric("montant_total", { precision: 12, scale: 2 }),
  dmgValidatedById: integer("dmg_validated_by_id").references(() => usersTable.id),
  dmgValidatedAt: timestamp("dmg_validated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const carburantDemandesTable = pgTable("carburant_demandes", {
  id: serial("id").primaryKey(),
  moyenId: integer("moyen_id").notNull().references(() => moyensTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  montantDemande: numeric("montant_demande", { precision: 12, scale: 2 }).notNull(),
  statut: text("statut").notNull().default("en_attente_cad"),
  montantValide: numeric("montant_valide", { precision: 12, scale: 2 }),
  cadValidatedById: integer("cad_validated_by_id").references(() => usersTable.id),
  cadValidatedAt: timestamp("cad_validated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const depenseDemandesTable = pgTable("depense_demandes", {
  id: serial("id").primaryKey(),
  moyenId: integer("moyen_id").notNull().references(() => moyensTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  montantDemande: numeric("montant_demande", { precision: 12, scale: 2 }).notNull(),
  nomBeneficiaire: text("nom_beneficiaire").notNull(),
  matriculeBeneficiaire: text("matricule_beneficiaire"),
  statut: text("statut").notNull().default("en_attente_dcgai"),
  dcgaiValidatedById: integer("dcgai_validated_by_id").references(() => usersTable.id),
  dcgaiValidatedAt: timestamp("dcgai_validated_at"),
  dfcValidatedById: integer("dfc_validated_by_id").references(() => usersTable.id),
  dfcValidatedAt: timestamp("dfc_validated_at"),
  montantPaye: numeric("montant_paye", { precision: 12, scale: 2 }),
  pieceReference: text("piece_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

export const insertMoyenSchema = createInsertSchema(moyensTable).omit({ id: true });
export type InsertMoyen = z.infer<typeof insertMoyenSchema>;
export type Moyen = typeof moyensTable.$inferSelect;

export const insertAttachmentSchema = createInsertSchema(attachmentsTable).omit({ id: true, createdAt: true });
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachmentsTable.$inferSelect;

export const insertEmployeSchema = createInsertSchema(employesTable).omit({ id: true });
export type InsertEmploye = z.infer<typeof insertEmployeSchema>;
export type Employe = typeof employesTable.$inferSelect;

export const insertBeneficiaireSchema = createInsertSchema(beneficiairesMoyenTable).omit({ id: true });
export type InsertBeneficiaire = z.infer<typeof insertBeneficiaireSchema>;
export type BeneficiaireMoyen = typeof beneficiairesMoyenTable.$inferSelect;
