import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { directionsTable } from "@workspace/db/schema";

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

export default router;
