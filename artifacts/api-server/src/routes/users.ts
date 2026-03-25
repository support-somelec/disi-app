import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, directionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

async function getUserWithDirection(id: number) {
  const rows = await db
    .select({
      id: usersTable.id,
      nom: usersTable.nom,
      prenom: usersTable.prenom,
      email: usersTable.email,
      role: usersTable.role,
      directionId: usersTable.directionId,
      directionNom: directionsTable.nom,
    })
    .from(usersTable)
    .leftJoin(directionsTable, eq(usersTable.directionId, directionsTable.id))
    .where(eq(usersTable.id, id));
  return rows[0] ?? null;
}

router.get("/users", async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        nom: usersTable.nom,
        prenom: usersTable.prenom,
        email: usersTable.email,
        role: usersTable.role,
        directionId: usersTable.directionId,
        directionNom: directionsTable.nom,
      })
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
  role: z.string().min(1),
  directionId: z.number().int().optional().nullable(),
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
