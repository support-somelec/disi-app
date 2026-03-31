import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { plansTable, moyensTable, attachmentsTable, directionsTable, usersTable, beneficiairesMoyenTable } from "@workspace/db/schema";
import { eq, and, SQL, sql, inArray } from "drizzle-orm";
import {
  CreatePlanBody,
  UpdatePlanBody,
  ValidatePlanBody,
  AddMoyenBody,
  AddAttachmentBody,
  ConsommerMoyenBody,
  CloturerPlanBody,
} from "@workspace/api-zod";
import { z } from "zod/v4";
import {
  sendMail,
  mailPlanCreated,
  mailPlanValidated,
  mailPlanOpened,
  mailPlanRejected,
  mailDemandeExecution,
  mailDemandeExecutionRH,
  mailDemandeExecutionBenef,
  mailConsommationSaisie,
} from "../mailer";

const router: IRouter = Router();

const CATEGORY_ROLE: Record<string, string> = {
  carburant: "dmg",
  materiel: "da",
  prime: "controle_financier",
  logement: "direction_financiere",
  indemnite_journaliere: "direction_financiere",
  logistique: "direction_financiere",
  autres: "direction_financiere",
};

async function getUserEmailsByRole(roles: string[]): Promise<string[]> {
  const users = await db.select({ email: usersTable.email })
    .from(usersTable)
    .where(inArray(usersTable.role, roles));
  return users.map(u => u.email);
}

async function getUserEmailById(userId: number): Promise<string | null> {
  const rows = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
  return rows[0]?.email ?? null;
}

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

function mapMoyen(m: typeof moyensTable.$inferSelect) {
  return {
    ...m,
    budget: Number(m.budget),
    quantite: m.quantite ? Number(m.quantite) : null,
    montantConsomme: Number(m.montantConsomme),
    demandeStatus: m.demandeStatus ?? null,
    demandeById: m.demandeById ?? null,
    demandeAt: m.demandeAt ?? null,
    listeMaterielJson: m.listeMaterielJson ?? null,
  };
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
      moyenId: attachmentsTable.moyenId,
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
    moyens: moyens.map(mapMoyen),
    attachments,
  };
}

// GET /plans/analytics
router.get("/plans/analytics", async (req, res) => {
  try {
    const byDirectionRaw = await db
      .select({
        directionId: plansTable.directionId,
        directionNom: directionsTable.nom,
        directionCode: directionsTable.code,
        nombrePlans: sql<number>`count(distinct ${plansTable.id})`,
        budgetTotal: sql<number>`coalesce(sum(${moyensTable.budget}), 0)`,
        montantConsomme: sql<number>`coalesce(sum(${moyensTable.montantConsomme}), 0)`,
      })
      .from(plansTable)
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(moyensTable, eq(moyensTable.planId, plansTable.id))
      .groupBy(plansTable.directionId, directionsTable.nom, directionsTable.code)
      .orderBy(directionsTable.nom);

    const byCategorieRaw = await db
      .select({
        categorie: moyensTable.categorie,
        budgetTotal: sql<number>`coalesce(sum(${moyensTable.budget}), 0)`,
        montantConsomme: sql<number>`coalesce(sum(${moyensTable.montantConsomme}), 0)`,
        nombreMoyens: sql<number>`count(*)`,
      })
      .from(moyensTable)
      .groupBy(moyensTable.categorie)
      .orderBy(moyensTable.categorie);

    res.json({
      byDirection: byDirectionRaw.map(r => ({
        ...r,
        budgetTotal: Number(r.budgetTotal),
        montantConsomme: Number(r.montantConsomme),
        nombrePlans: Number(r.nombrePlans),
      })),
      byCategorie: byCategorieRaw.map(r => ({
        ...r,
        budgetTotal: Number(r.budgetTotal),
        montantConsomme: Number(r.montantConsomme),
        nombreMoyens: Number(r.nombreMoyens),
      })),
    });
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: "Internal server error" });
  }
});

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

    // Send notifications (fire-and-forget)
    if (plan && newStatut !== current.statut) {
      setImmediate(async () => {
        try {
          if (newStatut === "en_attente_ct") {
            const emails = await getUserEmailsByRole(["controle_technique"]);
            const { subject, html } = mailPlanCreated(plan);
            await sendMail({ to: emails, subject, html });
          } else if (newStatut === "en_attente_dga") {
            const emails = await getUserEmailsByRole(["dga"]);
            const { subject, html } = mailPlanValidated(plan, "dga");
            await sendMail({ to: emails, subject, html });
          } else if (newStatut === "en_attente_dg") {
            const emails = await getUserEmailsByRole(["directeur_general"]);
            const { subject, html } = mailPlanValidated(plan, "directeur_general");
            await sendMail({ to: emails, subject, html });
          } else if (newStatut === "ouvert") {
            const creatorEmail = plan.createdById ? await getUserEmailById(plan.createdById) : null;
            if (creatorEmail) {
              const { subject, html } = mailPlanOpened(plan);
              await sendMail({ to: [creatorEmail], subject, html });
            }
          } else if (newStatut === "rejete") {
            const creatorEmail = plan.createdById ? await getUserEmailById(plan.createdById) : null;
            if (creatorEmail) {
              const { subject, html } = mailPlanRejected(plan);
              await sendMail({ to: [creatorEmail], subject, html });
            }
          }
        } catch (e) { console.error("[notify]", String(e)); }
      });
    }

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
    res.json(moyens.map(mapMoyen));
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
      autresDirectionId: body.autresDirectionId ?? null,
    }).returning();
    res.status(201).json(mapMoyen(moyen));
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/demander
const DemanderBody = z.object({ demandeById: z.number().int() });

