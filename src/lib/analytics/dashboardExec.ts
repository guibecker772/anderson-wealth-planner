export type {
  BucketGranularity,
  ExecSummary,
  ExecComparison,
  ExecSeriesPoint,
  CategoryDriver,
  ExecDashboardResponse,
} from './operational-metrics';

export {
  calculatePreviousPeriod,
  calculateMargin,
  getBucketKey,
  getBucketLabel,
  generateBuckets,
  getExecDashboardData,
} from './operational-metrics';

export function calculateDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
