import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, directionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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
      .orderBy(usersTable.nom);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
