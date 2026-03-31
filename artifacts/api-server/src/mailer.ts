import nodemailer from "nodemailer";

const TEST_OVERRIDE = process.env["EMAIL_TEST_OVERRIDE"] ?? "babacherif@somelec.mr";
const FROM = process.env["EMAIL_FROM"] ?? "SOMELEC Plans d'Action <noreply@somelec.mr>";

function createTransport() {
  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, tls: { rejectUnauthorized: false } });
}

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  const finalTo = TEST_OVERRIDE || recipients.join(", ");

  const transport = createTransport();
  if (!transport) {
    console.log(`[mailer] SMTP not configured — would send to: ${finalTo}`);
    console.log(`[mailer] Subject: ${opts.subject}`);
    return;
  }
  try {
    await transport.sendMail({ from: FROM, to: finalTo, subject: opts.subject, html: opts.html });
    console.log(`[mailer] Email sent to: ${finalTo} — ${opts.subject}`);
  } catch (err) {
    console.error(`[mailer] Failed to send email: ${String(err)}`);
  }
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;white-space:nowrap">${label}</td><td style="padding:6px 12px;font-size:13px;font-weight:600">${value}</td></tr>`;
}

function emailBase(title: string, color: string, body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <tr><td style="background:${color};padding:24px 32px">
    <div style="color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:.85">SOMELEC — Plans d'Action</div>
    <div style="color:#fff;font-size:20px;font-weight:700;margin-top:6px">${title}</div>
  </td></tr>
  <tr><td style="padding:24px 32px">${body}</td></tr>
  <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
    Ce message est généré automatiquement, merci de ne pas y répondre.
  </td></tr>
</table></td></tr></table></body></html>`;
}

export function mailPlanCreated(plan: { reference?: string | null; titre: string; directionNom?: string | null }) {
  const subject = `[CT] Nouveau plan à valider — ${plan.reference ?? plan.titre}`;
  const body = `<p style="margin:0 0 16px;color:#334155">Un nouveau plan d'action est en attente de votre validation.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
${row("Référence", plan.reference ?? "—")}
${row("Titre", plan.titre)}
${row("Direction", plan.directionNom ?? "—")}
</table>
<p style="margin:20px 0 0;color:#64748b;font-size:13px">Connectez-vous à l'application pour valider ou rejeter ce plan.</p>`;
  return { subject, html: emailBase("Nouveau plan à valider", "#f59e0b", body) };
}

export function mailPlanValidated(plan: { reference?: string | null; titre: string }, nextRole: string) {
  const roleLabels: Record<string, string> = {
    dga: "Directeur Général Adjoint (DGA)",
    directeur_general: "Directeur Général (DG)",
    direction: "Direction créatrice",
  };
  const subject = `[${nextRole.toUpperCase()}] Plan approuvé — ${plan.reference ?? plan.titre}`;
  const body = `<p style="margin:0 0 16px;color:#334155">Le plan ci-dessous a été approuvé et nécessite votre action.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
${row("Référence", plan.reference ?? "—")}
${row("Titre", plan.titre)}
${row("Votre rôle", roleLabels[nextRole] ?? nextRole)}
</table>
<p style="margin:20px 0 0;color:#64748b;font-size:13px">Connectez-vous à l'application pour traiter ce plan.</p>`;
  return { subject, html: emailBase("Plan en attente de votre action", "#3b82f6", body) };
}

export function mailPlanOpened(plan: { reference?: string | null; titre: string }) {
  const subject = `[OUVERT] Votre plan est approuvé — ${plan.reference ?? plan.titre}`;
  const body = `<p style="margin:0 0 16px;color:#334155">🎉 Votre plan d'action a été approuvé par le Directeur Général et est maintenant <strong>ouvert</strong>.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
${row("Référence", plan.reference ?? "—")}
${row("Titre", plan.titre)}
${row("Statut", "Ouvert — En exécution")}
</table>
<p style="margin:20px 0 0;color:#64748b;font-size:13px">Vous pouvez maintenant initier des demandes d'exécution pour vos moyens.</p>`;
  return { subject, html: emailBase("Plan ouvert", "#10b981", body) };
}

export function mailPlanRejected(plan: { reference?: string | null; titre: string; commentaireRejet?: string | null }) {
  const subject = `[REJETÉ] Plan rejeté — ${plan.reference ?? plan.titre}`;
  const body = `<p style="margin:0 0 16px;color:#334155">Votre plan d'action a été rejeté.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
${row("Référence", plan.reference ?? "—")}
${row("Titre", plan.titre)}
${row("Motif", plan.commentaireRejet ?? "Aucun commentaire")}
</table>`;
  return { subject, html: emailBase("Plan rejeté", "#ef4444", body) };
}

