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
});

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  type: text("type").notNull(),
  taille: integer("taille"),
  data: text("data"),
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
