// ─── Primary API ─────────────────────────────────────────
export { resolveVehicleMedia, resolveVehicleMediaCandidates, isPlaceholderMedia, SILHOUETTE_DIR, PHOTO_DIR } from './mediaResolver';
export { resolveVehicleFamily, normalizeModelString } from './normalizer';

// ─── Registry Data ───────────────────────────────────────
export { VEHICLE_FAMILIES, CATEGORY_TOKENS, CATEGORY_LABELS } from './families';

// ─── Types ───────────────────────────────────────────────
export type { VehicleCategory, VehicleMediaSource, VehicleFamily, VehicleMedia } from './types';
export type { VehicleFamilyMatch } from './normalizer';
