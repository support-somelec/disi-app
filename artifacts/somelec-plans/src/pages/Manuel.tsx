import React from "react";

const TODAY = "Juin 2026";

const HTML_DOC = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Guide Utilisateur — SOMELEC Plans d'Action</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11.5pt; color: #1a1a2e; background: #fff; line-height: 1.6; }

  .page { width: 21cm; margin: 0 auto; padding: 2cm 2.4cm 2.5cm; }

  /* ── Cover ── */
  .cover { text-align: center; padding: 60px 0 50px; border-bottom: 3px solid #1e40af; margin-bottom: 40px; }
  .cover .logo-box { display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 18px; margin-bottom: 18px; }
  .cover .logo-box svg { width: 40px; height: 40px; fill: white; }
  .cover h1 { font-size: 24pt; color: #1e3a8a; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; }
  .cover h2 { font-size: 14pt; color: #3b82f6; font-weight: 400; margin-bottom: 20px; }
  .cover .meta { font-size: 10pt; color: #6b7280; }
  .cover .badge { display: inline-block; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 20px; padding: 4px 18px; font-size: 10pt; color: #1e40af; font-weight: 600; margin-top: 10px; }

  /* ── TOC ── */
  .toc-box { background: #f0f7ff; border-left: 5px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 20px 24px; margin-bottom: 36px; }
  .toc-box h3 { font-size: 11pt; color: #1e40af; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .toc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .toc-grid a { color: #1e40af; text-decoration: none; font-size: 10.5pt; display: flex; align-items: baseline; gap: 6px; }
  .toc-grid a::before { content: "›"; font-weight: bold; color: #93c5fd; }

  /* ── Sections ── */
  .section { margin-bottom: 40px; page-break-inside: avoid; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 2px solid #dbeafe; }
  .section-num { min-width: 34px; height: 34px; background: #1e40af; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12pt; font-weight: 700; }
  .section-title { font-size: 15pt; font-weight: 700; color: #1e3a8a; }

  h3 { font-size: 11.5pt; color: #1e40af; margin: 18px 0 8px; font-weight: 700; }
  p { margin-bottom: 8px; }

  /* ── Role cards ── */
  .role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0; }
  .role-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .role-card .role-name { font-weight: 700; font-size: 10.5pt; color: #1e3a8a; margin-bottom: 4px; }
  .role-card .role-label { font-size: 9.5pt; color: #64748b; margin-bottom: 6px; }
  .role-card .role-can { font-size: 10pt; color: #374151; }
  .role-card.highlight { background: #eff6ff; border-color: #93c5fd; }

  /* ── Steps ── */
  .steps { counter-reset: step; margin: 10px 0 14px; }
  .step { display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start; }
  .step-num { counter-increment: step; min-width: 26px; height: 26px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 700; flex-shrink: 0; }
  .step-text { font-size: 10.5pt; color: #374151; padding-top: 3px; }
  .step-text strong { color: #1e3a8a; }

  /* ── Workflow pills ── */
  .flow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 12px 0 16px; }
  .pill { padding: 4px 12px; border-radius: 20px; font-size: 9.5pt; font-weight: 600; white-space: nowrap; }
  .pill.draft { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .pill.wait  { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .pill.ok    { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .pill.done  { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
  .pill.pay   { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; }
  .pill.rej   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .arrow { color: #9ca3af; font-size: 14pt; font-weight: 700; }

  /* ── Tip / Warning boxes ── */
  .tip { display: flex; gap: 10px; padding: 10px 14px; border-radius: 8px; margin: 12px 0; font-size: 10.5pt; }
  .tip.blue { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; }
  .tip.amber { background: #fffbeb; border: 1px solid #fde68a; color: #78350f; }
  .tip.green { background: #f0fdf4; border: 1px solid #bbf7d0; color: #14532d; }
  .tip-icon { font-size: 14pt; flex-shrink: 0; }

  /* ── Summary table ── */
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 12px 0 18px; }
  th { background: #1e40af; color: white; padding: 8px 12px; text-align: left; font-weight: 600; }
  td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }

  /* ── Quick-ref card ── */
  .qr-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 14px 0; }
  .qr-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .qr-card .qr-emoji { font-size: 22pt; margin-bottom: 6px; }
  .qr-card .qr-title { font-size: 9.5pt; font-weight: 700; color: #1e3a8a; margin-bottom: 4px; }
  .qr-card .qr-desc { font-size: 9pt; color: #6b7280; }

  /* ── Footer ── */
  .footer { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 40px; display: flex; justify-content: space-between; font-size: 9pt; color: #9ca3af; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section { page-break-inside: avoid; }
    @page { size: A4; margin: 1.5cm 2cm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- COVER -->
  <div class="cover">
    <div class="logo-box">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h1>SOMELEC</h1>
    <h2>Guide Utilisateur — Gestion des Plans d'Action</h2>
    <div class="meta">Société Mauritanienne d'Électricité</div>
    <div class="badge">Version 2.0 · ${TODAY}</div>
  </div>

  <!-- TABLE DES MATIÈRES -->
  <div class="toc-box">
    <h3>Sommaire</h3>
    <div class="toc-grid">
      <a href="#connexion">1. Se connecter à l'application</a>
      <a href="#roles">2. Comprendre votre rôle</a>
      <a href="#plans">3. Plans d'action</a>
      <a href="#carburant">4. Demandes de carburant</a>
      <a href="#materiel">5. Demandes de matériel</a>
      <a href="#location">6. Demandes de location</a>
      <a href="#depenses">7. Demandes de dépenses</a>
      <a href="#justificatifs">8. Justificatifs de paiement</a>
      <a href="#documents">9. Documents générés</a>
      <a href="#conseils">10. Conseils pratiques</a>
    </div>
  </div>

  <!-- 1. CONNEXION -->
  <div class="section" id="connexion">
    <div class="section-header">
      <div class="section-num">1</div>
      <div class="section-title">Se connecter à l'application</div>
    </div>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Ouvrir le navigateur et saisir l'adresse fournie par votre administrateur</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Saisir votre <strong>adresse e-mail</strong> et votre <strong>mot de passe</strong></div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Cliquer sur <strong>Se connecter</strong></div></div>
    </div>
    <div class="tip blue">
      <span class="tip-icon">🔑</span>
      <span>Pour changer votre mot de passe, cliquez sur votre nom en haut à droite puis sur <strong>Changer le mot de passe</strong>. Le nouveau mot de passe doit contenir au moins 6 caractères.</span>
    </div>
    <div class="tip amber">
      <span class="tip-icon">⚠️</span>
      <span>Si vous partagez un poste, pensez à vous <strong>déconnecter</strong> à la fin de votre session (menu en haut à droite → Se déconnecter).</span>
    </div>
  </div>

  <!-- 2. RÔLES -->
  <div class="section" id="roles">
    <div class="section-header">
      <div class="section-num">2</div>
      <div class="section-title">Comprendre votre rôle</div>
    </div>
    <p>Chaque utilisateur a un rôle qui détermine ce qu'il peut faire dans l'application :</p>
    <div class="role-grid">
      <div class="role-card highlight">
        <div class="role-name">Direction</div>
        <div class="role-label">Direction opérationnelle</div>
        <div class="role-can">Créer des plans · Initier toutes les demandes de moyens · Uploader les justificatifs</div>
      </div>
      <div class="role-card">
        <div class="role-name">Contrôle Technique (CT)</div>
        <div class="role-label">Contrôle technique</div>
        <div class="role-can">Valider ou rejeter les plans soumis</div>
      </div>
      <div class="role-card">
        <div class="role-name">DGA / DG</div>
        <div class="role-label">Direction Générale</div>
        <div class="role-can">Validation finale des plans avant ouverture</div>
      </div>
      <div class="role-card">
        <div class="role-name">CAD</div>
        <div class="role-label">Caisse, Approv. &amp; Dist.</div>
        <div class="role-can">Traiter les demandes de <strong>carburant</strong></div>
      </div>
      <div class="role-card">
        <div class="role-name">DA</div>
        <div class="role-label">Dir. des Approvisionnements</div>
        <div class="role-can">Traiter les demandes de <strong>matériel</strong></div>
      </div>
      <div class="role-card">
        <div class="role-name">DMG</div>
        <div class="role-label">Dir. Matériel &amp; Garage</div>
        <div class="role-can">Traiter les demandes de <strong>location d'engins</strong></div>
      </div>
      <div class="role-card highlight">
        <div class="role-name">DCGAI</div>
        <div class="role-label">Dir. Contrôle Gestion &amp; Audit</div>
        <div class="role-can">Valider budgétairement les dépenses et le matériel · Générer les bons</div>
      </div>
      <div class="role-card highlight">
        <div class="role-name">DFC</div>
        <div class="role-label">Direction Financière</div>
        <div class="role-can">Payer les dépenses · Suivre les justificatifs manquants</div>
      </div>
      <div class="role-card">
        <div class="role-name">Admin</div>
        <div class="role-label">Administrateur</div>
        <div class="role-can">Gérer les utilisateurs et les directions</div>
      </div>
    </div>
  </div>

  <!-- 3. PLANS -->
  <div class="section" id="plans">
    <div class="section-header">
      <div class="section-num">3</div>
      <div class="section-title">Plans d'action</div>
    </div>

    <h3>Circuit de validation d'un plan</h3>
    <div class="flow">
      <span class="pill draft">Brouillon</span><span class="arrow">→</span>
      <span class="pill wait">En attente DC</span><span class="arrow">→</span>
      <span class="pill wait">En attente CT</span><span class="arrow">→</span>
      <span class="pill wait">En attente DGA</span><span class="arrow">→</span>
      <span class="pill wait">En attente DG</span><span class="arrow">→</span>
      <span class="pill ok">Ouvert</span><span class="arrow">→</span>
      <span class="pill done">Clôturé</span>
    </div>
    <p>À chaque étape, le validateur peut également <span class="pill rej" style="display:inline">Rejeter</span> le plan avec un commentaire.</p>

    <h3>Créer un plan (Direction)</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Cliquer sur <strong>Nouveau Plan</strong> dans le menu à gauche</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Renseigner : référence, titre, description, dates de début et de fin</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Ajouter les moyens nécessaires : <strong>Carburant, Matériel, Location, Dépenses</strong> avec leur budget</div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text">Cliquer sur <strong>Créer le Plan</strong> — le plan est en <em>Brouillon</em> et peut être modifié avant soumission</div></div>
      <div class="step"><div class="step-num">5</div><div class="step-text">Cliquer sur <strong>Soumettre pour validation</strong> pour lancer le circuit d'approbation</div></div>
    </div>

    <h3>Valider / Rejeter un plan (CT · DGA · DG)</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Ouvrir le plan depuis le Tableau de Bord ou la liste des plans</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Lire les informations du plan et les moyens demandés</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text"><strong>Valider</strong> pour passer à l'étape suivante, ou <strong>Rejeter</strong> (un commentaire est obligatoire en cas de rejet)</div></div>
    </div>

    <h3>Clôturer un plan (Direction)</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">S'assurer que toutes les dépenses ont un <strong>justificatif uploadé</strong> (sinon la clôture est bloquée)</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Cliquer sur <strong>Clôturer le plan</strong> — un certificat PDF signé est généré automatiquement</div></div>
    </div>
    <div class="tip green">
      <span class="tip-icon">✅</span>
      <span>Un <strong>certificat de validation</strong> avec code d'authenticité peut être téléchargé à tout moment depuis la fiche d'un plan ouvert ou clôturé.</span>
    </div>
  </div>

  <!-- 4. CARBURANT -->
  <div class="section" id="carburant">
    <div class="section-header">
      <div class="section-num">4</div>
      <div class="section-title">Demandes de carburant</div>
    </div>
    <div class="flow">
      <span class="pill wait">En attente CAD</span><span class="arrow">→</span><span class="pill ok">Validée</span>
    </div>
    <table>
      <thead><tr><th>Qui ?</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td><strong>Direction</strong></td><td>Depuis la fiche du plan → section Carburant → <strong>Demander</strong> → saisir le montant souhaité</td></tr>
        <tr><td><strong>CAD</strong></td><td>Aller dans <strong>Demandes</strong> → ouvrir le plan → valider le montant (ajustable) → téléverser la décharge signée → générer le bon → <strong>Valider</strong></td></tr>
      </tbody>
    </table>
  </div>

  <!-- 5. MATÉRIEL -->
  <div class="section" id="materiel">
    <div class="section-header">
      <div class="section-num">5</div>
      <div class="section-title">Demandes de matériel</div>
    </div>
    <div class="flow">
      <span class="pill wait">En attente DA</span><span class="arrow">→</span>
      <span class="pill wait">En attente DCGAI</span><span class="arrow">→</span>
      <span class="pill ok">Validée</span>
    </div>
    <table>
      <thead><tr><th>Qui ?</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td><strong>Direction</strong></td><td>Fiche du plan → section Matériel → <strong>Faire une demande</strong> → sélectionner articles &amp; quantités → Soumettre</td></tr>
        <tr><td><strong>DA</strong></td><td>Saisir les <strong>prix unitaires</strong> → générer le <strong>bon de commande</strong> → Valider</td></tr>
        <tr><td><strong>DCGAI</strong></td><td>Générer le <strong>bon de validation DCGAI</strong> → Valider (le montant est consommé sur le plan)</td></tr>
      </tbody>
    </table>
    <div class="tip blue">
      <span class="tip-icon">ℹ️</span>
      <span>Le DCGAI peut annuler sa validation si une erreur est constatée. La demande repasse alors à l'étape DCGAI.</span>
    </div>
  </div>

  <!-- 6. LOCATION -->
  <div class="section" id="location">
    <div class="section-header">
      <div class="section-num">6</div>
      <div class="section-title">Demandes de location d'engins</div>
    </div>
    <div class="flow">
      <span class="pill wait">En attente DMG</span><span class="arrow">→</span><span class="pill ok">Validée</span>
    </div>
    <table>
      <thead><tr><th>Qui ?</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td><strong>Direction</strong></td><td>Fiche du plan → section Location → <strong>Faire une demande</strong> → choisir le type d'engin &amp; nombre de jours → Soumettre</td></tr>
        <tr><td><strong>DMG</strong></td><td>Saisir le <strong>coût journalier</strong> et le nombre de jours validés → téléverser la décharge → Valider</td></tr>
      </tbody>
    </table>
  </div>

  <!-- 7. DÉPENSES -->
  <div class="section" id="depenses">
    <div class="section-header">
      <div class="section-num">7</div>
      <div class="section-title">Demandes de dépenses</div>
    </div>
    <div class="flow">
      <span class="pill wait">En attente DCGAI</span><span class="arrow">→</span>
      <span class="pill wait">En attente DFC</span><span class="arrow">→</span>
      <span class="pill pay">Attente Justificatif</span><span class="arrow">→</span>
      <span class="pill ok">Payée</span>
    </div>
    <p>Les dépenses couvrent : <strong>Primes, Logement, Indemnités journalières, Logistique, Autres</strong>.</p>

    <h3>Initier une demande (Direction)</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Fiche du plan → section Dépenses → <strong>Nouvelle demande</strong></div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Ajouter les bénéficiaires : nom, matricule (optionnel), montant demandé</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Plusieurs bénéficiaires peuvent être regroupés dans une même demande (batch)</div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text">Soumettre — la demande passe en <em>En attente DCGAI</em></div></div>
    </div>

    <h3>Validation DCGAI</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Aller dans <strong>Demandes</strong> pour voir les demandes en attente</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Générer le <strong>Bon de Validation DCGAI</strong> (obligatoire — liste tous les bénéficiaires)</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Cliquer sur <strong>Valider</strong> — la demande passe en <em>En attente DFC</em></div></div>
    </div>

    <h3>Paiement (DFC)</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Aller dans <strong>Demandes</strong> → localiser les demandes <em>En attente DFC</em></div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Générer le <strong>Bon de Paiement</strong> (obligatoire)</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Saisir le montant effectivement payé et la <strong>référence de la pièce comptable</strong></div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text">Cliquer sur <strong>Payer</strong> — la demande passe en <em>Attente Justificatif</em></div></div>
    </div>
    <div class="tip blue">
      <span class="tip-icon">ℹ️</span>
      <span>Pour les batches, le bouton <strong>Payer tout le batch</strong> permet de régler tous les bénéficiaires en une seule opération.</span>
    </div>
  </div>

  <!-- 8. JUSTIFICATIFS -->
  <div class="section" id="justificatifs">
    <div class="section-header">
      <div class="section-num">8</div>
      <div class="section-title">Justificatifs de paiement</div>
    </div>
    <p>Après chaque paiement effectué par la DFC, la Direction opérationnelle doit joindre la <strong>preuve de paiement</strong> (reçu, bordereau, etc.).</p>

    <h3>Uploader un justificatif (Direction)</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Ouvrir la fiche du plan concerné</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Dans la section Dépenses, repérer les demandes en statut <span class="pill pay" style="display:inline;padding:2px 8px;font-size:9pt">Attente Justificatif</span></div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Cliquer sur <strong>Joindre le justificatif</strong> → sélectionner le fichier (PDF ou image)</div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text">Confirmer — la demande passe automatiquement en <span class="pill ok" style="display:inline;padding:2px 8px;font-size:9pt">Payée</span></div></div>
    </div>

    <h3>Suivre les justificatifs manquants (DFC / Admin)</h3>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-text">Cliquer sur <strong>Demandes</strong> dans le menu puis ouvrir l'onglet <strong>Justificatifs en attente</strong></div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">La liste affiche toutes les dépenses payées sans justificatif reçu</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Cliquer sur <strong>Télécharger Excel</strong> pour exporter la liste, ou sur <strong>Ouvrir</strong> pour accéder directement au plan</div></div>
    </div>
    <div class="tip amber">
      <span class="tip-icon">⚠️</span>
      <span>Un plan ne peut <strong>pas être clôturé</strong> tant qu'il reste des dépenses en attente de justificatif.</span>
    </div>
  </div>

  <!-- 9. DOCUMENTS -->
  <div class="section" id="documents">
    <div class="section-header">
      <div class="section-num">9</div>
      <div class="section-title">Documents générés automatiquement</div>
    </div>
    <p>Chaque étape clé génère un document officiel avec QR code d'authenticité :</p>
    <div class="qr-grid">
      <div class="qr-card"><div class="qr-emoji">⛽</div><div class="qr-title">Bon Carburant</div><div class="qr-desc">Émis par le CAD lors de la validation</div></div>
      <div class="qr-card"><div class="qr-emoji">📦</div><div class="qr-title">Bon de Commande</div><div class="qr-desc">Émis par la DA avec articles et prix</div></div>
      <div class="qr-card"><div class="qr-emoji">✔️</div><div class="qr-title">Bon DCGAI</div><div class="qr-desc">Validation budgétaire avec liste des bénéficiaires</div></div>
      <div class="qr-card"><div class="qr-emoji">💳</div><div class="qr-title">Bon de Paiement</div><div class="qr-desc">Émis par la DFC avec référence comptable</div></div>
      <div class="qr-card"><div class="qr-emoji">👥</div><div class="qr-title">Paiement Groupé</div><div class="qr-desc">Liste de tous les bénéficiaires d'un batch</div></div>
      <div class="qr-card"><div class="qr-emoji">🏅</div><div class="qr-title">Certificat de Plan</div><div class="qr-desc">Signé avec code SHA-256 d'authenticité</div></div>
    </div>
    <div class="tip blue">
      <span class="tip-icon">🖨️</span>
      <span>Tous les documents s'ouvrent dans un nouvel onglet et sont directement imprimables. La <strong>génération du document est obligatoire</strong> avant la validation pour les bons DCGAI et DFC.</span>
    </div>
  </div>

  <!-- 10. CONSEILS -->
  <div class="section" id="conseils">
    <div class="section-header">
      <div class="section-num">10</div>
      <div class="section-title">Conseils pratiques</div>
    </div>
    <table>
      <thead><tr><th>Situation</th><th>Que faire ?</th></tr></thead>
      <tbody>
        <tr><td>Je ne vois pas un plan dans la liste</td><td>Vérifier le filtre de statut (Tous / En cours / Clôturés) en haut de la liste</td></tr>
        <tr><td>Le bouton Valider est grisé</td><td>Générer d'abord le bon correspondant (bouton <em>Générer le bon</em>)</td></tr>
        <tr><td>Je ne peux pas clôturer le plan</td><td>Des dépenses sont en attente de justificatif — les uploader d'abord</td></tr>
        <tr><td>Les données semblent anciennes</td><td>Cliquer sur <strong>Actualiser</strong> ou attendre 60 secondes (rafraîchissement automatique)</td></tr>
        <tr><td>J'ai validé par erreur (DCGAI)</td><td>Utiliser le bouton <strong>Annuler la validation</strong> pour repasser en attente</td></tr>
        <tr><td>Je ne retrouve pas une demande</td><td>Utiliser les filtres (Type, Statut) et la barre de recherche dans Demandes</td></tr>
        <tr><td>Mon mot de passe ne fonctionne pas</td><td>Contacter l'administrateur pour réinitialisation</td></tr>
      </tbody>
    </table>
    <div class="tip green">
      <span class="tip-icon">💡</span>
      <span>Chaque action est tracée avec votre identité. Générez toujours les documents officiels avant de valider — ils constituent la preuve formelle de chaque étape du circuit.</span>
    </div>
  </div>

  <div class="footer">
    <span>SOMELEC — Document interne confidentiel</span>
    <span>Gestion des Plans d'Action · v2.0 · ${TODAY}</span>
  </div>

</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

export default function Manuel() {
  const handleOpen = () => {
    const blob = new Blob([HTML_DOC], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) alert("Veuillez autoriser les popups pour ouvrir le document.");
  };

  const sections = [
    { num: "1", title: "Se connecter", desc: "Accès et gestion du compte" },
    { num: "2", title: "Votre rôle", desc: "Ce que vous pouvez faire" },
    { num: "3", title: "Plans d'action", desc: "Création, validation, clôture" },
    { num: "4", title: "Carburant", desc: "Flux Direction → CAD" },
    { num: "5", title: "Matériel", desc: "Flux Direction → DA → DCGAI" },
    { num: "6", title: "Location", desc: "Flux Direction → DMG" },
    { num: "7", title: "Dépenses", desc: "Flux Direction → DCGAI → DFC" },
    { num: "8", title: "Justificatifs", desc: "Upload et suivi" },
    { num: "9", title: "Documents", desc: "Bons et certificats générés" },
    { num: "10", title: "Conseils pratiques", desc: "Résolution des problèmes courants" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guide Utilisateur</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            SOMELEC — Gestion des Plans d'Action · Version 2.0 · {TODAY}
          </p>
        </div>
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimer / Sauvegarder en PDF
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Ce guide explique, étape par étape, comment utiliser chaque fonctionnalité de l'application selon votre profil.
        Cliquez sur <strong>Imprimer / Sauvegarder en PDF</strong> pour obtenir le document complet formaté A4.
      </div>

      {/* Sommaire visuel */}
      <div className="grid grid-cols-2 gap-3">
        {sections.map((s) => (
          <div key={s.num} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {s.num}
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-900">{s.title}</div>
              <div className="text-xs text-gray-500">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-center text-gray-400 pb-4">
        SOMELEC — Document interne confidentiel · Gestion des Plans d'Action v2.0 · {TODAY}
      </p>
    </div>
  );
}
