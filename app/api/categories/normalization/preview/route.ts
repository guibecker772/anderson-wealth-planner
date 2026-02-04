/**
 * Category Normalization Preview API
 * 
 * POST /api/categories/normalization/preview
 * 
 * Preview which transactions would be normalized without actually applying changes.
 * Returns counts and sample of transactions that would be updated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  loadActiveRules, 
  resolveCategoryByRules,
  type NormalizationRule 
} from '@/lib/normalization/categoryNormalization';

interface PreviewRequest {
  scope?: 'EXPENSE' | 'INCOME' | 'BOTH';
  from?: string;
  to?: string;
  onlyUncategorized?: boolean;
  sampleLimit?: number;
}

interface PreviewSample {
  transactionId: string;
  rawLabel: string | null;
  currentCategory: string | null;
  newCategory: string | null;
  ruleId: string | null;
  ruleName: string | null;
}

interface RuleCount {
  ruleId: string;
  fromPattern: string;
  toCategory: string;
  count: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: PreviewRequest = await req.json();

    const {
      scope = 'BOTH',
      from,
      to,
      onlyUncategorized = true,
      sampleLimit = 10,
    } = body;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by eligibility: only RAW or NULL category if onlyUncategorized
    if (onlyUncategorized) {
      where.OR = [
        { category: null },
        { categorySource: 'RAW' },
      ];
    } else {
      // Still exclude MANUAL to not overwrite user edits
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

    // Load all eligible transactions
    const transactions = await db.transaction.findMany({
      where,
      select: {
        id: true,
        type: true,
        rawLabel: true,
        category: true,
        categorySource: true,
      },
      take: 5000, // Limit to prevent memory issues
    });

    // Load active rules
    const rules = await loadActiveRules(db);

    // Create a map of rules by ID for quick lookup
    const rulesById = new Map(rules.map(r => [r.id, r]));

    // Process each transaction
    let wouldUpdateCount = 0;
    const byRuleCount = new Map<string, number>();
    const samples: PreviewSample[] = [];

    for (const tx of transactions) {
      if (!tx.rawLabel) continue;

      const txScope = tx.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
      const result = resolveCategoryByRules(rules as NormalizationRule[], {
        rawLabel: tx.rawLabel,
        scope: txScope,
      });

      if (result.categoryId && result.ruleId) {
        // Would be updated
        wouldUpdateCount++;

        // Count by rule
        const currentCount = byRuleCount.get(result.ruleId) || 0;
        byRuleCount.set(result.ruleId, currentCount + 1);

        // Add to sample
        if (samples.length < sampleLimit) {
          const rule = rulesById.get(result.ruleId);
          samples.push({
            transactionId: tx.id,
            rawLabel: tx.rawLabel,
            currentCategory: tx.category,
            newCategory: result.categoryId,
            ruleId: result.ruleId,
            ruleName: rule?.fromPattern || null,
          });
        }
      }
    }

    // Convert rule counts to array with rule info
    const ruleCountArray: RuleCount[] = [];
    for (const entry of Array.from(byRuleCount.entries())) {
      const [ruleId, count] = entry;
      const rule = rulesById.get(ruleId);
      ruleCountArray.push({
        ruleId,
        fromPattern: rule?.fromPattern || '',
        toCategory: rule?.toCategory || '',
        count,
      });
    }

    // Sort by count descending
    ruleCountArray.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      eligibleCount: transactions.length,
      wouldUpdateCount,
      byRuleCount: ruleCountArray.slice(0, 10), // Top 10 rules
      sample: samples,
      filters: { scope, from, to, onlyUncategorized },
    });
  } catch (error) {
    console.error('[api/normalization/preview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
