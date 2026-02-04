/**
 * Category Normalization Apply API
 * 
 * POST /api/categories/normalization/apply
 * 
 * Apply normalization rules to existing transactions (backfill).
 * Processes in batches to avoid memory issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  loadActiveRules, 
  resolveCategoryByRules,
  type NormalizationRule 
} from '@/lib/normalization/categoryNormalization';

interface ApplyRequest {
  scope?: 'EXPENSE' | 'INCOME' | 'BOTH';
  from?: string;
  to?: string;
  onlyUncategorized?: boolean;
  dryRun?: boolean;
  batchSize?: number;
}

interface ApplyResult {
  updatedCount: number;
  skippedCount: number;
  errorsCount: number;
  byRuleCount: { ruleId: string; fromPattern: string; toCategory: string; count: number }[];
  dryRun: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: ApplyRequest = await req.json();

    const {
      scope = 'BOTH',
      from,
      to,
      onlyUncategorized = true,
      dryRun = false,
      batchSize = 500,
    } = body;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by eligibility
    if (onlyUncategorized) {
      where.OR = [
        { category: null },
        { categorySource: 'RAW' },
      ];
    } else {
      where.categorySource = { not: 'MANUAL' };
    }

    // Filter by scope
    if (scope === 'EXPENSE') {
      where.type = 'PAYABLE';
    } else if (scope === 'INCOME') {
      where.type = 'RECEIVABLE';
    }

    // Filter by date range
    if (from || to) {
      where.dueDate = {};
      if (from) (where.dueDate as Record<string, Date>).gte = new Date(from);
      if (to) (where.dueDate as Record<string, Date>).lte = new Date(to);
    }

    // Require non-empty rawLabel
    where.rawLabel = { not: null };

    // Load active rules once
    const rules = await loadActiveRules(db);
    
    if (rules.length === 0) {
      return NextResponse.json({
        updatedCount: 0,
        skippedCount: 0,
        errorsCount: 0,
        byRuleCount: [],
        dryRun,
        message: 'No active rules found',
      });
    }

    // Create a map of rules by ID for quick lookup
    const rulesById = new Map(rules.map(r => [r.id, r]));

    // Process in batches
    let updatedCount = 0;
    let skippedCount = 0;
    let errorsCount = 0;
    const byRuleCount = new Map<string, number>();
    
    let cursor: string | undefined;
    let hasMore = true;
    const now = new Date();

    while (hasMore) {
      // Fetch batch
      const transactions = await db.transaction.findMany({
        where,
        select: {
          id: true,
          type: true,
          rawLabel: true,
          category: true,
          categorySource: true,
        },
        take: batchSize,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
      });

      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      // Update cursor for next iteration
      cursor = transactions[transactions.length - 1].id;
      
      if (transactions.length < batchSize) {
        hasMore = false;
      }

      // Process batch
      const updates: { id: string; category: string; ruleId: string }[] = [];

      for (const tx of transactions) {
        if (!tx.rawLabel) {
          skippedCount++;
          continue;
        }

        try {
          const txScope = tx.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
          const result = resolveCategoryByRules(rules as NormalizationRule[], {
            rawLabel: tx.rawLabel,
            scope: txScope,
          });

          if (result.categoryId && result.ruleId) {
            updates.push({
              id: tx.id,
              category: result.categoryId,
              ruleId: result.ruleId,
            });

            // Count by rule
            const currentCount = byRuleCount.get(result.ruleId) || 0;
            byRuleCount.set(result.ruleId, currentCount + 1);
          } else {
            skippedCount++;
          }
        } catch {
          errorsCount++;
        }
      }

      // Apply updates if not dry run
      if (!dryRun && updates.length > 0) {
        // Use transaction for batch update
        await db.$transaction(
          updates.map(update =>
            db.transaction.update({
              where: { id: update.id },
              data: {
                category: update.category,
                categorySource: 'NORMALIZED',
                normalizedByRuleId: update.ruleId,
                normalizedAt: now,
              },
            })
          )
        );
      }

      updatedCount += updates.length;
    }

    // Convert rule counts to array
    const ruleCountArray = Array.from(byRuleCount.entries()).map(([ruleId, count]) => {
      const rule = rulesById.get(ruleId);
      return {
        ruleId,
        fromPattern: rule?.fromPattern || '',
        toCategory: rule?.toCategory || '',
        count,
      };
    });

    // Sort by count descending
    ruleCountArray.sort((a, b) => b.count - a.count);

    const result: ApplyResult = {
      updatedCount,
      skippedCount,
      errorsCount,
      byRuleCount: ruleCountArray,
      dryRun,
    };

    console.log(
      `[normalization/apply] ${dryRun ? 'DRY RUN: ' : ''}Updated ${updatedCount}, Skipped ${skippedCount}, Errors ${errorsCount}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/normalization/apply] Error:', error);
    return NextResponse.json(
      { error: 'Failed to apply normalization' },
      { status: 500 }
    );
  }
}