router.post("/plans/:id/moyens/:moyenId/demander", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const { demandeById } = DemanderBody.parse(req.body);

    const plan = await db.select().from(plansTable).where(eq(plansTable.id, planId));
    if (!plan.length) return res.status(404).json({ error: "Plan not found" });

    const existing = await db.select().from(moyensTable)
      .where(and(eq(moyensTable.id, moyenId), eq(moyensTable.planId, planId)));
    if (!existing.length) return res.status(404).json({ error: "Moyen not found" });

    const isPrime = existing[0].categorie === "prime";
    const requiredStatut = isPrime ? "cloture" : "ouvert";
    if (plan[0].statut !== requiredStatut) {
      return res.status(400).json({
        error: isPrime
          ? "La prime ne peut être demandée qu'après la clôture du plan"
          : "Le plan doit être ouvert",
      });
    }
    if (existing[0].demandeStatus === "demandee" || existing[0].demandeStatus === "consommee") {
      return res.status(400).json({ error: "Une demande a déjà été initiée pour ce moyen" });
    }
    if (Number(existing[0].montantConsomme) > 0) {
      return res.status(400).json({ error: "Ce moyen a déjà été consommé et ne peut plus faire l'objet d'une nouvelle demande." });
    }

    const [updated] = await db.update(moyensTable)
      .set({ demandeStatus: "demandee", demandeById, demandeAt: new Date() })
      .where(eq(moyensTable.id, moyenId))
      .returning();

    // Notify specialist
    const moyen = existing[0];
    const specialistRole = CATEGORY_ROLE[moyen.categorie];
    const planDetails = await getPlanWithDetails(planId);
    setImmediate(async () => {
      try {
        // Notify specialist (direction financière or other role)
        if (specialistRole) {
          const emails = await getUserEmailsByRole([specialistRole]);
          const { subject, html } = mailDemandeExecution({
            plan: planDetails!,
            moyen: { description: moyen.description, categorie: moyen.categorie, budget: Number(moyen.budget) },
            direction: planDetails?.directionNom ?? "",
          });
          await sendMail({ to: emails, subject, html });
        }
        // For prime — notify CF with beneficiaire list (stays "demandee" until CF validates)
        if (moyen.categorie === "prime") {
          const beneficiaires = await db.select().from(beneficiairesMoyenTable)
            .where(eq(beneficiairesMoyenTable.moyenId, moyenId));
          const cfEmails = await getUserEmailsByRole(["controle_financier"]);
          const { subject, html } = mailDemandeExecutionBenef({
            plan: planDetails!,
            moyen: { description: moyen.description, budget: Number(moyen.budget) },
            direction: planDetails?.directionNom ?? "",
            role: "CF",
            beneficiaires: beneficiaires.map(b => ({
              nom: b.nom,
              matricule: b.matricule,
              nni: b.nni,
              montant: Number(b.montant),
            })),
          });
          await sendMail({ to: cfEmails, subject, html });
        }
        // For indemnite_journaliere — also notify RH with beneficiaire list
        if (moyen.categorie === "indemnite_journaliere") {
          const beneficiaires = await db.select().from(beneficiairesMoyenTable)
            .where(eq(beneficiairesMoyenTable.moyenId, moyenId));
          if (beneficiaires.length > 0) {
            const rhEmails = await getUserEmailsByRole(["rh"]);
            const { subject, html } = mailDemandeExecutionRH({
              plan: planDetails!,
              moyen: { description: moyen.description, budget: Number(moyen.budget) },
              direction: planDetails?.directionNom ?? "",
              beneficiaires: beneficiaires.map(b => ({
                nom: b.nom,
                matricule: b.matricule,
                nni: b.nni,
                montant: Number(b.montant),
              })),
            });
            await sendMail({ to: rhEmails, subject, html });
            // Mark as treated when RH is notified
            await db.update(moyensTable)
              .set({ demandeStatus: "consommee" })
              .where(eq(moyensTable.id, moyenId));
          }
        }
      } catch (e) { console.error("[notify]", String(e)); }
    });

    res.json(mapMoyen(updated));
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

    const moyen = existing[0];
    // Enforce that a demand was initiated first
    if (moyen.demandeStatus !== "demandee") {
      return res.status(400).json({ error: "Ce moyen n'a pas de demande d'exécution en cours. La direction doit d'abord initier une demande." });
    }

    // Block budget overage for all categories except logistique, materiel, outillage, accessoire
    const CATEGORIES_DEPASSEMENT_AUTORISE = ["logistique", "materiel", "outillage", "accessoire"];
    const budget = Number(moyen.budget);
    if (!CATEGORIES_DEPASSEMENT_AUTORISE.includes(moyen.categorie ?? "") && body.montant > budget) {
      return res.status(400).json({
        error: `Le montant saisi (${body.montant.toLocaleString("fr-MR")} MRU) dépasse le budget prévu (${budget.toLocaleString("fr-MR")} MRU). Les dépassements de budget ne sont pas autorisés pour cette catégorie.`,
      });
    }

    const [updated] = await db.update(moyensTable)
      .set({ montantConsomme: String(body.montant), demandeStatus: "consommee" })
      .where(eq(moyensTable.id, moyenId))
      .returning();
    await db.update(plansTable).set({ updatedAt: new Date() }).where(eq(plansTable.id, planId));

    // Notify CF + DG
    const planDetails = await getPlanWithDetails(planId);
    setImmediate(async () => {
      try {
        const emails = await getUserEmailsByRole(["controle_financier", "directeur_general"]);
        const { subject, html } = mailConsommationSaisie({
          plan: planDetails!,
          moyen: { description: moyen.description, categorie: moyen.categorie, montant: body.montant, budget: Number(moyen.budget) },
        });
        await sendMail({ to: emails, subject, html });

        // For prime — after CF validates, notify RH with beneficiaire list
        if (moyen.categorie === "prime") {
          const beneficiaires = await db.select().from(beneficiairesMoyenTable)
            .where(eq(beneficiairesMoyenTable.moyenId, moyenId));
          if (beneficiaires.length > 0) {
            const rhEmails = await getUserEmailsByRole(["rh"]);
            const { subject: rhSubject, html: rhHtml } = mailDemandeExecutionBenef({
              plan: planDetails!,
              moyen: { description: moyen.description, budget: Number(moyen.budget) },
              direction: planDetails?.directionNom ?? "",
              role: "RH",
              beneficiaires: beneficiaires.map(b => ({
                nom: b.nom,
                matricule: b.matricule,
                nni: b.nni,
                montant: Number(b.montant),
              })),
            });
            await sendMail({ to: rhEmails, subject: rhSubject, html: rhHtml });
          }
        }
      } catch (e) { console.error("[notify]", String(e)); }
    });

    res.json(mapMoyen(updated));
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
      moyenId: attachmentsTable.moyenId,
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
      planId, moyenId: body.moyenId ?? null, nom: body.nom, type: body.type, taille: body.taille, data: body.data,
    }).returning();
    res.status(201).json({
      id: attachment.id, planId: attachment.planId, moyenId: attachment.moyenId,
      nom: attachment.nom, type: attachment.type, taille: attachment.taille, createdAt: attachment.createdAt,
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

// GET /plans/:id/moyens/:moyenId/beneficiaires
router.get("/plans/:id/moyens/:moyenId/beneficiaires", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const rows = await db.select().from(beneficiairesMoyenTable)
      .where(eq(beneficiairesMoyenTable.moyenId, moyenId));
    res.json(rows.map(b => ({ ...b, montant: Number(b.montant) })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/beneficiaires (replace all)
const BeneficiairesBody = z.object({
  beneficiaires: z.array(z.object({
    employeId: z.number().int().optional(),
    nom: z.string().min(1),
    matricule: z.string().optional(),
    nni: z.string().optional(),
    montant: z.number().positive(),
  })),
});

router.post("/plans/:id/moyens/:moyenId/beneficiaires", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const { beneficiaires } = BeneficiairesBody.parse(req.body);

    await db.delete(beneficiairesMoyenTable).where(eq(beneficiairesMoyenTable.moyenId, moyenId));

    if (beneficiaires.length > 0) {
      await db.insert(beneficiairesMoyenTable).values(
        beneficiaires.map(b => ({
          moyenId,
          employeId: b.employeId ?? null,
          nom: b.nom,
          matricule: b.matricule ?? null,
          nni: b.nni ?? null,
          montant: String(b.montant),
        }))
      );
    }

    const rows = await db.select().from(beneficiairesMoyenTable)
      .where(eq(beneficiairesMoyenTable.moyenId, moyenId));
    res.json(rows.map(b => ({ ...b, montant: Number(b.montant) })));
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
