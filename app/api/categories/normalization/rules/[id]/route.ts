/**
 * Category Normalization Rules API - Single Rule Operations
 * 
 * GET /api/categories/normalization/rules/[id] - Get single rule
 * PUT /api/categories/normalization/rules/[id] - Update rule
 * DELETE /api/categories/normalization/rules/[id] - Delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidRegexPattern } from '@/lib/normalization/categoryNormalization';

// Type for valid match types
type MatchType = 'EXACT' | 'CONTAINS' | 'REGEX';
type NormalizationScope = 'EXPENSE' | 'INCOME' | 'BOTH';

interface UpdateRuleBody {
  fromPattern?: string;
  matchType?: MatchType;
  scope?: NormalizationScope;
  toCategory?: string;
  priority?: number;
  active?: boolean;
}

interface RouteParams {
  params: { id: string };
}

/**
 * GET - Get single rule by ID
 */
export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const rule = await db.categoryNormalizationRule.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      rule: {
        ...rule,
        transactionCount: rule._count.transactions,
      }
    });
  } catch (error) {
    console.error('[api/normalization/rules/[id]] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rule' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update rule
 */
export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const body: UpdateRuleBody = await req.json();
    const errors: string[] = [];

    // Validation
    if (body.fromPattern !== undefined && body.fromPattern.trim().length === 0) {
      errors.push('fromPattern cannot be empty');
    }

    if (body.matchType !== undefined && !['EXACT', 'CONTAINS', 'REGEX'].includes(body.matchType)) {
      errors.push('matchType must be EXACT, CONTAINS, or REGEX');
    }

    if (body.scope !== undefined && !['EXPENSE', 'INCOME', 'BOTH'].includes(body.scope)) {
      errors.push('scope must be EXPENSE, INCOME, or BOTH');
    }

    if (body.toCategory !== undefined && body.toCategory.trim().length === 0) {
      errors.push('toCategory cannot be empty');
    }

    // Validate regex if type is REGEX
    if (body.matchType === 'REGEX' && body.fromPattern) {
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

    // Check if rule exists
    const existing = await db.categoryNormalizationRule.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.fromPattern !== undefined) updateData.fromPattern = body.fromPattern.trim();
    if (body.matchType !== undefined) updateData.matchType = body.matchType;
    if (body.scope !== undefined) updateData.scope = body.scope;
    if (body.toCategory !== undefined) updateData.toCategory = body.toCategory.trim();
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.active !== undefined) updateData.active = body.active;

    const rule = await db.categoryNormalizationRule.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('[api/normalization/rules/[id]] PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete rule
 */
export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    // Check if rule exists
    const existing = await db.categoryNormalizationRule.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Delete (transactions will have normalizedByRuleId set to null via onDelete: SetNull)
    await db.categoryNormalizationRule.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/normalization/rules/[id]] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    );
  }
}