export function mailDemandeExecution(opts: {
  plan: { reference?: string | null; titre: string };
  moyen: { description: string; categorie: string; budget: number };
  direction: string;
}) {
  const cat: Record<string, string> = { carburant: "Carburant", materiel: "Matériel", prime: "Prime", logement: "Logement", logistique: "Logistique", indemnite_journaliere: "Indemnité journalière" };
  const subject = `[DEMANDE] Nouvelle demande d'exécution — ${opts.plan.reference ?? opts.plan.titre}`;
  const body = `<p style="margin:0 0 16px;color:#334155">Une nouvelle demande d'exécution de dépense est en attente de votre saisie.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
${row("Plan", opts.plan.reference ?? opts.plan.titre)}
${row("Direction", opts.direction)}
${row("Catégorie", cat[opts.moyen.categorie] ?? opts.moyen.categorie)}
${row("Description", opts.moyen.description)}
${row("Budget prévu", `${opts.moyen.budget.toLocaleString("fr-MR")} MRU`)}
</table>
<p style="margin:20px 0 0;color:#64748b;font-size:13px">Connectez-vous à l'application pour saisir la consommation (décharge obligatoire).</p>`;
  return { subject, html: emailBase("Demande d'exécution en attente", "#f97316", body) };
}

export function mailDemandeExecutionRH(opts: {
  plan: { reference?: string | null; titre: string; directionNom?: string | null };
  moyen: { description: string; budget: number };
  direction: string;
  beneficiaires: Array<{ nom: string; matricule?: string | null; nni?: string | null; montant: number }>;
}) {
  const subject = `[RH] Demande de versement d'indemnités — ${opts.plan.reference ?? opts.plan.titre}`;
  const rows = opts.beneficiaires.map(b =>
    `<tr>
      <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0">${b.nom}</td>
      <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0;text-align:center">${b.matricule ?? "—"}</td>
      <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0;text-align:center">${b.nni ?? "—"}</td>
      <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${b.montant.toLocaleString("fr-MR")} MRU</td>
    </tr>`
  ).join("");
  const total = opts.beneficiaires.reduce((s, b) => s + b.montant, 0);
  const body = `
<p style="margin:0 0 16px;color:#334155">
  La direction <strong>${opts.direction}</strong> demande le versement des indemnités suivantes sur salaire pour les bénéficiaires ci-dessous.
</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px">
  ${row("Plan", opts.plan.reference ?? opts.plan.titre)}
  ${row("Description", opts.moyen.description)}
  ${row("Budget prévu", `${opts.moyen.budget.toLocaleString("fr-MR")} MRU`)}
</table>
<p style="margin:0 0 8px;font-weight:600;color:#334155">Liste des bénéficiaires :</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead>
    <tr style="background:#f1f5f9">
      <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600">NOM</th>
      <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600">MATRICULE</th>
      <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600">NNI</th>
      <th style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600">MONTANT</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr style="background:#f1f5f9">
      <td colspan="3" style="padding:8px 12px;font-size:13px;font-weight:700;color:#334155">TOTAL</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#0ea5e9;text-align:right">${total.toLocaleString("fr-MR")} MRU</td>
    </tr>
  </tfoot>
</table>
<p style="margin:20px 0 0;color:#64748b;font-size:13px">Merci de procéder au versement de ces montants sur les salaires des bénéficiaires concernés.</p>`;
  return { subject, html: emailBase("Demande de versement d'indemnités", "#0ea5e9", body) };
}

export function mailConsommationSaisie(opts: {
  plan: { reference?: string | null; titre: string; directionNom?: string | null };
  moyen: { description: string; categorie: string; montant: number; budget: number };
}) {
  const cat: Record<string, string> = { carburant: "Carburant", materiel: "Matériel", prime: "Prime", logement: "Logement", logistique: "Logistique", indemnite_journaliere: "Indemnité journalière" };
  const pct = opts.moyen.budget > 0 ? Math.round((opts.moyen.montant / opts.moyen.budget) * 100) : 0;
  const subject = `[CONSOMMATION] Saisie enregistrée — ${opts.plan.reference ?? opts.plan.titre}`;
  const body = `<p style="margin:0 0 16px;color:#334155">Une consommation de budget a été enregistrée.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
${row("Plan", opts.plan.reference ?? opts.plan.titre)}
${row("Direction", opts.plan.directionNom ?? "—")}
${row("Catégorie", cat[opts.moyen.categorie] ?? opts.moyen.categorie)}
${row("Description", opts.moyen.description)}
${row("Montant saisi", `${opts.moyen.montant.toLocaleString("fr-MR")} MRU`)}
${row("Budget alloué", `${opts.moyen.budget.toLocaleString("fr-MR")} MRU`)}
${row("Taux d'utilisation", `${pct}%`)}
</table>`;
  return { subject, html: emailBase("Consommation enregistrée", "#8b5cf6", body) };
}
