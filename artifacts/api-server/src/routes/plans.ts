import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { plansTable, moyensTable, attachmentsTable, directionsTable, usersTable, beneficiairesMoyenTable, materielItemsTable, materielDemandesTable, locationItemsTable, locationDemandesTable, carburantDemandesTable, depenseDemandesTable } from "@workspace/db/schema";
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
  mailMaterielDemande,
  mailBonSoumisDcgai,
  mailBonValide,
} from "../mailer";

const router: IRouter = Router();

const CATEGORY_ROLE: Record<string, string> = {
  carburant: "dmg",
  location: "dmg",
  materiel: "da",
  outillage: "da",
  accessoire: "da",
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
    locationVehiculeSimple: m.locationVehiculeSimple ?? null,
    locationEngin: m.locationEngin ?? null,
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
      if (current.statut === "brouillon") {
        // Check if the creator is a directeur_centrale — if so, skip DC validation step
        const creator = current.createdById
          ? (await db.select({ niveau: usersTable.niveau }).from(usersTable).where(eq(usersTable.id, current.createdById)))[0]
          : null;
        newStatut = creator?.niveau === "directeur_centrale" ? "en_attente_ct" : "en_attente_dc";
      }
      else if (current.statut === "en_attente_dc")  newStatut = "en_attente_ct";
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
          if (newStatut === "en_attente_dc") {
            // Notify all directeur_centrale users in the same direction
            const dcUsers = await db.select({ email: usersTable.email })
              .from(usersTable)
              .where(and(eq(usersTable.niveau, "directeur_centrale"), eq(usersTable.directionId, current.directionId)));
            const emails = dcUsers.map(u => u.email).filter(Boolean);
            if (emails.length) {
              const { subject, html } = mailPlanCreated(plan);
              await sendMail({ to: emails, subject, html });
            }
          } else if (newStatut === "en_attente_ct") {
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

// DELETE /plans/:id  (admin only — enforced client-side; server deletes unconditionally)
router.delete("/plans/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select({ id: plansTable.id }).from(plansTable).where(eq(plansTable.id, id));
    if (!existing.length) return res.status(404).json({ error: "Plan non trouvé." });
    await db.delete(plansTable).where(eq(plansTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: String(err) });
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
      listeMaterielJson: (body as any).listeMaterielJson ?? null,
      locationVehiculeSimple: (body as any).locationVehiculeSimple ?? null,
      locationEngin: (body as any).locationEngin ?? null,
    }).returning();

    // Seed location_items when categorie is location
    if (body.categorie === "location" && (body as any).listeMaterielJson) {
      try {
        const items: Array<{ typeEngin: string; nbJours: number }> = JSON.parse((body as any).listeMaterielJson);
        if (items.length > 0) {
          await db.insert(locationItemsTable).values(
            items.map(i => ({
              moyenId: moyen.id,
              typeEngin: i.typeEngin,
              nbJoursTotal: Number(i.nbJours) || 1,
              nbJoursRestants: Number(i.nbJours) || 1,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to seed location_items", e);
      }
    }

    // Seed materiel_items when categorie is materiel
    if (body.categorie === "materiel" && (body as any).listeMaterielJson) {
      try {
        const items: Array<{ item: string; quantite: number }> = JSON.parse((body as any).listeMaterielJson);
        if (items.length > 0) {
          await db.insert(materielItemsTable).values(
            items.map(i => ({
              moyenId: moyen.id,
              item: i.item,
              quantiteInitiale: Number(i.quantite) || 0,
              quantiteRestante: Number(i.quantite) || 0,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to seed materiel_items", e);
      }
    }

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

// ======================== MATERIEL WORKFLOW ========================

function mapMaterielDemande(d: typeof materielDemandesTable.$inferSelect) {
  return {
    ...d,
    items: JSON.parse(d.itemsJson || "[]"),
    montantTotal: d.montantTotal ? Number(d.montantTotal) : null,
    daValidatedAt: d.daValidatedAt ?? null,
    dcgaiValidatedAt: d.dcgaiValidatedAt ?? null,
  };
}

// GET /plans/:id/moyens/:moyenId/materiel-items
router.get("/plans/:id/moyens/:moyenId/materiel-items", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const items = await db.select().from(materielItemsTable).where(eq(materielItemsTable.moyenId, moyenId));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /plans/:id/moyens/:moyenId/materiel-demandes
router.get("/plans/:id/moyens/:moyenId/materiel-demandes", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const demandes = await db.select().from(materielDemandesTable).where(eq(materielDemandesTable.moyenId, moyenId));
    res.json(demandes.map(mapMaterielDemande));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/materiel-demandes (direction creates request)
router.post("/plans/:id/moyens/:moyenId/materiel-demandes", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const { createdById, items } = req.body as {
      createdById: number;
      items: Array<{ materielItemId: number; item: string; quantiteDemandee: number }>;
    };

    if (!items || items.length === 0) return res.status(400).json({ error: "Aucun article sélectionné." });

    // Validate and deduct quantities
    for (const reqItem of items) {
      const [stockItem] = await db.select().from(materielItemsTable).where(eq(materielItemsTable.id, reqItem.materielItemId));
      if (!stockItem) return res.status(400).json({ error: `Article introuvable: ${reqItem.item}` });
      if (stockItem.quantiteRestante < reqItem.quantiteDemandee) {
        return res.status(400).json({ error: `Stock insuffisant pour "${reqItem.item}": disponible ${stockItem.quantiteRestante}, demandé ${reqItem.quantiteDemandee}` });
      }
    }

    // Deduct from stock
    for (const reqItem of items) {
      await db.update(materielItemsTable)
        .set({ quantiteRestante: sql`quantite_restante - ${reqItem.quantiteDemandee}` })
        .where(eq(materielItemsTable.id, reqItem.materielItemId));
    }

    const itemsJson = JSON.stringify(items.map(i => ({ item: i.item, quantiteDemandee: i.quantiteDemandee })));
    const [demande] = await db.insert(materielDemandesTable).values({
      moyenId,
      planId,
      createdById,
      statut: "en_attente_da",
      itemsJson,
    }).returning();

    // Notify DA
    try {
      const plan = await db.select({ id: plansTable.id, reference: plansTable.reference, titre: plansTable.titre })
        .from(plansTable).where(eq(plansTable.id, planId));
      const moyen = await db.select({ description: moyensTable.description }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      const daEmails = await getUserEmailsByRole(["da"]);
      const planInfo = plan[0];
      if (planInfo && moyen[0] && daEmails.length > 0) {
        const mail = mailMaterielDemande({ plan: { id: planInfo.id, reference: planInfo.reference, titre: planInfo.titre }, moyen: moyen[0], items: items.map(i => ({ item: i.item, quantiteDemandee: i.quantiteDemandee })), demandeId: demande.id });
        await sendMail({ to: daEmails, ...mail });
      }
    } catch (e) { console.error("Mail error", e); }

    res.status(201).json(mapMaterielDemande(demande));
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/materiel-demandes/:demandeId/da-soumettre
router.post("/plans/:id/moyens/:moyenId/materiel-demandes/:demandeId/da-soumettre", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const demandeId = Number(req.params.demandeId);
    const { daUserId, items, decharge } = req.body as {
      daUserId: number;
      items: Array<{ item: string; quantiteDemandee: number; montantUnitaire: number }>;
      decharge?: { nom: string; mimeType: string; taille: number; data: string };
    };

    const [existing] = await db.select().from(materielDemandesTable).where(eq(materielDemandesTable.id, demandeId));
    if (!existing || existing.statut !== "en_attente_da") return res.status(400).json({ error: "Demande introuvable ou déjà traitée." });

    // Calculate total and build enriched items
    const enrichedItems = items.map(i => ({
      item: i.item,
      quantiteDemandee: i.quantiteDemandee,
      montantUnitaire: i.montantUnitaire,
      montantTotal: i.montantUnitaire * i.quantiteDemandee,
    }));
    const montantTotal = enrichedItems.reduce((s, i) => s + i.montantTotal, 0);

    // Generate bon number
    const plan = await db.select({ reference: plansTable.reference, titre: plansTable.titre, id: plansTable.id })
      .from(plansTable).where(eq(plansTable.id, planId));
    const planRef = plan[0]?.reference ?? `PLAN-${planId}`;
    const bonNumber = `BON-${planRef}-${String(demandeId).padStart(4, "0")}`;

    const [updated] = await db.update(materielDemandesTable)
      .set({
        statut: "en_attente_dcgai",
        itemsJson: JSON.stringify(enrichedItems),
        montantTotal: String(montantTotal),
        bonNumber,
        daValidatedById: daUserId,
        daValidatedAt: new Date(),
      })
      .where(eq(materielDemandesTable.id, demandeId))
      .returning();

    // Save decharge file if provided
    if (decharge?.data) {
      await db.insert(attachmentsTable).values({
        planId,
        moyenId,
        nom: decharge.nom,
        type: "decharge_da",
        taille: decharge.taille,
        data: decharge.data,
      });
    }

    // Notify DCGAI
    try {
      const moyen = await db.select({ description: moyensTable.description }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      const dcgaiEmails = await getUserEmailsByRole(["dcgai"]);
      if (plan[0] && moyen[0] && dcgaiEmails.length > 0) {
        const mail = mailBonSoumisDcgai({ plan: { id: plan[0].id, reference: plan[0].reference, titre: plan[0].titre }, moyen: moyen[0], bonNumber, montantTotal, demandeId });
        await sendMail({ to: dcgaiEmails, ...mail });
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(mapMaterielDemande(updated));
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/materiel-demandes/:demandeId/dcgai-valider
router.post("/plans/:id/moyens/:moyenId/materiel-demandes/:demandeId/dcgai-valider", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const demandeId = Number(req.params.demandeId);
    const { dcgaiUserId } = req.body as { dcgaiUserId: number };

    const [existing] = await db.select().from(materielDemandesTable).where(eq(materielDemandesTable.id, demandeId));
    if (!existing || existing.statut !== "en_attente_dcgai") return res.status(400).json({ error: "Bon introuvable ou déjà validé." });

    const montantTotal = Number(existing.montantTotal ?? 0);

    const [updated] = await db.update(materielDemandesTable)
      .set({ statut: "validee", dcgaiValidatedById: dcgaiUserId, dcgaiValidatedAt: new Date() })
      .where(eq(materielDemandesTable.id, demandeId))
      .returning();

    // Deduct from moyen budget
    await db.update(moyensTable)
      .set({ montantConsomme: sql`COALESCE(montant_consomme::numeric, 0) + ${montantTotal}` })
      .where(eq(moyensTable.id, moyenId));

    // Notify direction (plan creator)
    try {
      const plan = await db.select({ id: plansTable.id, reference: plansTable.reference, titre: plansTable.titre, createdById: plansTable.createdById })
        .from(plansTable).where(eq(plansTable.id, planId));
      const moyen = await db.select({ description: moyensTable.description }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      if (plan[0] && moyen[0]) {
        const dirEmail = await getUserEmailById(plan[0].createdById);
        const bonNumber = existing.bonNumber ?? `BON-${demandeId}`;
        const mail = mailBonValide({ plan: { id: plan[0].id, reference: plan[0].reference, titre: plan[0].titre }, moyen: moyen[0], bonNumber, montantTotal });
        if (dirEmail) await sendMail({ to: dirEmail, ...mail });
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(mapMaterielDemande(updated));
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// ======================== LOCATION VÉHICULE WORKFLOW ========================

function mapLocationDemande(d: typeof locationDemandesTable.$inferSelect) {
  return {
    ...d,
    items: JSON.parse(d.itemsJson || "[]"),
    montantTotal: d.montantTotal ? Number(d.montantTotal) : null,
    dmgValidatedAt: d.dmgValidatedAt ?? null,
  };
}

// GET /plans/:id/moyens/:moyenId/location-items
router.get("/plans/:id/moyens/:moyenId/location-items", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const items = await db.select().from(locationItemsTable).where(eq(locationItemsTable.moyenId, moyenId));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /plans/:id/moyens/:moyenId/location-demandes
router.get("/plans/:id/moyens/:moyenId/location-demandes", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const demandes = await db.select().from(locationDemandesTable).where(eq(locationDemandesTable.moyenId, moyenId));
    res.json(demandes.map(mapLocationDemande));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/location-demandes (direction creates request)
router.post("/plans/:id/moyens/:moyenId/location-demandes", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const { createdById, items } = req.body as {
      createdById: number;
      items: Array<{ locationItemId: number; typeEngin: string; nbJoursDemandes: number }>;
    };
    if (!items?.length) return res.status(400).json({ error: "Aucun item sélectionné." });

    // Validate against remaining days
    for (const sel of items) {
      const dbItem = await db.select().from(locationItemsTable).where(eq(locationItemsTable.id, sel.locationItemId));
      if (!dbItem.length) return res.status(400).json({ error: `Item ${sel.locationItemId} introuvable.` });
      if (sel.nbJoursDemandes > dbItem[0].nbJoursRestants) {
        return res.status(400).json({ error: `Nombre de jours demandés (${sel.nbJoursDemandes}) dépasse le disponible (${dbItem[0].nbJoursRestants}) pour ${dbItem[0].typeEngin}.` });
      }
    }

    // Deduct days from remaining
    for (const sel of items) {
      const dbItem = await db.select().from(locationItemsTable).where(eq(locationItemsTable.id, sel.locationItemId));
      await db.update(locationItemsTable)
        .set({ nbJoursRestants: dbItem[0].nbJoursRestants - sel.nbJoursDemandes })
        .where(eq(locationItemsTable.id, sel.locationItemId));
    }

    const [demande] = await db.insert(locationDemandesTable).values({
      planId,
      moyenId,
      createdById,
      statut: "en_attente_dmg",
      itemsJson: JSON.stringify(items),
    }).returning();

    // Notify DMG
    try {
      const plan = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const moyen = await db.select().from(moyensTable).where(eq(moyensTable.id, moyenId));
      const dmgEmails = await getUserEmailsByRole(["dmg"]);
      if (plan[0] && moyen[0] && dmgEmails.length > 0) {
        await sendMail({
          to: dmgEmails,
          subject: `[SOMELEC] Nouvelle demande location véhicule — ${plan[0].reference ?? plan[0].id}`,
          html: `<p>Une nouvelle demande de location véhicule a été soumise pour le plan <strong>${plan[0].titre}</strong> (réf. ${plan[0].reference ?? plan[0].id}).</p>
          <p>Moyen : ${moyen[0].description}</p>
          <p>Engins demandés : ${items.map(i => `${i.typeEngin} (${i.nbJoursDemandes} jour(s))`).join(", ")}</p>
          <p>Veuillez vous connecter pour traiter cette demande.</p>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.status(201).json(mapLocationDemande(demande));
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// POST /plans/:id/moyens/:moyenId/location-demandes/:demandeId/dmg-valider
router.post("/plans/:id/moyens/:moyenId/location-demandes/:demandeId/dmg-valider", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const demandeId = Number(req.params.demandeId);
    const { dmgUserId, itemsMontants, decharge } = req.body as {
      dmgUserId: number;
      itemsMontants: Array<{ locationItemId: number; typeEngin: string; nbJoursDemandes: number; montant: number }>;
      decharge?: { nom: string; mimeType: string; taille: number; data: string };
    };

    const existing = await db.select().from(locationDemandesTable).where(eq(locationDemandesTable.id, demandeId));
    if (!existing.length || existing[0].statut !== "en_attente_dmg") {
      return res.status(400).json({ error: "Demande introuvable ou déjà traitée." });
    }

    const montantTotal = itemsMontants.reduce((s, i) => s + (Number(i.montant) || 0), 0);

    // Deduct from moyen budget
    const moyen = await db.select().from(moyensTable).where(eq(moyensTable.id, moyenId));
    if (moyen.length) {
      const current = Number(moyen[0].montantConsomme ?? 0);
      await db.update(moyensTable)
        .set({ montantConsomme: String(current + montantTotal) })
        .where(eq(moyensTable.id, moyenId));
    }

    const [updated] = await db.update(locationDemandesTable)
      .set({
        statut: "validee",
        itemsJson: JSON.stringify(itemsMontants),
        montantTotal: String(montantTotal),
        dmgValidatedById: dmgUserId,
        dmgValidatedAt: new Date(),
      })
      .where(eq(locationDemandesTable.id, demandeId))
      .returning();

    // Save decharge file if provided
    if (decharge?.data) {
      await db.insert(attachmentsTable).values({
        planId,
        moyenId,
        nom: decharge.nom,
        type: "decharge_dmg",
        taille: decharge.taille,
        data: decharge.data,
      });
    }

    // Notify direction
    try {
      const plan = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const dirEmail = plan[0] ? await getUserEmailById(plan[0].createdById) : null;
      if (dirEmail && plan[0]) {
        await sendMail({
          to: dirEmail,
          subject: `[SOMELEC] Demande location véhicule validée — ${plan[0].reference ?? plan[0].id}`,
          html: `<p>Votre demande de location véhicule pour le plan <strong>${plan[0].titre}</strong> a été validée par la DMG.</p>
          <p>Montant total : <strong>${montantTotal.toLocaleString("fr-MR")} MRU</strong></p>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(mapLocationDemande(updated));
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// ─────────────────── CARBURANT WORKFLOW ───────────────────

const mapCarburantDemande = (d: typeof carburantDemandesTable.$inferSelect) => ({
  id: d.id, moyenId: d.moyenId, planId: d.planId, createdById: d.createdById,
  montantDemande: Number(d.montantDemande), statut: d.statut,
  montantValide: d.montantValide !== null ? Number(d.montantValide) : null,
  cadValidatedById: d.cadValidatedById, cadValidatedAt: d.cadValidatedAt, createdAt: d.createdAt,
});

// GET /plans/:id/moyens/:moyenId/carburant-demandes
router.get("/plans/:id/moyens/:moyenId/carburant-demandes", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const rows = await db.select().from(carburantDemandesTable).where(eq(carburantDemandesTable.moyenId, moyenId));
    res.json(rows.map(mapCarburantDemande));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/carburant-demandes
router.post("/plans/:id/moyens/:moyenId/carburant-demandes", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const { createdById, montantDemande } = req.body as { createdById: number; montantDemande: number };
    if (!montantDemande || montantDemande <= 0) return res.status(400).json({ error: "Montant invalide." });

    const [demande] = await db.insert(carburantDemandesTable).values({
      planId, moyenId, createdById, montantDemande: String(montantDemande), statut: "en_attente_cad",
    }).returning();

    try {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const [moyen] = await db.select({ description: moyensTable.description }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      const cadEmails = await getUserEmailsByRole(["cad"]);
      if (plan && moyen && cadEmails.length > 0) {
        await sendMail({
          to: cadEmails,
          subject: `[SOMELEC] Demande carburant — ${plan.reference ?? plan.id}`,
          html: `<p>Une demande de carburant de <strong>${Number(montantDemande).toLocaleString("fr-MR")} MRU</strong> a été soumise pour le plan <strong>${plan.titre}</strong>.<br>Moyen : ${moyen.description}<br>Connectez-vous pour valider.</p>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.status(201).json(mapCarburantDemande(demande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/carburant-demandes/:demandeId/cad-valider
router.post("/plans/:id/moyens/:moyenId/carburant-demandes/:demandeId/cad-valider", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const demandeId = Number(req.params.demandeId);
    const { cadUserId, montantValide, decharge } = req.body as {
      cadUserId: number;
      montantValide: number;
      decharge?: { nom: string; mimeType: string; taille: number; data: string };
    };

    const [existing] = await db.select().from(carburantDemandesTable).where(eq(carburantDemandesTable.id, demandeId));
    if (!existing || existing.statut !== "en_attente_cad") return res.status(400).json({ error: "Demande introuvable ou déjà traitée." });

    const [updated] = await db.update(carburantDemandesTable)
      .set({ statut: "validee", montantValide: String(montantValide), cadValidatedById: cadUserId, cadValidatedAt: new Date() })
      .where(eq(carburantDemandesTable.id, demandeId)).returning();

    // Deduct from moyen budget
    const [moyen] = await db.select().from(moyensTable).where(eq(moyensTable.id, moyenId));
    if (moyen) {
      await db.update(moyensTable)
        .set({ montantConsomme: String(Number(moyen.montantConsomme ?? 0) + montantValide) })
        .where(eq(moyensTable.id, moyenId));
    }

    if (decharge?.data) {
      await db.insert(attachmentsTable).values({
        planId, moyenId, nom: decharge.nom, type: "decharge_cad", taille: decharge.taille, data: decharge.data,
      });
    }

    try {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const dirEmail = plan ? await getUserEmailById(plan.createdById) : null;
      if (dirEmail && plan) {
        await sendMail({
          to: dirEmail,
          subject: `[SOMELEC] Demande carburant validée — ${plan.reference ?? plan.id}`,
          html: `<p>Votre demande carburant pour le plan <strong>${plan.titre}</strong> a été validée.<br>Montant : <strong>${montantValide.toLocaleString("fr-MR")} MRU</strong></p>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(mapCarburantDemande(updated));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// ─────────────────── DÉPENSES WORKFLOW (prime/logement/logistique/indemnité/autres) ───────────────────

const mapDepenseDemande = (d: typeof depenseDemandesTable.$inferSelect) => ({
  id: d.id, moyenId: d.moyenId, planId: d.planId, createdById: d.createdById,
  montantDemande: Number(d.montantDemande), nomBeneficiaire: d.nomBeneficiaire,
  matriculeBeneficiaire: d.matriculeBeneficiaire, batchRef: d.batchRef ?? null, statut: d.statut,
  dcgaiValidatedById: d.dcgaiValidatedById, dcgaiValidatedAt: d.dcgaiValidatedAt,
  dfcValidatedById: d.dfcValidatedById, dfcValidatedAt: d.dfcValidatedAt,
  montantPaye: d.montantPaye !== null ? Number(d.montantPaye) : null,
  pieceReference: d.pieceReference, createdAt: d.createdAt,
});

// GET /plans/:id/moyens/:moyenId/depense-demandes
router.get("/plans/:id/moyens/:moyenId/depense-demandes", async (req, res) => {
  try {
    const moyenId = Number(req.params.moyenId);
    const rows = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.moyenId, moyenId));
    res.json(rows.map(mapDepenseDemande));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /plans/:id/depense-demandes  (all pending for DCGAI/DFC)
router.get("/plans/:id/depense-demandes-all", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const rows = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.planId, planId));
    res.json(rows.map(mapDepenseDemande));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes/batch  (prime / indemnite_journaliere)
router.post("/plans/:id/moyens/:moyenId/depense-demandes/batch", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const { createdById, lignes } = req.body as {
      createdById: number;
      lignes: Array<{ nomBeneficiaire: string; matriculeBeneficiaire?: string; montantDemande: number }>;
    };
    if (!Array.isArray(lignes) || lignes.length === 0) return res.status(400).json({ error: "Au moins une ligne requise." });
    if (lignes.some(l => !l.montantDemande || l.montantDemande <= 0)) return res.status(400).json({ error: "Montants invalides." });

    const batchRef = `BATCH-${planId}-${moyenId}-${Date.now()}`;

    const inserted = await db.insert(depenseDemandesTable).values(
      lignes.map(l => ({
        planId, moyenId, createdById,
        montantDemande: String(l.montantDemande),
        nomBeneficiaire: l.nomBeneficiaire.trim(),
        matriculeBeneficiaire: l.matriculeBeneficiaire?.trim() || null,
        batchRef,
        statut: "en_attente_dcgai" as const,
      }))
    ).returning();

    try {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const [moyen] = await db.select({ description: moyensTable.description, categorie: moyensTable.categorie }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      const dcgaiEmails = await getUserEmailsByRole(["dcgai"]);
      if (plan && moyen && dcgaiEmails.length > 0) {
        const rows = lignes.map(l => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${l.nomBeneficiaire}${l.matriculeBeneficiaire ? ` (${l.matriculeBeneficiaire})` : ""}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${Number(l.montantDemande).toLocaleString("fr-MR")} MRU</td></tr>`).join("");
        await sendMail({
          to: dcgaiEmails,
          subject: `[SOMELEC] Demande groupée ${moyen.categorie} — ${plan.reference ?? plan.id}`,
          html: `<p>Nouvelle demande groupée (${lignes.length} bénéficiaire(s)) pour le plan <strong>${plan.titre}</strong> — ${plan.reference ?? ""}.<br>Catégorie : <strong>${moyen.categorie}</strong> — ${moyen.description}</p><table style="border-collapse:collapse;margin-top:12px"><thead><tr><th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f5">Bénéficiaire</th><th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f5">Montant</th></tr></thead><tbody>${rows}</tbody></table>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.status(201).json(inserted.map(mapDepenseDemande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/dcgai-valider
router.post("/plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/dcgai-valider", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const batchRef = req.params.batchRef;
    const { dcgaiUserId } = req.body as { dcgaiUserId: number };

    const rows = await db.select().from(depenseDemandesTable)
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_dcgai")));
    if (rows.length === 0) return res.status(400).json({ error: "Aucune demande en attente pour ce batch." });

    const updated = await db.update(depenseDemandesTable)
      .set({ statut: "en_attente_dfc", dcgaiValidatedById: dcgaiUserId, dcgaiValidatedAt: new Date() })
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_dcgai")))
      .returning();

    try {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const [moyen] = await db.select({ description: moyensTable.description, categorie: moyensTable.categorie }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      const dfcEmails = await getUserEmailsByRole(["direction_financiere"]);
      if (plan && moyen && dfcEmails.length > 0) {
        const tableRows = rows.map(r => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${r.nomBeneficiaire}${r.matriculeBeneficiaire ? ` (${r.matriculeBeneficiaire})` : ""}</td><td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${Number(r.montantDemande).toLocaleString("fr-MR")} MRU</td></tr>`).join("");
        await sendMail({
          to: dfcEmails,
          subject: `[SOMELEC] Dépense groupée validée DCGAI — paiement à effectuer — ${plan.reference ?? plan.id}`,
          html: `<p>Une demande groupée (${rows.length} bénéficiaire(s)) a été validée par le DCGAI pour le plan <strong>${plan.titre}</strong> (${plan.reference ?? ""}).<br>Catégorie : <strong>${moyen.categorie}</strong> — ${moyen.description}<br>Un document PDF est disponible sur l'application.</p><table style="border-collapse:collapse;margin-top:12px"><thead><tr><th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f5">Bénéficiaire</th><th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f5">Montant</th></tr></thead><tbody>${tableRows}</tbody></table>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(updated.map(mapDepenseDemande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes
router.post("/plans/:id/moyens/:moyenId/depense-demandes", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const { createdById, montantDemande, nomBeneficiaire, matriculeBeneficiaire } = req.body as {
      createdById: number; montantDemande: number; nomBeneficiaire: string; matriculeBeneficiaire?: string;
    };
    if (!montantDemande || montantDemande <= 0) return res.status(400).json({ error: "Montant invalide." });
    if (!nomBeneficiaire?.trim()) return res.status(400).json({ error: "Nom du bénéficiaire requis." });

    const [demande] = await db.insert(depenseDemandesTable).values({
      planId, moyenId, createdById, montantDemande: String(montantDemande),
      nomBeneficiaire, matriculeBeneficiaire: matriculeBeneficiaire ?? null, statut: "en_attente_dcgai",
    }).returning();

    try {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const [moyen] = await db.select({ description: moyensTable.description, categorie: moyensTable.categorie }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      const dcgaiEmails = await getUserEmailsByRole(["dcgai"]);
      if (plan && moyen && dcgaiEmails.length > 0) {
        await sendMail({
          to: dcgaiEmails,
          subject: `[SOMELEC] Demande dépense ${moyen.categorie} — ${plan.reference ?? plan.id}`,
          html: `<p>Nouvelle demande de dépense de <strong>${Number(montantDemande).toLocaleString("fr-MR")} MRU</strong> pour le plan <strong>${plan.titre}</strong>.<br>Catégorie : ${moyen.categorie} — Moyen : ${moyen.description}<br>Bénéficiaire : ${nomBeneficiaire}${matriculeBeneficiaire ? ` (${matriculeBeneficiaire})` : ""}</p>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.status(201).json(mapDepenseDemande(demande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes/:demandeId/dcgai-valider
router.post("/plans/:id/moyens/:moyenId/depense-demandes/:demandeId/dcgai-valider", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const demandeId = Number(req.params.demandeId);
    const { dcgaiUserId } = req.body as { dcgaiUserId: number };

    const [existing] = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.id, demandeId));
    if (!existing || existing.statut !== "en_attente_dcgai") return res.status(400).json({ error: "Demande introuvable ou déjà traitée." });

    const [updated] = await db.update(depenseDemandesTable)
      .set({ statut: "en_attente_dfc", dcgaiValidatedById: dcgaiUserId, dcgaiValidatedAt: new Date() })
      .where(eq(depenseDemandesTable.id, demandeId)).returning();

    try {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      const [moyen] = await db.select({ description: moyensTable.description }).from(moyensTable).where(eq(moyensTable.id, moyenId));
      const dfcEmails = await getUserEmailsByRole(["direction_financiere"]);
      if (plan && moyen && dfcEmails.length > 0) {
        await sendMail({
          to: dfcEmails,
          subject: `[SOMELEC] Dépense validée DCGAI — paiement à effectuer — ${plan.reference ?? plan.id}`,
          html: `<p>Une dépense a été validée par le DCGAI pour le plan <strong>${plan.titre}</strong>.<br>Moyen : ${moyen.description}<br>Bénéficiaire : ${existing.nomBeneficiaire}${existing.matriculeBeneficiaire ? ` (${existing.matriculeBeneficiaire})` : ""}<br>Montant demandé : <strong>${Number(existing.montantDemande).toLocaleString("fr-MR")} MRU</strong><br>Connectez-vous pour effectuer le paiement.</p>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(mapDepenseDemande(updated));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes/:demandeId/dfc-payer
router.post("/plans/:id/moyens/:moyenId/depense-demandes/:demandeId/dfc-payer", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const demandeId = Number(req.params.demandeId);
    const { dfcUserId, montantPaye } = req.body as { dfcUserId: number; montantPaye: number };

    const [existing] = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.id, demandeId));
    if (!existing || existing.statut !== "en_attente_dfc") return res.status(400).json({ error: "Demande introuvable ou déjà traitée." });

    const [plan] = await db.select({ reference: plansTable.reference, titre: plansTable.titre, id: plansTable.id, createdById: plansTable.createdById })
      .from(plansTable).where(eq(plansTable.id, planId));
    const planRef = plan?.reference ?? `PLAN-${planId}`;
    const pieceReference = `PIECE-${planRef}-${String(demandeId).padStart(4, "0")}`;

    const [updated] = await db.update(depenseDemandesTable)
      .set({ statut: "payee", dfcValidatedById: dfcUserId, dfcValidatedAt: new Date(), montantPaye: String(montantPaye), pieceReference })
      .where(eq(depenseDemandesTable.id, demandeId)).returning();

    // Deduct from moyen budget
    const [moyen] = await db.select().from(moyensTable).where(eq(moyensTable.id, moyenId));
    if (moyen) {
      await db.update(moyensTable)
        .set({ montantConsomme: String(Number(moyen.montantConsomme ?? 0) + montantPaye) })
        .where(eq(moyensTable.id, moyenId));
    }

    try {
      const dirEmail = plan ? await getUserEmailById(plan.createdById) : null;
      if (dirEmail && plan) {
        await sendMail({
          to: dirEmail,
          subject: `[SOMELEC] Paiement effectué — ${pieceReference}`,
          html: `<p>Le paiement pour le plan <strong>${plan.titre}</strong> a été effectué.<br>Bénéficiaire : ${existing.nomBeneficiaire}<br>Montant payé : <strong>${montantPaye.toLocaleString("fr-MR")} MRU</strong><br>Réf. pièce : <strong>${pieceReference}</strong></p>`,
        });
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(mapDepenseDemande(updated));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/dfc-payer
router.post("/plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/dfc-payer", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const moyenId = Number(req.params.moyenId);
    const batchRef = req.params.batchRef;
    const { dfcUserId, montantTotal } = req.body as { dfcUserId: number; montantTotal: number };

    const rows = await db.select().from(depenseDemandesTable)
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_dfc")));
    if (rows.length === 0) return res.status(400).json({ error: "Aucune demande en attente de paiement pour ce batch." });

    const pieceReference = `BATCH-PIECE-${planId}-${Date.now()}`;

    const updated = await db.update(depenseDemandesTable)
      .set({ statut: "payee", dfcValidatedById: dfcUserId, dfcValidatedAt: new Date(), montantPaye: String(montantTotal), pieceReference })
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_dfc")))
      .returning();

    // Deduct total from moyen budget
    const [moyen] = await db.select().from(moyensTable).where(eq(moyensTable.id, moyenId));
    if (moyen) {
      await db.update(moyensTable)
        .set({ montantConsomme: String(Number(moyen.montantConsomme ?? 0) + montantTotal) })
        .where(eq(moyensTable.id, moyenId));
    }

    try {
      const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
      if (plan) {
        const dirEmail = await getUserEmailById(plan.createdById);
        if (dirEmail) {
          await sendMail({
            to: dirEmail,
            subject: `[SOMELEC] Paiement groupé effectué — ${pieceReference}`,
            html: `<p>Le paiement groupé (${rows.length} bénéficiaire(s)) pour le plan <strong>${plan.titre}</strong> a été effectué.<br>Montant total : <strong>${montantTotal.toLocaleString("fr-MR")} MRU</strong><br>Réf. pièce : <strong>${pieceReference}</strong></p>`,
          });
        }
      }
    } catch (e) { console.error("Mail error", e); }

    res.json(updated.map(mapDepenseDemande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// GET /plans/:id/carburant-demandes-all  (all for CAD view)
router.get("/plans/:id/carburant-demandes-all", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const rows = await db.select().from(carburantDemandesTable).where(eq(carburantDemandesTable.planId, planId));
    res.json(rows.map(mapCarburantDemande));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
