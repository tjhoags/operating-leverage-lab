import { describe, expect, it } from 'vitest';
import fixtures from '../acceptance/economic-fixtures.json';
import {
  PRESETS,
  compute,
  completionFraction,
  costPerAcceptedCompletion,
  costPerAttempt,
  parseDraft,
  parseScenarioFile,
  presetById,
  toDraft,
  validateScenarioObject,
} from '../../src/model';
import { assertFinite, dec, scenario } from './helpers';

const MONEY = Number(fixtures.tolerances.money_absolute);
const HOURS = Number(fixtures.tolerances.hours_absolute);
const MONTHS = Number(fixtures.tolerances.fractional_months_absolute);

type AnyCase = Record<string, any>;
const caseById = (id: string): AnyCase => {
  const found = (fixtures.cases as AnyCase[]).find((c) => c.id === id);
  if (!found) throw new Error(`fixture ${id} missing`);
  return found;
};

const closeMoney = (actual: number, expected: string) => expect(actual).toBeCloseTo(dec(expected), Math.log10(1 / MONEY));
const closeHours = (actual: number, expected: string) => expect(Math.abs(actual - dec(expected))).toBeLessThanOrEqual(HOURS);
const closeMonths = (actual: number, expected: string) => expect(Math.abs(actual - dec(expected))).toBeLessThanOrEqual(MONTHS);

describe('fixture file', () => {
  it('is the synthetic acceptance set the tests map onto the schema', () => {
    expect(fixtures.fixture_format_version).toBe('1.0.0');
    expect(fixtures.synthetic).toBe(true);
    expect(fixtures.conventions.year_months).toBe(12);
    expect(fixtures.cases).toHaveLength(8);
  });
});

describe('case 1: fixed payroll frees capacity while increasing cash expense', () => {
  const c = caseById('fixed-payroll-capacity-only');
  const s = scenario({
    acceptedCompletionsPerMonth: c.inputs.accepted_completions_per_month,
    baselineMinutesPerCompletion: dec(c.inputs.baseline_human_minutes_per_completion),
    proposedMinutesPerCompletion: dec(c.inputs.post_change_human_minutes_per_completion),
    labourCashPerMonth: dec(c.inputs.baseline_fixed_payroll_per_month),
    // Payroll unchanged: no cash-reducing hours, so no cash rate applies.
    cashRatePerHour: 0,
    cashSensitiveShare: dec(c.inputs.cash_reducing_hours_per_month) / 100,
    variableCashPerAttempt: dec(c.inputs.incremental_variable_cost_per_completion),
    fixedCashPerMonth: dec(c.inputs.incremental_fixed_cost_per_month),
    setupCash: dec(c.inputs.setup_cost_at_month_zero),
    adoptionRamp: [dec(c.inputs.adoption_fraction)],
  });
  const r = compute(s);
  const e = c.expected;

  it('matches hours and cash ledger', () => {
    assertFinite(r);
    closeHours(r.steady.baselineHours, e.baseline_human_hours_per_month);
    closeHours(r.steady.proposedHours, e.post_change_human_hours_per_month);
    closeHours(r.steady.hoursFreed, e.hours_freed_per_month);
    closeMoney(r.steady.cashRemoved, e.gross_cash_expense_removed_per_month);
    closeMoney(r.steady.baselineOngoingCash, e.baseline_ongoing_cash_cost_per_month);
    closeMoney(r.steady.postOngoingCash, e.post_change_ongoing_cash_cost_per_month);
    closeMoney(r.unitCost.before!, e.baseline_cost_per_accepted_completion);
    closeMoney(r.unitCost.after!, e.post_change_cost_per_accepted_completion);
    closeMoney(r.steady.netCash, e.net_current_baseline_cash_benefit_per_month);
    closeMoney(r.cumulativeYearOne, e.year_one_cumulative_current_baseline_cash_benefit);
  });

  it('reports no payback rather than a month, zero, or infinity', () => {
    expect(e.payback_month).toBeNull();
    expect(r.payback.status).toBe('no_payback');
    if (r.payback.status === 'no_payback') expect(r.payback.reason).toBe('negative_net');
  });

  it('keeps an optional capacity valuation out of cash benefit and payback', () => {
    // The fixture's illustrative valuation (hours x rate) is a planning figure the
    // product deliberately does not compute; the cash ledger must not contain it.
    const illustrative = r.steady.hoursFreed * dec(c.inputs.optional_capacity_valuation_per_hour);
    closeMoney(illustrative, e.optional_capacity_value_per_month);
    expect(r.steady.netCash).toBeLessThan(0);
    expect(r.steady.retainedHours).toBe(100);
    expect(r.plan.enabled).toBe(false);
  });
});

