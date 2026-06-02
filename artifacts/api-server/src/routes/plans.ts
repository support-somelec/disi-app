import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { plansTable, moyensTable, attachmentsTable, directionsTable, usersTable, beneficiairesMoyenTable, materielItemsTable, materielDemandesTable, locationItemsTable, locationDemandesTable, carburantDemandesTable, depenseDemandesTable, planCommentsTable } from "@workspace/db/schema";
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

  const comments = await db
    .select()
    .from(planCommentsTable)
    .where(eq(planCommentsTable.planId, planId))
    .orderBy(planCommentsTable.createdAt);

  return {
    ...plan,
    budgetTotal,
    montantConsomme,
    moyens: moyens.map(mapMoyen),
    attachments,
    comments,
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

    // Always record every approval/rejection in history for certificate traceability
    {
      const validatorRow = body.validatedById
        ? (await db.select({ nom: usersTable.nom, prenom: usersTable.prenom, role: usersTable.role })
            .from(usersTable).where(eq(usersTable.id, body.validatedById)))[0]
        : null;
      const validatorNom = validatorRow ? `${validatorRow.prenom} ${validatorRow.nom}` : null;
      const defaultComment = body.action === "approuver" ? `Approuvé (${current.statut})` : `Rejeté (${current.statut})`;
      await db.insert(planCommentsTable).values({
        planId: id,
        userId: body.validatedById ?? null,
        userNom: validatorNom,
        action: body.action,
        statutAvant: current.statut,
        commentaire: body.commentaire?.trim() || defaultComment,
      });
    }

    const plan = await getPlanWithDetails(id);

    res.json(plan);
  } catch (err) {
    console.error(String(err));
    res.status(400).json({ error: String(err) });
  }
});

