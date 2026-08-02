-- Migration 002: File storage on disk (replace base64 in DB)

-- Add file_path column to attachments (new records use disk; old records keep data column)
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Add justificatif_path to depense_demandes
ALTER TABLE depense_demandes ADD COLUMN IF NOT EXISTS justificatif_path TEXT;

-- Settings table for admin-configurable parameters (e.g. SHARE_PATH)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed default share path if not already set
INSERT INTO settings (key, value) VALUES ('SHARE_PATH', '/data/somelec-files')
  ON CONFLICT (key) DO NOTHING;
