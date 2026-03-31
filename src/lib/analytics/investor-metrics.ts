import { type DateRangeStrings } from '@/lib/dateRange';
export type {
  Investor,
  InvestorMetrics,
  InvestorVehicleMetrics,
  InvestorListResponse,
} from './operational-metrics';

export { getInvestorMetrics } from './operational-metrics';

import { PrismaClient } from '@prisma/client';
import { getInvestorList as getOperationalInvestorList } from './operational-metrics';

export async function getInvestorList(client: PrismaClient): Promise<import('./operational-metrics').InvestorListResponse> {
  return getOperationalInvestorList(client);
}

export async function getAllInvestorsMetrics(client: PrismaClient, dateRange: DateRangeStrings) {
  const investors = await getOperationalInvestorList(client);
  const { getInvestorMetrics } = await import('./operational-metrics');
  const metrics = await Promise.all(
    investors.investors.map((investor) => getInvestorMetrics(client, investor.id, dateRange))
  );
  return { investors: metrics, dateRange };
}
