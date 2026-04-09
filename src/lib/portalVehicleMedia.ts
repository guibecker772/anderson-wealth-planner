/**
 * Public facade for vehicle media resolution in portal components.
 *
 * New API (preferred):
 *   import { resolveVehicleMedia, type VehicleMedia } from '@/lib/portalVehicleMedia';
 *
 * Legacy API (backwards-compatible, wraps new system):
 *   import { getVehicleImageMeta, type VehicleImageMeta } from '@/lib/portalVehicleMedia';
 */

// ─── New API (re-exported from vehicles module) ─────────
export {
  resolveVehicleMedia,
  resolveVehicleMediaCandidates,
  resolveVehicleFamily,
  normalizeModelString,
  isPlaceholderMedia,
  VEHICLE_FAMILIES,
  CATEGORY_TOKENS,
  CATEGORY_LABELS,
  SILHOUETTE_DIR,
  PHOTO_DIR,
} from '@/lib/vehicles';

export type {
  VehicleCategory,
  VehicleMediaSource,
  VehicleFamily,
  VehicleMedia,
  VehicleFamilyMatch,
} from '@/lib/vehicles';

// ─── Legacy API (backwards-compatible) ──────────────────
import { resolveVehicleMedia as _resolve, resolveVehicleMediaCandidates as _resolveCandidates, normalizeModelString as _normalize } from '@/lib/vehicles';
import type { VehicleMedia as _Media } from '@/lib/vehicles';

/** @deprecated Use `VehicleMedia['category']` instead. */
export type VehicleImageKind = 'hatch' | 'sedan' | 'crossover' | 'electric' | 'utility' | 'default';

/** @deprecated Use `VehicleMedia['source']` instead. */
export type VehicleImageCoverage = 'model' | 'category' | 'placeholder';

/** @deprecated Use `VehicleMedia` instead. */
export interface VehicleImageMeta {
  src: string;
  label: string;
  kind: VehicleImageKind;
  coverage: VehicleImageCoverage;
}

function toLegacyCoverage(source: _Media['source']): VehicleImageCoverage {
  if (source === 'photo' || source === 'silhouette') return 'model';
  if (source === 'category-silhouette') return 'category';
  return 'placeholder';
}

function toLegacyMeta(media: _Media): VehicleImageMeta {
  return {
    src: media.src,
    label: media.label,
    kind: media.category as VehicleImageKind,
    coverage: toLegacyCoverage(media.source),
  };
}

/** @deprecated Use `resolveVehicleMedia()` instead. */
export function getVehicleImageMeta(model: string | null | undefined): VehicleImageMeta {
  return toLegacyMeta(_resolve(model));
}

/** @deprecated Use `resolveVehicleMediaCandidates()` instead. */
export function getVehicleImageCandidates(model: string | null | undefined): VehicleImageMeta[] {
  return _resolveCandidates(model).map(toLegacyMeta);
}

/** @deprecated Use `normalizeModelString()` instead. */
export function normalizeVehicleModel(model: string | null | undefined): string {
  return _normalize(model);
}

/** @deprecated Use `VEHICLE_FAMILIES` + `CATEGORY_TOKENS` directly instead. */
export const vehicleVisualRegistry = {
  get assets() {
    // Derive from families for backwards compat
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const _families = require('@/lib/vehicles').VEHICLE_FAMILIES as import('@/lib/vehicles').VehicleFamily[];
    const assets: Record<string, string> = {};
    for (const f of _families) {
      const key = f.id.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
      assets[key] = `/vehicles/silhouettes/${f.id}.svg`;
    }
    assets['hatch'] = '/vehicles/silhouettes/hatch.svg';
    assets['sedan'] = '/vehicles/silhouettes/sedan.svg';
    assets['crossover'] = '/vehicles/silhouettes/crossover.svg';
    assets['utility'] = '/vehicles/silhouettes/utility.svg';
    assets['default'] = '/vehicles/silhouettes/default.svg';
    return assets;
  },
  modelRules: [],
  categoryRules: [],
  fallback: { src: '/vehicles/silhouettes/default.svg', label: 'Veículo', kind: 'default' as const, coverage: 'placeholder' as const },
};
