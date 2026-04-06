export interface VehicleImageMeta {
  src: string;
  label: string;
}

function normalizeModel(model: string | null | undefined): string {
  return (model ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getVehicleImageMeta(model: string | null | undefined): VehicleImageMeta {
  const normalized = normalizeModel(model);

  if (normalized.includes('uno')) {
    return { src: '/vehicles/uno.svg', label: 'Fiat Uno' };
  }
  if (normalized.includes('gol')) {
    return { src: '/vehicles/gol.svg', label: 'Volkswagen Gol' };
  }
  if (normalized.includes('mobi')) {
    return { src: '/vehicles/mobi.svg', label: 'Fiat Mobi' };
  }
  if (normalized.includes('voyage') || normalized.includes('logan') || normalized.includes('cronos')) {
    return { src: '/vehicles/sedan.svg', label: 'Sedan' };
  }
  if (normalized.includes('kwid') || normalized.includes('march') || normalized.includes('polo')) {
    return { src: '/vehicles/hatch.svg', label: 'Hatch' };
  }
  if (
    normalized.includes('cactus') ||
    normalized.includes('duster') ||
    normalized.includes('kicks') ||
    normalized.includes('t cross') ||
    normalized.includes('tcross')
  ) {
    return { src: '/vehicles/crossover.svg', label: 'Crossover' };
  }

  return { src: '/vehicles/default.svg', label: 'Veiculo' };
}
