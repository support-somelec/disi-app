import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { directionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/directions", async (_req, res) => {
  try {
    const directions = await db.select().from(directionsTable).orderBy(directionsTable.nom);
    res.json(directions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const DirectionBody = z.object({
  nom: z.string().min(1),
  code: z.string().min(1),
});

router.post("/directions", async (req, res) => {
  try {
    const body = DirectionBody.parse(req.body);
    const [created] = await db.insert(directionsTable).values({ nom: body.nom, code: body.code.toUpperCase() }).returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.put("/directions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = DirectionBody.parse(req.body);
    const [updated] = await db
      .update(directionsTable)
      .set({ nom: body.nom, code: body.code.toUpperCase() })
      .where(eq(directionsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Direction non trouvée" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.delete("/directions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(directionsTable).where(eq(directionsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
