/** Vehicle body category. */
export type VehicleCategory = 'hatch' | 'sedan' | 'crossover' | 'electric' | 'utility';

/**
 * How the media was resolved — ordered from most to least specific.
 *
 * - `photo`                Real photograph of the exact model (PNG/WebP transparent).
 * - `silhouette`           Model-specific silhouette/illustration (SVG).
 * - `category-silhouette`  Generic silhouette for the body category (SVG).
 * - `placeholder`          Final fallback — no model or category matched.
 */
export type VehicleMediaSource = 'photo' | 'silhouette' | 'category-silhouette' | 'placeholder';

/** A registered vehicle family in the catalog. */
export interface VehicleFamily {
  /** Unique slug used as file stem: `'gol'`, `'tcross'`, `'hyptec-ht'`, … */
  id: string;
  /** Human label: `'Volkswagen Gol'` */
  label: string;
  /** Brand name: `'Volkswagen'` */
  brand: string;
  /** Body category */
  category: VehicleCategory;
  /**
   * Normalized tokens for matching against model strings.
   * Order matters when families share substring tokens (e.g. `hb20s` before `hb20`).
   */
  aliases: string[];
  /**
   * Path to a real photo asset (PNG/WebP with transparency), relative to `public/`.
   * Set to `null` while no real photo is available — the resolver uses the silhouette.
   *
   * When you add a real photo, set this to e.g. `'/vehicles/photos/gol.webp'`.
   */
  photoSrc: string | null;
}

/** Resolved visual media for a vehicle — the output consumers render. */
export interface VehicleMedia {
  /** Asset path (relative to `public/`), ready to use as `src` or `backgroundImage`. */
  src: string;
  /** Human label for the vehicle (model or category name). */
  label: string;
  /** Resolved family ID, or `null` if no family matched. */
  familyId: string | null;
  /** Body category, or `'default'` if nothing matched. */
  category: VehicleCategory | 'default';
  /** Resolution specificity — tells the UI how accurate the visual is. */
  source: VehicleMediaSource;
}