describe('case 2: fully reducible contractor billing', () => {
  const c = caseById('fully-reducible-contractors');
  const s = scenario({
    labourCashPerMonth: dec(c.inputs.baseline_billed_hours_per_month) * dec(c.inputs.contractor_cash_cost_per_hour),
    cashRatePerHour: dec(c.inputs.contractor_cash_cost_per_hour),
    cashSensitiveShare: 1,
    variableCashPerAttempt: dec(c.inputs.incremental_variable_cost_per_completion),
    fixedCashPerMonth: dec(c.inputs.incremental_fixed_cost_per_month),
    setupCash: dec(c.inputs.setup_cost_at_month_zero),
  });
  const r = compute(s);
  const e = c.expected;

  it('matches the cash ledger and unit costs', () => {
    assertFinite(r);
    closeHours(r.steady.hoursFreed, e.hours_freed_per_month);
    closeHours(r.steady.cashChangingHours, e.cash_reducing_hours_per_month);
    closeMoney(r.steady.cashRemoved, e.gross_cash_expense_removed_per_month);
    closeMoney(r.steady.baselineOngoingCash, e.baseline_ongoing_cash_cost_per_month);
    closeMoney(r.steady.postOngoingCash, e.post_change_ongoing_cash_cost_per_month);
    closeMoney(r.unitCost.before!, e.baseline_cost_per_accepted_completion);
    closeMoney(r.unitCost.after!, e.post_change_cost_per_accepted_completion);
    closeMoney(r.steady.netCash, e.net_current_baseline_cash_benefit_per_month);
    closeMoney(r.cumulativeYearOne, e.year_one_cumulative_current_baseline_cash_benefit);
  });

  it('matches the cumulative path and whole plus fractional payback', () => {
    e.cumulative_current_baseline_cash_benefit_by_month.forEach((value: string, i: number) => {
      closeMoney(r.months[i]!.cumulativeCash, value);
    });
    expect(r.payback.status).toBe('paid_back');
    if (r.payback.status === 'paid_back') {
      expect(r.payback.month).toBe(e.payback_month);
      closeMonths(r.payback.fractionalMonths, e.fractional_payback_months);
    }
  });

  it('does not keep removed hours as retained capacity', () => {
    expect(r.steady.retainedHours).toBe(0);
    expect(r.plan.retainedHoursAtFullAdoption).toBe(0);
  });
});

