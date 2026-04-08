import type { FleetResponse, FleetVehicleRow } from '@/lib/analytics/fleet-metrics';

export interface PortalReportAlertGroup {
  key: 'financial' | 'quality' | 'lateFee';
  title: string;
  summary: string;
  severity: 'warning' | 'info';
  visiblePlates: string[];
  totalCount: number;
  additionalCount: number;
}

export interface PortalInvestorReportData {
  featuredVehicles: FleetVehicleRow[];
  tableVehicles: FleetVehicleRow[];
  alertGroups: PortalReportAlertGroup[];
}

function sortByResultThenRevenue(a: FleetVehicleRow, b: FleetVehicleRow): number {
  return (
    b.operationalResult - a.operationalResult ||
    b.revenueReceived - a.revenueReceived ||
    a.plate.localeCompare(b.plate)
  );
}

function buildAlertGroup(
  key: PortalReportAlertGroup['key'],
  vehicles: FleetVehicleRow[],
): PortalReportAlertGroup | null {
  if (vehicles.length === 0) return null;

  const sorted = [...vehicles].sort((a, b) => b.openAmount - a.openAmount || sortByResultThenRevenue(a, b));
  const visiblePlates = sorted.slice(0, 5).map((vehicle) => vehicle.plate);
  const additionalCount = Math.max(sorted.length - visiblePlates.length, 0);

  if (key === 'financial') {
    return {
      key,
      severity: 'warning',
      title: 'Atenção financeira',
      summary: 'Veículos com valor em aberto no período e necessidade de acompanhamento no fechamento da carteira.',
      visiblePlates,
      totalCount: sorted.length,
      additionalCount,
    };
  }

  if (key === 'quality') {
    return {
      key,
      severity: 'warning',
      title: 'Qualidade operacional',
      summary: 'Placas com sinalizações de qualidade na base, sugerindo revisão pontual da leitura operacional.',
      visiblePlates,
      totalCount: sorted.length,
      additionalCount,
    };
  }

  return {
    key,
    severity: 'info',
    title: 'Multas e atrasos operacionais',
    summary: 'Veículos impactados por multa ou atraso, refletindo custo adicional na operação do período.',
    visiblePlates,
    totalCount: sorted.length,
    additionalCount,
  };
}

export function buildPortalInvestorReportData(data: FleetResponse): PortalInvestorReportData {
  const featuredVehicles = [...data.vehicles].sort(sortByResultThenRevenue).slice(0, 3);
  const tableVehicles = [...data.vehicles].sort((a, b) => a.plate.localeCompare(b.plate));

  const financialVehicles = data.vehicles.filter((vehicle) => vehicle.openAmount > 0);
  const qualityVehicles = data.vehicles.filter(
    (vehicle) => vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED > 0,
  );
  const lateFeeVehicles = data.vehicles.filter((vehicle) => vehicle.lateFeeCost > 0);

  const alertGroups = [
    buildAlertGroup('financial', financialVehicles),
    buildAlertGroup('quality', qualityVehicles),
    buildAlertGroup('lateFee', lateFeeVehicles),
  ].filter(Boolean) as PortalReportAlertGroup[];

  return {
    featuredVehicles,
    tableVehicles,
    alertGroups,
  };
}
