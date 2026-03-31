export type {
  MetricsSummary,
  MetricsDelta,
  MetricsSummaryWithComparison,
} from './operational-metrics';

export {
  getMetricsSummary,
  getMetricsSummaryWithComparison,
  calculatePreviousPeriod,
} from './workbook-metrics';

export { dateRangeToDbFilter, type DateRangeStrings } from '@/lib/dateRange';

export function calculateDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
