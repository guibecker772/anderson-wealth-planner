import { describe, expect, it } from '@jest/globals';
import { buildPortalInvestorReportData } from '@/lib/portal-report';
import type { FleetResponse } from '@/lib/analytics/fleet-metrics';

const baseData: FleetResponse = {
  dateRange: { from: '2026-03-01', to: '2026-03-31' },
  latestReferenceDate: '2026-03-31',
  kpis: {
    totalVehicles: 4,
    totalSnapshots: 8,
    operationalRevenueReceived: 1800,
    operationalCost: 420,
    maintenanceCost: 220,
    lateFeeCost: 80,
    discountCost: 120,
    amountToCharge: 430,
    openAmount: 220,
    operationalResult: 1380,
    statusDistribution: [{ status: 'Ativo', count: 4 }],
  },
  vehicles: [
    {
      plate: 'DDD4444',
      model: 'Gol',
      investor: 'Koni',
      driver: 'Maria',
      currentStatus: 'Ativo',
      snapshotCount: 2,
      revenueReceived: 900,
      operationalCost: 120,
      maintenanceCost: 70,
      lateFeeCost: 0,
      discountCost: 50,
      amountToCharge: 60,
      openAmount: 0,
      operationalResult: 780,
      weekCount: 2,
      qualitySummary: { OK: 2, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 },
    },
    {
      plate: 'CCC3333',
      model: 'Uno',
      investor: 'Koni',
      driver: null,
      currentStatus: 'Oficina',
      snapshotCount: 2,
      revenueReceived: 450,
      operationalCost: 130,
      maintenanceCost: 80,
      lateFeeCost: 50,
      discountCost: 0,
      amountToCharge: 170,
      openAmount: 120,
      operationalResult: 320,
      weekCount: 2,
      qualitySummary: { OK: 0, WARNING: 1, REVIEW_REQUIRED: 1, UNKNOWN: 0 },
    },
    {
      plate: 'BBB2222',
      model: 'Mobi',
      investor: 'Koni',
      driver: 'João',
      currentStatus: 'Ativo',
      snapshotCount: 2,
      revenueReceived: 300,
      operationalCost: 90,
      maintenanceCost: 40,
      lateFeeCost: 20,
      discountCost: 30,
      amountToCharge: 100,
      openAmount: 100,
      operationalResult: 210,
      weekCount: 2,
      qualitySummary: { OK: 1, WARNING: 1, REVIEW_REQUIRED: 0, UNKNOWN: 0 },
    },
    {
      plate: 'AAA1111',
      model: 'Kwid',
      investor: 'Koni',
      driver: 'Carlos',
      currentStatus: 'Ativo',
      snapshotCount: 2,
      revenueReceived: 150,
      operationalCost: 80,
      maintenanceCost: 30,
      lateFeeCost: 10,
      discountCost: 40,
      amountToCharge: 100,
      openAmount: 0,
      operationalResult: 70,
      weekCount: 2,
      qualitySummary: { OK: 2, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 },
    },
  ],
};

describe('portal-report', () => {
  it('sorts featured vehicles and groups alerts by type', () => {
    const report = buildPortalInvestorReportData(baseData);

    expect(report.featuredVehicles).toHaveLength(3);
    expect(report.featuredVehicles[0]?.plate).toBe('DDD4444');
    expect(report.tableVehicles[0]?.plate).toBe('AAA1111');
    expect(report.alertGroups.map((group) => group.key)).toEqual(['financial', 'quality', 'lateFee']);
    expect(report.alertGroups[0]?.visiblePlates).toContain('CCC3333');
    expect(report.alertGroups[1]?.totalCount).toBe(2);
  });
});
