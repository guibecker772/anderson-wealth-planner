import { getInvestorList, getInvestorMetrics } from '../investor-metrics';

describe('investor-metrics', () => {
  it('links only high-confidence financial entries to the investor', async () => {
    const operationalFindMany = jest.fn()
      .mockResolvedValueOnce([
        { investorNormalized: 'Victor', plate: 'ABC1D23' },
        { investorNormalized: 'Anderson', plate: 'XYZ9K87' },
      ])
      .mockResolvedValueOnce([
        {
          referenceDate: new Date('2026-03-01T00:00:00.000Z'),
          vehicleStatusNormalized: 'Locado',
          plate: 'ABC1D23',
          investorNormalized: 'Victor',
          maintenanceByDriverAmount: 100,
          lateFeeAmount: 50,
          discountAmount: 25,
          amountPaidWeek: 1000,
          rawJson: { __quality: { status: 'OK' } },
        },
      ]);

    const financialRows = [
      {
        id: 'fin-1',
        domain: 'EXPENSE',
        direction: 'OUTFLOW',
        entryDate: new Date('2026-03-18T00:00:00.000Z'),
        groupRaw: 'Transferências Victor',
        detailRaw: null,
        categoryRaw: 'Despesa Variável',
        accountRaw: 'Banrisul',
        amount: 1200,
        sourceSheetName: 'Despesa',
        sourceRowNumber: 10,
      },
      {
        id: 'fin-2',
        domain: 'EXPENSE',
        direction: 'OUTFLOW',
        entryDate: new Date('2026-03-19T00:00:00.000Z'),
        groupRaw: 'Repasse investidores',
        detailRaw: null,
        categoryRaw: 'Despesa Variável',
        accountRaw: 'Banrisul',
        amount: 5000,
        sourceSheetName: 'Despesa',
        sourceRowNumber: 11,
      },
    ];

    const financialFindMany = jest.fn()
      .mockResolvedValueOnce(financialRows)
      .mockResolvedValueOnce(financialRows);

    const db = {
      operationalSnapshot: {
        findMany: operationalFindMany,
      },
      financialEntry: {
        findMany: financialFindMany,
      },
    } as unknown as Parameters<typeof getInvestorMetrics>[0];

    const result = await getInvestorMetrics(db, 'victor', { from: '2026-03-01', to: '2026-03-31' });

    expect(result).not.toBeNull();
    expect(result?.totals.operationalRevenue).toBe(1000);
    expect(result?.totals.operationalCost).toBe(175);
    expect(result?.totals.identifiedFinancialOutflow).toBe(1200);
    expect(result?.totals.expandedResult).toBe(-375);
    expect(result?.financialLinks).toHaveLength(1);
    expect(result?.financialLinks[0].groupRaw).toBe('Transferências Victor');
    expect(result?.allocationSummary.linkedExpenseCount).toBe(1);
  });

  it('keeps ambiguous corporate expenses as unallocated', async () => {
    const operationalFindMany = jest.fn().mockResolvedValue([
      { investorNormalized: 'Victor', plate: 'ABC1D23' },
      { investorNormalized: 'Anderson', plate: 'XYZ9K87' },
    ]);

    const financialFindMany = jest.fn().mockResolvedValue([
      {
        id: 'fin-1',
        domain: 'EXPENSE',
        direction: 'OUTFLOW',
        entryDate: new Date('2026-03-18T00:00:00.000Z'),
        groupRaw: 'Transferências Victor',
        detailRaw: null,
        categoryRaw: 'Despesa Variável',
        accountRaw: 'Banrisul',
        amount: 1200,
        sourceSheetName: 'Despesa',
        sourceRowNumber: 10,
      },
      {
        id: 'fin-2',
        domain: 'EXPENSE',
        direction: 'OUTFLOW',
        entryDate: new Date('2026-03-19T00:00:00.000Z'),
        groupRaw: 'Impostos',
        detailRaw: 'IRPJ',
        categoryRaw: 'Despesa Variável',
        accountRaw: 'Banrisul',
        amount: 400,
        sourceSheetName: 'Despesa',
        sourceRowNumber: 11,
      },
      {
        id: 'fin-3',
        domain: 'EXPENSE',
        direction: 'OUTFLOW',
        entryDate: new Date('2026-03-20T00:00:00.000Z'),
        groupRaw: 'Repasse investidores',
        detailRaw: null,
        categoryRaw: 'Despesa Variável',
        accountRaw: 'Banrisul',
        amount: 700,
        sourceSheetName: 'Despesa',
        sourceRowNumber: 12,
      },
    ]);

    const db = {
      operationalSnapshot: {
        findMany: operationalFindMany,
      },
      financialEntry: {
        findMany: financialFindMany,
      },
    } as unknown as Parameters<typeof getInvestorList>[0];

    const result = await getInvestorList(db, { from: '2026-03-01', to: '2026-03-31' });
    const victor = result.investors.find((item) => item.name === 'Victor');

    expect(victor?.identifiedFinancialOutflow).toBe(1200);
    expect(result.summary.corporateUnallocatedExpense).toBe(1100);
    expect(result.summary.investorsWithFinancialLinks).toBe(1);
  });
});
