/**
 * Category Normalization Rules API - List & Create
 * 
 * GET /api/categories/normalization/rules - List all rules
 * POST /api/categories/normalization/rules - Create new rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidRegexPattern } from '@/lib/normalization/categoryNormalization';

// Type for valid match types
type MatchType = 'EXACT' | 'CONTAINS' | 'REGEX';
type NormalizationScope = 'EXPENSE' | 'INCOME' | 'BOTH';

interface CreateRuleBody {
  fromPattern: string;
  matchType: MatchType;
  scope: NormalizationScope;
  toCategory: string;
  priority?: number;
  active?: boolean;
}

/**
 * GET - List all normalization rules
 */
export async function GET() {
  try {
    const rules = await db.categoryNormalizationRule.findMany({
      orderBy: [
        { priority: 'desc' },
        { updatedAt: 'desc' },
      ],
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    });

    return NextResponse.json({
      rules: rules.map(rule => ({
        ...rule,
        transactionCount: rule._count.transactions,
      })),
      total: rules.length,
    });
  } catch (error) {
    console.error('[api/normalization/rules] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rules', rules: [], total: 0 },
      { status: 500 }
    );
  }
}

/**
 * POST - Create new normalization rule
 */
export async function POST(req: NextRequest) {
  try {
    const body: CreateRuleBody = await req.json();

    // Validation
    const errors: string[] = [];

    if (!body.fromPattern || body.fromPattern.trim().length === 0) {
      errors.push('fromPattern is required');
    }

    if (!body.matchType || !['EXACT', 'CONTAINS', 'REGEX'].includes(body.matchType)) {
      errors.push('matchType must be EXACT, CONTAINS, or REGEX');
    }

    if (!body.scope || !['EXPENSE', 'INCOME', 'BOTH'].includes(body.scope)) {
      errors.push('scope must be EXPENSE, INCOME, or BOTH');
    }

    if (!body.toCategory || body.toCategory.trim().length === 0) {
      errors.push('toCategory is required');
    }

    // Validate regex pattern if type is REGEX
    if (body.matchType === 'REGEX') {
      const regexValidation = isValidRegexPattern(body.fromPattern);
      if (!regexValidation.valid) {
        errors.push(`Invalid regex pattern: ${regexValidation.error}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // Create rule
    const rule = await db.categoryNormalizationRule.create({
      data: {
        fromPattern: body.fromPattern.trim(),
        matchType: body.matchType,
        scope: body.scope,
        toCategory: body.toCategory.trim(),
        priority: body.priority ?? 0,
        active: body.active ?? true,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('[api/normalization/rules] POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    );
  }
}
