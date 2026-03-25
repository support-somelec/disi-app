import { db } from "@workspace/db";
import { directionsTable, usersTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const DIRECTIONS = [
  { nom: "Direction Générale",              code: "DG" },
  { nom: "Direction Technique",             code: "DT" },
  { nom: "Direction Commerciale",           code: "DC" },
  { nom: "Direction Financière",            code: "DF" },
  { nom: "Direction des Ressources Humaines", code: "DRH" },
  { nom: "Direction de la Production",      code: "DP" },
  { nom: "Direction Distribution",          code: "DD" },
  { nom: "Direction Systèmes Informatiques", code: "DSI" },
];

const USERS = [
  { nom: "", prenom: "Admin",  email: "admin@somelec.mr",           role: "admin",              directionIdx: null },
  { nom: "", prenom: "DG",     email: "dg@somelec.mr",              role: "directeur_general",  directionIdx: 0 },
  { nom: "", prenom: "DGA",    email: "dga@somelec.mr",             role: "dga",                directionIdx: 0 },
  { nom: "", prenom: "CT",     email: "ct@somelec.mr",              role: "controle_technique", directionIdx: 0 },
  { nom: "", prenom: "DT",     email: "dt@somelec.mr",              role: "direction",          directionIdx: 1 },
  { nom: "Ould Mohamed", prenom: "Ahmed",   email: "ahmed.mohamed@somelec.mr",  role: "direction", directionIdx: 5 },
  { nom: "Diallo",       prenom: "Aminata", email: "aminata.diallo@somelec.mr", role: "direction", directionIdx: 2 },
  { nom: "Ba",           prenom: "Oumar",   email: "oumar.ba@somelec.mr",       role: "direction", directionIdx: 3 },
  { nom: "Ould Salem",   prenom: "Moctar",  email: "moctar.salem@somelec.mr",   role: "direction", directionIdx: 4 },
  { nom: "", prenom: "DMG", email: "dmg@somelec.mr", role: "dmg",                directionIdx: null },
  { nom: "", prenom: "DA",  email: "da@somelec.mr",  role: "da",                 directionIdx: null },
  { nom: "", prenom: "CF",  email: "cf@somelec.mr",  role: "controle_financier", directionIdx: null },
  { nom: "", prenom: "DF",  email: "df@somelec.mr",  role: "direction_financiere", directionIdx: 3 },
];

export async function seedIfEmpty() {
  try {
    const existing = await db.select({ n: sql<number>`count(*)` }).from(directionsTable);
    if (Number(existing[0]?.n ?? 0) > 0) return; // already seeded

    console.log("[seed] Directions table empty — seeding initial data...");

    const insertedDirs = await db.insert(directionsTable).values(DIRECTIONS).returning();
    console.log(`[seed] Inserted ${insertedDirs.length} directions.`);

    const userValues = USERS.map(u => ({
      nom: u.nom,
      prenom: u.prenom,
      email: u.email,
      role: u.role,
      directionId: u.directionIdx !== null ? insertedDirs[u.directionIdx]?.id ?? null : null,
    }));

    const insertedUsers = await db.insert(usersTable).values(userValues).onConflictDoNothing().returning();
    console.log(`[seed] Inserted ${insertedUsers.length} users.`);
  } catch (err) {
    console.error("[seed] Error during seeding:", String(err));
  }
}
