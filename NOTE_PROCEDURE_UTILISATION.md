# Note de Procédure — Application SOMELEC Gestion des Plans d'Action

**Version :** 1.0  
**Date :** Avril 2026  
**Destinataires :** Tous les utilisateurs de l'application

---

## 1. Présentation de l'application

L'application **SOMELEC — Gestion des Plans d'Action** est un outil de gestion et de suivi des plans d'action des différentes directions de la SOMELEC. Elle permet de :

- Créer et soumettre des plans d'action budgétisés
- Suivre leur circuit de validation hiérarchique
- Gérer l'exécution des moyens (matériel, carburant, location, primes, indemnités, etc.)
- Tracer toutes les dépenses et générer les documents associés

**Accès :** [http://plans.somelec.mr/somelec-plans/](http://plans.somelec.mr/somelec-plans/)

---

## 2. Rôles et profils utilisateurs

Chaque utilisateur dispose d'un profil déterminant les actions disponibles dans l'application.

| Profil | Intitulé | Rôle principal |
|---|---|---|
| **direction** | Chef de direction/département | Créer et gérer ses plans d'action |
| **controle_technique** | Contrôle Technique (CT) | Valider les plans au niveau CT |
| **dga** | Directeur Général Adjoint | Valider les plans au niveau DGA |
| **directeur_general** | Directeur Général | Approbation finale des plans |
| **da** | Direction des Approvisionnements | Traiter les demandes matériel |
| **dmg** | Direction Matériel & Garage | Traiter les demandes de location |
| **cad** | Caisse & Approvisionnement | Valider les demandes de carburant |
| **dcgai** | Contrôle de Gestion & Audit | Valider les demandes de dépenses (prime, indemnité, etc.) |
| **direction_financiere** | Direction Financière (DFC) | Effectuer les paiements |
| **rh** | Ressources Humaines | Consultation et réception des notifications |
| **controle_financier** | Contrôle Financier (CF) | Suivi financier |
| **admin** | Administrateur | Gérer les utilisateurs, directions et employés |

> **Note :** Un utilisateur nouvellement créé a le statut **"En attente"** jusqu'à ce que l'administrateur lui attribue un profil.

---

## 3. Connexion à l'application

1. Ouvrir le navigateur et accéder à l'URL de l'application
2. Saisir le **nom d'utilisateur** et le **mot de passe** fournis par l'administrateur
3. Cliquer sur **"Se connecter"**

---

## 4. Circuit de validation d'un Plan d'Action

### 4.1 Création du plan (Profil : Direction)

1. Sur la page d'accueil, cliquer sur **"Nouveau plan"**
2. Renseigner les informations du plan :
   - **Titre** du plan
   - **Description** / objectif
   - **Date de début** et **durée** (en mois)
3. Ajouter les **moyens** nécessaires (voir section 5)
4. Cliquer sur **"Enregistrer"** pour sauvegarder en brouillon  
5. Cliquer sur **"Soumettre"** pour lancer le circuit de validation

> Le plan passe en statut **"En attente DC"** (ou directement **"En attente CT"** si le créateur est Directeur Centrale).

### 4.2 Validation par le Directeur Centrale (DC)

1. Le DC reçoit une notification par e-mail
2. Ouvrir le plan dans l'application
3. Consulter le détail des moyens budgétisés
4. Choisir :
   - **"Approuver"** → le plan passe à l'étape CT
   - **"Rejeter"** → saisir un commentaire obligatoire ; le plan retourne à la direction créatrice

### 4.3 Validation par le Contrôle Technique (CT)

Même procédure que le DC. En cas d'approbation, le plan passe au **DGA**.

### 4.4 Validation par le DGA

Même procédure. En cas d'approbation, le plan passe au **Directeur Général**.

### 4.5 Approbation finale par le Directeur Général

En cas d'approbation, le plan passe au statut **"Ouvert"** — l'exécution peut commencer.

### 4.6 Rejet et resoumission

Si un plan est rejeté à n'importe quelle étape :
1. La direction créatrice reçoit une notification avec le commentaire de rejet
2. Elle modifie le plan (budget, description, moyens)
3. Elle resoumet le plan — le circuit recommence depuis le début

---

## 5. Ajout des moyens à un plan

Lors de la création ou de la modification d'un plan, la direction ajoute les moyens nécessaires. Chaque moyen a :
- Une **catégorie** (voir tableau ci-dessous)
- Une **description**
- Un **budget** alloué (en MRU)
- Une **quantité** et **unité** (optionnel)

| Catégorie | Description |
|---|---|
| **Matériel / Outillage / Accessoire** | Fournitures, équipements, pièces |
| **Carburant** | Approvisionnement en carburant |
| **Location véhicule** | Location de véhicules légers |
| **Location engin** | Location d'engins lourds |
| **Prime** | Primes du personnel |
| **Indemnité journalière** | Frais de mission |
| **Logement** | Frais d'hébergement |
| **Logistique** | Frais de transport et logistique |
| **Autres dépenses** | Dépenses diverses |

---

## 6. Exécution du plan (statut : Ouvert)

Une fois le plan approuvé et **ouvert**, la direction peut soumettre des demandes d'exécution pour chaque moyen. Chaque catégorie suit un circuit spécifique décrit ci-après.

---

### 6.1 Matériel / Outillage / Accessoire

**Circuit :** Direction → DA → DCGAI → Consommé

**Côté Direction :**
1. Ouvrir le plan, localiser le moyen "Matériel"
2. Cliquer sur **"Dem. exécution"**
3. Sélectionner les articles et les quantités souhaitées
4. Soumettre la demande → notification envoyée à la DA

**Côté DA :**
1. Dans le panel **"Demandes matériel (DA)"**, charger les demandes du moyen
2. Vérifier les articles et quantités
3. Saisir le **prix unitaire** de chaque article
4. Cliquer sur **"Valider"** → notification envoyée au DCGAI

**Côté DCGAI :**
1. Dans le panel **"Demandes matériel (DCGAI)"**, vérifier la demande
2. Cliquer sur **"Générer"** pour produire le bon de validation
3. Cliquer sur **"Valider"** → le budget est déduit et la consommation enregistrée

---

### 6.2 Carburant

**Circuit :** Direction → CAD → Consommé

**Côté Direction :**
1. Ouvrir le plan, localiser le moyen "Carburant"
2. Cliquer sur **"Dem. carburant"**
3. Saisir le **montant demandé** (en MRU)
4. Soumettre → notification envoyée au CAD

**Côté CAD :**
1. Dans le panel **"Demandes Carburant (CAD)"**, visualiser les demandes en attente
2. Cliquer sur **"Générer"** pour produire le **bon carburant avec QR Code**
3. Une fois le bon remis au demandeur, cliquer sur **"Valider"**
4. Saisir le **montant accordé** (peut différer du montant demandé)
5. Joindre la **décharge** signée (facultatif)
6. Cliquer sur **"Valider & Déduire du budget"**

---

### 6.3 Location de véhicules / Engins

**Circuit :** Direction → DMG → Consommé

**Côté Direction :**
1. Ouvrir le plan, localiser le moyen "Location"
2. Cliquer sur **"Dem. exécution"**
3. Sélectionner le **type d'engin/véhicule** et le **nombre de jours**
4. Soumettre → notification envoyée au DMG

**Côté DMG :**
1. Dans le panel **"Demandes Location (DMG)"**, consulter la demande
2. Vérifier les détails
3. Cliquer sur **"Valider"** → le budget est mis à jour

---

### 6.4 Prime

**Circuit :** Direction (après clôture) → DCGAI → DFC → Payé

> **Important :** Les demandes de prime ne peuvent être soumises qu'**après la clôture du plan**.

**Côté Direction :**
1. Ouvrir le plan clôturé, localiser le moyen "Prime"
2. Cliquer sur **"Dem. dépense"**
3. Dans le dialog, ajouter les bénéficiaires de trois façons :
   - **Recherche employé** : taper le nom dans la barre de recherche
   - **Saisie manuelle** : renseigner Nom, Matricule et Montant
   - **Import Excel** : importer un fichier `.xlsx` avec les colonnes Nom, Matricule, Montant
4. Vérifier la liste et les montants
5. Cliquer sur **"Envoyer au DCGAI"**

**Côté DCGAI :**
1. Dans le panel **"Demandes Dépenses à valider (DCGAI)"**, localiser le batch de primes
2. Consulter la liste des bénéficiaires et le montant total
3. Cliquer sur **"Générer"** pour produire le bon de validation
4. Cliquer sur **"Valider tout"** → le batch passe en attente DFC
5. En cas d'erreur, cliquer sur **"Annuler"** → le batch revient à l'état initial et le document doit être régénéré

**Côté DFC :**
1. Dans le panel **"Paiements à effectuer (DFC)"**, localiser le batch
2. Cliquer sur **"Saisir paiement"**
3. Confirmer le montant total à payer
4. Valider → une **référence de pièce** est générée automatiquement

---

### 6.5 Indemnité journalière / Logement / Logistique / Autres

**Circuit :** Direction (pendant le plan ouvert) → DCGAI → DFC → Payé

La procédure est identique à celle des Primes (section 6.4), sauf que ces demandes peuvent être soumises pendant que le plan est **Ouvert** (pas besoin d'attendre la clôture).

---

## 7. Consultation des bénéficiaires

Pour les catégories **Prime** et **Indemnité journalière**, il est possible de consulter la liste des bénéficiaires d'une demande :

1. Dans le tableau des moyens du plan, localiser la ligne concernée
2. Cliquer sur **"Voir bénéficiaires (N)"**
3. Un tableau s'affiche avec : Nom, Matricule, Montant, et le statut de la demande :
   - 🟡 **En attente DCGAI** : la demande est soumise, en attente de validation
   - 🔵 **Validé DCGAI** : validée par le DCGAI, en attente de paiement par la DFC
   - 🟢 **Payé** : le paiement a été effectué par la DFC

---

## 8. Clôture d'un plan

Une fois l'exécution du plan terminée, la direction doit le clôturer :

1. Ouvrir le plan (statut : Ouvert)
2. Cliquer sur **"Clôturer le plan"**
3. Rédiger un **rapport de clôture** décrivant les réalisations
4. Joindre des **pièces justificatives** si nécessaire
5. Confirmer la clôture

> Après clôture, les demandes de **prime** peuvent être soumises.

---

## 9. Commentaires et suivi

Sur chaque plan, un **journal des commentaires** enregistre toutes les actions de validation/rejet avec :
- Le nom de l'intervenant
- La date et l'heure
- L'action effectuée (approbation ou rejet)
- Le commentaire saisi

Ce journal est visible par tous les profils ayant accès au plan.

---

## 10. Administration (Profil : Admin)

L'administrateur dispose d'un accès à la page **Administration** permettant de :

### Gestion des utilisateurs
- Créer de nouveaux comptes utilisateurs
- Attribuer les profils (rôles) et niveaux
- Réinitialiser les mots de passe
- Désactiver un compte

### Gestion des directions
- Créer / modifier les directions et départements de la SOMELEC

### Gestion des employés
- Ajouter des employés avec leur matricule et NNI
- Ces données alimentent la recherche lors des demandes de primes/indemnités

---

## 11. Bonnes pratiques

- **Bien renseigner les budgets** lors de la création du plan — ils servent de plafond pour les demandes d'exécution
- **Conserver les décharges signées** avant de valider dans l'application (carburant, matériel)
- **Ne pas fermer l'onglet** pendant la génération d'un document PDF
- En cas d'erreur de validation DCGAI, utiliser le bouton **"Annuler"** plutôt que de contourner le processus

---

## 12. Support et assistance

Pour tout problème technique ou demande d'accès, contacter l'administrateur système de la DISI.

---

*Document établi par la DISI — SOMELEC*