describe('case 3: partial billing reduction', () => {
  const c = caseById('partial-billing-reduction');
  const billedReduction = dec(c.inputs.baseline_billed_hours_per_month) - dec(c.inputs.post_change_billed_hours_per_month);
  const s = scenario({
    labourCashPerMonth: dec(c.inputs.baseline_billed_hours_per_month) * dec(c.inputs.contractor_cash_cost_per_hour),
    cashRatePerHour: dec(c.inputs.contractor_cash_cost_per_hour),
    cashSensitiveShare: billedReduction / 100,
    variableCashPerAttempt: dec(c.inputs.incremental_variable_cost_per_completion),
    fixedCashPerMonth: dec(c.inputs.incremental_fixed_cost_per_month),
    setupCash: dec(c.inputs.setup_cost_at_month_zero),
  });
  const r = compute(s);
  const e = c.expected;

  it('separates freed hours, cash-reducing hours and retained capacity', () => {
    assertFinite(r);
    closeHours(r.steady.hoursFreed, e.hours_freed_per_month);
    closeHours(r.steady.cashChangingHours, e.cash_reducing_hours_per_month);
    closeHours(r.steady.retainedHours, e.additional_retained_capacity_hours_per_month);
    closeMoney(r.steady.cashRemoved, e.gross_cash_expense_removed_per_month);
    closeMoney(r.steady.baselineOngoingCash, e.baseline_ongoing_cash_cost_per_month);
    closeMoney(r.steady.postOngoingCash, e.post_change_ongoing_cash_cost_per_month);
    closeMoney(r.unitCost.after!, e.post_change_cost_per_accepted_completion);
    closeMoney(r.steady.netCash, e.net_current_baseline_cash_benefit_per_month);
    closeMoney(r.cumulativeYearOne, e.year_one_cumulative_current_baseline_cash_benefit);
    expect(r.payback.status).toBe('paid_back');
    if (r.payback.status === 'paid_back') {
      expect(r.payback.month).toBe(e.payback_month);
      closeMonths(r.payback.fractionalMonths, e.fractional_payback_months);
    }
  });
});

describe('case 4: adoption ramp', () => {
  const c = caseById('adoption-ramp');
  const s = scenario({
    labourCashPerMonth: dec(c.inputs.baseline_billed_hours_per_month) * dec(c.inputs.contractor_cash_cost_per_hour),
    cashRatePerHour: dec(c.inputs.contractor_cash_cost_per_hour),
    variableCashPerAttempt: dec(c.inputs.full_adoption_incremental_variable_cost_per_month) / c.inputs.accepted_completions_per_month,
    fixedCashPerMonth: dec(c.inputs.incremental_fixed_cost_per_month),
    setupCash: dec(c.inputs.setup_cost_at_month_zero),
    adoptionRamp: c.inputs.adoption_fractions_by_month.map(dec),
  });
  const r = compute(s);
  const e = c.expected;

  it('matches every expected monthly row, with fixed cost unprorated', () => {
    assertFinite(r);
    expect(c.inputs.fixed_subscription_prorated_by_adoption).toBe(false);
    for (const row of e.monthly_rows) {
      const actual = r.months[row.month - 1]!;
      closeHours(actual.hoursFreed, row.hours_freed);
      closeMoney(actual.cashRemoved, row.gross_cash_expense_removed);
      closeMoney(actual.variableCost, row.variable_cost);
      closeMoney(actual.fixedCost, row.fixed_cost);
      closeMoney(actual.netCash, row.net_cash_benefit);
      closeMoney(actual.cumulativeCash, row.cumulative_cash_benefit);
    }
  });

  it('pays back in month four, not month two, with the stated fraction', () => {
    expect(r.payback.status).toBe('paid_back');
    if (r.payback.status === 'paid_back') {
      expect(r.payback.month).toBe(e.payback_month);
      closeMonths(r.payback.fractionalMonths, e.fractional_payback_months);
      expect(r.payback.fractionalMonths).toBeCloseTo(3 + 1250 / 3500, 9);
    }
    closeMoney(r.cumulativeYearOne, e.year_one_cumulative_current_baseline_cash_benefit);
    closeHours(r.hoursFreedYearOne, e.year_one_hours_freed);
  });
});

