import type { Scenario } from './types';

export interface Preset {
  id: string;
  title: string;
  blurb: string;
  scenario: Scenario;
}

const planOff = { enabled: false, divisible: true, startMonth: 4, hoursPerMonth: 0, budgetPerMonth: 0 };

/**
 * Three fictional worked examples. They are synthetic assumptions, not
 * customer results, and every figure shown for them comes from the model.
 */
export const PRESETS: readonly Preset[] = [
  {
    id: 'fixed-payroll',
    title: 'Fixed payroll',
    blurb: 'An in-house salaried team. Hours come free, but payroll does not move, so the new tooling is pure added cost.',
    scenario: {
      schemaVersion: 1,
      name: 'Fixed payroll (fictional example)',
      currency: 'USD',
      horizonMonths: 12,
      acceptedCompletionsPerMonth: 1000,
      baselineMinutesPerCompletion: 12,
      proposedMinutesPerCompletion: 6,
      attemptsPerCompletion: 1,
      labourCashPerMonth: 10000,
      cashRatePerHour: 0,
      cashSensitiveShare: 0,
      fixedCashPerMonth: 300,
      variableCashPerAttempt: 0.2,
      setupCash: 1200,
      adoptionRamp: [],
      retainedBuildHours: 24,
      retainedMaintenanceHoursPerMonth: 4,
      futurePlan: planOff,
    },
  },
  {
    id: 'flexible-contractor',
    title: 'Flexible contractor',
    blurb: 'Hourly contractors bill for the time. Every freed hour comes off the invoice, so capacity turns into cash.',
    scenario: {
      schemaVersion: 1,
      name: 'Flexible contractor (fictional example)',
      currency: 'USD',
      horizonMonths: 12,
      acceptedCompletionsPerMonth: 1000,
      baselineMinutesPerCompletion: 12,
      proposedMinutesPerCompletion: 6,
      attemptsPerCompletion: 1,
      labourCashPerMonth: 8000,
      cashRatePerHour: 40,
      cashSensitiveShare: 1,
      fixedCashPerMonth: 300,
      variableCashPerAttempt: 0.2,
      setupCash: 7000,
      adoptionRamp: [],
      retainedBuildHours: 24,
      retainedMaintenanceHoursPerMonth: 4,
      futurePlan: planOff,
    },
  },
  {
    id: 'contractor-ramped',
    title: 'Contractor, ramped',
    blurb: 'The same contractor case reaching full volume over three months. The subscription starts on day one; the savings do not.',
    scenario: {
      schemaVersion: 1,
      name: 'Contractor, ramped (fictional example)',
      currency: 'USD',
      horizonMonths: 12,
      acceptedCompletionsPerMonth: 1000,
      baselineMinutesPerCompletion: 12,
      proposedMinutesPerCompletion: 6,
      attemptsPerCompletion: 1,
      labourCashPerMonth: 8000,
      cashRatePerHour: 40,
      cashSensitiveShare: 1,
      fixedCashPerMonth: 300,
      variableCashPerAttempt: 0.2,
      setupCash: 7000,
      adoptionRamp: [0.25, 0.5, 1],
      retainedBuildHours: 24,
      retainedMaintenanceHoursPerMonth: 4,
      futurePlan: planOff,
    },
  },
];

export const DEFAULT_PRESET_ID = 'flexible-contractor';

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
