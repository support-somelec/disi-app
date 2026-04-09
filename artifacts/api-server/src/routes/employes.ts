import { Router } from "express";
import { db } from "@workspace/db";
import { employesTable } from "@workspace/db/schema";
import { eq, or, ilike } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const CreateEmployeBody = z.object({
  matricule: z.string().min(1),
  nni: z.string().optional(),
  nom: z.string().min(1),
  fonction: z.string().optional(),
});

const UpdateEmployeBody = z.object({
  matricule: z.string().min(1).optional(),
  nni: z.string().optional(),
  nom: z.string().min(1).optional(),
  fonction: z.string().optional(),
});

// GET /employes?q=...
router.get("/employes", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    let rows;
    if (q) {
      rows = await db.select().from(employesTable).where(
        or(
          ilike(employesTable.matricule, `%${q}%`),
          ilike(employesTable.nni, `%${q}%`),
          ilike(employesTable.nom, `%${q}%`)
        )
      );
    } else {
      rows = await db.select().from(employesTable);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /employes/:id
router.get("/employes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(employesTable).where(eq(employesTable.id, id));
    if (!rows.length) return res.status(404).json({ error: "Employé non trouvé" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /employes
router.post("/employes", async (req, res) => {
  try {
    const body = CreateEmployeBody.parse(req.body);
    const [created] = await db.insert(employesTable).values(body).returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// PUT /employes/:id
router.put("/employes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateEmployeBody.parse(req.body);
    const [updated] = await db.update(employesTable).set(body).where(eq(employesTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Employé non trouvé" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// DELETE /employes/:id
router.delete("/employes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(employesTable).where(eq(employesTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /employes/bulk — upsert list by matricule
const BulkEmployeBody = z.array(z.object({
  matricule: z.string().min(1),
  nni: z.string().optional(),
  nom: z.string().min(1),
  fonction: z.string().optional(),
}));

router.post("/employes/bulk", async (req, res) => {
  try {
    const rows = BulkEmployeBody.parse(req.body);
    if (!rows.length) return res.json({ inserted: 0, updated: 0 });
    const result = await db.insert(employesTable)
      .values(rows)
      .onConflictDoUpdate({
        target: employesTable.matricule,
        set: {
          nni: sql`excluded.nni`,
          nom: sql`excluded.nom`,
          fonction: sql`excluded.fonction`,
        },
      })
      .returning();
    res.json({ count: result.length });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
