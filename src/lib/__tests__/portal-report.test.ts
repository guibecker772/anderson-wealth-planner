import { describe, expect, it } from '@jest/globals';
import { buildPortalInvestorReportData } from '@/lib/portal-report';
import type { FleetResponse } from '@/lib/analytics/fleet-metrics';

const baseData: FleetResponse = {
  dateRange: { from: '2026-03-01', to: '2026-03-31' },
  kpis: {
    totalVehicles: 2,
    totalSnapshots: 4,
    operationalRevenueReceived: 1000,
    operationalCost: 200,
    maintenanceCost: 100,
    lateFeeCost: 50,
    discountCost: 50,
    amountToCharge: 300,
    openAmount: 120,
    operationalResult: 800,
    statusDistribution: [{ status: 'Ativo', count: 2 }],
  },
  vehicles: [
    {
      plate: 'BBB2222',
      model: 'Gol',
      investor: 'Koni',
      driver: 'Maria',
      currentStatus: 'Ativo',
      snapshotCount: 2,
      revenueReceived: 700,
      operationalCost: 100,
      maintenanceCost: 50,
      lateFeeCost: 0,
      discountCost: 50,
      amountToCharge: 100,
      openAmount: 0,
      operationalResult: 600,
      weekCount: 2,
      qualitySummary: { OK: 2, WARNING: 0, REVIEW_REQUIRED: 0, UNKNOWN: 0 },
    },
    {
      plate: 'AAA1111',
      model: 'Uno',
      investor: 'Koni',
      driver: null,
      currentStatus: 'Oficina',
      snapshotCount: 2,
      revenueReceived: 300,
      operationalCost: 100,
      maintenanceCost: 50,
      lateFeeCost: 50,
      discountCost: 0,
      amountToCharge: 200,
      openAmount: 120,
      operationalResult: 200,
      weekCount: 2,
      qualitySummary: { OK: 0, WARNING: 1, REVIEW_REQUIRED: 1, UNKNOWN: 0 },
    },
  ],
};

describe('portal-report', () => {
  it('sorts featured vehicles by result and creates alerts', () => {
    const report = buildPortalInvestorReportData(baseData);
    expect(report.featuredVehicles[0]?.plate).toBe('BBB2222');
    expect(report.tableVehicles[0]?.plate).toBe('AAA1111');
    expect(report.alerts[0]?.plate).toBe('AAA1111');
  });
});
