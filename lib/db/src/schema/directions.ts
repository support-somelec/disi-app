import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const directionsTable = pgTable("directions", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  code: varchar("code", { length: 20 }).notNull().unique(),
});

export const insertDirectionSchema = createInsertSchema(directionsTable).omit({ id: true });
export type InsertDirection = z.infer<typeof insertDirectionSchema>;
export type Direction = typeof directionsTable.$inferSelect;
