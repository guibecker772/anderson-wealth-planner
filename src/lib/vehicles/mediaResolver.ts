import type { VehicleMedia } from './types';
import type { VehicleFamilyMatch } from './normalizer';
import { resolveVehicleFamily } from './normalizer';
import { CATEGORY_LABELS } from './families';

/** Base path for silhouette/illustration SVGs inside `public/`. */
export const SILHOUETTE_DIR = '/vehicles/silhouettes';

/**
 * Base path for real photo assets inside `public/`.
 *
 * When adding a real photo, place it at:
 *   `public/vehicles/photos/{familyId}.webp`
 * Then set the family's `photoSrc` field to:
 *   `'/vehicles/photos/{familyId}.webp'`
 */
export const PHOTO_DIR = '/vehicles/photos';

const DEFAULT_MEDIA: VehicleMedia = {
  src: `${SILHOUETTE_DIR}/default.svg`,
  label: 'Veículo',
  familyId: null,
  category: 'default',
  source: 'placeholder',
};

/**
 * Resolve the best available visual media for a vehicle model string.
 *
 * Priority chain:
 * 1. **Real photo** of the resolved family (`family.photoSrc`).
 * 2. **Model silhouette** for the resolved family (`/vehicles/silhouettes/{id}.svg`).
 * 3. **Category silhouette** when only category is known (`/vehicles/silhouettes/{category}.svg`).
 * 4. **Default placeholder** when nothing matched.
 */
export function resolveVehicleMedia(model: string | null | undefined): VehicleMedia {
  return buildMediaFromMatch(resolveVehicleFamily(model));
}

/**
 * Like `resolveVehicleMedia` but returns all fallback candidates, ordered from
 * most to least specific. Useful for debugging or "next-best" rendering.
 */
export function resolveVehicleMediaCandidates(model: string | null | undefined): VehicleMedia[] {
  return buildCandidateChain(resolveVehicleFamily(model));
}

/**
 * Returns `true` when the media is a final-fallback placeholder
 * (no model or category matched).
 */
export function isPlaceholderMedia(media: VehicleMedia): boolean {
  return media.source === 'placeholder';
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildMediaFromMatch(match: VehicleFamilyMatch): VehicleMedia {
  const { family, category } = match;

  if (family) {
    if (family.photoSrc) {
      return {
        src: family.photoSrc,
        label: family.label,
        familyId: family.id,
        category: family.category,
        source: 'photo',
      };
    }

    return {
      src: `${SILHOUETTE_DIR}/${family.id}.svg`,
      label: family.label,
      familyId: family.id,
      category: family.category,
      source: 'silhouette',
    };
  }

  if (category) {
    return {
      src: `${SILHOUETTE_DIR}/${category}.svg`,
      label: CATEGORY_LABELS[category],
      familyId: null,
      category,
      source: 'category-silhouette',
    };
  }

  return { ...DEFAULT_MEDIA };
}

function buildCandidateChain(match: VehicleFamilyMatch): VehicleMedia[] {
  const candidates: VehicleMedia[] = [];
  const { family, category } = match;

  if (family) {
    if (family.photoSrc) {
      candidates.push({
        src: family.photoSrc,
        label: family.label,
        familyId: family.id,
        category: family.category,
        source: 'photo',
      });
    }

    candidates.push({
      src: `${SILHOUETTE_DIR}/${family.id}.svg`,
      label: family.label,
      familyId: family.id,
      category: family.category,
      source: 'silhouette',
    });

    candidates.push({
      src: `${SILHOUETTE_DIR}/${family.category}.svg`,
      label: CATEGORY_LABELS[family.category],
      familyId: null,
      category: family.category,
      source: 'category-silhouette',
    });
  } else if (category) {
    candidates.push({
      src: `${SILHOUETTE_DIR}/${category}.svg`,
      label: CATEGORY_LABELS[category],
      familyId: null,
      category,
      source: 'category-silhouette',
    });
  }

  candidates.push({ ...DEFAULT_MEDIA });
  return candidates;
}