describe('case 5: hypothetical future hiring plan', () => {
  const c = caseById('hypothetical-future-hiring');
  const plan = c.inputs.hiring_plan;
  const s = scenario(
    {
      labourCashPerMonth: dec(c.inputs.baseline_fixed_payroll_per_month),
      cashRatePerHour: 0,
      cashSensitiveShare: 0,
      variableCashPerAttempt: dec(c.inputs.incremental_variable_cost_per_completion),
      fixedCashPerMonth: dec(c.inputs.incremental_fixed_cost_per_month),
      setupCash: dec(c.inputs.setup_cost_at_month_zero),
    },
    {
      enabled: true,
      divisible: false,
      startMonth: plan.starting_month,
      hoursPerMonth: dec(plan.freed_capacity_allocated_to_plan_hours_per_month),
      budgetPerMonth: dec(plan.planned_contractor_hours_per_month) * dec(plan.planned_contractor_cost_per_hour),
    },
  );
  const r = compute(s);
  const e = c.expected;

  it('leaves the current-cash ledger unchanged by the plan', () => {
    assertFinite(r);
    const ledger = e.current_baseline_ledger;
    closeHours(r.steady.hoursFreed, ledger.hours_freed_per_month);
    closeMoney(r.steady.cashRemoved, ledger.gross_cash_expense_removed_per_month);
    closeMoney(r.steady.netCash, ledger.net_cash_benefit_per_month);
    closeMoney(r.cumulativeYearOne, ledger.year_one_cumulative_cash_benefit);
    expect(ledger.payback_month).toBeNull();
    expect(r.payback.status).toBe('no_payback');
    closeMoney(r.unitCost.before!, e.baseline_cost_per_accepted_completion);
    closeMoney(r.unitCost.after!, e.post_change_current_workload_cost_per_accepted_completion);
  });

  it('allocates retained hours only from the start month and reports coverage', () => {
    const comparison = e.hypothetical_hiring_plan_comparison;
    comparison.avoided_future_expense_by_month.forEach((value: string, i: number) => {
      closeMoney(r.months[i]!.plan!.avoidedExpense, value);
    });
    closeMoney(r.plan.avoidedExpenseYearOne, comparison.year_one_potential_avoided_future_expense);
    closeMoney(r.plan.netAgainstPlanYearOne, comparison.year_one_net_benefit_against_stated_hiring_plan);
    closeHours(r.plan.hoursCoveredAtFullAdoption, comparison.capacity_allocated_to_future_plan_hours_per_month);
    closeHours(r.plan.remainingHoursAtFullAdoption, comparison.remaining_unallocated_capacity_hours_per_month);
    expect(comparison.realized_savings_claim_permitted).toBe(false);
    // Months 1-3 retain all 100 hours; months 4-12 leave 20.
    for (const row of r.months.slice(0, 3)) {
      expect(row.plan!.active).toBe(false);
      expect(row.plan!.hoursCovered).toBe(0);
      closeHours(row.plan!.remainingHours, '100.00');
    }
    for (const row of r.months.slice(3)) {
      expect(row.plan!.active).toBe(true);
      closeHours(row.plan!.hoursCovered, '80.00');
      closeHours(row.plan!.remainingHours, '20.00');
    }
  });

  it('gives a contractor case with all hours monetised no capacity for the plan', () => {
    const contractor = compute(scenario({ cashSensitiveShare: 1 }, { ...s.futurePlan }));
    expect(contractor.plan.retainedHoursAtFullAdoption).toBe(0);
    expect(contractor.plan.avoidedExpenseYearOne).toBe(0);
    for (const row of contractor.months) expect(row.plan!.avoidedExpense).toBe(0);
  });

  it('treats a divisible plan proportionally and an indivisible one as all-or-nothing', () => {
    const shortPlan = { ...s.futurePlan, hoursPerMonth: 160, budgetPerMonth: 6400 };
    const divisible = compute(scenario({ ...s, futurePlan: undefined as never }, { ...shortPlan, divisible: true }));
    const indivisible = compute(scenario({ ...s, futurePlan: undefined as never }, { ...shortPlan, divisible: false }));
    // 100 retained hours against 160 required: 62.5% coverage.
    expect(divisible.plan.coverageAtFullAdoption).toBeCloseTo(0.625, 9);
    expect(divisible.months[3]!.plan!.avoidedExpense).toBeCloseTo(4000, 9);
    expect(indivisible.months[3]!.plan!.avoidedExpense).toBe(0);
    expect(indivisible.plan.monthsFullyCovered).toBe(0);
    expect(divisible.plan.remainingHoursAtFullAdoption).toBe(0);
  });
});

