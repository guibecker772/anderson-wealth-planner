/**
 * Category Normalization Engine
 * 
 * Single source of truth for mapping raw text labels to standardized categories.
 * 
 * Features:
 * - Three match types: EXACT, CONTAINS, REGEX
 * - Priority-based rule resolution (higher priority wins)
 * - Safe regex execution with size limits
 * - Text normalization (trim, lowercase, collapse whitespace)
 * - Idempotent: running again produces same results
 */

import { PrismaClient, MatchType, NormalizationScope } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface NormalizationRule {
  id: string;
  fromPattern: string;
  matchType: MatchType;
  scope: NormalizationScope;
  toCategory: string;
  priority: number;
  active: boolean;
  updatedAt: Date;
}

export interface NormalizationResult {
  categoryId: string | null;  // The normalized category name (toCategory)
  ruleId: string | null;      // ID of the rule that matched
}

export interface NormalizationInput {
  rawLabel: string | null | undefined;
  scope: 'EXPENSE' | 'INCOME';
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Safety limits for regex patterns
const MAX_PATTERN_LENGTH = 200;
const MAX_TEXT_LENGTH = 500;

// ============================================================================
// TEXT NORMALIZATION
// ============================================================================

/**
 * Normalize text for comparison
 * - Trim whitespace
 * - Convert to lowercase
 * - Collapse multiple spaces to single
 * - Optionally remove accents (for broader matching)
 */
export function normalizeText(text: string | null | undefined, removeAccents = false): string {
  if (!text) return '';
  
  let normalized = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' '); // Collapse multiple spaces
  
  if (removeAccents) {
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  return normalized;
}

/**
 * Compare two strings for exact equality after normalization
 */
export function matchExact(pattern: string, text: string, removeAccents = false): boolean {
  const normalizedPattern = normalizeText(pattern, removeAccents);
  const normalizedText = normalizeText(text, removeAccents);
  return normalizedPattern === normalizedText;
}

/**
 * Check if text contains pattern as substring (case-insensitive, normalized)
 */
export function matchContains(pattern: string, text: string, removeAccents = false): boolean {
  const normalizedPattern = normalizeText(pattern, removeAccents);
  const normalizedText = normalizeText(text, removeAccents);
  return normalizedText.includes(normalizedPattern);
}

/**
 * Match text against a regex pattern with safety limits
 * Returns false if regex is invalid or text/pattern exceeds limits
 */
export function matchRegex(pattern: string, text: string): boolean {
  // Safety checks
  if (!pattern || pattern.length > MAX_PATTERN_LENGTH) return false;
  if (!text || text.length > MAX_TEXT_LENGTH) return false;
  
  try {
    const regex = new RegExp(pattern, 'i'); // Case-insensitive
    return regex.test(text);
  } catch {
    // Invalid regex pattern - fail silently
    console.warn(`[normalization] Invalid regex pattern: ${pattern}`);
    return false;
  }
}

/**
 * Validate if a regex pattern is valid and safe
 */
export function isValidRegexPattern(pattern: string): { valid: boolean; error?: string } {
  if (!pattern) {
    return { valid: false, error: 'Pattern cannot be empty' };
  }
  
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { valid: false, error: `Pattern exceeds ${MAX_PATTERN_LENGTH} characters` };
  }
  
