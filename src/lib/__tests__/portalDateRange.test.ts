import { getLatestDataMonthRange, resolvePortalDateRange } from '@/lib/portalDateRange';

type PortalDateRangeDbMock = {
  operationalSnapshot: {
    findFirst: jest.Mock;
  };
};

describe('portalDateRange', () => {
  it('returns the month boundaries of the latest data date', () => {
    expect(getLatestDataMonthRange(new Date('2026-03-26T12:00:00Z'))).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });

  it('keeps an explicit valid date range', async () => {
    const db: PortalDateRangeDbMock = {
      operationalSnapshot: {
        findFirst: jest.fn(),
      },
    };

    const range = await resolvePortalDateRange(db, {
      investorId: 'inv_1',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(range).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(db.operationalSnapshot.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the month of the latest snapshot when no range is provided', async () => {
    const db: PortalDateRangeDbMock = {
      operationalSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          referenceDate: new Date('2026-03-26T12:00:00Z'),
        }),
      },
    };

    const range = await resolvePortalDateRange(db, {
      investorId: 'inv_1',
    });

    expect(range).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });
});