describe('case 6: zero and negative returns', () => {
  const c = caseById('no-payback');
  const variants: AnyCase[] = c.variants;

  it('zero monthly benefit never pays back and stays at minus setup', () => {
    const v = variants.find((x) => x.id === 'zero-monthly-benefit')!;
    const s = scenario({
      proposedMinutesPerCompletion: dec(v.inputs.post_change_human_minutes_per_completion),
      labourCashPerMonth: 200 * dec(v.inputs.contractor_cash_cost_per_hour),
      cashRatePerHour: dec(v.inputs.contractor_cash_cost_per_hour),
      fixedCashPerMonth: dec(v.inputs.incremental_total_recurring_cost_per_month),
      variableCashPerAttempt: 0,
      setupCash: dec(v.inputs.setup_cost_at_month_zero),
    });
    const r = compute(s);
    assertFinite(r);
    const e = v.expected;
    closeHours(r.steady.baselineHours, e.baseline_human_hours_per_month);
    closeHours(r.steady.proposedHours, e.post_change_human_hours_per_month);
    closeHours(r.steady.hoursFreed, e.hours_freed_per_month);
    closeMoney(r.steady.cashRemoved, e.gross_cash_expense_removed_per_month);
    closeMoney(r.steady.postOngoingCash, e.post_change_ongoing_cash_cost_per_month);
    closeMoney(r.unitCost.after!, e.post_change_cost_per_accepted_completion);
    closeMoney(r.steady.netCash, e.net_cash_benefit_per_month);
    closeMoney(r.cumulativeYearOne, e.year_one_cumulative_cash_benefit);
    for (const row of r.months) closeMoney(row.cumulativeCash, e.cumulative_balance_at_every_modeled_month);
    expect(e.payback_month).toBeNull();
    expect(r.payback).toEqual({ status: 'no_payback', reason: 'zero_net', cumulativeAtHorizon: -1000 });
  });

  it('additional human work is a cost, not clipped away', () => {
    const v = variants.find((x) => x.id === 'additional-human-work')!;
    const s = scenario({
      proposedMinutesPerCompletion: dec(v.inputs.post_change_human_minutes_per_completion),
      labourCashPerMonth: 200 * dec(v.inputs.contractor_cash_cost_per_hour),
      cashRatePerHour: dec(v.inputs.contractor_cash_cost_per_hour),
      cashSensitiveShare: 1,
      fixedCashPerMonth: dec(v.inputs.incremental_total_recurring_cost_per_month),
      variableCashPerAttempt: 0,
      setupCash: dec(v.inputs.setup_cost_at_month_zero),
    });
    const r = compute(s);
    assertFinite(r);
    const e = v.expected;
    closeHours(r.steady.proposedHours, e.post_change_human_hours_per_month);
    closeHours(r.steady.hoursFreed, e.hours_freed_per_month);
    closeHours(-r.steady.hoursFreed, e.additional_hours_per_month);
    expect(r.steady.retainedHours).toBe(0);
    closeMoney(r.steady.postOngoingCash, e.post_change_ongoing_cash_cost_per_month);
    closeMoney(r.unitCost.after!, e.post_change_cost_per_accepted_completion);
    closeMoney(r.steady.netCash, e.net_cash_benefit_per_month);
    closeMoney(r.cumulativeYearOne, e.year_one_cumulative_cash_benefit);
    expect(r.payback.status).toBe('no_payback');
    if (r.payback.status === 'no_payback') expect(r.payback.reason).toBe('negative_net');
  });
});

