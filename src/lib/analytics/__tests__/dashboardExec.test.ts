/**
 * Tests for Executive Dashboard Analytics
 */

import { 
  calculatePreviousPeriod,
  calculateDeltaPct,
  calculateMargin,
  getBucketKey,
  getBucketLabel,
  generateBuckets,
} from '../dashboardExec';

describe('dashboardExec', () => {
  describe('calculatePreviousPeriod', () => {
    it('calculates previous period for 30-day range', () => {
      const result = calculatePreviousPeriod('2026-01-01', '2026-01-30');
      expect(result.from).toBe('2025-12-02');
      expect(result.to).toBe('2025-12-31');
    });

    it('calculates previous period for single day', () => {
      const result = calculatePreviousPeriod('2026-01-15', '2026-01-15');
      expect(result.from).toBe('2026-01-14');
      expect(result.to).toBe('2026-01-14');
    });

    it('calculates previous period for full month', () => {
      const result = calculatePreviousPeriod('2026-01-01', '2026-01-31');
      expect(result.from).toBe('2025-12-01');
      expect(result.to).toBe('2025-12-31');
    });

    it('calculates previous period crossing year boundary', () => {
      const result = calculatePreviousPeriod('2026-02-01', '2026-02-28');
      expect(result.from).toBe('2026-01-04');
      expect(result.to).toBe('2026-01-31');
    });
  });

  describe('calculateDeltaPct', () => {
    it('calculates positive percentage change', () => {
      expect(calculateDeltaPct(150, 100)).toBeCloseTo(50);
    });

    it('calculates negative percentage change', () => {
      expect(calculateDeltaPct(50, 100)).toBeCloseTo(-50);
    });

    it('returns null when previous is zero', () => {
      expect(calculateDeltaPct(100, 0)).toBeNull();
    });

    it('handles zero current correctly', () => {
      expect(calculateDeltaPct(0, 100)).toBeCloseTo(-100);
    });

    it('handles negative values', () => {
      // -50 to -100 = 50% increase (less negative)
      expect(calculateDeltaPct(-50, -100)).toBeCloseTo(50);
    });
  });

  describe('calculateMargin', () => {
    it('calculates positive margin', () => {
      expect(calculateMargin(30, 100)).toBeCloseTo(30);
    });

    it('calculates negative margin (loss)', () => {
      expect(calculateMargin(-20, 100)).toBeCloseTo(-20);
    });

    it('returns null when income is zero', () => {
      expect(calculateMargin(0, 0)).toBeNull();
    });

    it('handles large margin', () => {
      expect(calculateMargin(80, 100)).toBeCloseTo(80);
    });
  });

  describe('getBucketKey', () => {
    it('returns date string for day granularity', () => {
      const date = new Date('2026-01-15T12:00:00Z');
      expect(getBucketKey(date, 'day')).toBe('2026-01-15');
    });

    it('returns week start (Monday) for week granularity', () => {
      // Jan 15, 2026 is a Thursday, week starts Monday Jan 12
      const date = new Date('2026-01-15T12:00:00Z');
      expect(getBucketKey(date, 'week')).toBe('2026-01-12');
    });

    it('returns month start for month granularity', () => {
      const date = new Date('2026-01-15T12:00:00Z');
      expect(getBucketKey(date, 'month')).toBe('2026-01-01');
    });
  });

  describe('getBucketLabel', () => {
    it('formats day bucket correctly', () => {
      expect(getBucketLabel('2026-01-15', 'day')).toBe('15/01');
    });

    it('formats week bucket correctly', () => {
      expect(getBucketLabel('2026-01-12', 'week')).toBe('Sem 12/01');
    });

    it('formats month bucket correctly', () => {
      expect(getBucketLabel('2026-01-01', 'month')).toMatch(/[A-Za-z]+\/26/);
    });
  });

  describe('generateBuckets', () => {
    it('generates day buckets for 5-day range', () => {
      const buckets = generateBuckets('2026-01-01', '2026-01-05', 'day');
      expect(buckets).toHaveLength(5);
      expect(buckets[0]).toBe('2026-01-01');
      expect(buckets[4]).toBe('2026-01-05');
    });

    it('generates week buckets for monthly range', () => {
      const buckets = generateBuckets('2026-01-01', '2026-01-31', 'week');
      expect(buckets.length).toBeGreaterThanOrEqual(4);
      expect(buckets.length).toBeLessThanOrEqual(6);
    });

    it('generates month buckets for quarterly range', () => {
      const buckets = generateBuckets('2026-01-01', '2026-03-31', 'month');
      expect(buckets).toHaveLength(3);
      expect(buckets[0]).toBe('2026-01-01');
      expect(buckets[1]).toBe('2026-02-01');
      expect(buckets[2]).toBe('2026-03-01');
    });

    it('includes partial week at start', () => {
      // Jan 15 is Thursday, week bucket starts at previous Monday (Jan 12)
      const buckets = generateBuckets('2026-01-15', '2026-01-21', 'week');
      expect(buckets[0]).toBe('2026-01-12');
    });

    it('handles single day range', () => {
      const buckets = generateBuckets('2026-01-15', '2026-01-15', 'day');
      expect(buckets).toHaveLength(1);
      expect(buckets[0]).toBe('2026-01-15');
    });
  });
});
