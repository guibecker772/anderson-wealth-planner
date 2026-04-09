import type { VehicleCategory, VehicleFamily } from './types';
import { VEHICLE_FAMILIES, CATEGORY_TOKENS } from './families';

/** Result of normalizing a raw model string. */
export interface VehicleFamilyMatch {
  /** The matched family entry, or `null` if no family matched. */
  family: VehicleFamily | null;
  /** Inferred category (from family or from category tokens), or `null` if unknown. */
  category: VehicleCategory | null;
  /** The normalized (lowercased, accent-stripped) model string. */
  normalized: string;
}

/**
 * Normalize a raw vehicle model string for matching.
 *
 * - Lowercases
 * - Strips diacritics (NFD + combining marks removal)
 * - Collapses non-alphanumeric runs to single spaces
 * - Trims
 *
 * Examples:
 * ```
 * 'Gol (Novo) 1.0 Mi Total Flex 8v 2p'  → 'gol novo 1 0 mi total flex 8v 2p'
 * 'T-Cross 1.0 TSI Flex 12v 5p Aut.'     → 't cross 1 0 tsi flex 12v 5p aut'
 * 'HB20S Platinum 1.0 Turbo'             → 'hb20s platinum 1 0 turbo'
 * ```
 */
export function normalizeModelString(model: string | null | undefined): string {
  return (model ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve a raw model string to a vehicle family and/or category.
 *
 * Resolution order:
 * 1. Family match via aliases (first match in `VEHICLE_FAMILIES` wins — list order matters).
 * 2. Category inference via `CATEGORY_TOKENS`.
 * 3. `null` family + `null` category (unknown).
 */
export function resolveVehicleFamily(model: string | null | undefined): VehicleFamilyMatch {
  const normalized = normalizeModelString(model);

  if (!normalized) {
    return { family: null, category: null, normalized };
  }

  for (const family of VEHICLE_FAMILIES) {
    if (family.aliases.some((alias) => normalized.includes(alias))) {
      return { family, category: family.category, normalized };
    }
  }

  for (const [cat, tokens] of Object.entries(CATEGORY_TOKENS) as [VehicleCategory, readonly string[]][]) {
    if (tokens.some((token) => normalized.includes(token))) {
      return { family: null, category: cat, normalized };
    }
  }

  return { family: null, category: null, normalized };
}