describe('case 7: accepted completions are the denominator', () => {
  const c = caseById('accepted-completions-denominator');
  const i = c.inputs;
  const e = c.expected;

  it('computes unit cost on accepted output with failures already included once', () => {
    expect(completionFraction(i.post_change_accepted_completions_per_month, i.post_change_attempts_per_month)).toBeCloseTo(dec(e.completion_fraction), 9);
    const before = costPerAcceptedCompletion(dec(i.baseline_total_ongoing_cash_cost_per_month), i.baseline_accepted_completions_per_month)!;
    const after = costPerAcceptedCompletion(dec(i.post_change_total_ongoing_cash_cost_per_month), i.post_change_accepted_completions_per_month)!;
    closeMoney(before, e.baseline_cost_per_accepted_completion);
    closeMoney(after, e.post_change_cost_per_accepted_completion);
    expect(((after - before) / before) * 100).toBeCloseTo(dec(e.cost_per_completed_task_increase_percent), 9);
    closeMoney(costPerAttempt(dec(i.post_change_total_ongoing_cash_cost_per_month), i.post_change_attempts_per_month)!, e.post_change_cost_per_attempt);
    closeMoney(dec(i.baseline_total_ongoing_cash_cost_per_month) - dec(i.post_change_total_ongoing_cash_cost_per_month), e.net_cash_benefit_per_month);
    expect(i.human_hours).toBeNull();
    expect(e.hours_freed).toBeNull();
  });

  it('charges the per-attempt price on every attempt in the main model', () => {
    const r = compute(scenario({ acceptedCompletionsPerMonth: 800, attemptsPerCompletion: 1.25, variableCashPerAttempt: 1 }));
    expect(r.steady.attemptsPerMonth).toBeCloseTo(1000, 9);
    expect(r.steady.variableCost).toBeCloseTo(1000, 9);
    // Unit cost is per accepted completion: 1000 of variable cost over 800 accepted.
    const variablePerAccepted = r.steady.variableCost / 800;
    expect(variablePerAccepted).toBeCloseTo(1.25, 9);
  });
});

describe('case 8: sensitivity grid', () => {
  const c = caseById('sensitivity-grid');
  const shared = c.shared_inputs;
  const rows: AnyCase[] = c.expected_rows;
  const run = (minutes: number, variable: number) =>
    compute(
      scenario({
        proposedMinutesPerCompletion: minutes,
        labourCashPerMonth: 200 * dec(shared.contractor_cash_cost_per_hour),
        cashRatePerHour: dec(shared.contractor_cash_cost_per_hour),
        variableCashPerAttempt: variable,
        fixedCashPerMonth: dec(shared.incremental_fixed_cost_per_month),
        setupCash: dec(shared.setup_cost_at_month_zero),
      }),
    );

  it('recalculates every grid cell consistently', () => {
    for (const row of rows) {
      const r = run(dec(row.post_change_human_minutes_per_completion), dec(row.incremental_variable_cost_per_completion));
      assertFinite(r);
      closeHours(r.steady.hoursFreed, row.hours_freed_per_month);
      closeMoney(r.steady.netCash, row.net_cash_benefit_per_month);
      expect(r.payback.status).toBe('paid_back');
      if (r.payback.status === 'paid_back') closeMonths(r.payback.fractionalMonths, row.fractional_payback_months);
    }
  });

  it('is monotone: more residual effort or a higher variable price never improves benefit', () => {
    for (const minutes of [6, 9]) {
      const nets = [0.2, 0.4, 0.8].map((v) => run(minutes, v).steady.netCash);
      expect(nets[0]).toBeGreaterThan(nets[1]!);
      expect(nets[1]).toBeGreaterThan(nets[2]!);
    }
    for (const variable of [0.2, 0.4, 0.8]) {
      expect(run(6, variable).steady.netCash).toBeGreaterThan(run(9, variable).steady.netCash);
    }
  });

  it('agrees with the flexible contractor preset at the selected cell', () => {
    const preset = compute(presetById('flexible-contractor')!.scenario);
    const cell = run(6, 0.2);
    expect(cell.steady.netCash).toBe(preset.steady.netCash);
    expect(cell.payback).toEqual(preset.payback);
  });
});

