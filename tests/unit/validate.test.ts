import { describe, expect, it } from 'vitest';
import { PRESETS, parseDraft, relationshipErrors, toDraft, validateScenarioObject } from '../../src/model';
import { scenario } from './helpers';

describe('draft round trip', () => {
  it('converts every preset to a draft and back without change', () => {
    for (const preset of PRESETS) {
      const result = parseDraft(toDraft(preset.scenario));
      expect(result.ok, preset.id).toBe(true);
      if (result.ok) expect(result.scenario).toEqual(preset.scenario);
    }
  });

  it('presents shares and adoption as percentages', () => {
    const draft = toDraft(scenario({ cashSensitiveShare: 0.25, adoptionRamp: [0.25, 0.5, 1] }));
    expect(draft.numbers.cashSensitiveShare).toBe('25');
    expect(draft.adoptionRamp).toBe('25, 50, 100');
  });

  it('accepts thousands separators, percent signs and surrounding spaces', () => {
    const draft = toDraft(scenario());
    draft.numbers.labourCashPerMonth = ' 8,000 ';
    draft.adoptionRamp = '25% 50%, 100';
    const result = parseDraft(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.labourCashPerMonth).toBe(8000);
      expect(result.scenario.adoptionRamp).toEqual([0.25, 0.5, 1]);
    }
  });

  it.each(['1,5', '12,34', '1,,000', '1,000,', '1.234,56', ',100', '1000,000'])(
    'rejects ambiguous or malformed numeric grouping: %s',
    (text) => {
      const draft = toDraft(scenario());
      draft.numbers.variableCashPerAttempt = text;
      const result = parseDraft(draft);
      expect(result.ok).toBe(false);
      expect(result.errors.variableCashPerAttempt).toMatch(/decimal point/);
    },
  );

  it.each([
    ['1,000.50', 1000.5],
    [' 12,345,678.90 ', 12345678.9],
    ['1.5', 1.5],
  ])('preserves correctly grouped or ungrouped amounts: %s', (text, expected) => {
    const draft = toDraft(scenario());
    draft.numbers.variableCashPerAttempt = String(text);
    const result = parseDraft(draft);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scenario.variableCashPerAttempt).toBe(expected);
  });

  it('reports every problem at once and keeps the others', () => {
    const draft = toDraft(scenario());
    draft.numbers.acceptedCompletionsPerMonth = '';
    draft.numbers.horizonMonths = '12.5';
    draft.futurePlan.numbers.startMonth = '0';
    draft.currency = 'dollars';
    draft.name = 'x'.repeat(200);
    const result = parseDraft(draft);
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(
      ['acceptedCompletionsPerMonth', 'currency', 'futurePlan.startMonth', 'horizonMonths', 'name'].sort(),
    );
    expect(result.errors.horizonMonths).toMatch(/whole number/);
  });

  it('rejects a ramp longer than the horizon and a plan starting after it', () => {
    const draft = toDraft(scenario({ horizonMonths: 12, adoptionRamp: new Array(13).fill(1) }));
    const result = parseDraft(draft);
    expect(result.ok).toBe(false);
    expect(result.errors.adoptionRamp).toMatch(/13 months/);
    const errors = relationshipErrors(scenario({}, { enabled: true, startMonth: 13 }));
    expect(errors['futurePlan.startMonth']).toMatch(/within the 12-month horizon/);
    expect(relationshipErrors(scenario({}, { enabled: false, startMonth: 13 }))).toEqual({});
  });

  it('allows an empty ramp, which means full adoption from month one', () => {
    const draft = toDraft(scenario());
    draft.adoptionRamp = '';
    const result = parseDraft(draft);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scenario.adoptionRamp).toEqual([]);
  });

  it('normalises currency codes and trims names', () => {
    const draft = toDraft(scenario());
    draft.currency = ' eur ';
    draft.name = '  Quarterly review  ';
    const result = parseDraft(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.currency).toBe('EUR');
      expect(result.scenario.name).toBe('Quarterly review');
    }
  });
});

describe('untrusted object validation', () => {
  it('accepts a well-formed scenario', () => {
    expect(validateScenarioObject(scenario()).ok).toBe(true);
  });

  it('rejects wrong schema versions, non-objects and missing fields with named problems', () => {
    expect(validateScenarioObject(null).ok).toBe(false);
    expect(validateScenarioObject('scenario').ok).toBe(false);
    const wrongVersion = validateScenarioObject({ ...scenario(), schemaVersion: 2 });
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) expect(wrongVersion.problems[0]).toMatch(/schemaVersion must be 1/);
    const missing = validateScenarioObject({ schemaVersion: 1 });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.problems).toContain('acceptedCompletionsPerMonth must be a number; found nothing.');
      expect(missing.problems).toContain('futurePlan must be an object.');
    }
  });

  it('does not coerce numeric strings, booleans or nulls', () => {
    const bad = validateScenarioObject({ ...scenario(), setupCash: '7000', fixedCashPerMonth: null, attemptsPerCompletion: true });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.problems).toContain('setupCash must be a number; found text "7000".');
      expect(bad.problems).toContain('fixedCashPerMonth must be a number; found null.');
      expect(bad.problems).toContain('attemptsPerCompletion must be a number; found boolean.');
    }
  });

  it('rejects out-of-range values and bad plan flags', () => {
    const bad = validateScenarioObject({
      ...scenario(),
      cashSensitiveShare: 1.2,
      horizonMonths: 61,
      futurePlan: { enabled: 'yes', divisible: true, startMonth: 1.5, hoursPerMonth: -1, budgetPerMonth: 0 },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.problems.join('\n')).toMatch(/cashSensitiveShare: Must be at most 100/);
      expect(bad.problems.join('\n')).toMatch(/horizonMonths: Must be at most 60/);
      expect(bad.problems.join('\n')).toMatch(/futurePlan.enabled must be true or false/);
      expect(bad.problems.join('\n')).toMatch(/futurePlan.startMonth: Enter a whole number/);
      expect(bad.problems.join('\n')).toMatch(/futurePlan.hoursPerMonth: Cannot be negative/);
    }
  });

  it('keeps user text as text and bounds its length', () => {
    const html = validateScenarioObject({ ...scenario(), name: '<b>bold</b>' });
    expect(html.ok).toBe(true);
    if (html.ok) expect(html.scenario.name).toBe('<b>bold</b>');
    expect(validateScenarioObject({ ...scenario(), name: 'x'.repeat(121) }).ok).toBe(false);
  });

  it('ignores unknown extra keys', () => {
    const result = validateScenarioObject({ ...scenario(), extra: 'ignored' });
    expect(result.ok).toBe(true);
    if (result.ok) expect('extra' in result.scenario).toBe(false);
  });
});
