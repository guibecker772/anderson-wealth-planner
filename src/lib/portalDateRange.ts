import { endOfMonth, startOfMonth } from 'date-fns';
import type { PrismaClient } from '@prisma/client';
import {
  formatDateString,
  getPresetRange,
  parseDateString,
  type DateRangeStrings,
} from '@/lib/dateRange';

function hasExplicitValidRange(from?: string | null, to?: string | null): from is string {
  if (!from || !to) return false;
  return Boolean(parseDateString(from) && parseDateString(to));
}

export function getLatestDataMonthRange(referenceDate: Date): DateRangeStrings {
  return {
    from: formatDateString(startOfMonth(referenceDate)),
    to: formatDateString(endOfMonth(referenceDate)),
  };
}

export async function resolvePortalDateRange(
  db: PrismaClient,
  options: {
    investorId: string;
    plate?: string;
    from?: string | null;
    to?: string | null;
  },
): Promise<DateRangeStrings> {
  if (hasExplicitValidRange(options.from, options.to)) {
    return { from: options.from, to: options.to! };
  }

  const latestSnapshot = await db.operationalSnapshot.findFirst({
    where: {
      investorId: options.investorId,
      ...(options.plate ? { plate: options.plate } : {}),
    },
    orderBy: { referenceDate: 'desc' },
    select: { referenceDate: true },
  });

  if (latestSnapshot?.referenceDate) {
    return getLatestDataMonthRange(latestSnapshot.referenceDate);
  }

  return getPresetRange('thisYear');
}