describe('boundary requirements', () => {
  const boundaries = fixtures.boundary_requirements as AnyCase[];
  const boundary = (condition: string) => {
    const found = boundaries.find((b) => b.condition === condition);
    if (!found) throw new Error(`boundary ${condition} missing`);
    return found;
  };

  it('zero accepted completions leaves unit cost undefined without crashing', () => {
    boundary('zero_accepted_completions');
    const r = compute(scenario({ acceptedCompletionsPerMonth: 0 }));
    assertFinite(r);
    expect(r.unitCost.before).toBeUndefined();
    expect(r.unitCost.after).toBeUndefined();
    expect(r.unitCost.setupPerCompletion).toBeUndefined();
    expect(r.steady.hoursFreed).toBe(0);
    expect(r.steady.netCash).toBe(-300);
  });

  it('a missing required number is a validation error, not silent zero', () => {
    boundary('missing_required_number');
    const draft = toDraft(scenario());
    draft.numbers.setupCash = '';
    const result = parseDraft(draft);
    expect(result.ok).toBe(false);
    expect(result.errors.setupCash).toMatch(/Blank is not treated as zero/);
  });

  it('non-finite or negative volume or rate is rejected', () => {
    boundary('non_finite_or_negative_volume_or_rate');
    for (const [key, text] of [
      ['acceptedCompletionsPerMonth', '-5'],
      ['acceptedCompletionsPerMonth', 'Infinity'],
      ['acceptedCompletionsPerMonth', 'NaN'],
      ['acceptedCompletionsPerMonth', '1e400'],
      ['cashRatePerHour', '-40'],
      ['cashRatePerHour', 'forty'],
    ] as const) {
      const draft = toDraft(scenario());
      draft.numbers[key] = text;
      const result = parseDraft(draft);
      expect(result.ok, `${key}=${text}`).toBe(false);
      expect(result.errors[key], `${key}=${text}`).toBeTruthy();
    }
    const imported = validateScenarioObject({ ...scenario(), acceptedCompletionsPerMonth: -1 });
    expect(imported.ok).toBe(false);
  });

  it('adoption outside zero to one is rejected in drafts and imports', () => {
    boundary('adoption_fraction_outside_zero_to_one');
    const draft = toDraft(scenario());
    draft.adoptionRamp = '25, 150';
    expect(parseDraft(draft).ok).toBe(false);
    draft.adoptionRamp = '25, -5';
    expect(parseDraft(draft).ok).toBe(false);
    expect(validateScenarioObject({ ...scenario(), adoptionRamp: [1.5] }).ok).toBe(false);
    expect(validateScenarioObject({ ...scenario(), adoptionRamp: [-0.1] }).ok).toBe(false);
    expect(validateScenarioObject({ ...scenario(), adoptionRamp: [0, 0.5, 1] }).ok).toBe(true);
  });

  it('accepted completions cannot exceed attempts', () => {
    boundary('accepted_completions_exceed_attempts');
    const draft = toDraft(scenario());
    draft.numbers.attemptsPerCompletion = '0.8';
    const result = parseDraft(draft);
    expect(result.ok).toBe(false);
    expect(result.errors.attemptsPerCompletion).toMatch(/at least 1/);
    expect(validateScenarioObject({ ...scenario(), attemptsPerCompletion: 0.99 }).ok).toBe(false);
  });

  it('cash-reducing hours cannot exceed positive freed hours and cash removed cannot exceed labour cash', () => {
    boundary('cash_reducing_hours_exceed_corresponding_positive_freed_hours');
    const draft = toDraft(scenario());
    draft.numbers.cashSensitiveShare = '120';
    const share = parseDraft(draft);
    expect(share.ok).toBe(false);
    expect(share.errors.cashSensitiveShare).toMatch(/at most 100/);
    // 100 freed hours at 100/h would remove 10,000 from an 8,000 bill.
    const tooMuch = parseDraft(toDraft(scenario({ cashRatePerHour: 100 })));
    expect(tooMuch.ok).toBe(false);
    expect(tooMuch.errors.cashRatePerHour).toMatch(/more than the 8,000/);
    const imported = validateScenarioObject(scenario({ cashRatePerHour: 100 }));
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.problems.join(' ')).toMatch(/cashRatePerHour/);
    // Exactly the labour cash is allowed.
    expect(parseDraft(toDraft(scenario({ cashRatePerHour: 80 }))).ok).toBe(true);
  });

  it('zero setup means no initial investment, and ongoing profitability is stated separately', () => {
    boundary('zero_setup_cost');
    const profitable = compute(scenario({ setupCash: 0 }));
    expect(profitable.payback).toEqual({ status: 'no_investment', ongoing: 'positive' });
    const losing = compute(presetById('fixed-payroll')!.scenario && scenario({ setupCash: 0, cashSensitiveShare: 0, cashRatePerHour: 0 }));
    expect(losing.payback).toEqual({ status: 'no_investment', ongoing: 'negative' });
    const flat = compute(scenario({ setupCash: 0, proposedMinutesPerCompletion: 11.25, fixedCashPerMonth: 500, variableCashPerAttempt: 0 }));
    expect(flat.payback).toEqual({ status: 'no_investment', ongoing: 'zero' });
    expect(profitable.months[0]!.cumulativeCash).toBeCloseTo(3500, 9);
  });

  it('percentage of assets is plain arithmetic and not a product feature', () => {
    const b = boundary('percentage_of_assets');
    expect((dec(b.inputs.assets) * dec(b.inputs.percentage)) / 100).toBeCloseTo(dec(b.expected_amount), 6);
  });

  it('invalid import is rejected before anything replaces the valid scenario', () => {
    boundary('invalid_import');
    const bad = parseScenarioFile(JSON.stringify({ format: 'operating-leverage-lab-scenario', version: 1, scenario: { ...scenario(), setupCash: 'seven thousand' } }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems[0]).toMatch(/setupCash must be a number/);
  });

  it('the fixture boundary list contains only conditions covered above', () => {
    expect(boundaries.map((b) => b.condition).sort()).toEqual(
      [
        'accepted_completions_exceed_attempts',
        'adoption_fraction_outside_zero_to_one',
        'cash_reducing_hours_exceed_corresponding_positive_freed_hours',
        'invalid_import',
        'missing_required_number',
        'non_finite_or_negative_volume_or_rate',
        'percentage_of_assets',
        'zero_accepted_completions',
        'zero_setup_cost',
      ].sort(),
    );
  });
});

