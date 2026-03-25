# Workspace

## Overview

Application de gestion des plans d'action SOMELEC (Société de Production, Distribution et Commercialisation de l'Électricité).

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Tailwind CSS + React Query
- **Build**: esbuild (CJS bundle)

## Application: SOMELEC Plans d'Action

### Concept
Gestion du cycle de vie des plans d'action avec circuit de validation :
1. **Direction** : Crée un plan d'action (titre, description, durée, date début, direction)
2. **Contrôle Technique** : Valide ou rejette
3. **Direction Générale** : Valide ou rejette → plan ouvert

### Statuts
- `brouillon` → `en_attente_ct` → `en_attente_dga` → `en_attente_dg` → `ouvert` → `cloture`
- Peut être `rejete` à n'importe quelle étape CT/DGA/DG

### Rôles utilisateurs
- `direction` : Crée, soumet et clôture des plans d'action
- `controle_technique` : Valide les plans en attente CT
- `dga` : Valide les plans en attente DGA + accès Analyse
- `directeur_general` : Valide les plans en attente DG + accès Analyse
- `dmg` : Saisit la consommation pour les moyens carburant
- `da` : Saisit la consommation pour les moyens matériel
- `controle_financier` : Saisit la consommation pour les moyens prime
- `direction_financiere` : Saisit la consommation pour logement/logistique/indemnite_journaliere

### Entités principales
- **Plans** : titre, description, dateDebut, duree, directionId, statut, createdById, reference ({DIR_CODE}-{MMYYYY}-{seq})
- **Moyens** : categorie (materiel/carburant/logement/logistique/prime/indemnite_journaliere), description, budget, quantite, unite, montantConsomme
- **Attachments** : Pièces jointes (nom, type, taille, data base64) — peut être liée à un moyen (décharge) via moyenId
- **Directions** : Unités organisationnelles
- **Users** : Employés avec rôles

### Fonctionnalités clés
- Circuit de validation complet avec stepper horizontal
- Décharge obligatoire par ligne de consommation (moyenId dans attachments)
- Page Analyse DG : dépenses agrégées par direction et par type de dépense
- Alertes dépassement budget (rouge) et délai (orange) sur le dashboard
- Téléchargement des pièces jointes via /api/plans/:id/attachments/:id/download
- Auto-seed au démarrage si la DB est vide (production)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080, /api)
│   └── somelec-plans/      # React + Vite frontend (port 21631, /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## DB Schema

- `directions` : id, nom, code
- `users` : id, nom, prenom, email, role, direction_id
- `plans` : id, titre, description, date_debut, duree, direction_id, statut, created_by_id, commentaire_rejet, created_at, updated_at
- `moyens` : id, plan_id, categorie, description, budget, unite, quantite
- `attachments` : id, plan_id, moyen_id (nullable), nom, type, taille, data, created_at

## Key Commands

- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm run typecheck` — Full typecheck
