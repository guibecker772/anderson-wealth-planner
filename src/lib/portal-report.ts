import type { FleetResponse, FleetVehicleRow } from '@/lib/analytics/fleet-metrics';

export interface PortalReportAlert {
  plate: string;
  title: string;
  description: string;
  severity: 'warning' | 'info';
}

export interface PortalInvestorReportData {
  featuredVehicles: FleetVehicleRow[];
  tableVehicles: FleetVehicleRow[];
  alerts: PortalReportAlert[];
}

function getVehicleAlertScore(vehicle: FleetVehicleRow): number {
  let score = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
  if (vehicle.openAmount > 0) score += 1;
  if (vehicle.lateFeeCost > 0) score += 1;
  return score;
}

export function buildPortalInvestorReportData(data: FleetResponse): PortalInvestorReportData {
  const featuredVehicles = [...data.vehicles]
    .sort(
      (a, b) =>
        b.operationalResult - a.operationalResult ||
        b.revenueReceived - a.revenueReceived ||
        a.plate.localeCompare(b.plate),
    )
    .slice(0, 4);

  const tableVehicles = [...data.vehicles].sort((a, b) => a.plate.localeCompare(b.plate));

  const alerts = [...data.vehicles]
    .filter((vehicle) => getVehicleAlertScore(vehicle) > 0)
    .sort((a, b) => getVehicleAlertScore(b) - getVehicleAlertScore(a) || b.openAmount - a.openAmount)
    .slice(0, 6)
    .map((vehicle) => {
      const qualityAlerts = vehicle.qualitySummary.WARNING + vehicle.qualitySummary.REVIEW_REQUIRED;
      if (vehicle.openAmount > 0) {
        return {
          plate: vehicle.plate,
          severity: 'warning' as const,
          title: 'Valor em aberto no período',
          description: `${vehicle.plate} mantém cobrança em aberto e exige acompanhamento no fechamento do período.`,
        };
      }
      if (qualityAlerts > 0) {
        return {
          plate: vehicle.plate,
          severity: 'warning' as const,
          title: 'Sinalização de qualidade operacional',
          description: `${vehicle.plate} possui ${qualityAlerts} sinalização(ões) de qualidade para revisão da base operacional.`,
        };
      }
      return {
        plate: vehicle.plate,
        severity: 'info' as const,
        title: 'Impacto por multa ou atraso',
        description: `${vehicle.plate} apresentou impacto de multa ou atraso no período selecionado.`,
      };
    });

  return {
    featuredVehicles,
    tableVehicles,
    alerts,
  };
}