describe('presets match the brief', () => {
  it('fixed payroll: -500 per month, -7,200 year one, 100 hours freed, no payback', () => {
    const r = compute(presetById('fixed-payroll')!.scenario);
    expect(r.steady.netCash).toBeCloseTo(-500, 9);
    expect(r.cumulativeYearOne).toBeCloseTo(-7200, 9);
    expect(r.steady.hoursFreed).toBeCloseTo(100, 9);
    expect(r.payback.status).toBe('no_payback');
  });
  it('flexible contractor: +3,500 per month, 7,000 setup, payback month two', () => {
    const r = compute(presetById('flexible-contractor')!.scenario);
    expect(r.steady.netCash).toBeCloseTo(3500, 9);
    expect(r.setupCash).toBe(7000);
    expect(r.payback).toEqual({ status: 'paid_back', month: 2, fractionalMonths: 2 });
    expect(r.cumulativeYearOne).toBeCloseTo(35000, 9);
  });
  it('contractor ramp: payback month four and +30,250 year one', () => {
    const r = compute(presetById('contractor-ramped')!.scenario);
    expect(r.payback.status).toBe('paid_back');
    if (r.payback.status === 'paid_back') expect(r.payback.month).toBe(4);
    expect(r.cumulativeYearOne).toBeCloseTo(30250, 9);
  });
  it('every preset is valid under the same rules as an import', () => {
    for (const preset of PRESETS) {
      const validated = validateScenarioObject(preset.scenario);
      expect(validated.ok, preset.id).toBe(true);
      expect(preset.scenario.name).toMatch(/fictional/);
    }
  });
});
