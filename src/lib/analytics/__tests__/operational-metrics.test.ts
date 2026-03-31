import { getMetricsSummary, getTransactionAnalyticsBundle } from '../operational-metrics';

type MockRow = {
  id: string;
  referenceDate: Date;
  referenceMonth: number;
  referenceYear: number;
  weekOfMonth: number | null;
  vehicleStatusNormalized: string | null;
  paymentState: string;
  plate: string;
  model: string | null;
  investorNormalized: string | null;
  driverNormalized: string | null;
  contractValue: number;
  lateFeeAmount: number;
  discountAmount: number;
  amountToCharge: number;
  maintenanceByDriverAmount: number;
  amountPaidWeek: number;
  openAmount: number;
  rawJson: { __quality: { status: string } };
  sourceRowNumber: number;
};

function createDbMock(rows: MockRow[]) {
  return {
    operationalSnapshot: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  } as Parameters<typeof getMetricsSummary>[0];
}

describe('operational-metrics', () => {
  it('does not treat lateFeeAmount as revenue', async () => {
    const rows = [
      {
        id: 'row-1',
        referenceDate: new Date('2026-03-10T12:00:00Z'),
        referenceMonth: 3,
        referenceYear: 2026,
        weekOfMonth: 2,
        vehicleStatusNormalized: 'Locado',
        paymentState: 'PAID',
        plate: 'ABC1D23',
        model: 'Modelo X',
        investorNormalized: 'Victor',
        driverNormalized: 'Motorista 1',
        contractValue: 1000,
        lateFeeAmount: 100,
        discountAmount: 0,
        amountToCharge: 1000,
        maintenanceByDriverAmount: 50,
        amountPaidWeek: 1000,
        openAmount: 0,
        rawJson: { __quality: { status: 'OK' } },
        sourceRowNumber: 10,
      },
    ];

    const db = createDbMock(rows);
    const dateRange = { from: '2026-03-01', to: '2026-03-31' };
    const summary = await getMetricsSummary(db, dateRange);
    const incomeAnalytics = await getTransactionAnalyticsBundle(db, {
      ...dateRange,
      scope: 'income',
      limit: 5,
    });
    const expenseAnalytics = await getTransactionAnalyticsBundle(db, {
      ...dateRange,
      scope: 'expense',
      limit: 5,
    });

    expect(summary.income.received).toBe(900);
    expect(summary.expense.paid).toBe(150);
    expect(incomeAnalytics.top.data.some((item) => item.key === 'late-fee')).toBe(false);
    expect(expenseAnalytics.top.data.find((item) => item.key === 'late-fee')?.total).toBe(100);
  });
});
