-- Migration 001: Ajout des colonnes d'annulation DCGAI sur depense_demandes
-- Date: 2026-04-30
-- Description: Permet de tracer qui a annulé une validation DCGAI et quand

ALTER TABLE depense_demandes
  ADD COLUMN IF NOT EXISTS dcgai_annule_by_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS dcgai_annule_at TIMESTAMP;
