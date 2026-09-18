import type {
  MonthRow,
  Payback,
  PlanMonth,
  PlanSummary,
  Results,
  Scenario,
  SteadyState,
  UnitCost,
} from './types';

const EPSILON = 1e-9;

/** Adoption fraction for a given 1-based month. */
export function adoptionForMonth(ramp: readonly number[], month: number): number {
  if (ramp.length === 0) return 1;
  const index = Math.min(month, ramp.length) - 1;
  return ramp[index] ?? 1;
}

/** Expand the stored ramp to one fraction per modelled month. */
export function expandRamp(ramp: readonly number[], horizonMonths: number): number[] {
  const out: number[] = [];
  for (let month = 1; month <= horizonMonths; month += 1) {
    out.push(adoptionForMonth(ramp, month));
  }
  return out;
}

/** Hours changed per month for a constant accepted workload at a given adoption. */
export function hoursFreedPerMonth(s: Scenario, adoption: number): number {
  const minutesPerCompletion = s.baselineMinutesPerCompletion - s.proposedMinutesPerCompletion;
  return (s.acceptedCompletionsPerMonth * minutesPerCompletion * adoption) / 60;
}

/**
 * Cost per accepted completion. Failed attempts and retries are already in the
 * total cost; the denominator is accepted output only. Zero accepted output
 * leaves the unit cost undefined rather than zero.
 */
export function costPerAcceptedCompletion(totalCost: number, accepted: number): number | undefined {
  if (!(accepted > 0)) return undefined;
  return totalCost / accepted;
}

export function costPerAttempt(totalCost: number, attempts: number): number | undefined {
  if (!(attempts > 0)) return undefined;
  return totalCost / attempts;
}

export function completionFraction(accepted: number, attempts: number): number | undefined {
  if (!(attempts > 0)) return undefined;
  return accepted / attempts;
}

interface LabourSplit {
  hoursFreed: number;
  cashChangingHours: number;
  retainedHours: number;
  cashRemoved: number;
}

function splitLabour(s: Scenario, adoption: number): LabourSplit {
  const hoursFreed = hoursFreedPerMonth(s, adoption);
  // The cash-sensitive share applies to added hours too: extra human work on a
  // billed arrangement costs money and is never clipped away.
  // A zero rate does not change a bill, even if a share was entered. Those
  // freed hours remain available rather than disappearing from both ledgers.
  const cashChangingHours = s.cashRatePerHour > 0 ? hoursFreed * s.cashSensitiveShare : 0;
  const retainedHours = hoursFreed > 0 ? hoursFreed - cashChangingHours : 0;
  const cashRemoved = cashChangingHours * s.cashRatePerHour;
  return { hoursFreed, cashChangingHours, retainedHours, cashRemoved };
}

function newCostsAt(s: Scenario, adoption: number): { variableCost: number; fixedCost: number; attemptsPerMonth: number } {
  const attemptsPerMonth = s.acceptedCompletionsPerMonth * s.attemptsPerCompletion * adoption;
  return {
    attemptsPerMonth,
    variableCost: attemptsPerMonth * s.variableCashPerAttempt,
    // Fixed subscription and maintenance are charged in full from month one.
    fixedCost: s.fixedCashPerMonth,
  };
}

function planForMonth(s: Scenario, month: number, retainedHours: number): PlanMonth | null {
  const plan = s.futurePlan;
  if (!plan.enabled) return null;
  if (month < plan.startMonth) {
    return {
      active: false,
      hoursRequired: 0,
      hoursCovered: 0,
      coverage: 0,
      avoidedExpense: 0,
      remainingHours: retainedHours,
    };
  }
  const hoursCovered = Math.min(Math.max(0, plan.hoursPerMonth), Math.max(0, retainedHours));
  // Validation rejects an enabled plan without positive required hours. Keep
  // direct callers from treating a zero-hour plan as free budget avoidance.
  const coverage = plan.hoursPerMonth > 0 ? hoursCovered / plan.hoursPerMonth : 0;
  const fullyCovered = coverage >= 1 - EPSILON;
  const avoidedExpense = plan.divisible
    ? plan.budgetPerMonth * Math.min(1, coverage)
    : fullyCovered
      ? plan.budgetPerMonth
      : 0;
  return {
    active: true,
    hoursRequired: plan.hoursPerMonth,
    hoursCovered,
    coverage: Math.min(1, coverage),
    avoidedExpense,
    remainingHours: retainedHours - hoursCovered,
  };
}

export function computePayback(setupCash: number, months: readonly MonthRow[], steadyNet: number): Payback {
  const last = months[months.length - 1];
  const cumulativeAtHorizon = last ? last.cumulativeCash : -setupCash;
  if (setupCash <= 0) {
    return {
      status: 'no_investment',
      ongoing: steadyNet > EPSILON ? 'positive' : steadyNet < -EPSILON ? 'negative' : 'zero',
    };
  }
  let previousCumulative = -setupCash;
  for (const row of months) {
    if (row.cumulativeCash >= -EPSILON) {
      const gap = -previousCumulative;
      const fraction = row.netCash > 0 ? Math.min(1, gap / row.netCash) : 1;
      return {
        status: 'paid_back',
        month: row.month,
        fractionalMonths: row.month - 1 + fraction,
      };
    }
    previousCumulative = row.cumulativeCash;
  }
  const reason =
    Math.abs(steadyNet) <= EPSILON
      ? 'zero_net'
      : steadyNet < 0
        ? 'negative_net'
        : 'insufficient_within_horizon';
  return { status: 'no_payback', reason, cumulativeAtHorizon };
}

