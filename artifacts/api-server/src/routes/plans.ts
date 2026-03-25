import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { plansTable, moyensTable, attachmentsTable, directionsTable, usersTable } from "@workspace/db/schema";
import { eq, and, SQL, sql } from "drizzle-orm";
import {
  CreatePlanBody,
  UpdatePlanBody,
  ValidatePlanBody,
  AddMoyenBody,
  AddAttachmentBody,
  ConsommerMoyenBody,
  CloturerPlanBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function generateReference(directionId: number, createdAt: Date): Promise<string> {
  const dir = await db.select({ code: directionsTable.code, id: directionsTable.id })
    .from(directionsTable).where(eq(directionsTable.id, directionId));
  const code = dir[0]?.code ?? String(directionId);
  const mm = String(createdAt.getMonth() + 1).padStart(2, "0");
  const yyyy = createdAt.getFullYear();
  const prefix = `${code}-${mm}${yyyy}-`;
  const count = await db.select({ n: sql<number>`count(*)` })
    .from(plansTable)
    .where(sql`reference LIKE ${prefix + "%"}`);
  const seq = (Number(count[0]?.n ?? 0) + 1).toString().padStart(3, "0");
  return `${prefix}${seq}`;
}

async function getPlanWithDetails(planId: number) {
  const plans = await db
    .select({
      id: plansTable.id,
      reference: plansTable.reference,
      titre: plansTable.titre,
      description: plansTable.description,
      dateDebut: plansTable.dateDebut,
      duree: plansTable.duree,
      directionId: plansTable.directionId,
      directionNom: directionsTable.nom,
      statut: plansTable.statut,
      createdById: plansTable.createdById,
      createdByNom: usersTable.nom,
      commentaireRejet: plansTable.commentaireRejet,
      rapportCloture: plansTable.rapportCloture,
      dateCloture: plansTable.dateCloture,
      createdAt: plansTable.createdAt,
      updatedAt: plansTable.updatedAt,
    })
    .from(plansTable)
    .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
    .leftJoin(usersTable, eq(plansTable.createdById, usersTable.id))
    .where(eq(plansTable.id, planId));

  if (!plans.length) return null;
  const plan = plans[0];

  const moyens = await db.select().from(moyensTable).where(eq(moyensTable.planId, planId));
  const attachments = await db
    .select({
      id: attachmentsTable.id,
      planId: attachmentsTable.planId,
      nom: attachmentsTable.nom,
      type: attachmentsTable.type,
      taille: attachmentsTable.taille,
      createdAt: attachmentsTable.createdAt,
    })
    .from(attachmentsTable)
    .where(eq(attachmentsTable.planId, planId));

  const budgetTotal = moyens.reduce((sum, m) => sum + Number(m.budget), 0);
  const montantConsomme = moyens.reduce((sum, m) => sum + Number(m.montantConsomme), 0);

  return {
    ...plan,
    budgetTotal,
    montantConsomme,
    moyens: moyens.map(m => ({
      ...m,
      budget: Number(m.budget),
      quantite: m.quantite ? Number(m.quantite) : null,
      montantConsomme: Number(m.montantConsomme),
    })),
    attachments,
  };
}

// GET /plans
router.get("/plans", async (req, res) => {
  try {
    const { status, directionId, createdById } = req.query;
    const conditions: SQL[] = [];
    if (status) conditions.push(eq(plansTable.statut, String(status)));
    if (directionId) conditions.push(eq(plansTable.directionId, Number(directionId)));
    if (createdById) conditions.push(eq(plansTable.createdById, Number(createdById)));

    const plansRaw = await db
      .select({
        id: plansTable.id,
        reference: plansTable.reference,
        titre: plansTable.titre,
        description: plansTable.description,
        dateDebut: plansTable.dateDebut,
        duree: plansTable.duree,
        directionId: plansTable.directionId,
        directionNom: directionsTable.nom,
        statut: plansTable.statut,
        createdById: plansTable.createdById,
        createdByNom: usersTable.nom,
        commentaireRejet: plansTable.commentaireRejet,
        rapportCloture: plansTable.rapportCloture,
        dateCloture: plansTable.dateCloture,
        createdAt: plansTable.createdAt,
        updatedAt: plansTable.updatedAt,
      })
      .from(plansTable)
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(usersTable, eq(plansTable.createdById, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(plansTable.createdAt);

    const plansWithBudget = await Promise.all(
      plansRaw.map(async (plan) => {
        const moyens = await db.select().from(moyensTable).where(eq(moyensTable.planId, plan.id));
        const budgetTotal = moyens.reduce((sum, m) => sum + Number(m.budget), 0);
        const montantConsomme = moyens.reduce((sum, m) => sum + Number(m.montantConsomme), 0);
        return { ...plan, budgetTotal, montantConsomme, moyens: [], attachments: [] };
      })
    );

    res.json(plansWithBudget);
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /plans
router.post("/plans", async (req, res) => {
  try {
    const raw = req.body;
    if (raw.dateDebut && typeof raw.dateDebut === "string") raw.dateDebut = new Date(raw.dateDebut);
    const body = CreatePlanBody.parse(raw);
    const now = new Date();
    const reference = await generateReference(body.directionId, now);
    const [plan] = await db
      .insert(plansTable)
      .values({
        reference,
        titre: body.titre,
        description: body.description,
        dateDebut: body.dateDebut,
        duree: body.duree,
        directionId: body.directionId,
        createdById: body.createdById,
        statut: "brouillon",
      })
      .returning();

    const result = await getPlanWithDetails(plan.id);
    res.status(201).json(result);
  } catch (err) {
    console.error("POST /plans error:", String(err));
    res.status(400).json({ error: String(err) });
  }
});

// GET /plans/:id
router.get("/plans/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const plan = await getPlanWithDetails(id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /plans/:id
router.put("/plans/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const raw = req.body;
    if (raw.dateDebut && typeof raw.dateDebut === "string") raw.dateDebut = new Date(raw.dateDebut);
    const body = UpdatePlanBody.parse(raw);
    const updates: Partial<typeof plansTable.$inferInsert> = { updatedAt: new Date() };
    if (body.titre !== undefined) updates.titre = body.titre;
    if (body.description !== undefined) updates.description = body.description;
    if (body.dateDebut !== undefined) updates.dateDebut = body.dateDebut;
    if (body.duree !== undefined) updates.duree = body.duree;
    if (body.directionId !== undefined) updates.directionId = body.directionId;
    await db.update(plansTable).set(updates).where(eq(plansTable.id, id));
    const plan = await getPlanWithDetails(id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// POST /plans/:id/validate
router.post("/plans/:id/validate", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = ValidatePlanBody.parse(req.body);
    const existing = await db.select().from(plansTable).where(eq(plansTable.id, id));
    if (!existing.length) return res.status(404).json({ error: "Plan not found" });
    const current = existing[0];
    let newStatut = current.statut;
    let commentaireRejet = current.commentaireRejet;

    if (body.action === "approuver") {
      if (current.statut === "brouillon")         newStatut = "en_attente_ct";
      else if (current.statut === "en_attente_ct")  newStatut = "en_attente_dga";
      else if (current.statut === "en_attente_dga") newStatut = "en_attente_dg";
      else if (current.statut === "en_attente_dg")  newStatut = "ouvert";
    } else if (body.action === "rejeter") {
      newStatut = "rejete";
      commentaireRejet = body.commentaire ?? "Rejeté sans commentaire";
    }

    await db.update(plansTable).set({ statut: newStatut, commentaireRejet, updatedAt: new Date() }).where(eq(plansTable.id, id));
    const plan = await getPlanWithDetails(id);
    res.json(plan);
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// POST /plans/:id/cloturer
router.post("/plans/:id/cloturer", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = CloturerPlanBody.parse(req.body);
    const existing = await db.select().from(plansTable).where(eq(plansTable.id, id));
    if (!existing.length) return res.status(404).json({ error: "Plan not found" });
    if (existing[0].statut !== "ouvert") return res.status(400).json({ error: "Le plan doit être ouvert pour être clôturé" });

    await db.update(plansTable).set({
      statut: "cloture",
      rapportCloture: body.rapportCloture,
      dateCloture: new Date(),
      updatedAt: new Date(),
    }).where(eq(plansTable.id, id));

    const plan = await getPlanWithDetails(id);
    res.json(plan);
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// GET /plans/:id/moyens
router.get("/plans/:id/moyens", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyens = await db.select().from(moyensTable).where(eq(moyensTable.planId, planId));
    res.json(moyens.map(m => ({
      ...m,
      budget: Number(m.budget),
      quantite: m.quantite ? Number(m.quantite) : null,
      montantConsomme: Number(m.montantConsomme),
    })));
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /plans/:id/moyens
router.post("/plans/:id/moyens", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const body = AddMoyenBody.parse(req.body);
    const [moyen] = await db.insert(moyensTable).values({
      planId,
      categorie: body.categorie,
      description: body.description,
      budget: String(body.budget),
      unite: body.unite,
      quantite: body.quantite !== undefined ? String(body.quantite) : null,
      montantConsomme: "0",
    }).returning();
    res.status(201).json({
      ...moyen,
      budget: Number(moyen.budget),
      quantite: moyen.quantite ? Number(moyen.quantite) : null,
      montantConsomme: Number(moyen.montantConsomme),
    });
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/consommer
router.post("/plans/:id/moyens/:moyenId/consommer", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const body = ConsommerMoyenBody.parse(req.body);
    const existing = await db.select().from(moyensTable)
      .where(and(eq(moyensTable.id, moyenId), eq(moyensTable.planId, planId)));
    if (!existing.length) return res.status(404).json({ error: "Moyen not found" });
    const [updated] = await db.update(moyensTable)
      .set({ montantConsomme: String(body.montant) })
      .where(eq(moyensTable.id, moyenId))
      .returning();
    await db.update(plansTable).set({ updatedAt: new Date() }).where(eq(plansTable.id, planId));
    res.json({
      ...updated,
      budget: Number(updated.budget),
      quantite: updated.quantite ? Number(updated.quantite) : null,
      montantConsomme: Number(updated.montantConsomme),
    });
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// DELETE /plans/:id/moyens/:moyenId
router.delete("/plans/:id/moyens/:moyenId", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    await db.delete(moyensTable).where(and(eq(moyensTable.id, moyenId), eq(moyensTable.planId, planId)));
    res.status(204).send();
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /plans/:id/attachments
router.get("/plans/:id/attachments", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const attachments = await db.select({
      id: attachmentsTable.id,
      planId: attachmentsTable.planId,
      nom: attachmentsTable.nom,
      type: attachmentsTable.type,
      taille: attachmentsTable.taille,
      createdAt: attachmentsTable.createdAt,
    }).from(attachmentsTable).where(eq(attachmentsTable.planId, planId));
    res.json(attachments);
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /plans/:id/attachments
router.post("/plans/:id/attachments", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const body = AddAttachmentBody.parse(req.body);
    const [attachment] = await db.insert(attachmentsTable).values({
      planId, nom: body.nom, type: body.type, taille: body.taille, data: body.data,
    }).returning();
    res.status(201).json({
      id: attachment.id, planId: attachment.planId, nom: attachment.nom,
      type: attachment.type, taille: attachment.taille, createdAt: attachment.createdAt,
    });
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// GET /plans/:id/attachments/:attachmentId/download
router.get("/plans/:id/attachments/:attachmentId/download", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);
    const rows = await db.select().from(attachmentsTable)
      .where(and(eq(attachmentsTable.id, attachmentId), eq(attachmentsTable.planId, planId)));
    if (!rows.length) return res.status(404).json({ error: "Attachment not found" });
    const att = rows[0];
    if (!att.data) return res.status(404).json({ error: "No file data stored" });

    // att.data is a base64 data URL like "data:application/pdf;base64,..."
    const match = att.data.match(/^data:(.+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Invalid file data format" });

    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(att.nom)}"`);
    res.setHeader("Content-Length", buffer.length.toString());
    res.send(buffer);
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /plans/:id/attachments/:attachmentId
router.delete("/plans/:id/attachments/:attachmentId", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);
    await db.delete(attachmentsTable).where(and(eq(attachmentsTable.id, attachmentId), eq(attachmentsTable.planId, planId)));
    res.status(204).send();
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