  try {
    new RegExp(pattern, 'i');
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

// ============================================================================
// RULE MATCHING
// ============================================================================

/**
 * Check if a single rule matches the given text
 */
export function matchRule(rule: NormalizationRule, text: string): boolean {
  if (!rule.active) return false;
  if (!text) return false;
  
  switch (rule.matchType) {
    case 'EXACT':
      return matchExact(rule.fromPattern, text);
    case 'CONTAINS':
      return matchContains(rule.fromPattern, text);
    case 'REGEX':
      return matchRegex(rule.fromPattern, text);
    default:
      return false;
  }
}

/**
 * Filter rules by scope
 * BOTH scope matches any input scope
 */
export function filterRulesByScope(rules: NormalizationRule[], scope: 'EXPENSE' | 'INCOME'): NormalizationRule[] {
  return rules.filter(rule => 
    rule.scope === 'BOTH' || rule.scope === scope
  );
}

/**
 * Sort rules by priority (descending) with stable tiebreaker
 * Higher priority first; on tie, use updatedAt descending (most recent first)
 */
export function sortRulesByPriority(rules: NormalizationRule[]): NormalizationRule[] {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    // Tiebreaker: more recently updated wins
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/**
 * Pick the best matching rule from a list
 * Returns the first rule that matches after sorting by priority
 */
export function pickBestRule(rules: NormalizationRule[], text: string): NormalizationRule | null {
  const sortedRules = sortRulesByPriority(rules);
  
  for (const rule of sortedRules) {
    if (matchRule(rule, text)) {
      return rule;
    }
  }
  
  return null;
}

// ============================================================================
// MAIN RESOLUTION FUNCTION
// ============================================================================

/**
 * Resolve category by applying normalization rules
 * 
 * @param rules - All active rules (will be filtered by scope)
 * @param input - The rawLabel and scope to match against
 * @returns NormalizationResult with category and ruleId, or nulls if no match
 */
export function resolveCategoryByRules(
  rules: NormalizationRule[],
  input: NormalizationInput
): NormalizationResult {
  if (!input.rawLabel) {
    return { categoryId: null, ruleId: null };
  }
  
  // Filter by scope
  const scopedRules = filterRulesByScope(rules, input.scope);
  
  // Find best matching rule
  const matchedRule = pickBestRule(scopedRules, input.rawLabel);
  
  if (matchedRule) {
    return {
      categoryId: matchedRule.toCategory,
      ruleId: matchedRule.id,
    };
  }
  
  return { categoryId: null, ruleId: null };
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Load all active normalization rules from database
 */
export async function loadActiveRules(db: PrismaClient): Promise<NormalizationRule[]> {
  const rules = await db.categoryNormalizationRule.findMany({
    where: { active: true },
    orderBy: [
      { priority: 'desc' },
      { updatedAt: 'desc' },
    ],
  });
  
  return rules;
}

/**
 * Apply normalization to a transaction and return update data
 * Does not modify the database - returns the fields to update
 */
export async function normalizeTransaction(
  db: PrismaClient,
  transaction: {
    id: string;
    type: 'PAYABLE' | 'RECEIVABLE';
    rawLabel: string | null;
    categorySource?: string;
  }
): Promise<{
  category: string;
  categorySource: 'NORMALIZED';
  normalizedByRuleId: string;
  normalizedAt: Date;
} | null> {
  if (!transaction.rawLabel) return null;
  
  const rules = await loadActiveRules(db);
  const scope = transaction.type === 'PAYABLE' ? 'EXPENSE' : 'INCOME';
  
  const result = resolveCategoryByRules(rules, {
    rawLabel: transaction.rawLabel,
    scope,
  });
  
  if (result.categoryId && result.ruleId) {
    return {
      category: result.categoryId,
      categorySource: 'NORMALIZED',
      normalizedByRuleId: result.ruleId,
      normalizedAt: new Date(),
    };
  }
  
  return null;
}

// ============================================================================
// RAWLABEL BUILDER
// ============================================================================

/**
 * Build the rawLabel for a transaction from its source data
 * 
 * For PAYABLE (expenses):
 * - Concatenates: counterparty (Pagar para) | description | category (from Excel)
 * 
 * For RECEIVABLE (income):
 * - Concatenates: counterparty (Receber de) | description | category (from Excel)
 * 
 * This creates a deterministic text that can be matched against rules.
 */
export function buildRawLabel(fields: {
  counterparty?: string | null;
  description?: string | null;
  category?: string | null;
  observations?: string | null;
}): string {
  const parts = [
    fields.counterparty,
    fields.description,
    fields.category,
    fields.observations,
  ].filter(Boolean);
  
  if (parts.length === 0) return '';
  
  return parts.join(' | ');
}
