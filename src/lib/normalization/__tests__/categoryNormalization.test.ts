/**
 * Category Normalization Engine Tests
 */

import {
  normalizeText,
  matchExact,
  matchContains,
  matchRegex,
  isValidRegexPattern,
  matchRule,
  filterRulesByScope,
  sortRulesByPriority,
  pickBestRule,
  resolveCategoryByRules,
  buildRawLabel,
  type NormalizationRule,
} from '../categoryNormalization';

// ============================================================================
// HELPER TO CREATE MOCK RULES
// ============================================================================

function createRule(overrides: Partial<NormalizationRule> = {}): NormalizationRule {
  return {
    id: 'rule-1',
    fromPattern: 'test',
    matchType: 'CONTAINS',
    scope: 'BOTH',
    toCategory: 'Test Category',
    priority: 0,
    active: true,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ============================================================================
// normalizeText
// ============================================================================

describe('normalizeText', () => {
  it('should trim whitespace', () => {
    expect(normalizeText('  hello world  ')).toBe('hello world');
  });

  it('should convert to lowercase', () => {
    expect(normalizeText('HELLO WORLD')).toBe('hello world');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });

  it('should handle empty/null input', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });

  it('should optionally remove accents', () => {
    expect(normalizeText('café résumé', true)).toBe('cafe resume');
    expect(normalizeText('café résumé', false)).toBe('café résumé');
  });
});

// ============================================================================
// matchExact
// ============================================================================

describe('matchExact', () => {
  it('should match identical strings', () => {
    expect(matchExact('hello', 'hello')).toBe(true);
  });

  it('should match case-insensitively', () => {
    expect(matchExact('HELLO', 'hello')).toBe(true);
    expect(matchExact('Hello', 'HELLO')).toBe(true);
  });

  it('should match after trimming', () => {
    expect(matchExact('  hello  ', 'hello')).toBe(true);
  });

  it('should not match different strings', () => {
    expect(matchExact('hello', 'world')).toBe(false);
    expect(matchExact('hello', 'hello world')).toBe(false);
  });
});

// ============================================================================
// matchContains
// ============================================================================

describe('matchContains', () => {
  it('should match substring', () => {
    expect(matchContains('world', 'hello world')).toBe(true);
  });

  it('should match case-insensitively', () => {
    expect(matchContains('WORLD', 'hello world')).toBe(true);
  });

  it('should match exact string', () => {
    expect(matchContains('hello', 'hello')).toBe(true);
  });

  it('should not match non-existing substring', () => {
    expect(matchContains('xyz', 'hello world')).toBe(false);
  });
});

// ============================================================================
// matchRegex
// ============================================================================

describe('matchRegex', () => {
  it('should match valid regex', () => {
    expect(matchRegex('hello.*world', 'hello beautiful world')).toBe(true);
  });

  it('should match case-insensitively', () => {
    expect(matchRegex('HELLO', 'hello world')).toBe(true);
  });

  it('should return false for invalid regex', () => {
    expect(matchRegex('[invalid(', 'test')).toBe(false);
  });

  it('should return false for pattern exceeding limit', () => {
    const longPattern = 'a'.repeat(201);
    expect(matchRegex(longPattern, 'test')).toBe(false);
  });

  it('should return false for text exceeding limit', () => {
    const longText = 'a'.repeat(501);
    expect(matchRegex('a', longText)).toBe(false);
  });

  it('should return false for empty pattern', () => {
    expect(matchRegex('', 'test')).toBe(false);
  });
});

// ============================================================================
// isValidRegexPattern
// ============================================================================

describe('isValidRegexPattern', () => {
  it('should return valid for correct patterns', () => {
    expect(isValidRegexPattern('hello.*world')).toEqual({ valid: true });
    expect(isValidRegexPattern('^energia')).toEqual({ valid: true });
  });

  it('should return invalid for empty pattern', () => {
    expect(isValidRegexPattern('')).toEqual({ valid: false, error: 'Pattern cannot be empty' });
  });

  it('should return invalid for pattern exceeding limit', () => {
    const longPattern = 'a'.repeat(201);
    const result = isValidRegexPattern(longPattern);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('200');
  });

  it('should return invalid for malformed regex', () => {
    const result = isValidRegexPattern('[invalid(');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// matchRule
// ============================================================================

describe('matchRule', () => {
  it('should not match inactive rules', () => {
    const rule = createRule({ active: false, fromPattern: 'test' });
    expect(matchRule(rule, 'test')).toBe(false);
  });

  it('should match EXACT type', () => {
    const rule = createRule({ matchType: 'EXACT', fromPattern: 'energia' });
    expect(matchRule(rule, 'energia')).toBe(true);
    expect(matchRule(rule, 'energia elétrica')).toBe(false);
  });

  it('should match CONTAINS type', () => {
    const rule = createRule({ matchType: 'CONTAINS', fromPattern: 'energia' });
    expect(matchRule(rule, 'pagamento energia elétrica')).toBe(true);
    expect(matchRule(rule, 'telefone')).toBe(false);
  });

  it('should match REGEX type', () => {
    const rule = createRule({ matchType: 'REGEX', fromPattern: '^CPFL.*energia' });
    expect(matchRule(rule, 'CPFL pagamento energia')).toBe(true);
    expect(matchRule(rule, 'energia CPFL')).toBe(false);
  });

  it('should return false for empty text', () => {
    const rule = createRule({ fromPattern: 'test' });
    expect(matchRule(rule, '')).toBe(false);
  });
});

// ============================================================================
// filterRulesByScope
// ============================================================================

describe('filterRulesByScope', () => {
  const rules: NormalizationRule[] = [
    createRule({ id: 'expense', scope: 'EXPENSE' }),
    createRule({ id: 'income', scope: 'INCOME' }),
    createRule({ id: 'both', scope: 'BOTH' }),
  ];

  it('should filter EXPENSE rules for expense scope', () => {
    const filtered = filterRulesByScope(rules, 'EXPENSE');
    expect(filtered.map(r => r.id)).toEqual(['expense', 'both']);
  });

  it('should filter INCOME rules for income scope', () => {
    const filtered = filterRulesByScope(rules, 'INCOME');
    expect(filtered.map(r => r.id)).toEqual(['income', 'both']);
  });
});

// ============================================================================
// sortRulesByPriority
// ============================================================================

describe('sortRulesByPriority', () => {
  it('should sort by priority descending', () => {
    const rules: NormalizationRule[] = [
      createRule({ id: 'low', priority: 0 }),
      createRule({ id: 'high', priority: 10 }),
      createRule({ id: 'mid', priority: 5 }),
    ];
    const sorted = sortRulesByPriority(rules);
    expect(sorted.map(r => r.id)).toEqual(['high', 'mid', 'low']);
  });

  it('should use updatedAt as tiebreaker', () => {
    const rules: NormalizationRule[] = [
      createRule({ id: 'old', priority: 5, updatedAt: new Date('2026-01-01') }),
      createRule({ id: 'new', priority: 5, updatedAt: new Date('2026-02-01') }),
    ];
    const sorted = sortRulesByPriority(rules);
    expect(sorted.map(r => r.id)).toEqual(['new', 'old']);
  });
});

// ============================================================================
// pickBestRule
// ============================================================================

describe('pickBestRule', () => {
  it('should pick highest priority matching rule', () => {
    const rules: NormalizationRule[] = [
      createRule({ id: 'low', priority: 0, fromPattern: 'energia' }),
      createRule({ id: 'high', priority: 10, fromPattern: 'energia' }),
    ];
    const result = pickBestRule(rules, 'pagamento energia');
    expect(result?.id).toBe('high');
  });

  it('should return null when no rules match', () => {
    const rules: NormalizationRule[] = [
      createRule({ id: 'rule1', fromPattern: 'xyz' }),
    ];
    const result = pickBestRule(rules, 'abc');
    expect(result).toBeNull();
  });

  it('should skip inactive rules', () => {
    const rules: NormalizationRule[] = [
      createRule({ id: 'inactive', priority: 100, fromPattern: 'test', active: false }),
      createRule({ id: 'active', priority: 1, fromPattern: 'test', active: true }),
    ];
    const result = pickBestRule(rules, 'test');
    expect(result?.id).toBe('active');
  });
});

// ============================================================================
// resolveCategoryByRules
// ============================================================================

describe('resolveCategoryByRules', () => {
  const rules: NormalizationRule[] = [
    createRule({ 
      id: 'rule1', 
      fromPattern: 'energia', 
      toCategory: 'Energia Elétrica',
      scope: 'EXPENSE',
      priority: 10 
    }),
    createRule({ 
      id: 'rule2', 
      fromPattern: 'cpfl', 
      toCategory: 'CPFL Energia',
      scope: 'EXPENSE',
      priority: 20 
    }),
    createRule({ 
      id: 'rule3', 
      fromPattern: 'aluguel', 
      toCategory: 'Locação',
      scope: 'INCOME',
    }),
  ];

  it('should resolve category for matching rule', () => {
    const result = resolveCategoryByRules(rules, {
      rawLabel: 'pagamento energia cpfl',
      scope: 'EXPENSE',
    });
    // rule2 has higher priority and matches 'cpfl'
    expect(result.categoryId).toBe('CPFL Energia');
    expect(result.ruleId).toBe('rule2');
  });

  it('should return nulls when no match', () => {
    const result = resolveCategoryByRules(rules, {
      rawLabel: 'telefone vivo',
      scope: 'EXPENSE',
    });
    expect(result.categoryId).toBeNull();
    expect(result.ruleId).toBeNull();
  });

  it('should return nulls for empty rawLabel', () => {
    const result = resolveCategoryByRules(rules, {
      rawLabel: '',
      scope: 'EXPENSE',
    });
    expect(result.categoryId).toBeNull();
    expect(result.ruleId).toBeNull();
  });

  it('should filter by scope', () => {
    const result = resolveCategoryByRules(rules, {
      rawLabel: 'energia',
      scope: 'INCOME', // energia rule is EXPENSE only
    });
    expect(result.categoryId).toBeNull();
  });
});

// ============================================================================
// buildRawLabel
// ============================================================================

describe('buildRawLabel', () => {
  it('should concatenate non-null fields', () => {
    const result = buildRawLabel({
      counterparty: 'CPFL',
      description: 'Pagamento energia',
      category: 'Utilidades',
    });
    expect(result).toBe('CPFL | Pagamento energia | Utilidades');
  });

  it('should skip null/undefined fields', () => {
    const result = buildRawLabel({
      counterparty: 'CPFL',
      description: null,
      category: 'Utilidades',
    });
    expect(result).toBe('CPFL | Utilidades');
  });

  it('should return empty string when all fields are empty', () => {
    const result = buildRawLabel({
      counterparty: null,
      description: undefined,
      category: null,
    });
    expect(result).toBe('');
  });
});
