/**
 * Scenario schema. Every quantity is per month unless the name says otherwise.
 * Money is in the scenario's display currency; time is in minutes or hours as
 * named. Shares and adoption fractions are stored as fractions (0..1) and
 * presented as percentages by the interface.
 */

export const SCENARIO_SCHEMA_VERSION = 1 as const;

export interface FuturePlan {
  /** When false the plan is ignored entirely and reported as "not modelled". */
  enabled: boolean;
  /** First month (1-based) in which the plan would otherwise incur spend. */
  startMonth: number;
  /** Hours of work per month the plan needs. */
  hoursPerMonth: number;
  /** Cash the plan would cost per month if nobody absorbed the work. */
  budgetPerMonth: number;
  /**
   * true: a partly covered plan avoids a proportional share of the budget.
   * false: the budget is avoided only in months where the hours are fully covered.
   */
  divisible: boolean;
}

export interface Scenario {
  schemaVersion: typeof SCENARIO_SCHEMA_VERSION;
  name: string;
  /** ISO 4217 code used for display only. */
  currency: string;
  /** Number of modelled months after month zero. */
  horizonMonths: number;

  acceptedCompletionsPerMonth: number;
  baselineMinutesPerCompletion: number;
  proposedMinutesPerCompletion: number;
  /** Billable attempts per accepted completion, including failures and retries. */
  attemptsPerCompletion: number;

  /** Current in-scope labour cash expense per month (the baseline). */
  labourCashPerMonth: number;
  /** Cash actually paid or stopped per changed hour. */
  cashRatePerHour: number;
  /** Fraction of changed hours that change the bill (0..1). */
  cashSensitiveShare: number;

  fixedCashPerMonth: number;
  variableCashPerAttempt: number;
  setupCash: number;

  /**
   * Adoption fraction for the first months. Months beyond the list use the last
   * value; an empty list means full adoption from month one.
   */
  adoptionRamp: number[];

  /** Salaried time committed to the change. Recorded in hours, never priced. */
  retainedBuildHours: number;
  retainedMaintenanceHoursPerMonth: number;

  futurePlan: FuturePlan;
}

export interface MonthRow {
  month: number;
  adoption: number;
  /** Positive: hours freed. Negative: extra human hours the new process needs. */
  hoursFreed: number;
  /** Changed hours that change the bill (sign follows hoursFreed). */
  cashChangingHours: number;
  /** Freed hours that stay in the business as capacity. Never negative. */
  retainedHours: number;
  /** Existing cash expense removed (negative when labour cash increases). */
  cashRemoved: number;
  variableCost: number;
  fixedCost: number;
  newCosts: number;
  netCash: number;
  cumulativeCash: number;
  plan: PlanMonth | null;
}

export interface PlanMonth {
  active: boolean;
  hoursRequired: number;
  hoursCovered: number;
  /** 0..1 share of the required hours covered by retained capacity. */
  coverage: number;
  avoidedExpense: number;
  remainingHours: number;
}

export type Payback =
  | { status: 'no_investment'; ongoing: 'positive' | 'zero' | 'negative' }
  | { status: 'paid_back'; month: number; fractionalMonths: number }
  | {
      status: 'no_payback';
      reason: 'zero_net' | 'negative_net' | 'insufficient_within_horizon';
      cumulativeAtHorizon: number;
    };

export interface UnitCost {
  /** undefined when accepted completions are zero. */
  before: number | undefined;
  after: number | undefined;
  setupPerCompletion: number | undefined;
  changePercent: number | undefined;
}

export interface SteadyState {
  /** Human hours per month at the current process for the accepted workload. */
  baselineHours: number;
  proposedHours: number;
  hoursFreed: number;
  cashChangingHours: number;
  retainedHours: number;
  cashRemoved: number;
  attemptsPerMonth: number;
  variableCost: number;
  fixedCost: number;
  newCosts: number;
  netCash: number;
  baselineOngoingCash: number;
  postOngoingCash: number;
}

export interface PlanSummary {
  enabled: boolean;
  divisible: boolean;
  startMonth: number;
  hoursPerMonth: number;
  budgetPerMonth: number;
  /** Retained hours available at full adoption before the plan takes any. */
  retainedHoursAtFullAdoption: number;
  hoursCoveredAtFullAdoption: number;
  remainingHoursAtFullAdoption: number;
  coverageAtFullAdoption: number;
  monthsFullyCovered: number;
  monthsActive: number;
  avoidedExpenseYearOne: number;
  avoidedExpenseHorizon: number;
  /** Current-cash cumulative plus avoided future expense: a conditional comparison. */
  netAgainstPlanYearOne: number;
  netAgainstPlanHorizon: number;
}

export interface Results {
  scenario: Scenario;
  steady: SteadyState;
  months: MonthRow[];
  setupCash: number;
  cumulativeYearOne: number;
  cumulativeHorizon: number;
  hoursFreedYearOne: number;
  hoursFreedHorizon: number;
  payback: Payback;
  unitCost: UnitCost;
  plan: PlanSummary;
  resource: { buildHours: number; maintenanceHoursPerMonth: number; yearOneHours: number };
}
