import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { directionsTable } from "./directions";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(), // direction, controle_technique, directeur_general
  directionId: integer("direction_id").references(() => directionsTable.id),
  niveau: text("niveau").notNull().default("standard"), // standard | directeur_centrale
  password: text("password").notNull().default("somelec2026"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
