// Shared app-wide constants.

export const APP_NAME = "PharmTrack";

// Drug pricing margins — mirror of CLAUDE.md section 6 and the Python copies in
// scripts/import_drugs.py and agent/config.py. Keep all copies identical.
// One source of truth per language.
export const MARGIN_BY_CATEGORY: Record<string, number> = {
  REMBOURSABLE: 0.28,
  OTC: 0.33,
  GENERIQUE: 0.3,
};

export const DEFAULT_MARGIN = 0.3;
