import { describe, expect, it } from 'vitest';
import {
  compute,
  parseDraft,
  parseScenarioFile,
  serializeScenario,
  toDraft,
  validateScenarioObject,
} from '../../src/model';
import { assertFinite, scenario } from './helpers';

describe('future-plan required hours', () => {
  it.each([true, false])('rejects a zero-hour enabled plan in form and import (divisible=%s)', (divisible) => {
    const input = scenario({}, { enabled: true, startMonth: 4, hoursPerMonth: 0, budgetPerMonth: 3200, divisible });
    const draft = parseDraft(toDraft(input));
    expect(draft.ok).toBe(false);
    expect(draft.errors['futurePlan.hoursPerMonth']).toMatch(/positive required hours/);
    const imported = parseScenarioFile(serializeScenario(input, null));
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.problems.join(' ')).toMatch(/positive required hours/);
  });

  it.each([0, -1])('does not award free budget when a direct caller bypasses validation with %s hours', (hoursPerMonth) => {
    for (const divisible of [true, false]) {
      const r = compute(scenario({}, { enabled: true, startMonth: 4, hoursPerMonth, budgetPerMonth: 3200, divisible }));
      assertFinite(r);
      expect(r.steady.retainedHours).toBe(0);
      expect(r.plan.avoidedExpenseYearOne).toBe(0);
      expect(r.plan.monthsFullyCovered).toBe(0);
      for (const row of r.months) {
        expect(row.plan!.hoursCovered).toBe(0);
        expect(row.plan!.coverage).toBe(0);
        expect(row.plan!.avoidedExpense).toBe(0);
      }
    }
  });

  it('keeps a disabled zero-hour plan valid and unmodeled', () => {
    const input = scenario({}, { enabled: false, hoursPerMonth: 0, budgetPerMonth: 0 });
    expect(validateScenarioObject(input).ok).toBe(true);
    expect(parseDraft(toDraft(input)).ok).toBe(true);
    expect(compute(input).months.every((row) => row.plan === null)).toBe(true);
  });
});

describe('zero-rate hours remain capacity', () => {
  it('retains freed hours when an entered share has no cash rate and allocates them only from the plan start', () => {
    const input = scenario(
      { cashRatePerHour: 0, cashSensitiveShare: 1, adoptionRamp: [0.25, 0.5, 1] },
      { enabled: true, startMonth: 4, hoursPerMonth: 80, budgetPerMonth: 3200, divisible: false },
    );
    expect(validateScenarioObject(input).ok).toBe(true);
    const r = compute(input);
    expect(r.steady.cashChangingHours).toBe(0);
    expect(r.steady.cashRemoved).toBe(0);
    expect(r.steady.retainedHours).toBe(100);
    expect(r.months.slice(0, 3).map((row) => row.retainedHours)).toEqual([25, 50, 100]);
    expect(r.months.slice(0, 3).every((row) => row.plan!.hoursCovered === 0)).toBe(true);
    expect(r.plan.avoidedExpenseYearOne).toBe(28800);
    expect(r.months[3]!.plan!.remainingHours).toBe(20);
    // Future avoidance never turns the losing current-cash ledger profitable.
    expect(r.steady.netCash).toBe(-500);
  });

  it('does not invent retained capacity when unchanged payroll needs more work', () => {
    const r = compute(scenario({ cashRatePerHour: 0, cashSensitiveShare: 1, proposedMinutesPerCompletion: 15 }));
    expect(r.steady.hoursFreed).toBe(-50);
    expect(r.steady.cashChangingHours).toBe(0);
    expect(r.steady.cashRemoved).toBe(0);
    expect(r.steady.retainedHours).toBe(0);
    expect(r.steady.netCash).toBe(-500);
  });
});

describe('imported assumptions retain numeric precision through the editable form', () => {
  it('preserves cents and long decimal assumptions instead of rounding to twelve significant digits', () => {
    const input = scenario({
      labourCashPerMonth: 123456789012.34,
      setupCash: 987654321098.76,
      variableCashPerAttempt: 0.123456789012345,
      cashRatePerHour: 0,
      cashSensitiveShare: 0,
    });
    const imported = parseScenarioFile(serializeScenario(input, null));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.problems.join(' '));
    const draft = toDraft(imported.scenario);
    expect(draft.numbers.labourCashPerMonth).toBe('123456789012.34');
    const parsed = parseDraft(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.scenario).toEqual(input);
    expect(compute(parsed.scenario)).toEqual(compute(input));
  });

  it('can reparse scientific notation produced from a small valid adoption fraction', () => {
    const input = scenario({ adoptionRamp: [1e-10, 1] });
    expect(validateScenarioObject(input).ok).toBe(true);
    const parsed = parseDraft(toDraft(input));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.scenario).toEqual(input);
  });
});
