import type { VehicleCategory, VehicleFamily } from './types';

/**
 * Central catalog of known vehicle families.
 *
 * ORDER MATTERS for alias collision: families listed earlier take priority when
 * two families share an overlapping token (e.g. `hb20s` must come before `hb20`).
 *
 * To add a new family:
 * 1. Add an entry here with a unique `id`.
 * 2. Place a silhouette SVG at `public/vehicles/silhouettes/{id}.svg`.
 * 3. (Future) Place a real photo at `public/vehicles/photos/{id}.webp` and set `photoSrc`.
 */
export const VEHICLE_FAMILIES: readonly VehicleFamily[] = [
  // — Volkswagen ————————————————————————————————————————————
  { id: 'gol',        label: 'Volkswagen Gol',       brand: 'Volkswagen', category: 'hatch',     aliases: ['gol'],                 photoSrc: null },
  { id: 'voyage',     label: 'Volkswagen Voyage',    brand: 'Volkswagen', category: 'sedan',     aliases: ['voyage'],              photoSrc: null },
  { id: 'polo',       label: 'Volkswagen Polo',      brand: 'Volkswagen', category: 'hatch',     aliases: ['polo'],                photoSrc: null },
  { id: 'tcross',     label: 'Volkswagen T-Cross',   brand: 'Volkswagen', category: 'crossover', aliases: ['t cross', 'tcross'],   photoSrc: null },

  // — Nissan ————————————————————————————————————————————————
  { id: 'kicks',      label: 'Nissan Kicks',         brand: 'Nissan',     category: 'crossover', aliases: ['kicks'],               photoSrc: null },
  { id: 'versa',      label: 'Nissan Versa',         brand: 'Nissan',     category: 'sedan',     aliases: ['versa'],               photoSrc: null },

  // — Citroën ———————————————————————————————————————————————
  { id: 'cactus',     label: 'Citroën C4 Cactus',   brand: 'Citroën',    category: 'crossover', aliases: ['c4 cactus', 'cactus'], photoSrc: null },

  // — Fiat ——————————————————————————————————————————————————
  { id: 'uno',        label: 'Fiat Uno',             brand: 'Fiat',       category: 'hatch',     aliases: ['uno'],                 photoSrc: null },
  { id: 'mobi',       label: 'Fiat Mobi',            brand: 'Fiat',       category: 'hatch',     aliases: ['mobi'],                photoSrc: null },
  { id: 'argo',       label: 'Fiat Argo',            brand: 'Fiat',       category: 'hatch',     aliases: ['argo'],                photoSrc: null },

  // — Hyundai (⚠ hb20s MUST come before hb20 — substring collision)
  { id: 'hb20s',      label: 'Hyundai HB20S',        brand: 'Hyundai',    category: 'sedan',     aliases: ['hb20s'],               photoSrc: null },
  { id: 'hb20',       label: 'Hyundai HB20',         brand: 'Hyundai',    category: 'hatch',     aliases: ['hb20'],                photoSrc: null },

  // — Toyota ————————————————————————————————————————————————
  { id: 'etios',      label: 'Toyota Etios',         brand: 'Toyota',     category: 'hatch',     aliases: ['etios'],               photoSrc: null },

  // — Chevrolet —————————————————————————————————————————————
  { id: 'prisma',     label: 'Chevrolet Prisma',     brand: 'Chevrolet',  category: 'sedan',     aliases: ['prisma'],              photoSrc: null },

  // — Hyptec ————————————————————————————————————————————————
  { id: 'hyptec-ht',  label: 'Hyptec HT',           brand: 'Hyptec',     category: 'electric',  aliases: ['hyptec ht', 'hyptec'], photoSrc: null },
];

/**
 * Extra tokens that help infer a vehicle *category* when no family matches.
 * Covers models not in the catalog (Kwid, Duster, etc.) and generic keywords.
 *
 * Family aliases are NOT duplicated here — the normalizer checks families first.
 */
export const CATEGORY_TOKENS: Readonly<Record<VehicleCategory, readonly string[]>> = {
  utility:   ['saveiro', 'strada', 'montana', 'fiorino', 'sprinter', 'master', 'van', 'utilitario'],
  sedan:     ['sedan', 'logan', 'cronos'],
  hatch:     ['kwid', 'march', 'hatch'],
  crossover: ['duster', 'tracker', 'creta', 'suv', 'crossover'],
  electric:  ['ev', 'eletric', 'electric'],
};

/** Human-readable labels for each category. */
export const CATEGORY_LABELS: Readonly<Record<VehicleCategory, string>> = {
  hatch:     'Hatch',
  sedan:     'Sedan',
  crossover: 'Crossover',
  electric:  'Elétrico',
  utility:   'Utilitário',
};