// GET /plans/:id/certificat — HTML certificate for download
router.get("/plans/:id/certificat", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const plan = await getPlanWithDetails(id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // Fetch direction info
    const direction = plan.directionNom ?? "";

    // Build validation history from plan_comments (approvals only)
    const approvals = (plan.comments ?? []).filter(c => c.action === "approuver");

    const STATUT_LABELS: Record<string, string> = {
      brouillon: "Brouillon",
      en_attente_dc: "Direction Centrale",
      en_attente_ct: "Contrôle Technique",
      en_attente_dga: "Direction Générale Adjointe",
      en_attente_dg: "Direction Générale",
    };
    const ROLE_LABELS: Record<string, string> = {
      directeur_centrale: "Directeur Central",
      controle_technique: "Contrôle Technique",
      dga: "Directeur Général Adjoint",
      directeur_general: "Directeur Général",
    };

    // Compute hash for document integrity
    const crypto = await import("crypto");
    const hashInput = `${plan.id}-${plan.reference}-${plan.titre}-${plan.directionId}-${plan.createdAt}`;
    const hash = crypto.createHash("sha256").update(hashInput).digest("hex").toUpperCase();
    const shortHash = hash.slice(0, 16).match(/.{1,4}/g)!.join("-");

    const budgetTotal = plan.budgetTotal ?? 0;
    const formatMRU = (n: number) => n.toLocaleString("fr-FR") + " MRU";

    const openedAt = plan.statut === "ouvert" || plan.statut === "cloture"
      ? approvals.find(c => c.statutAvant === "en_attente_dg")?.createdAt
      : null;

    const validationRows = approvals.map(c => {
      const statutLabel = STATUT_LABELS[c.statutAvant ?? ""] ?? c.statutAvant ?? "—";
      const dateStr = new Date(c.createdAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
      const commentHtml = (c.commentaire && !c.commentaire.startsWith("Approuvé")) ? `<br><em style="color:#555;font-size:11px">${c.commentaire}</em>` : "";
      return `
        <tr>
          <td>${statutLabel}</td>
          <td>${c.userNom ?? "—"}</td>
          <td style="text-align:center">${dateStr}</td>
          <td style="text-align:center">
            <span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600">✓ Approuvé</span>
            ${commentHtml}
          </td>
        </tr>`;
    }).join("");

    const moyenRows = (plan.moyens ?? []).map(m => {
      const consomme = Number(m.montantConsomme ?? 0);
      const budget = Number(m.budget);
      const pct = budget > 0 ? Math.round(consomme / budget * 100) : 0;
      return `<tr>
        <td>${m.categorie}</td>
        <td>${m.description}</td>
        <td style="text-align:right">${formatMRU(budget)}</td>
        <td style="text-align:right">${formatMRU(consomme)}</td>
        <td style="text-align:center">${pct}%</td>
      </tr>`;
    }).join("");

    const now = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
    const openedStr = openedAt ? new Date(openedAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—";

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Certificat de Validation — ${plan.reference ?? plan.id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 13px; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 48px; }

  /* HEADER */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 28px; }
  .header-logo { display: flex; align-items: center; gap: 14px; }
  .org-name { font-size: 22px; font-weight: 800; color: #1e3a8a; letter-spacing: 1px; }
  .org-sub { font-size: 11px; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .header-right { text-align: right; }
  .cert-title { font-size: 14px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px; }
  .cert-ref { font-size: 11px; color: #64748b; margin-top: 4px; }

  /* STATUS BANNER */
  .status-banner { background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); color: #fff; border-radius: 10px; padding: 16px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
  .status-banner .plan-title { font-size: 18px; font-weight: 700; }
  .status-banner .plan-meta { font-size: 12px; opacity: 0.85; margin-top: 4px; }
  .status-badge { background: #22c55e; color: #fff; padding: 6px 18px; border-radius: 20px; font-weight: 700; font-size: 13px; white-space: nowrap; }

  /* SECTION */
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }

  /* INFO GRID */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .info-item { display: flex; flex-direction: column; }
  .info-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f1f5f9; color: #475569; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 1.5px solid #e2e8f0; }
  td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }

  /* HASH */
  .hash-block { background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 16px; }
  .hash-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .hash-value { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #1e3a8a; letter-spacing: 2px; }

  /* FOOTER */
  .footer { margin-top: 32px; border-top: 1.5px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #94a3b8; }
  .footer-note { max-width: 500px; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { padding: 20px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">
      <div>
        <div class="org-name">SOMELEC</div>
        <div class="org-sub">Plans d'Action</div>
      </div>
    </div>
    <div class="header-right">
      <div class="cert-title">Certificat de Validation</div>
      <div class="cert-ref">Généré le ${now}</div>
    </div>
  </div>

  <!-- STATUS BANNER -->
  <div class="status-banner">
    <div>
      <div class="plan-title">${plan.titre}</div>
      <div class="plan-meta">${direction} &nbsp;·&nbsp; Réf. ${plan.reference ?? `#${plan.id}`} &nbsp;·&nbsp; Ouvert le ${openedStr}</div>
    </div>
    <div class="status-badge">✓ Plan Validé</div>
  </div>

  <!-- PLAN INFO -->
  <div class="section">
    <div class="section-title">Informations du plan</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Direction</span><span class="info-value">${direction}</span></div>
      <div class="info-item"><span class="info-label">Créé par</span><span class="info-value">${plan.createdByNom ?? "—"}</span></div>
      <div class="info-item"><span class="info-label">Date de début</span><span class="info-value">${new Date(plan.dateDebut).toLocaleDateString("fr-FR", { dateStyle: "long" })}</span></div>
      <div class="info-item"><span class="info-label">Durée</span><span class="info-value">${plan.duree} mois</span></div>
      <div class="info-item"><span class="info-label">Budget total</span><span class="info-value">${formatMRU(budgetTotal)}</span></div>
      <div class="info-item"><span class="info-label">Nombre de moyens</span><span class="info-value">${(plan.moyens ?? []).length} moyen(s)</span></div>
      ${plan.description ? `<div class="info-item" style="grid-column:1/-1"><span class="info-label">Description</span><span class="info-value" style="font-weight:400">${plan.description}</span></div>` : ""}
    </div>
  </div>

  <!-- VALIDATION CHAIN -->
  <div class="section">
    <div class="section-title">Chaîne de validation</div>
    ${approvals.length === 0
      ? `<p style="color:#94a3b8;font-style:italic;font-size:12px;">Aucune validation enregistrée pour ce plan.</p>`
      : `<table>
          <thead><tr>
            <th>Étape</th>
            <th>Validateur</th>
            <th style="text-align:center">Date &amp; Heure</th>
            <th style="text-align:center">Décision</th>
          </tr></thead>
          <tbody>${validationRows}</tbody>
        </table>`
    }
  </div>

  <!-- MOYENS SUMMARY -->
  ${(plan.moyens ?? []).length > 0 ? `
  <div class="section">
    <div class="section-title">Récapitulatif des moyens</div>
    <table>
      <thead><tr>
        <th>Catégorie</th>
        <th>Description</th>
        <th style="text-align:right">Budget</th>
        <th style="text-align:right">Consommé</th>
        <th style="text-align:center">%</th>
      </tr></thead>
      <tbody>${moyenRows}</tbody>
    </table>
  </div>` : ""}

  <!-- INTEGRITY HASH -->
  <div class="section">
    <div class="section-title">Intégrité du document</div>
    <div class="hash-block">
      <div>
        <div class="hash-label">Empreinte numérique (SHA-256)</div>
        <div class="hash-value">${shortHash}</div>
      </div>
      <div style="font-size:11px;color:#94a3b8;max-width:340px">
        Cette empreinte est calculée à partir des données immuables du plan. Elle permet de vérifier l'authenticité de ce document dans l'application SOMELEC Plans d'Action.
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-note">
      Document généré automatiquement par SOMELEC Plans d'Action. Ce certificat atteste de la validation du plan d'action par la chaîne hiérarchique compétente.
    </div>
    <div style="text-align:right">
      <div style="font-weight:700;color:#1e3a8a">SOMELEC — Plans d'Action</div>
      <div>${plan.reference ?? `Plan #${plan.id}`}</div>
    </div>
  </div>

</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error(String(err));
    res.status(500).json({ error: String(err) });
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

    // Block closure if any depense is awaiting justificatif
    const nonJustifiees = await db.select({ id: depenseDemandesTable.id })
      .from(depenseDemandesTable)
      .where(and(eq(depenseDemandesTable.planId, id), eq(depenseDemandesTable.statut, "en_attente_justificatif")))
      .limit(1);
    if (nonJustifiees.length > 0) {
      return res.status(400).json({ error: "Ce plan contient des dépenses payées sans justificatif. Veuillez fournir les justificatifs avant de clôturer." });
    }

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

    const existingPending = await db.select().from(materielDemandesTable).where(
      and(eq(materielDemandesTable.moyenId, moyenId), inArray(materielDemandesTable.statut, ["en_attente_da", "en_attente_dcgai"]))
    );
    if (existingPending.length > 0) {
      return res.status(409).json({ error: "Une demande est déjà en cours de traitement pour ce moyen. Veuillez attendre qu'elle soit traitée avant d'en soumettre une nouvelle." });
    }

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

    const existingPending = await db.select().from(locationDemandesTable).where(
      and(eq(locationDemandesTable.moyenId, moyenId), eq(locationDemandesTable.statut, "en_attente_dmg"))
    );
    if (existingPending.length > 0) {
      return res.status(409).json({ error: "Une demande de location est déjà en cours de traitement pour ce moyen. Veuillez attendre qu'elle soit traitée avant d'en soumettre une nouvelle." });
    }

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

    const existing = await db.select().from(carburantDemandesTable).where(
      and(eq(carburantDemandesTable.moyenId, moyenId), eq(carburantDemandesTable.statut, "en_attente_cad"))
    );
    if (existing.length > 0) {
      return res.status(200).json(mapCarburantDemande(existing[0]));
    }

    const [demande] = await db.insert(carburantDemandesTable).values({
      planId, moyenId, createdById, montantDemande: String(montantDemande), statut: "en_attente_cad",
    }).returning();

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

    res.json(mapCarburantDemande(updated));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// ─────────────────── DÉPENSES WORKFLOW (prime/logement/logistique/indemnité/autres) ───────────────────

const mapDepenseDemande = (d: typeof depenseDemandesTable.$inferSelect) => ({
  id: d.id, moyenId: d.moyenId, planId: d.planId, createdById: d.createdById,
  montantDemande: Number(d.montantDemande), nomBeneficiaire: d.nomBeneficiaire,
  matriculeBeneficiaire: d.matriculeBeneficiaire, batchRef: d.batchRef ?? null, statut: d.statut,
  dcgaiValidatedById: d.dcgaiValidatedById, dcgaiValidatedAt: d.dcgaiValidatedAt,
  dcgaiAnnuleById: d.dcgaiAnnuleById, dcgaiAnnuleAt: d.dcgaiAnnuleAt,
  dfcValidatedById: d.dfcValidatedById, dfcValidatedAt: d.dfcValidatedAt,
  montantPaye: d.montantPaye !== null ? Number(d.montantPaye) : null,
  pieceReference: d.pieceReference,
  justificatifNom: d.justificatifNom ?? null,
  justificatifAt: d.justificatifAt ?? null,
  createdAt: d.createdAt,
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

    const existingPending = await db.select().from(depenseDemandesTable).where(
      and(eq(depenseDemandesTable.moyenId, moyenId), eq(depenseDemandesTable.statut, "en_attente_dcgai"))
    );
    if (existingPending.length > 0) {
      return res.status(409).json({ error: "Une demande est déjà en attente de validation pour ce moyen. Veuillez attendre qu'elle soit traitée par le DCGAI avant d'en soumettre une nouvelle." });
    }

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

    res.json(updated.map(mapDepenseDemande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/dcgai-annuler
router.post("/plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/dcgai-annuler", async (req, res) => {
  try {
    const batchRef = req.params.batchRef;
    const { dcgaiUserId } = req.body as { dcgaiUserId: number };

    const rows = await db.select().from(depenseDemandesTable)
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_dfc")));
    if (rows.length === 0) return res.status(400).json({ error: "Aucune demande validée trouvée pour ce batch." });

    const updated = await db.update(depenseDemandesTable)
      .set({
        statut: "en_attente_dcgai",
        dcgaiValidatedById: null,
        dcgaiValidatedAt: null,
        dcgaiAnnuleById: dcgaiUserId,
        dcgaiAnnuleAt: new Date(),
      })
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_dfc")))
      .returning();

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

    const existingPending = await db.select().from(depenseDemandesTable).where(
      and(
        eq(depenseDemandesTable.moyenId, moyenId),
        eq(depenseDemandesTable.nomBeneficiaire, nomBeneficiaire.trim()),
        eq(depenseDemandesTable.statut, "en_attente_dcgai")
      )
    );
    if (existingPending.length > 0) {
      return res.status(409).json({ error: `Une demande pour le bénéficiaire "${nomBeneficiaire}" est déjà en attente pour ce moyen. Elle a peut-être déjà été enregistrée malgré le problème réseau.` });
    }

    const [demande] = await db.insert(depenseDemandesTable).values({
      planId, moyenId, createdById, montantDemande: String(montantDemande),
      nomBeneficiaire, matriculeBeneficiaire: matriculeBeneficiaire ?? null, statut: "en_attente_dcgai",
    }).returning();

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

    res.json(mapDepenseDemande(updated));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes/:demandeId/dcgai-annuler
router.post("/plans/:id/moyens/:moyenId/depense-demandes/:demandeId/dcgai-annuler", async (req, res) => {
  try {
    const demandeId = Number(req.params.demandeId);
    const { dcgaiUserId } = req.body as { dcgaiUserId: number };

    const [existing] = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.id, demandeId));
    if (!existing || existing.statut !== "en_attente_dfc") return res.status(400).json({ error: "Demande introuvable ou statut incorrect." });

    const [updated] = await db.update(depenseDemandesTable)
      .set({
        statut: "en_attente_dcgai",
        dcgaiValidatedById: null,
        dcgaiValidatedAt: null,
        dcgaiAnnuleById: dcgaiUserId,
        dcgaiAnnuleAt: new Date(),
      })
      .where(eq(depenseDemandesTable.id, demandeId)).returning();

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
      .set({ statut: "en_attente_justificatif", dfcValidatedById: dfcUserId, dfcValidatedAt: new Date(), montantPaye: String(montantPaye), pieceReference })
      .where(eq(depenseDemandesTable.id, demandeId)).returning();

    // Deduct from moyen budget
    const [moyen] = await db.select().from(moyensTable).where(eq(moyensTable.id, moyenId));
    if (moyen) {
      await db.update(moyensTable)
        .set({ montantConsomme: String(Number(moyen.montantConsomme ?? 0) + montantPaye) })
        .where(eq(moyensTable.id, moyenId));
    }

    res.json(mapDepenseDemande(updated));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes/:demandeId/justifier
router.post("/plans/:id/moyens/:moyenId/depense-demandes/:demandeId/justifier", async (req, res) => {
  try {
    const demandeId = Number(req.params.demandeId);
    const { justificatifNom, justificatifData } = req.body as { justificatifNom: string; justificatifData: string };
    const [existing] = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.id, demandeId));
    if (!existing || existing.statut !== "en_attente_justificatif") return res.status(400).json({ error: "Demande introuvable ou statut incorrect." });

    const [updated] = await db.update(depenseDemandesTable)
      .set({ statut: "payee", justificatifNom, justificatifData, justificatifAt: new Date() })
      .where(eq(depenseDemandesTable.id, demandeId)).returning();

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
      .set({ statut: "en_attente_justificatif", dfcValidatedById: dfcUserId, dfcValidatedAt: new Date(), montantPaye: String(montantTotal), pieceReference })
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_dfc")))
      .returning();

    // Deduct total from moyen budget
    const [moyen] = await db.select().from(moyensTable).where(eq(moyensTable.id, moyenId));
    if (moyen) {
      await db.update(moyensTable)
        .set({ montantConsomme: String(Number(moyen.montantConsomme ?? 0) + montantTotal) })
        .where(eq(moyensTable.id, moyenId));
    }

    res.json(updated.map(mapDepenseDemande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// POST /plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/justifier
router.post("/plans/:id/moyens/:moyenId/depense-demandes-batch/:batchRef/justifier", async (req, res) => {
  try {
    const batchRef = req.params.batchRef;
    const { justificatifNom, justificatifData } = req.body as { justificatifNom: string; justificatifData: string };

    const rows = await db.select().from(depenseDemandesTable)
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_justificatif")));
    if (rows.length === 0) return res.status(400).json({ error: "Aucune demande en attente de justificatif pour ce batch." });

    const updated = await db.update(depenseDemandesTable)
      .set({ statut: "payee", justificatifNom, justificatifData, justificatifAt: new Date() })
      .where(and(eq(depenseDemandesTable.batchRef, batchRef), eq(depenseDemandesTable.statut, "en_attente_justificatif")))
      .returning();

    res.json(updated.map(mapDepenseDemande));
  } catch (err) { console.error(String(err)); res.status(400).json({ error: String(err) }); }
});

// GET /depenses/non-justifiees — all depense demandes awaiting justificatif (for DFC tab)
router.get("/depenses/non-justifiees", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: depenseDemandesTable.id,
        planId: depenseDemandesTable.planId,
        moyenId: depenseDemandesTable.moyenId,
        batchRef: depenseDemandesTable.batchRef,
        nomBeneficiaire: depenseDemandesTable.nomBeneficiaire,
        matriculeBeneficiaire: depenseDemandesTable.matriculeBeneficiaire,
        montantDemande: depenseDemandesTable.montantDemande,
        montantPaye: depenseDemandesTable.montantPaye,
        pieceReference: depenseDemandesTable.pieceReference,
        dfcValidatedAt: depenseDemandesTable.dfcValidatedAt,
        createdAt: depenseDemandesTable.createdAt,
        planReference: plansTable.reference,
        planTitre: plansTable.titre,
        directionNom: directionsTable.nom,
        moyenDescription: moyensTable.description,
        moyenCategorie: moyensTable.categorie,
      })
      .from(depenseDemandesTable)
      .leftJoin(plansTable, eq(depenseDemandesTable.planId, plansTable.id))
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(moyensTable, eq(depenseDemandesTable.moyenId, moyensTable.id))
      .where(eq(depenseDemandesTable.statut, "en_attente_justificatif"))
      .orderBy(depenseDemandesTable.dfcValidatedAt);

    res.json(rows.map(r => ({
      ...r,
      montantDemande: Number(r.montantDemande),
      montantPaye: r.montantPaye !== null ? Number(r.montantPaye) : null,
    })));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /depenses/non-justifiees/excel — Excel export
router.get("/depenses/non-justifiees/excel", async (req, res) => {
  try {
    const XLSX = await import("xlsx");
    const rows = await db
      .select({
        id: depenseDemandesTable.id,
        batchRef: depenseDemandesTable.batchRef,
        nomBeneficiaire: depenseDemandesTable.nomBeneficiaire,
        matriculeBeneficiaire: depenseDemandesTable.matriculeBeneficiaire,
        montantDemande: depenseDemandesTable.montantDemande,
        montantPaye: depenseDemandesTable.montantPaye,
        pieceReference: depenseDemandesTable.pieceReference,
        dfcValidatedAt: depenseDemandesTable.dfcValidatedAt,
        createdAt: depenseDemandesTable.createdAt,
        planReference: plansTable.reference,
        planTitre: plansTable.titre,
        directionNom: directionsTable.nom,
        moyenDescription: moyensTable.description,
        moyenCategorie: moyensTable.categorie,
      })
      .from(depenseDemandesTable)
      .leftJoin(plansTable, eq(depenseDemandesTable.planId, plansTable.id))
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(moyensTable, eq(depenseDemandesTable.moyenId, moyensTable.id))
      .where(eq(depenseDemandesTable.statut, "en_attente_justificatif"))
      .orderBy(depenseDemandesTable.dfcValidatedAt);

    const data = rows.map(r => ({
      "Réf. Plan": r.planReference ?? `Plan #${r.planId ?? ""}`,
      "Titre Plan": r.planTitre ?? "",
      "Direction": r.directionNom ?? "",
      "Catégorie": r.moyenCategorie ?? "",
      "Moyen": r.moyenDescription ?? "",
      "Bénéficiaire": r.nomBeneficiaire ?? "",
      "Matricule": r.matriculeBeneficiaire ?? "",
      "Montant demandé (MRU)": Number(r.montantDemande ?? 0),
      "Montant payé (MRU)": r.montantPaye !== null ? Number(r.montantPaye) : "",
      "Réf. pièce": r.pieceReference ?? "",
      "Date paiement": r.dfcValidatedAt ? new Date(r.dfcValidatedAt).toLocaleDateString("fr-FR") : "",
      "Date demande": r.createdAt ? new Date(r.createdAt).toLocaleDateString("fr-FR") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dépenses non justifiées");

    // Column widths
    ws["!cols"] = [18,30,20,14,25,25,14,22,20,20,16,14].map(w => ({ wch: w }));

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `depenses_non_justifiees_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /plans/:id/carburant-demandes-all  (all for CAD view)
router.get("/plans/:id/carburant-demandes-all", async (req, res) => {
  try {
    const planId = Number(req.params.id);
    const rows = await db.select().from(carburantDemandesTable).where(eq(carburantDemandesTable.planId, planId));
    res.json(rows.map(mapCarburantDemande));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── ADMIN: duplicate demandes detection & deletion ──────────────────────────

// GET /admin/doublons — detect all duplicate pending demandes across all types
router.get("/admin/doublons", async (req, res) => {
  try {
    const [carburantAll, materielAll, locationAll, depenseAll] = await Promise.all([
      db.select().from(carburantDemandesTable).where(eq(carburantDemandesTable.statut, "en_attente_cad")),
      db.select().from(materielDemandesTable).where(inArray(materielDemandesTable.statut, ["en_attente_da", "en_attente_dcgai"])),
      db.select().from(locationDemandesTable).where(eq(locationDemandesTable.statut, "en_attente_dmg")),
      db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.statut, "en_attente_dcgai")),
    ]);

    const groupByMoyen = <T extends { moyenId: number }>(rows: T[]): T[][] => {
      const map: Record<number, T[]> = {};
      for (const r of rows) {
        if (!map[r.moyenId]) map[r.moyenId] = [];
        map[r.moyenId].push(r);
      }
      return Object.values(map).filter(g => g.length > 1);
    };

    const carburantGroups = groupByMoyen(carburantAll);
    const materielGroups  = groupByMoyen(materielAll);
    const locationGroups  = groupByMoyen(locationAll);

    // Depense: count distinct batches (or individual records) per moyen
    const depenseByMoyen: Record<number, typeof depenseAll> = {};
    for (const r of depenseAll) {
      if (!depenseByMoyen[r.moyenId]) depenseByMoyen[r.moyenId] = [];
      depenseByMoyen[r.moyenId].push(r);
    }
    const depenseGroups = Object.values(depenseByMoyen).filter(g => {
      const units = new Set(g.map(r => r.batchRef ?? `ind:${r.id}`));
      return units.size > 1;
    });

    // Collect all relevant moyenIds
    const allMoyenIds = new Set<number>([
      ...carburantGroups.flatMap(g => g.map(r => r.moyenId)),
      ...materielGroups.flatMap(g => g.map(r => r.moyenId)),
      ...locationGroups.flatMap(g => g.map(r => r.moyenId)),
      ...depenseGroups.flatMap(g => g.map(r => r.moyenId)),
    ]);

    if (allMoyenIds.size === 0) {
      return res.json({ carburant: [], materiel: [], location: [], depense: [] });
    }

    const moyenInfos = await db.select({
      id: moyensTable.id, description: moyensTable.description,
      categorie: moyensTable.categorie, planId: moyensTable.planId,
    }).from(moyensTable).where(inArray(moyensTable.id, [...allMoyenIds]));

    const planIds = [...new Set(moyenInfos.map(m => m.planId))];
    const planInfos = await db.select({
      id: plansTable.id, titre: plansTable.titre, reference: plansTable.reference,
    }).from(plansTable).where(inArray(plansTable.id, planIds));

    const moyenMap = Object.fromEntries(moyenInfos.map(m => [m.id, m]));
    const planMap  = Object.fromEntries(planInfos.map(p => [p.id, p]));

    const enrichSimple = <T extends { id: number; moyenId: number; planId: number; createdAt: Date }>(
      groups: T[][], type: string
    ) => groups.map(g => ({
      type,
      moyenId: g[0].moyenId,
      planId: g[0].planId,
      planTitre: planMap[g[0].planId]?.titre ?? "",
      planReference: planMap[g[0].planId]?.reference ?? "",
      moyenDescription: moyenMap[g[0].moyenId]?.description ?? "",
      moyenCategorie: moyenMap[g[0].moyenId]?.categorie ?? "",
      demandes: g.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    }));

    const depenseResult = depenseGroups.map(g => {
      const batches: Record<string, typeof g> = {};
      for (const r of g) {
        const key = r.batchRef ?? `ind:${r.id}`;
        if (!batches[key]) batches[key] = [];
        batches[key].push(r);
      }
      return {
        type: "depense",
        moyenId: g[0].moyenId,
        planId: g[0].planId,
        planTitre: planMap[g[0].planId]?.titre ?? "",
        planReference: planMap[g[0].planId]?.reference ?? "",
        moyenDescription: moyenMap[g[0].moyenId]?.description ?? "",
        moyenCategorie: moyenMap[g[0].moyenId]?.categorie ?? "",
        batches: Object.entries(batches).map(([, rows]) => ({
          batchRef: rows[0].batchRef ?? null,
          isIndividual: !rows[0].batchRef,
          demandeId: rows[0].id,
          count: rows.length,
          montantTotal: rows.reduce((s, r) => s + Number(r.montantDemande), 0),
          createdAt: rows[0].createdAt.toISOString(),
        })),
      };
    });

    res.json({
      carburant: enrichSimple(carburantGroups, "carburant"),
      materiel:  enrichSimple(materielGroups, "materiel"),
      location:  enrichSimple(locationGroups, "location"),
      depense:   depenseResult,
    });
  } catch (err) { console.error(String(err)); res.status(500).json({ error: String(err) }); }
});

// DELETE /admin/demandes/carburant/:id
router.delete("/admin/demandes/carburant/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [d] = await db.select().from(carburantDemandesTable).where(eq(carburantDemandesTable.id, id));
    if (!d) return res.status(404).json({ error: "Demande introuvable." });
    if (d.statut !== "en_attente_cad") return res.status(400).json({ error: "Cette demande a déjà été traitée et ne peut pas être supprimée." });
    await db.delete(carburantDemandesTable).where(eq(carburantDemandesTable.id, id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// DELETE /admin/demandes/materiel/:id  (restores stock quantities)
router.delete("/admin/demandes/materiel/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [d] = await db.select().from(materielDemandesTable).where(eq(materielDemandesTable.id, id));
    if (!d) return res.status(404).json({ error: "Demande introuvable." });
    if (!["en_attente_da", "en_attente_dcgai"].includes(d.statut)) {
      return res.status(400).json({ error: "Cette demande a déjà été traitée et ne peut pas être supprimée." });
    }
    const items: Array<{ item: string; quantiteDemandee: number }> = JSON.parse(d.itemsJson);
    const stockItems = await db.select().from(materielItemsTable).where(eq(materielItemsTable.moyenId, d.moyenId));
    for (const reqItem of items) {
      const stockItem = stockItems.find(s => s.item === reqItem.item);
      if (stockItem) {
        await db.update(materielItemsTable)
          .set({ quantiteRestante: stockItem.quantiteRestante + reqItem.quantiteDemandee })
          .where(eq(materielItemsTable.id, stockItem.id));
      }
    }
    await db.delete(materielDemandesTable).where(eq(materielDemandesTable.id, id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// DELETE /admin/demandes/location/:id  (restores remaining days)
router.delete("/admin/demandes/location/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [d] = await db.select().from(locationDemandesTable).where(eq(locationDemandesTable.id, id));
    if (!d) return res.status(404).json({ error: "Demande introuvable." });
    if (d.statut !== "en_attente_dmg") {
      return res.status(400).json({ error: "Cette demande a déjà été traitée et ne peut pas être supprimée." });
    }
    const items: Array<{ locationItemId: number; nbJoursDemandes: number }> = JSON.parse(d.itemsJson);
    for (const sel of items) {
      await db.update(locationItemsTable)
        .set({ nbJoursRestants: sql`nb_jours_restants + ${sel.nbJoursDemandes}` })
        .where(eq(locationItemsTable.id, sel.locationItemId));
    }
    await db.delete(locationDemandesTable).where(eq(locationDemandesTable.id, id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// DELETE /admin/demandes/depense/:id  (individual depense record)
router.delete("/admin/demandes/depense/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [d] = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.id, id));
    if (!d) return res.status(404).json({ error: "Demande introuvable." });
    if (d.statut !== "en_attente_dcgai") return res.status(400).json({ error: "Cette demande a déjà été traitée et ne peut pas être supprimée." });
    await db.delete(depenseDemandesTable).where(eq(depenseDemandesTable.id, id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// DELETE /admin/demandes/depense-batch/:batchRef  (all records of a batch)
router.delete("/admin/demandes/depense-batch/:batchRef", async (req, res) => {
  try {
    const batchRef = req.params.batchRef;
    const rows = await db.select().from(depenseDemandesTable).where(eq(depenseDemandesTable.batchRef, batchRef));
    if (rows.length === 0) return res.status(404).json({ error: "Batch introuvable." });
    if (rows.some(r => r.statut !== "en_attente_dcgai")) {
      return res.status(400).json({ error: "Ce batch a déjà été partiellement ou totalement traité et ne peut pas être supprimé." });
    }
    await db.delete(depenseDemandesTable).where(eq(depenseDemandesTable.batchRef, batchRef));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ─────────────────── TABLEAU GLOBAL DES DEMANDES ───────────────────

// GET /api/demandes-globales
// Returns unified list of all demandes across all plans (carburant, materiel, location, depense)
router.get("/demandes-globales", async (_req, res) => {
  try {
    const result: object[] = [];

    // 1. Carburant demandes
    const carburantRows = await db
      .select({
        id: carburantDemandesTable.id,
        planId: carburantDemandesTable.planId,
        planReference: plansTable.reference,
        planTitre: plansTable.titre,
        directionNom: directionsTable.nom,
        moyenId: carburantDemandesTable.moyenId,
        moyenDescription: moyensTable.description,
        moyenCategorie: moyensTable.categorie,
        statut: carburantDemandesTable.statut,
        montant: carburantDemandesTable.montantDemande,
        montantValide: carburantDemandesTable.montantValide,
        createdAt: carburantDemandesTable.createdAt,
      })
      .from(carburantDemandesTable)
      .leftJoin(plansTable, eq(carburantDemandesTable.planId, plansTable.id))
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(moyensTable, eq(carburantDemandesTable.moyenId, moyensTable.id));

    for (const d of carburantRows) {
      result.push({
        type: "carburant", id: d.id, batchRef: null, isBatch: false,
        planId: d.planId, planReference: d.planReference, planTitre: d.planTitre ?? "",
        directionNom: d.directionNom ?? "",
        moyenId: d.moyenId, moyenDescription: d.moyenDescription ?? "", moyenCategorie: d.moyenCategorie ?? "carburant",
        statut: d.statut, montant: Number(d.montant), montantValide: d.montantValide ? Number(d.montantValide) : null,
        createdAt: d.createdAt,
      });
    }

    // 2. Matériel demandes
    const materielRows = await db
      .select({
        id: materielDemandesTable.id,
        planId: materielDemandesTable.planId,
        planReference: plansTable.reference,
        planTitre: plansTable.titre,
        directionNom: directionsTable.nom,
        moyenId: materielDemandesTable.moyenId,
        moyenDescription: moyensTable.description,
        moyenCategorie: moyensTable.categorie,
        statut: materielDemandesTable.statut,
        montantTotal: materielDemandesTable.montantTotal,
        itemsJson: materielDemandesTable.itemsJson,
        createdAt: materielDemandesTable.createdAt,
      })
      .from(materielDemandesTable)
      .leftJoin(plansTable, eq(materielDemandesTable.planId, plansTable.id))
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(moyensTable, eq(materielDemandesTable.moyenId, moyensTable.id));

    for (const d of materielRows) {
      const items: unknown[] = (() => { try { return JSON.parse(d.itemsJson ?? "[]"); } catch { return []; } })();
      result.push({
        type: "materiel", id: d.id, batchRef: null, isBatch: false,
        planId: d.planId, planReference: d.planReference, planTitre: d.planTitre ?? "",
        directionNom: d.directionNom ?? "",
        moyenId: d.moyenId, moyenDescription: d.moyenDescription ?? "", moyenCategorie: d.moyenCategorie ?? "materiel",
        statut: d.statut, montant: d.montantTotal ? Number(d.montantTotal) : null,
        nbItems: items.length, createdAt: d.createdAt,
      });
    }

    // 3. Location demandes
    const locationRows = await db
      .select({
        id: locationDemandesTable.id,
        planId: locationDemandesTable.planId,
        planReference: plansTable.reference,
        planTitre: plansTable.titre,
        directionNom: directionsTable.nom,
        moyenId: locationDemandesTable.moyenId,
        moyenDescription: moyensTable.description,
        moyenCategorie: moyensTable.categorie,
        statut: locationDemandesTable.statut,
        montantTotal: locationDemandesTable.montantTotal,
        createdAt: locationDemandesTable.createdAt,
      })
      .from(locationDemandesTable)
      .leftJoin(plansTable, eq(locationDemandesTable.planId, plansTable.id))
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(moyensTable, eq(locationDemandesTable.moyenId, moyensTable.id));

    for (const d of locationRows) {
      result.push({
        type: "location", id: d.id, batchRef: null, isBatch: false,
        planId: d.planId, planReference: d.planReference, planTitre: d.planTitre ?? "",
        directionNom: d.directionNom ?? "",
        moyenId: d.moyenId, moyenDescription: d.moyenDescription ?? "", moyenCategorie: d.moyenCategorie ?? "location",
        statut: d.statut, montant: d.montantTotal ? Number(d.montantTotal) : null,
        createdAt: d.createdAt,
      });
    }

    // 4. Dépense demandes — group batch (batchRef != null) by batchRef
    const depenseRows = await db
      .select({
        id: depenseDemandesTable.id,
        planId: depenseDemandesTable.planId,
        planReference: plansTable.reference,
        planTitre: plansTable.titre,
        directionNom: directionsTable.nom,
        moyenId: depenseDemandesTable.moyenId,
        moyenDescription: moyensTable.description,
        moyenCategorie: moyensTable.categorie,
        statut: depenseDemandesTable.statut,
        montantDemande: depenseDemandesTable.montantDemande,
        montantPaye: depenseDemandesTable.montantPaye,
        nomBeneficiaire: depenseDemandesTable.nomBeneficiaire,
        batchRef: depenseDemandesTable.batchRef,
        createdAt: depenseDemandesTable.createdAt,
      })
      .from(depenseDemandesTable)
      .leftJoin(plansTable, eq(depenseDemandesTable.planId, plansTable.id))
      .leftJoin(directionsTable, eq(plansTable.directionId, directionsTable.id))
      .leftJoin(moyensTable, eq(depenseDemandesTable.moyenId, moyensTable.id));

    const batchMap = new Map<string, typeof depenseRows>();
    for (const d of depenseRows) {
      if (d.batchRef) {
        const arr = batchMap.get(d.batchRef) ?? [];
        arr.push(d);
        batchMap.set(d.batchRef, arr);
      } else {
        result.push({
          type: "depense", id: d.id, batchRef: null, isBatch: false,
          planId: d.planId, planReference: d.planReference, planTitre: d.planTitre ?? "",
          directionNom: d.directionNom ?? "",
          moyenId: d.moyenId, moyenDescription: d.moyenDescription ?? "", moyenCategorie: d.moyenCategorie ?? "autres",
          statut: d.statut, montant: Number(d.montantDemande),
          montantPaye: d.montantPaye ? Number(d.montantPaye) : null,
          nomBeneficiaire: d.nomBeneficiaire,
          createdAt: d.createdAt,
        });
      }
    }
    for (const [batchRef, rows] of batchMap) {
      const first = rows[0];
      const totalMontant = rows.reduce((s, r) => s + Number(r.montantDemande), 0);
      result.push({
        type: "depense", id: first.id, batchRef, isBatch: true,
        nbBeneficiaires: rows.length,
        planId: first.planId, planReference: first.planReference, planTitre: first.planTitre ?? "",
        directionNom: first.directionNom ?? "",
        moyenId: first.moyenId, moyenDescription: first.moyenDescription ?? "", moyenCategorie: first.moyenCategorie ?? "prime",
        statut: first.statut, montant: totalMontant,
        createdAt: first.createdAt,
      });
    }

    result.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(result);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
