import React from "react";

const BASE_URL = import.meta.env.BASE_URL ?? "/somelec-plans/";

const SECTIONS = [
  {
    id: "introduction",
    titre: "1. Introduction",
    contenu: `
      <p>La plateforme <strong>SOMELEC — Gestion des Plans d'Action</strong> est un outil de pilotage et de suivi budgétaire interne destiné aux directions opérationnelles et fonctionnelles de la Société Mauritanienne d'Électricité.</p>
      <p>Elle permet de :</p>
      <ul>
        <li>Créer et soumettre des plans d'action annuels ou ponctuels</li>
        <li>Suivre le processus de validation hiérarchique</li>
        <li>Gérer la consommation des moyens alloués (carburant, matériel, location, dépenses)</li>
        <li>Assurer la traçabilité des paiements et des justificatifs</li>
        <li>Produire des rapports et documents officiels (bons, certificats)</li>
      </ul>
      <p>Ce manuel décrit les procédures à suivre par chaque profil d'utilisateur.</p>
    `
  },
  {
    id: "connexion",
    titre: "2. Connexion et Gestion du Compte",
    contenu: `
      <h3>2.1 Connexion</h3>
      <ol>
        <li>Accéder à l'application via l'URL fournie par l'administrateur</li>
        <li>Saisir votre adresse e-mail et votre mot de passe</li>
        <li>Cliquer sur <strong>Se connecter</strong></li>
      </ol>
      <div class="note">La session est maintenue dans le navigateur. Pensez à vous déconnecter si vous utilisez un poste partagé.</div>

      <h3>2.2 Changer le mot de passe</h3>
      <ol>
        <li>Cliquer sur votre nom en haut à droite</li>
        <li>Sélectionner <strong>Changer le mot de passe</strong></li>
        <li>Saisir l'ancien puis le nouveau mot de passe (minimum 6 caractères)</li>
        <li>Confirmer et valider</li>
      </ol>

      <h3>2.3 Déconnexion</h3>
      <p>Cliquer sur votre nom en haut à droite puis sur <strong>Se déconnecter</strong>.</p>
    `
  },
  {
    id: "roles",
    titre: "3. Profils et Rôles",
    contenu: `
      <p>Chaque utilisateur dispose d'un rôle qui détermine ses droits d'accès et ses actions disponibles dans l'application :</p>
      <table>
        <thead><tr><th>Rôle</th><th>Libellé</th><th>Responsabilités principales</th></tr></thead>
        <tbody>
          <tr><td><code>direction</code></td><td>Direction opérationnelle</td><td>Créer, modifier, soumettre des plans. Initier toutes les demandes de moyens.</td></tr>
          <tr><td><code>controle_technique</code></td><td>Contrôle Technique</td><td>Valider techniquement les plans soumis.</td></tr>
          <tr><td><code>dga</code></td><td>Directeur Général Adjoint</td><td>Valider les plans après le CT.</td></tr>
          <tr><td><code>directeur_general</code></td><td>Directeur Général</td><td>Validation finale des plans avant ouverture.</td></tr>
          <tr><td><code>cad</code></td><td>Caisse, Approv. &amp; Dist.</td><td>Traiter les demandes de carburant.</td></tr>
          <tr><td><code>da</code></td><td>Dir. des Approvisionnements</td><td>Traiter les demandes de matériel.</td></tr>
          <tr><td><code>dmg</code></td><td>Dir. Matériel &amp; Garage</td><td>Traiter les demandes de location d'engins.</td></tr>
          <tr><td><code>dcgai</code></td><td>Dir. Contrôle Gestion &amp; Audit</td><td>Valider budgétairement les demandes de dépenses et matériel. Générer les bons de validation.</td></tr>
          <tr><td><code>direction_financiere</code></td><td>Direction Financière (DFC)</td><td>Procéder aux paiements des dépenses. Gérer les justificatifs. Accéder au tableau des dépenses non justifiées.</td></tr>
          <tr><td><code>admin</code></td><td>Administrateur</td><td>Gérer les utilisateurs, directions et paramètres. Accès complet en lecture.</td></tr>
        </tbody>
      </table>
      <div class="note">Les rôles <strong>DGA</strong>, <strong>DG</strong> et <strong>Contrôle Technique</strong> ont accès en lecture seule aux demandes de moyens.</div>
    `
  },
  {
    id: "plans",
    titre: "4. Gestion des Plans d'Action",
    contenu: `
      <h3>4.1 Cycle de vie d'un plan</h3>
      <p>Un plan passe par les statuts suivants :</p>
      <div class="workflow">
        <span class="statut brouillon">Brouillon</span>
        <span class="arrow">→</span>
        <span class="statut attente">En attente DC</span>
        <span class="arrow">→</span>
        <span class="statut attente">En attente CT</span>
        <span class="arrow">→</span>
        <span class="statut attente">En attente DGA</span>
        <span class="arrow">→</span>
        <span class="statut attente">En attente DG</span>
        <span class="arrow">→</span>
        <span class="statut ouvert">Ouvert</span>
        <span class="arrow">→</span>
        <span class="statut cloture">Clôturé</span>
      </div>
      <p>Un plan peut également être <span class="statut rejete">Rejeté</span> à n'importe quelle étape de validation, avec un commentaire obligatoire.</p>

      <h3>4.2 Créer un plan (rôle : Direction)</h3>
      <ol>
        <li>Cliquer sur <strong>Nouveau Plan</strong> dans le menu latéral</li>
        <li>Remplir : référence, titre, description, date de début et de fin</li>
        <li>Ajouter les moyens : pour chaque catégorie (Carburant, Matériel, Location, Dépense), cliquer sur <strong>Ajouter un moyen</strong>, définir une description et un budget</li>
        <li>Pour les dépenses, choisir une catégorie : Prime, Logement, Indemnité journalière, Logistique, Autres</li>
        <li>Cliquer sur <strong>Créer le Plan</strong></li>
      </ol>
      <div class="note">Un plan créé est d'abord en statut <strong>Brouillon</strong>. Il peut être modifié avant soumission.</div>

      <h3>4.3 Soumettre un plan</h3>
      <p>Depuis la fiche du plan (statut Brouillon), cliquer sur <strong>Soumettre pour validation</strong>. Le plan passe en <em>En attente DC</em> (ou directement <em>En attente CT</em> si soumis par un Directeur Central).</p>

      <h3>4.4 Valider ou rejeter un plan</h3>
      <p>Selon votre rôle (CT, DGA, DG), depuis la fiche du plan :</p>
      <ul>
        <li>Cliquer sur <strong>Valider</strong> pour passer à l'étape suivante — un commentaire est optionnel</li>
        <li>Cliquer sur <strong>Rejeter</strong> pour renvoyer à la direction — un commentaire est obligatoire</li>
      </ul>

      <h3>4.5 Clôturer un plan</h3>
      <p>Un plan ouvert peut être clôturé par la direction qui l'a créé. La clôture est <strong>bloquée</strong> si des demandes de dépenses sont encore en attente de justificatif.</p>
      <p>À la clôture, un <strong>certificat de validation PDF</strong> est automatiquement généré et téléchargeable.</p>

      <h3>4.6 Certificat de validation</h3>
      <p>Pour les plans ouverts ou clôturés, cliquer sur <strong>Télécharger le certificat</strong> depuis la fiche du plan. Le certificat inclut un code d'authenticité SHA-256.</p>
    `
  },
  {
    id: "carburant",
    titre: "5. Demandes de Carburant",
    contenu: `
      <h3>5.1 Flux</h3>
      <div class="workflow">
        <span class="statut attente">En attente CAD</span>
        <span class="arrow">→</span>
        <span class="statut ouvert">Validée</span>
      </div>

      <h3>5.2 Initier une demande (rôle : Direction)</h3>
      <ol>
        <li>Ouvrir la fiche du plan, section <strong>Carburant</strong></li>
        <li>Cliquer sur <strong>Demander</strong> sur le moyen souhaité</li>
        <li>Saisir le montant demandé (dans la limite du budget restant)</li>
        <li>Confirmer</li>
      </ol>

      <h3>5.3 Traiter une demande (rôle : CAD)</h3>
      <ol>
        <li>Accéder au <strong>Tableau des Demandes</strong></li>
        <li>Localiser les demandes en attente (statut <em>En attente CAD</em>)</li>
        <li>Ouvrir la fiche du plan concerné</li>
        <li>Valider le montant (possibilité d'ajuster) et téléverser la <strong>décharge signée</strong></li>
        <li>Générer le bon de validation puis confirmer</li>
      </ol>
      <div class="note">Le montant validé par le CAD peut différer du montant demandé. La consommation budgétaire est mise à jour automatiquement.</div>
    `
  },
  {
    id: "materiel",
    titre: "6. Demandes de Matériel",
    contenu: `
      <h3>6.1 Flux</h3>
      <div class="workflow">
        <span class="statut attente">En attente DA</span>
        <span class="arrow">→</span>
        <span class="statut attente">En attente DCGAI</span>
        <span class="arrow">→</span>
        <span class="statut ouvert">Validée</span>
      </div>

      <h3>6.2 Initier une demande (rôle : Direction)</h3>
      <ol>
        <li>Ouvrir la fiche du plan, section <strong>Matériel</strong></li>
        <li>Cliquer sur <strong>Faire une demande</strong></li>
        <li>Sélectionner les articles et saisir les quantités demandées</li>
        <li>Soumettre la demande</li>
      </ol>

      <h3>6.3 Traitement DA</h3>
      <ol>
        <li>Saisir les prix unitaires pour chaque article</li>
        <li>Générer le <strong>bon de commande</strong> (obligatoire avant validation)</li>
        <li>Valider — la demande passe en <em>En attente DCGAI</em></li>
      </ol>

      <h3>6.4 Validation DCGAI</h3>
      <ol>
        <li>Générer le <strong>Bon de Validation DCGAI</strong> (obligatoire)</li>
        <li>Valider — le montant est consommé sur le plan</li>
      </ol>
      <div class="note">Le DCGAI peut annuler sa validation si nécessaire. La demande repasse en <em>En attente DCGAI</em>.</div>
    `
  },
  {
    id: "location",
    titre: "7. Demandes de Location d'Engins",
    contenu: `
      <h3>7.1 Flux</h3>
      <div class="workflow">
        <span class="statut attente">En attente DMG</span>
        <span class="arrow">→</span>
        <span class="statut ouvert">Validée</span>
      </div>

      <h3>7.2 Initier une demande (rôle : Direction)</h3>
      <ol>
        <li>Ouvrir la fiche du plan, section <strong>Location</strong></li>
        <li>Cliquer sur <strong>Faire une demande</strong></li>
        <li>Sélectionner le type d'engin et saisir le nombre de jours demandés</li>
        <li>Soumettre</li>
      </ol>

      <h3>7.3 Traitement DMG</h3>
      <ol>
        <li>Saisir le coût journalier et le nombre de jours validés</li>
        <li>Téléverser la <strong>décharge de location</strong></li>
        <li>Valider la demande</li>
      </ol>
    `
  },
  {
    id: "depenses",
    titre: "8. Demandes de Dépenses",
    contenu: `
      <h3>8.1 Flux complet</h3>
      <div class="workflow">
        <span class="statut attente">En attente DCGAI</span>
        <span class="arrow">→</span>
        <span class="statut attente">En attente DFC</span>
        <span class="arrow">→</span>
        <span class="statut amber">Attente Justificatif</span>
        <span class="arrow">→</span>
        <span class="statut ouvert">Payée</span>
      </div>

      <h3>8.2 Catégories de dépenses</h3>
      <ul>
        <li><strong>Prime</strong> — primes versées aux agents</li>
        <li><strong>Logement</strong> — indemnités de logement</li>
        <li><strong>Indemnité journalière</strong> — per diem</li>
        <li><strong>Logistique</strong> — frais divers de déplacement et fournitures</li>
        <li><strong>Autres</strong> — toute dépense ne rentrant pas dans les catégories ci-dessus</li>
      </ul>

      <h3>8.3 Initier une demande (rôle : Direction)</h3>
      <p>Les demandes de dépenses peuvent être <strong>individuelles</strong> ou <strong>groupées (batch)</strong> :</p>
      <ol>
        <li>Ouvrir la fiche du plan, section <strong>Dépenses</strong></li>
        <li>Cliquer sur <strong>Nouvelle demande</strong></li>
        <li>Saisir pour chaque bénéficiaire : nom, matricule (optionnel), montant demandé</li>
        <li>Plusieurs bénéficiaires peuvent être ajoutés en une seule demande (batch)</li>
        <li>Soumettre — la demande passe en <em>En attente DCGAI</em></li>
      </ol>

      <h3>8.4 Validation DCGAI</h3>
      <ol>
        <li>Accéder au <strong>Tableau des Demandes</strong> ou à la fiche du plan</li>
        <li>Pour chaque demande (individuelle ou batch) :<br/>
          — Générer le <strong>Bon de Validation DCGAI</strong> (obligatoire, inclut les noms des bénéficiaires)<br/>
          — Cliquer sur <strong>Valider</strong></li>
        <li>La demande passe en <em>En attente DFC</em></li>
      </ol>
      <div class="note">Le bon de validation DCGAI liste tous les bénéficiaires du batch avec leur matricule. Il est nécessaire avant de pouvoir valider.</div>

      <h3>8.5 Paiement DFC</h3>
      <ol>
        <li>Accéder au <strong>Tableau des Demandes</strong> — onglet <strong>Demandes</strong></li>
        <li>Localiser les demandes en <em>En attente DFC</em></li>
        <li>Ouvrir la fiche du plan</li>
        <li>Pour chaque demande :<br/>
          — Générer le <strong>Bon de Paiement</strong><br/>
          — Saisir le <strong>montant effectivement payé</strong> et la <strong>référence de pièce comptable</strong><br/>
          — Cliquer sur <strong>Payer</strong></li>
        <li>La demande passe en statut <em>Attente Justificatif</em></li>
      </ol>
      <div class="note">Pour les batches, un paiement groupé est possible via le bouton <strong>Payer tout le batch</strong>.</div>

      <h3>8.6 Upload du Justificatif (rôle : Direction)</h3>
      <p>Après paiement, la Direction opérationnelle doit fournir la preuve de paiement :</p>
      <ol>
        <li>Ouvrir la fiche du plan concerné</li>
        <li>Dans la section Dépenses, localiser les demandes en statut <em>Attente Justificatif</em></li>
        <li>Cliquer sur <strong>Joindre le justificatif</strong></li>
        <li>Sélectionner le fichier PDF ou image</li>
        <li>Confirmer — la demande passe en statut <em>Payée</em></li>
      </ol>

      <h3>8.7 Suivi des justificatifs manquants (rôles : DFC et Admin)</h3>
      <ol>
        <li>Accéder au <strong>Tableau des Demandes</strong></li>
        <li>Cliquer sur l'onglet <strong>Justificatifs en attente</strong></li>
        <li>La liste affiche toutes les dépenses payées sans justificatif reçu, avec le montant et la date de paiement</li>
        <li>Cliquer sur <strong>Télécharger Excel</strong> pour exporter la liste complète</li>
        <li>Cliquer sur <strong>Ouvrir</strong> pour accéder directement à la fiche du plan concerné</li>
      </ol>
      <div class="note info">Un plan ne peut pas être clôturé tant qu'il reste des dépenses en attente de justificatif.</div>
    `
  },
  {
    id: "tableau-demandes",
    titre: "9. Tableau des Demandes",
    contenu: `
      <p>Le <strong>Tableau des Demandes</strong> est accessible depuis le menu latéral. Il offre une vue centralisée de toutes les demandes de moyens selon votre rôle.</p>

      <h3>9.1 Filtres disponibles</h3>
      <ul>
        <li><strong>Statut</strong> : Toutes / En attente / Traitées</li>
        <li><strong>Type</strong> : Carburant, Matériel, Location, Dépense</li>
        <li><strong>Recherche</strong> : par référence de plan, direction ou moyen</li>
        <li><strong>Tri</strong> : par type, plan, date ou statut</li>
      </ul>

      <h3>9.2 Accès filtré par rôle</h3>
      <table>
        <thead><tr><th>Rôle</th><th>Demandes visibles</th></tr></thead>
        <tbody>
          <tr><td>CAD</td><td>Carburant uniquement</td></tr>
          <tr><td>DA</td><td>Matériel uniquement</td></tr>
          <tr><td>DMG</td><td>Location uniquement</td></tr>
          <tr><td>DCGAI</td><td>Dépenses uniquement</td></tr>
          <tr><td>DFC</td><td>Dépenses + onglet Justificatifs</td></tr>
          <tr><td>Admin / DGA / DG / CT</td><td>Toutes les demandes (lecture)</td></tr>
        </tbody>
      </table>

      <h3>9.3 Actualisation</h3>
      <p>Les données se rafraîchissent automatiquement toutes les 60 secondes. Le bouton <strong>Actualiser</strong> permet un rafraîchissement manuel immédiat.</p>
    `
  },
  {
    id: "analytique",
    titre: "10. Analyse et Tableaux de Bord",
    contenu: `
      <h3>10.1 Tableau de bord principal</h3>
      <p>La page d'accueil affiche :</p>
      <ul>
        <li>Le nombre de plans par statut</li>
        <li>Les plans en dépassement de budget (consommé &gt; alloué)</li>
        <li>Le budget total, consommé et disponible</li>
        <li>La liste des plans avec leur avancement</li>
      </ul>

      <h3>10.2 Page Analyse</h3>
      <p>Accessible via le menu <strong>Analyse</strong>, elle présente :</p>
      <ul>
        <li>La consommation par <strong>Direction</strong> (budget vs consommé, taux d'avancement)</li>
        <li>La consommation par <strong>catégorie de moyen</strong> (Carburant, Matériel, etc.)</li>
        <li>Les indicateurs globaux : budget total, total consommé, disponible</li>
      </ul>
    `
  },
  {
    id: "admin",
    titre: "11. Administration",
    contenu: `
      <h3>11.1 Gestion des utilisateurs (rôle : Admin)</h3>
      <p>Depuis le menu <strong>Administration &gt; Utilisateurs</strong> :</p>
      <ul>
        <li>Créer un utilisateur : nom, e-mail, mot de passe, rôle, direction associée</li>
        <li>Modifier le rôle ou la direction d'un utilisateur existant</li>
        <li>Réinitialiser le mot de passe d'un utilisateur</li>
        <li>Désactiver un compte</li>
      </ul>
      <div class="note">Un utilisateur de type <strong>direction</strong> doit être rattaché à une direction. Les rôles fonctionnels (DFC, DCGAI, CAD, etc.) ne sont pas rattachés à une direction.</div>

      <h3>11.2 Gestion des directions</h3>
      <p>L'administrateur peut créer, modifier et archiver les directions opérationnelles depuis le même écran.</p>

      <h3>11.3 Inscription (Register)</h3>
      <p>Un nouvel utilisateur peut s'inscrire lui-même depuis la page de connexion (lien <em>Créer un nouveau compte</em>). Le compte est actif immédiatement mais son rôle par défaut est <em>direction</em> — l'administrateur doit ensuite ajuster le rôle si nécessaire.</p>
    `
  },
  {
    id: "documents",
    titre: "12. Documents Générés",
    contenu: `
      <p>L'application génère automatiquement plusieurs types de documents officiels :</p>
      <table>
        <thead><tr><th>Document</th><th>Émetteur</th><th>Contenu clé</th></tr></thead>
        <tbody>
          <tr><td>Bon de Validation Carburant</td><td>CAD</td><td>Plan, montant validé, QR code unique</td></tr>
          <tr><td>Bon de Commande Matériel</td><td>DA</td><td>Articles, quantités, prix unitaires, total</td></tr>
          <tr><td>Bon de Validation DCGAI</td><td>DCGAI</td><td>Plan, bénéficiaire(s), montant, QR code</td></tr>
          <tr><td>Bon de Paiement DFC</td><td>DFC</td><td>Bénéficiaire, montant payé, référence pièce, QR code</td></tr>
          <tr><td>Bon de Paiement Groupé DFC</td><td>DFC</td><td>Liste des bénéficiaires du batch, montant total, QR code</td></tr>
          <tr><td>Certificat de Validation Plan</td><td>Système</td><td>Référence plan, hachage SHA-256 d'authenticité, historique validations</td></tr>
        </tbody>
      </table>
      <div class="note">Tous les documents s'ouvrent dans un nouvel onglet et sont imprimables directement. Le QR code permet la vérification d'authenticité. <strong>La génération du document est obligatoire avant la validation</strong> pour les bons DCGAI et DFC.</div>
    `
  },
  {
    id: "bonnes-pratiques",
    titre: "13. Bonnes Pratiques",
    contenu: `
      <ul>
        <li>Ne jamais partager votre mot de passe — chaque action est tracée avec votre identité</li>
        <li>Générer systématiquement les documents avant de valider — ils constituent la preuve formelle de chaque étape</li>
        <li>Les justificatifs de dépenses doivent être uploadés rapidement après paiement pour permettre la clôture des plans</li>
        <li>En cas de doute sur un montant, utiliser la fonction <strong>Annuler la validation</strong> plutôt que de valider une information incorrecte</li>
        <li>Utiliser les commentaires lors des validations/rejets pour garantir la traçabilité</li>
        <li>Vérifier régulièrement le <strong>Tableau des Demandes</strong> — les données se rafraîchissent toutes les 60 secondes mais un rafraîchissement manuel est possible</li>
      </ul>
    `
  }
];

