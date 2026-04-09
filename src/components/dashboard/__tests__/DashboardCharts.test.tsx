import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardCharts, type DashboardChartsData } from '../DashboardCharts';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/components/ui/DateRangePicker', () => ({
  DateRangeBadge: ({ from, to }: { from: string; to: string }) => <span>{`${from}-${to}`}</span>,
}));

describe('DashboardCharts', () => {
  it('renders the dashboard layout with an empty imported-data state', () => {
    const dateRange = { from: '2026-03-01', to: '2026-03-31' };

    const data: DashboardChartsData = {
      summary: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingPayables: 0,
        overduePayables: 0,
        pendingReceivables: 0,
        overdueReceivables: 0,
      },
      cashflow: [],
      topCategories: [],
      dateRange,
      emptyState: {
        isEmpty: true,
        title: 'Nenhum dado importado ainda',
        description: 'Importe seus arquivos em Configuracoes para preencher os indicadores.',
        actionLabel: 'Ir para Configuracoes',
        actionHref: '/configuracoes',
      },
    };

    const html = renderToStaticMarkup(
      <DashboardCharts
        data={data}
        initialExecData={{
          summary: {
            incomeReceived: 0,
            expensePaid: 0,
            profitCash: 0,
            margin: null,
            receivable: 0,
            payable: 0,
            receivableOverdue: 0,
            payableOverdue: 0,
          },
          comparison: {
            incomeReceived: { prev: 0, deltaValue: 0, deltaPct: null },
            expensePaid: { prev: 0, deltaValue: 0, deltaPct: null },
            profitCash: { prev: 0, deltaValue: 0, deltaPct: null },
            receivable: { prev: 0, deltaValue: 0, deltaPct: null },
            payable: { prev: 0, deltaValue: 0, deltaPct: null },
            margin: { prev: null, deltaPP: null },
          },
          series: [],
          drivers: [],
          dateRange,
          previousRange: dateRange,
          bucket: 'week',
        }}
        dateRange={dateRange}
        initialBucket="week"
      />
    );

    expect(html).toContain('Visao Geral');
    expect(html).toContain('Nenhum dado importado ainda');
    expect(html).toContain('Ir para Configuracoes');
    expect(html).toContain('Receita e despesa');
    expect(html).toContain('Margem de lucro');
    expect(html).toContain('Sem comparacao');
    expect(html).toMatch(/R\$\s*0,00/);
  });
});
