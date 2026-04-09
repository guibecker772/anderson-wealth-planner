import { getFleetData, getVehicleDetail } from '../fleet-metrics';

type FleetSnapshotRow = {
  id?: string;
  plate: string;
  model: string | null;
  investorNormalized: string | null;
  driverNormalized: string | null;
  vehicleStatusNormalized: string | null;
  vehicleStatusRaw: string | null;
  referenceDate: Date;
  referenceYear?: number;
  referenceMonth?: number;
  weekOfMonth: number | null;
  contractValue?: number;
  amountPaidWeek: number;
  maintenanceByDriverAmount: number;
  lateFeeAmount: number;
  discountAmount: number;
  amountToCharge: number;
  openAmount: number;
  paymentState?: string;
  rawJson: { __quality: { status: string } };
  sourceRowNumber: number;
};

function toDbRow(row: FleetSnapshotRow, index: number) {
  return {
    id: row.id ?? `row-${index + 1}`,
    referenceYear: row.referenceYear ?? row.referenceDate.getUTCFullYear(),
    referenceMonth: row.referenceMonth ?? row.referenceDate.getUTCMonth() + 1,
    contractValue: row.contractValue ?? 0,
    paymentState: row.paymentState ?? 'UNKNOWN',
    ...row,
  };
}

function createDbMock(sequences: FleetSnapshotRow[][]) {
  const findMany = jest.fn();
  sequences.forEach((rows) => {
    findMany.mockResolvedValueOnce(rows.map(toDbRow));
  });

  return {
    operationalSnapshot: {
      findMany,
    },
  } as any;
}

describe('fleet-metrics investor driver display', () => {
  it('uses the latest known driver from a previous period up to the selected end date', async () => {
    const db = createDbMock([
      [
        {
          plate: 'ABC1D23',
          model: 'Onix',
          investorNormalized: 'Victor',
          driverNormalized: null,
          vehicleStatusNormalized: 'Locado',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-03-17T00:00:00Z'),
          weekOfMonth: 3,
          amountPaidWeek: 1000,
          maintenanceByDriverAmount: 50,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 200,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 300,
        },
      ],
      [
        {
          plate: 'ABC1D23',
          model: 'Onix',
          investorNormalized: 'Victor',
          driverNormalized: null,
          vehicleStatusNormalized: 'Locado',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-03-17T00:00:00Z'),
          weekOfMonth: 3,
          amountPaidWeek: 1000,
          maintenanceByDriverAmount: 50,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 200,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 300,
        },
        {
          plate: 'ABC1D23',
          model: 'Onix',
          investorNormalized: 'Victor',
          driverNormalized: 'Maria Oliveira',
          vehicleStatusNormalized: 'Locado',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-02-10T00:00:00Z'),
          weekOfMonth: 2,
          amountPaidWeek: 900,
          maintenanceByDriverAmount: 40,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 150,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 210,
        },
      ],
    ]);

    const result = await getFleetData(db, { from: '2026-03-01', to: '2026-03-31' }, 'investor-1');

    expect(result.vehicles).toHaveLength(1);
    expect(result.vehicles[0].driver).toBe('Maria Oliveira');
    expect(result.vehicles[0].currentStatus).toBe('Locado');
    expect(result.latestReferenceDate).toBe('2026-03-17');
  });

  it('replaces the historical driver when a newer filled driver exists inside the current period', async () => {
    const db = createDbMock([
      [
        {
          plate: 'ABC1D23',
          model: 'Onix',
          investorNormalized: 'Victor',
          driverNormalized: 'João Pereira',
          vehicleStatusNormalized: 'Locado',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-03-20T00:00:00Z'),
          weekOfMonth: 3,
          amountPaidWeek: 1200,
          maintenanceByDriverAmount: 30,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 0,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 310,
        },
      ],
      [
        {
          plate: 'ABC1D23',
          model: 'Onix',
          investorNormalized: 'Victor',
          driverNormalized: 'João Pereira',
          vehicleStatusNormalized: 'Locado',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-03-20T00:00:00Z'),
          weekOfMonth: 3,
          amountPaidWeek: 1200,
          maintenanceByDriverAmount: 30,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 0,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 310,
        },
        {
          plate: 'ABC1D23',
          model: 'Onix',
          investorNormalized: 'Victor',
          driverNormalized: 'Maria Oliveira',
          vehicleStatusNormalized: 'Locado',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-02-10T00:00:00Z'),
          weekOfMonth: 2,
          amountPaidWeek: 900,
          maintenanceByDriverAmount: 40,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 150,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 210,
        },
      ],
    ]);

    const result = await getVehicleDetail(db, 'ABC1D23', { from: '2026-03-01', to: '2026-03-31' }, 'investor-1');

    expect(result?.driver).toBe('João Pereira');
    expect(result?.currentStatus).toBe('Locado');
    expect(result?.latestReferenceDate).toBe('2026-03-20');
  });

  it('keeps driver null when there is no valid driver in the entire history up to the selected end date', async () => {
    const db = createDbMock([
      [
        {
          plate: 'XYZ9K87',
          model: 'HB20',
          investorNormalized: 'Anderson',
          driverNormalized: null,
          vehicleStatusNormalized: 'Disponível Locação',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-03-17T00:00:00Z'),
          weekOfMonth: 3,
          amountPaidWeek: 0,
          maintenanceByDriverAmount: 0,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 0,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 120,
        },
      ],
      [
        {
          plate: 'XYZ9K87',
          model: 'HB20',
          investorNormalized: 'Anderson',
          driverNormalized: null,
          vehicleStatusNormalized: 'Disponível Locação',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-03-17T00:00:00Z'),
          weekOfMonth: 3,
          amountPaidWeek: 0,
          maintenanceByDriverAmount: 0,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 0,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 120,
        },
        {
          plate: 'XYZ9K87',
          model: 'HB20',
          investorNormalized: 'Anderson',
          driverNormalized: null,
          vehicleStatusNormalized: 'Locado',
          vehicleStatusRaw: null,
          referenceDate: new Date('2026-02-10T00:00:00Z'),
          weekOfMonth: 2,
          amountPaidWeek: 0,
          maintenanceByDriverAmount: 0,
          lateFeeAmount: 0,
          discountAmount: 0,
          amountToCharge: 0,
          openAmount: 0,
          rawJson: { __quality: { status: 'OK' } },
          sourceRowNumber: 90,
        },
      ],
    ]);

    const result = await getFleetData(db, { from: '2026-03-01', to: '2026-03-31' }, 'investor-1');

    expect(result.vehicles[0].driver).toBeNull();
    expect(result.latestReferenceDate).toBe('2026-03-17');
  });
});