export default function Manuel() {
  const handlePrint = () => {
    window.print();
  };

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Manuel de Procédure — SOMELEC Gestion des Plans d'Action</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
  .page { width: 21cm; margin: auto; padding: 2cm 2.2cm; }

  /* Header */
  .doc-header { text-align: center; border-bottom: 3px double #1a4db5; padding-bottom: 18px; margin-bottom: 28px; }
  .doc-header h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 2px; color: #1a4db5; margin-bottom: 4px; }
  .doc-header .sub { font-size: 12px; color: #555; }
  .doc-header .date { font-size: 11px; color: #888; margin-top: 6px; }
  .doc-header .version { display: inline-block; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 4px; padding: 2px 10px; font-size: 11px; color: #1e40af; margin-top: 8px; }

  /* TOC */
  .toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 22px; margin-bottom: 32px; }
  .toc h2 { font-size: 13px; color: #1a4db5; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .toc ul { list-style: none; columns: 2; gap: 20px; }
  .toc ul li { padding: 3px 0; font-size: 11px; color: #374151; }
  .toc ul li::before { content: "›"; color: #1a4db5; margin-right: 6px; font-weight: bold; }

  /* Sections */
  .section { margin-bottom: 36px; page-break-inside: avoid; }
  .section h2 { font-size: 15px; color: #1a4db5; border-bottom: 2px solid #dbeafe; padding-bottom: 6px; margin-bottom: 14px; }
  .section h3 { font-size: 12px; color: #1e3a8a; margin: 14px 0 8px 0; font-weight: bold; }
  .section p { margin-bottom: 8px; line-height: 1.6; }
  .section ul, .section ol { margin: 8px 0 10px 20px; line-height: 1.7; }
  .section li { margin-bottom: 3px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 10px 0 14px 0; font-size: 11px; }
  th { background: #dbeafe; color: #1e3a8a; padding: 7px 10px; text-align: left; font-weight: bold; }
  td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 3px; padding: 1px 5px; font-size: 10px; font-family: monospace; color: #1e40af; }

  /* Workflow */
  .workflow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 12px 0 14px 0; }
  .statut { padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: bold; }
  .statut.brouillon { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .statut.attente { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .statut.amber { background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; }
  .statut.ouvert { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .statut.cloture { background: #ede9fe; color: #5b21b6; border: 1px solid #c4b5fd; }
  .statut.rejete { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .arrow { color: #6b7280; font-weight: bold; font-size: 14px; }

  /* Notes */
  .note { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 8px 12px; margin: 10px 0; font-size: 11px; color: #78350f; line-height: 1.5; }
  .note.info { background: #eff6ff; border-left-color: #3b82f6; color: #1e3a8a; }

  /* Footer */
  .doc-footer { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 32px; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section { page-break-inside: avoid; }
    .no-print { display: none !important; }
    @page { margin: 1.5cm 2cm; size: A4; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <h1>SOMELEC — Manuel de Procédure</h1>
    <div class="sub">Société Mauritanienne d'Électricité — Gestion des Plans d'Action</div>
    <div class="date">Version 2.0 — Juin 2026</div>
    <span class="version">Document officiel interne</span>
  </div>

  <div class="toc">
    <h2>Table des Matières</h2>
    <ul>
      ${SECTIONS.map(s => `<li>${s.titre}</li>`).join("")}
    </ul>
  </div>

  ${SECTIONS.map(s => `
  <div class="section">
    <h2>${s.titre}</h2>
    ${s.contenu}
  </div>
  `).join("")}

  <div class="doc-footer">
    <span>SOMELEC — Document interne confidentiel</span>
    <span>Gestion des Plans d'Action v2.0 — Juin 2026</span>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      alert("Veuillez autoriser les popups pour télécharger le manuel.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manuel de Procédure</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            SOMELEC — Gestion des Plans d'Action · Version 2.0 · Juin 2026
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Télécharger / Imprimer PDF
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Ce manuel décrit toutes les procédures de l'application. Cliquer sur <strong>Télécharger / Imprimer PDF</strong> pour obtenir le document imprimable.
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
        {SECTIONS.map((s) => (
          <div key={s.id} className="px-6 py-5">
            <h2 className="text-base font-bold text-blue-800 mb-3">{s.titre}</h2>
            <div
              className="prose prose-sm max-w-none text-gray-700 [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2 [&_table]:text-xs [&_th]:bg-blue-50 [&_th]:text-blue-800 [&_th]:font-semibold [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-gray-100 [&_table]:border-collapse [&_table]:w-full [&_.note]:bg-amber-50 [&_.note]:border-l-4 [&_.note]:border-amber-400 [&_.note]:px-3 [&_.note]:py-2 [&_.note]:text-amber-800 [&_.note.info]:bg-blue-50 [&_.note.info]:border-blue-400 [&_.note.info]:text-blue-800 [&_.workflow]:flex [&_.workflow]:flex-wrap [&_.workflow]:items-center [&_.workflow]:gap-2 [&_.statut]:px-2.5 [&_.statut]:py-0.5 [&_.statut]:rounded-full [&_.statut]:text-xs [&_.statut]:font-semibold [&_.arrow]:text-gray-400 [&_.arrow]:font-bold [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_code]:text-blue-700"
              dangerouslySetInnerHTML={{ __html: s.contenu }}
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-center text-gray-400 pb-4">
        SOMELEC — Document interne confidentiel · Gestion des Plans d'Action v2.0 · Juin 2026
      </p>
    </div>
  );
}
