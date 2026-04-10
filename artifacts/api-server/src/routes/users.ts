import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, directionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

const USER_SELECT = {
  id: usersTable.id,
  nom: usersTable.nom,
  prenom: usersTable.prenom,
  email: usersTable.email,
  role: usersTable.role,
  niveau: usersTable.niveau,
  directionId: usersTable.directionId,
  directionNom: directionsTable.nom,
};

async function getUserWithDirection(id: number) {
  const rows = await db
    .select(USER_SELECT)
    .from(usersTable)
    .leftJoin(directionsTable, eq(usersTable.directionId, directionsTable.id))
    .where(eq(usersTable.id, id));
  return rows[0] ?? null;
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis." });
    const rows = await db
      .select({ ...USER_SELECT, password: usersTable.password })
      .from(usersTable)
      .leftJoin(directionsTable, eq(usersTable.directionId, directionsTable.id))
      .where(eq(usersTable.email, email.toLowerCase().trim()));
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Aucun compte trouvé avec cet email." });
    if (user.password !== password) return res.status(401).json({ error: "Mot de passe incorrect." });
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.put("/users/:id/password", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Champs requis." });
    if (newPassword.length < 6) return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères." });
    const rows = await db.select({ password: usersTable.password }).from(usersTable).where(eq(usersTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "Utilisateur non trouvé." });
    if (rows[0].password !== currentPassword) return res.status(401).json({ error: "Mot de passe actuel incorrect." });
    await db.update(usersTable).set({ password: newPassword }).where(eq(usersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.get("/users", async (_req, res) => {
  try {
    const users = await db
      .select(USER_SELECT)
      .from(usersTable)
      .leftJoin(directionsTable, eq(usersTable.directionId, directionsTable.id))
      .orderBy(usersTable.prenom);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const CreateUserBody = z.object({
  nom: z.string().default(""),
  prenom: z.string().min(1),
  email: z.string().email(),
  role: z.string().default("en_attente"),
  directionId: z.number().int().optional().nullable(),
  niveau: z.string().default("standard"),
});

router.post("/users", async (req, res) => {
  try {
    const body = CreateUserBody.parse(req.body);
    const [created] = await db.insert(usersTable).values({
      nom: body.nom,
      prenom: body.prenom,
      email: body.email,
      role: body.role,
      directionId: body.directionId ?? null,
      niveau: body.niveau ?? "standard",
    }).returning();
    const full = await getUserWithDirection(created.id);
    res.status(201).json(full);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ error: "Cet email est déjà utilisé." });
    } else {
      res.status(400).json({ error: msg });
    }
  }
});

const UpdateUserBody = z.object({
  nom: z.string().optional(),
  prenom: z.string().optional(),
  role: z.string().optional(),
  directionId: z.number().int().nullable().optional(),
  niveau: z.string().optional(),
});

router.put("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateUserBody.parse(req.body);
    const updates: Record<string, unknown> = {};
    if (body.nom !== undefined) updates.nom = body.nom;
    if (body.prenom !== undefined) updates.prenom = body.prenom;
    if (body.role !== undefined) updates.role = body.role;
    if ("directionId" in body) updates.directionId = body.directionId ?? null;
    if (body.niveau !== undefined) updates.niveau = body.niveau;
    await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
    const full = await getUserWithDirection(id);
    if (!full) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(full);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
