import type { Results, Scenario } from '../../src/model';

/** Contractor-style base scenario used to map fixture economics onto the schema. */
export function scenario(overrides: Partial<Scenario> = {}, plan: Partial<Scenario['futurePlan']> = {}): Scenario {
  return {
    schemaVersion: 1,
    name: 'Test',
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
    retainedBuildHours: 0,
    retainedMaintenanceHoursPerMonth: 0,
    ...overrides,
    futurePlan: {
      enabled: false,
      divisible: true,
      startMonth: 1,
      hoursPerMonth: 0,
      budgetPerMonth: 0,
      ...plan,
    },
  };
}

/** Fixture decimals are base-10 strings; null means undefined, never zero. */
export function dec(value: string | number | null | undefined): number {
  if (value === null || value === undefined) throw new Error('fixture value is null; caller must treat it as undefined');
  return Number(value);
}

/** Every numeric leaf of a result must be finite: NaN and Infinity are forbidden. */
export function collectNonFinite(value: unknown, path = 'results', out: string[] = []): string[] {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectNonFinite(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectNonFinite(v, `${path}.${k}`, out);
  }
  return out;
}

export function assertFinite(results: Results): void {
  const bad = collectNonFinite(results);
  if (bad.length > 0) throw new Error(`non-finite values at ${bad.join(', ')}`);
}
