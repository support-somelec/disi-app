import { db } from "@workspace/db";
import { directionsTable, usersTable, employesTable } from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";

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
  { nom: "", prenom: "RH",    email: "rh@somelec.mr",    role: "rh",    directionIdx: 4 },
  { nom: "", prenom: "DCGAI", email: "dcgai@somelec.mr", role: "dcgai", directionIdx: null },
  { nom: "", prenom: "CAD",   email: "cad@somelec.mr",   role: "cad",   directionIdx: null },
];

const EMPLOYES_INIT = [
  { matricule: "EMP001", nni: "1234567890", nom: "Ould Abdelaziz Mohamed", fonction: "Ingénieur Réseau" },
  { matricule: "EMP002", nni: "0987654321", nom: "Diallo Fatoumata", fonction: "Technicien Électrique" },
  { matricule: "EMP003", nni: "1122334455", nom: "Ba Ibrahima", fonction: "Agent Commercial" },
  { matricule: "EMP004", nni: "5566778899", nom: "Ould Baba Ahmed", fonction: "Comptable" },
  { matricule: "EMP005", nni: "9988776655", nom: "Mint Saleh Mariem", fonction: "Secrétaire de Direction" },
];

export async function ensureAdminUser() {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, "admin@somelec.mr"));
    if (existing.length === 0) {
      await db.insert(usersTable).values({ nom: "", prenom: "Admin", email: "admin@somelec.mr", role: "admin", directionId: null });
      console.log("[seed] Admin user created.");
    }
  } catch (err) {
    console.error("[seed] Error ensuring admin user:", String(err));
  }
}

// Accounts that must always exist regardless of when they were added
const REQUIRED_USERS = [
  { nom: "", prenom: "DCGAI", email: "dcgai@somelec.mr", role: "dcgai" },
  { nom: "", prenom: "CAD",   email: "cad@somelec.mr",   role: "cad"   },
  { nom: "", prenom: "DMG",   email: "dmg@somelec.mr",   role: "dmg"   },
  { nom: "", prenom: "DA",    email: "da@somelec.mr",     role: "da"    },
  { nom: "", prenom: "CF",    email: "cf@somelec.mr",     role: "controle_financier" },
];

export async function ensureAllUsers() {
  try {
    for (const user of REQUIRED_USERS) {
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));
      if (existing.length === 0) {
        await db.insert(usersTable).values({ nom: user.nom, prenom: user.prenom, email: user.email, role: user.role, directionId: null });
        console.log(`[seed] Created missing user: ${user.email}`);
      }
    }
  } catch (err) {
    console.error("[seed] Error ensuring required users:", String(err));
  }
}

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

    await db.insert(employesTable).values(EMPLOYES_INIT).onConflictDoNothing();
    console.log(`[seed] Inserted ${EMPLOYES_INIT.length} employees.`);
  } catch (err) {
    console.error("[seed] Error during seeding:", String(err));
  }
}
