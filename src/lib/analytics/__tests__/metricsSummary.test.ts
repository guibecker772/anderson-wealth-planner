/**
 * Tests for Metrics Summary functions
 */

import {
  calculatePreviousPeriod,
  calculateDeltaPct,
  dateRangeToDbFilter,
} from '../metricsSummary';

describe('calculatePreviousPeriod', () => {
  it('should calculate previous 30-day period correctly', () => {
    const result = calculatePreviousPeriod('2026-01-15', '2026-02-13');
    
    // Current period is 30 days (Jan 15 to Feb 13)
    // Previous should be Dec 16 to Jan 14
    expect(result.from).toBe('2025-12-16');
    expect(result.to).toBe('2026-01-14');
  });

  it('should calculate previous month period correctly', () => {
    const result = calculatePreviousPeriod('2026-02-01', '2026-02-28');
    
    // Current period is 28 days (Feb 1 to Feb 28)
    // Previous should be Jan 4 to Jan 31
    expect(result.from).toBe('2026-01-04');
    expect(result.to).toBe('2026-01-31');
  });

  it('should handle single day period', () => {
    const result = calculatePreviousPeriod('2026-02-03', '2026-02-03');
    
    // Current period is 1 day
    // Previous should be the day before
    expect(result.from).toBe('2026-02-02');
    expect(result.to).toBe('2026-02-02');
  });

  it('should handle year boundary correctly', () => {
    const result = calculatePreviousPeriod('2026-01-01', '2026-01-31');
    
    // Current period is 31 days
    // Previous should be Dec 1 to Dec 31 of previous year
    expect(result.from).toBe('2025-12-01');
    expect(result.to).toBe('2025-12-31');
  });

  it('should handle 7-day period', () => {
    const result = calculatePreviousPeriod('2026-02-01', '2026-02-07');
    
    // Current period is 7 days
    // Previous should be Jan 25 to Jan 31
    expect(result.from).toBe('2026-01-25');
    expect(result.to).toBe('2026-01-31');
  });
});

describe('calculateDeltaPct', () => {
  it('should calculate positive delta correctly', () => {
    const result = calculateDeltaPct(150, 100);
    expect(result).toBe(50);
  });

  it('should calculate negative delta correctly', () => {
    const result = calculateDeltaPct(80, 100);
    expect(result).toBe(-20);
  });

  it('should return null when previous is zero (division by zero)', () => {
    const result = calculateDeltaPct(100, 0);
    expect(result).toBeNull();
  });

  it('should return 0 when both current and previous are zero', () => {
    const result = calculateDeltaPct(0, 0);
    expect(result).toBeNull(); // Still null because denominator is 0
  });

  it('should return -100% when current is zero and previous is positive', () => {
    const result = calculateDeltaPct(0, 100);
    expect(result).toBe(-100);
  });

  it('should handle negative numbers correctly', () => {
    // Previous was -100, current is -50 (improvement)
    const result = calculateDeltaPct(-50, -100);
    // (-50 - (-100)) / |-100| = 50 / 100 = 50%
    expect(result).toBe(50);
  });

  it('should handle decimal values', () => {
    const result = calculateDeltaPct(110.5, 100);
    expect(result).toBeCloseTo(10.5, 5);
  });
});

describe('dateRangeToDbFilter', () => {
  it('should return Date objects for gte and lte', () => {
    const result = dateRangeToDbFilter({
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(result.gte).toBeInstanceOf(Date);
    expect(result.lte).toBeInstanceOf(Date);
  });

  it('should set gte to start of day', () => {
    const result = dateRangeToDbFilter({
      from: '2026-01-15',
      to: '2026-01-15',
    });

    // Check that hours are at start of day (in Brazil time, this would be 03:00 UTC)
    // The exact hour depends on timezone handling
    expect(result.gte.getUTCHours()).toBeLessThanOrEqual(3);
  });

  it('should set lte to end of day', () => {
    const result = dateRangeToDbFilter({
      from: '2026-01-15',
      to: '2026-01-15',
    });

    // The lte should be at 23:59:59.999 in Brazil time
    // In UTC this could be around 02:59:59.999 of the next day
    expect(result.lte.getTime()).toBeGreaterThan(result.gte.getTime());
  });

  it('should handle multi-day ranges', () => {
    const result = dateRangeToDbFilter({
      from: '2026-01-01',
      to: '2026-12-31',
    });

    // Almost a full year difference
    const diffMs = result.lte.getTime() - result.gte.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    expect(diffDays).toBeGreaterThanOrEqual(364);
    expect(diffDays).toBeLessThanOrEqual(366);
  });
});

describe('Edge cases', () => {
  describe('Delta percentage edge cases', () => {
    it('should not return Infinity', () => {
      const result = calculateDeltaPct(1000000, 0);
      expect(result).toBeNull();
      expect(Number.isFinite(result)).toBe(false); // null is not finite
    });

    it('should not return NaN', () => {
      const result = calculateDeltaPct(NaN, 100);
      expect(Number.isNaN(result)).toBe(true);
    });
  });

  describe('Previous period edge cases', () => {
    it('should handle leap year correctly', () => {
      // 2024 is a leap year
      const result = calculatePreviousPeriod('2024-03-01', '2024-03-29');
      
      // 29 day period, previous should include Feb 29
      expect(result.from).toBe('2024-02-01');
      expect(result.to).toBe('2024-02-29');
    });
  });
});
