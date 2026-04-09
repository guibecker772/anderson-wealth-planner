import fs from 'node:fs';
import path from 'node:path';
import {
  resolveVehicleMedia,
  resolveVehicleMediaCandidates,
  resolveVehicleFamily,
  normalizeModelString,
  isPlaceholderMedia,
  VEHICLE_FAMILIES,
} from '@/lib/vehicles';

describe('vehicles module', () => {
  describe('normalizeModelString', () => {
    it('strips accents, lowercases, and collapses non-alphanumeric', () => {
      expect(normalizeModelString('  T-Cross   Highline  ')).toBe('t cross highline');
      expect(normalizeModelString('HB20S Platinum 1.0 Turbo')).toBe('hb20s platinum 1 0 turbo');
      expect(normalizeModelString('Gol (Novo) 1.0 Mi Total Flex 8v 2p')).toBe('gol novo 1 0 mi total flex 8v 2p');
      expect(normalizeModelString('Citroën C4 Cactus')).toBe('citroen c4 cactus');
    });

    it('handles null/undefined/empty', () => {
      expect(normalizeModelString(null)).toBe('');
      expect(normalizeModelString(undefined)).toBe('');
      expect(normalizeModelString('')).toBe('');
    });
  });

  describe('resolveVehicleFamily', () => {
    it('matches specific families by alias', () => {
      const match = resolveVehicleFamily('Gol 1.0 Flex 12v 5p');
      expect(match.family).not.toBeNull();
      expect(match.family!.id).toBe('gol');
      expect(match.category).toBe('hatch');
    });

    it('matches T-Cross with hyphen/space variations', () => {
      expect(resolveVehicleFamily('T-Cross Highline 250 TSI').family?.id).toBe('tcross');
      expect(resolveVehicleFamily('TCROSS 1.0').family?.id).toBe('tcross');
    });

    it('resolves hb20s before hb20 (substring priority)', () => {
      expect(resolveVehicleFamily('HB20S Platinum').family?.id).toBe('hb20s');
      expect(resolveVehicleFamily('HB20S Platinum').category).toBe('sedan');
      expect(resolveVehicleFamily('HB20 Sense').family?.id).toBe('hb20');
      expect(resolveVehicleFamily('HB20 Sense').category).toBe('hatch');
    });

    it('falls back to category when no family matches', () => {
      const match = resolveVehicleFamily('Kwid Zen 1.0 Flex');
      expect(match.family).toBeNull();
      expect(match.category).toBe('hatch');
    });

    it('infers utility category', () => {
      const match = resolveVehicleFamily('Renault Master Furgão L2H2');
      expect(match.family).toBeNull();
      expect(match.category).toBe('utility');
    });

    it('returns null family and category for unknown models', () => {
      const match = resolveVehicleFamily('Modelo Experimental ZX');
      expect(match.family).toBeNull();
      expect(match.category).toBeNull();
    });
  });

  describe('resolveVehicleMedia', () => {
    it('returns model-specific silhouette for known families', () => {
      const media = resolveVehicleMedia('Gol 1.0 Flex 12v 5p');
      expect(media).toMatchObject({
        src: '/vehicles/silhouettes/gol.svg',
        familyId: 'gol',
        category: 'hatch',
        source: 'silhouette',
      });
      expect(media.label).toBe('Volkswagen Gol');
    });

    it('returns category silhouette for unregistered models', () => {
      const media = resolveVehicleMedia('Kwid Zen 1.0');
      expect(media).toMatchObject({
        src: '/vehicles/silhouettes/hatch.svg',
        familyId: null,
        category: 'hatch',
        source: 'category-silhouette',
      });
    });

    it('returns placeholder for completely unknown models', () => {
      const media = resolveVehicleMedia('Modelo Experimental ZX');
      expect(media).toMatchObject({
        src: '/vehicles/silhouettes/default.svg',
        familyId: null,
        category: 'default',
        source: 'placeholder',
      });
      expect(isPlaceholderMedia(media)).toBe(true);
    });

    it('handles null/empty model', () => {
      expect(isPlaceholderMedia(resolveVehicleMedia(null))).toBe(true);
      expect(isPlaceholderMedia(resolveVehicleMedia(''))).toBe(true);
    });
  });

  describe('resolveVehicleMediaCandidates', () => {
    it('returns full fallback chain for known families', () => {
      const candidates = resolveVehicleMediaCandidates('Kicks S 1.6 16v');
      expect(candidates.length).toBe(3); // silhouette, category-silhouette, placeholder
      expect(candidates[0].source).toBe('silhouette');
      expect(candidates[0].familyId).toBe('kicks');
      expect(candidates[1].source).toBe('category-silhouette');
      expect(candidates[2].source).toBe('placeholder');
    });

    it('always closes with placeholder', () => {
      const candidates = resolveVehicleMediaCandidates('Modelo Experimental ZX');
      expect(candidates).toHaveLength(1);
      expect(candidates[0].source).toBe('placeholder');
    });
  });

  describe('isPlaceholderMedia', () => {
    it('returns false for family and category matches', () => {
      expect(isPlaceholderMedia(resolveVehicleMedia('Gol'))).toBe(false);
      expect(isPlaceholderMedia(resolveVehicleMedia('Kwid'))).toBe(false);
    });

    it('returns true only for placeholder', () => {
      expect(isPlaceholderMedia(resolveVehicleMedia('XYZABC'))).toBe(true);
    });
  });

  describe('asset files', () => {
    it('every family has a silhouette SVG on disk', () => {
      for (const family of VEHICLE_FAMILIES) {
        const assetPath = path.join(process.cwd(), 'public', 'vehicles', 'silhouettes', `${family.id}.svg`);
        expect(fs.existsSync(assetPath)).toBe(true);
      }
    });

    it('category fallback SVGs exist on disk', () => {
      for (const category of ['hatch', 'sedan', 'crossover', 'utility', 'default'] as const) {
        const assetPath = path.join(process.cwd(), 'public', 'vehicles', 'silhouettes', `${category}.svg`);
        expect(fs.existsSync(assetPath)).toBe(true);
      }
    });
  });
});