/** Deterministic evaluation of a valid scenario. Never returns NaN or Infinity. */
export function compute(s: Scenario): Results {
  const steadyLabour = splitLabour(s, 1);
  const steadyCosts = newCostsAt(s, 1);
  const steadyNewCosts = steadyCosts.variableCost + steadyCosts.fixedCost;
  const steady: SteadyState = {
    baselineHours: (s.acceptedCompletionsPerMonth * s.baselineMinutesPerCompletion) / 60,
    proposedHours: (s.acceptedCompletionsPerMonth * s.proposedMinutesPerCompletion) / 60,
    ...steadyLabour,
    attemptsPerMonth: steadyCosts.attemptsPerMonth,
    variableCost: steadyCosts.variableCost,
    fixedCost: steadyCosts.fixedCost,
    newCosts: steadyNewCosts,
    netCash: steadyLabour.cashRemoved - steadyNewCosts,
    baselineOngoingCash: s.labourCashPerMonth,
    postOngoingCash: s.labourCashPerMonth - steadyLabour.cashRemoved + steadyNewCosts,
  };

  const months: MonthRow[] = [];
  let cumulative = -s.setupCash;
  const ramp = expandRamp(s.adoptionRamp, s.horizonMonths);
  for (let month = 1; month <= s.horizonMonths; month += 1) {
    const adoption = ramp[month - 1] ?? 1;
    const labour = splitLabour(s, adoption);
    const costs = newCostsAt(s, adoption);
    const newCosts = costs.variableCost + costs.fixedCost;
    const netCash = labour.cashRemoved - newCosts;
    cumulative += netCash;
    months.push({
      month,
      adoption,
      ...labour,
      variableCost: costs.variableCost,
      fixedCost: costs.fixedCost,
      newCosts,
      netCash,
      cumulativeCash: cumulative,
      plan: planForMonth(s, month, labour.retainedHours),
    });
  }

  const yearOneRows = months.slice(0, 12);
  const yearOneLast = yearOneRows[yearOneRows.length - 1];
  const horizonLast = months[months.length - 1];
  const cumulativeYearOne = yearOneLast ? yearOneLast.cumulativeCash : -s.setupCash;
  const cumulativeHorizon = horizonLast ? horizonLast.cumulativeCash : -s.setupCash;
  const sum = (rows: readonly MonthRow[], pick: (r: MonthRow) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);

  const accepted = s.acceptedCompletionsPerMonth;
  const before = costPerAcceptedCompletion(steady.baselineOngoingCash, accepted);
  const after = costPerAcceptedCompletion(steady.postOngoingCash, accepted);
  const unitCost: UnitCost = {
    before,
    after,
    setupPerCompletion: accepted > 0 ? s.setupCash / (accepted * s.horizonMonths) : undefined,
    changePercent:
      before !== undefined && after !== undefined && before > 0 ? ((after - before) / before) * 100 : undefined,
  };

  const steadyPlan = planForMonth(s, Math.max(s.futurePlan.startMonth, 1), steadyLabour.retainedHours);
  const activePlanRows = months.filter((r) => r.plan?.active);
  const avoidedYearOne = sum(yearOneRows, (r) => r.plan?.avoidedExpense ?? 0);
  const avoidedHorizon = sum(months, (r) => r.plan?.avoidedExpense ?? 0);
  const plan: PlanSummary = {
    enabled: s.futurePlan.enabled,
    divisible: s.futurePlan.divisible,
    startMonth: s.futurePlan.startMonth,
    hoursPerMonth: s.futurePlan.hoursPerMonth,
    budgetPerMonth: s.futurePlan.budgetPerMonth,
    retainedHoursAtFullAdoption: steadyLabour.retainedHours,
    hoursCoveredAtFullAdoption: steadyPlan?.hoursCovered ?? 0,
    remainingHoursAtFullAdoption: steadyPlan ? steadyPlan.remainingHours : steadyLabour.retainedHours,
    coverageAtFullAdoption: steadyPlan?.coverage ?? 0,
    monthsFullyCovered: activePlanRows.filter((r) => (r.plan?.coverage ?? 0) >= 1 - EPSILON).length,
    monthsActive: activePlanRows.length,
    avoidedExpenseYearOne: avoidedYearOne,
    avoidedExpenseHorizon: avoidedHorizon,
    netAgainstPlanYearOne: cumulativeYearOne + avoidedYearOne,
    netAgainstPlanHorizon: cumulativeHorizon + avoidedHorizon,
  };

  return {
    scenario: s,
    steady,
    months,
    setupCash: s.setupCash,
    cumulativeYearOne,
    cumulativeHorizon,
    hoursFreedYearOne: sum(yearOneRows, (r) => r.hoursFreed),
    hoursFreedHorizon: sum(months, (r) => r.hoursFreed),
    payback: computePayback(s.setupCash, months, steady.netCash),
    unitCost,
    plan,
    resource: {
      buildHours: s.retainedBuildHours,
      maintenanceHoursPerMonth: s.retainedMaintenanceHoursPerMonth,
      yearOneHours: s.retainedBuildHours + s.retainedMaintenanceHoursPerMonth * Math.min(12, s.horizonMonths),
    },
  };
}
