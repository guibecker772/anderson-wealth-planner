import { getVehicleImageCandidates, getVehicleImageMeta, resolveVehicleMedia, isPlaceholderMedia } from '@/lib/portalVehicleMedia';

describe('portalVehicleMedia', () => {
  describe('legacy API (backwards compatibility)', () => {
    it('returns a model-specific image when there is direct coverage', () => {
      expect(getVehicleImageMeta('T-Cross Highline')).toMatchObject({
        src: '/vehicles/silhouettes/tcross.svg',
        coverage: 'model',
        kind: 'crossover',
      });

      expect(getVehicleImageMeta('Gol 1.0')).toMatchObject({
        src: '/vehicles/silhouettes/gol.svg',
        coverage: 'model',
        kind: 'hatch',
      });
    });

    it('falls back to a category image when there is no direct model asset', () => {
      const candidates = getVehicleImageCandidates('Renault Duster 1.6');

      expect(candidates[0]).toMatchObject({
        src: '/vehicles/silhouettes/crossover.svg',
        coverage: 'category',
        kind: 'crossover',
      });
      expect(candidates.at(-1)).toMatchObject({
        src: '/vehicles/silhouettes/default.svg',
        coverage: 'placeholder',
      });
    });

    it('returns only the premium placeholder when the model is unknown', () => {
      expect(getVehicleImageCandidates('Modelo Experimental ZX')).toEqual([
        expect.objectContaining({
          src: '/vehicles/silhouettes/default.svg',
          coverage: 'placeholder',
          kind: 'default',
        }),
      ]);
    });
  });

  describe('new API', () => {
    it('resolveVehicleMedia returns VehicleMedia with correct fields', () => {
      const media = resolveVehicleMedia('Gol 1.0');
      expect(media.familyId).toBe('gol');
      expect(media.category).toBe('hatch');
      expect(media.source).toBe('silhouette');
    });

    it('isPlaceholderMedia works via the facade', () => {
      expect(isPlaceholderMedia(resolveVehicleMedia('XYZABC'))).toBe(true);
      expect(isPlaceholderMedia(resolveVehicleMedia('Gol'))).toBe(false);
    });
  });
});
