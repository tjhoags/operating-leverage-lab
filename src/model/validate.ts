import { hoursFreedPerMonth } from './compute';
import { SCENARIO_SCHEMA_VERSION, type FuturePlan, type Scenario } from './types';

export type NumericKey =
  | 'horizonMonths'
  | 'acceptedCompletionsPerMonth'
  | 'baselineMinutesPerCompletion'
  | 'proposedMinutesPerCompletion'
  | 'attemptsPerCompletion'
  | 'labourCashPerMonth'
  | 'cashRatePerHour'
  | 'cashSensitiveShare'
  | 'fixedCashPerMonth'
  | 'variableCashPerAttempt'
  | 'setupCash'
  | 'retainedBuildHours'
  | 'retainedMaintenanceHoursPerMonth';

export type PlanNumericKey = 'startMonth' | 'hoursPerMonth' | 'budgetPerMonth';

export type FieldPath =
  | NumericKey
  | `futurePlan.${PlanNumericKey}`
  | 'adoptionRamp'
  | 'name'
  | 'currency';

export type FieldErrors = Partial<Record<FieldPath, string>>;

export interface NumericSpec {
  label: string;
  min: number;
  max: number;
  integer?: boolean;
  /** Display unit is percent; the stored value is a fraction. */
  percent?: boolean;
}

export const NUMERIC_SPECS: Record<NumericKey, NumericSpec> = {
  horizonMonths: { label: 'Horizon', min: 12, max: 60, integer: true },
  acceptedCompletionsPerMonth: { label: 'Accepted completions', min: 0, max: 1e9 },
  baselineMinutesPerCompletion: { label: 'Human minutes per task, baseline', min: 0, max: 100_000 },
  proposedMinutesPerCompletion: { label: 'Human minutes per task, after', min: 0, max: 100_000 },
  attemptsPerCompletion: { label: 'Attempts per accepted completion', min: 1, max: 1000 },
  labourCashPerMonth: { label: 'Current labour cash expense', min: 0, max: 1e12 },
  cashRatePerHour: { label: 'Cash rate per changed hour', min: 0, max: 1e6 },
  cashSensitiveShare: { label: 'Cash-sensitive share of changed hours', min: 0, max: 1, percent: true },
  fixedCashPerMonth: { label: 'Fixed incremental cash cost', min: 0, max: 1e12 },
  variableCashPerAttempt: { label: 'Variable cash cost per attempt', min: 0, max: 1e9 },
  setupCash: { label: 'One-time setup cash', min: 0, max: 1e12 },
  retainedBuildHours: { label: 'Build time on retained salaries', min: 0, max: 1e6 },
  retainedMaintenanceHoursPerMonth: { label: 'Maintenance time on retained salaries', min: 0, max: 1e6 },
};

export const PLAN_SPECS: Record<PlanNumericKey, NumericSpec> = {
  startMonth: { label: 'Plan start month', min: 1, max: 60, integer: true },
  hoursPerMonth: { label: 'Hours the plan needs', min: 0, max: 1e6 },
  budgetPerMonth: { label: 'Monthly budget the plan would cost', min: 0, max: 1e12 },
};

export const NUMERIC_KEYS = Object.keys(NUMERIC_SPECS) as NumericKey[];
export const PLAN_KEYS = Object.keys(PLAN_SPECS) as PlanNumericKey[];

export const MAX_NAME_LENGTH = 120;
export const MAX_RAMP_MONTHS = 60;

/** Editable text form of a scenario. Blank strings stay blank until parsed. */
export interface ScenarioDraft {
  name: string;
  currency: string;
  numbers: Record<NumericKey, string>;
  /** Comma separated adoption percentages for the first months, e.g. "25, 50, 100". */
  adoptionRamp: string;
  futurePlan: {
    enabled: boolean;
    divisible: boolean;
    numbers: Record<PlanNumericKey, string>;
  };
}

// Editable assumptions must preserve the stored number, not display-rounded
// significant digits. Number's string form can be parsed back without loss.
const formatPlain = (n: number): string => String(n);

export function toDraft(s: Scenario): ScenarioDraft {
  const numbers = {} as Record<NumericKey, string>;
  for (const key of NUMERIC_KEYS) {
    const spec = NUMERIC_SPECS[key];
    const raw = s[key];
    numbers[key] = formatPlain(spec.percent ? raw * 100 : raw);
  }
  const planNumbers = {} as Record<PlanNumericKey, string>;
  for (const key of PLAN_KEYS) planNumbers[key] = formatPlain(s.futurePlan[key]);
  return {
    name: s.name,
    currency: s.currency,
    numbers,
    adoptionRamp: s.adoptionRamp.map((f) => formatPlain(f * 100)).join(', '),
    futurePlan: {
      enabled: s.futurePlan.enabled,
      divisible: s.futurePlan.divisible,
      numbers: planNumbers,
    },
  };
}

type NumberParse = { ok: true; value: number } | { ok: false; error: string };

function parseNumberText(text: string, spec: NumericSpec): NumberParse {
  const input = text.trim();
  if (input.includes(',') && !/^[-+]?\d{1,3}(,\d{3})+(\.\d*)?([eE][-+]?\d+)?$/.test(input)) {
    return { ok: false, error: 'Use commas only for thousands, such as 1,000.50. Use a decimal point, such as 1.5.' };
  }
  const trimmed = input.replace(/,/g, '');
  if (trimmed === '') return { ok: false, error: 'Enter a number. Blank is not treated as zero.' };
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) {
    return { ok: false, error: 'Enter a plain number such as 1200 or 0.25.' };
  }
  const value = Number(trimmed);
  return checkNumber(value, spec);
}

function checkNumber(value: number, spec: NumericSpec): NumberParse {
  const scale = spec.percent ? 100 : 1;
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a finite number.' };
  if (spec.integer && !Number.isInteger(value)) return { ok: false, error: 'Enter a whole number.' };
  if (value < spec.min * scale) {
    return {
      ok: false,
      error: spec.min * scale === 0 ? 'Cannot be negative.' : `Must be at least ${spec.min * scale}.`,
    };
  }
  if (value > spec.max * scale) return { ok: false, error: `Must be at most ${spec.max * scale}.` };
  return { ok: true, value };
}

function parseRampText(text: string): { ok: true; value: number[] } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: [] };
  const parts = trimmed.split(/[,\s]+/).filter((p) => p !== '');
  const value: number[] = [];
  for (const part of parts) {
    const stripped = part.replace(/%$/, '');
    if (!/^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(stripped)) {
      return { ok: false, error: `"${part}" is not a percentage. Use values like 25, 50, 100.` };
    }
    const pct = Number(stripped);
    if (pct > 100) return { ok: false, error: 'Adoption cannot exceed 100% in any month.' };
    value.push(pct / 100);
  }
  if (value.length > MAX_RAMP_MONTHS) {
    return { ok: false, error: `List at most ${MAX_RAMP_MONTHS} months; later months repeat the last value.` };
  }
  return { ok: true, value };
}

function checkCurrency(code: string): string | null {
  if (!/^[A-Z]{3}$/.test(code)) return 'Use a three-letter currency code such as USD.';
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code });
  } catch {
    return `"${code}" is not a recognised currency code.`;
  }
  return null;
}

/**
 * Cross-field rules shared by the form and by import. Keyed by the field that
 * the person can change to resolve the problem.
 */
export function relationshipErrors(s: Scenario): FieldErrors {
  const errors: FieldErrors = {};
  const freed = hoursFreedPerMonth(s, 1);
  if (freed > 0) {
    const reduction = freed * s.cashSensitiveShare * s.cashRatePerHour;
    if (reduction > s.labourCashPerMonth + 1e-9) {
      errors.cashRatePerHour =
        `This removes ${round2(reduction)} of labour cash per month at full adoption, ` +
        `more than the ${round2(s.labourCashPerMonth)} you currently pay. ` +
        'Lower the rate or the cash-sensitive share, or raise the current labour cash expense.';
    }
  }
  if (s.adoptionRamp.length > s.horizonMonths) {
    errors.adoptionRamp = `The ramp lists ${s.adoptionRamp.length} months but the horizon is ${s.horizonMonths} months.`;
  }
  if (s.futurePlan.enabled && s.futurePlan.startMonth > s.horizonMonths) {
    errors['futurePlan.startMonth'] = `Start month must be within the ${s.horizonMonths}-month horizon.`;
  }
  if (s.futurePlan.enabled && s.futurePlan.hoursPerMonth <= 0) {
    errors['futurePlan.hoursPerMonth'] = 'Enter positive required hours for an enabled future plan.';
  }
  return errors;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('en-US');
}

export type DraftResult = { ok: true; scenario: Scenario; errors: FieldErrors } | { ok: false; errors: FieldErrors };

/** Parse a draft into a scenario, or report every field problem at once. */
export function parseDraft(draft: ScenarioDraft): DraftResult {
  const errors: FieldErrors = {};
  const numbers: Partial<Record<NumericKey, number>> = {};
  for (const key of NUMERIC_KEYS) {
    const spec = NUMERIC_SPECS[key];
    const parsed = parseNumberText(draft.numbers[key] ?? '', spec);
    if (parsed.ok) numbers[key] = spec.percent ? parsed.value / 100 : parsed.value;
    else errors[key] = parsed.error;
  }
  const planNumbers: Partial<Record<PlanNumericKey, number>> = {};
  for (const key of PLAN_KEYS) {
    const parsed = parseNumberText(draft.futurePlan.numbers[key] ?? '', PLAN_SPECS[key]);
    if (parsed.ok) planNumbers[key] = parsed.value;
    else errors[`futurePlan.${key}`] = parsed.error;
  }
  const ramp = parseRampText(draft.adoptionRamp);
  if (!ramp.ok) errors.adoptionRamp = ramp.error;
  const currency = draft.currency.trim().toUpperCase();
  const currencyError = checkCurrency(currency);
  if (currencyError) errors.currency = currencyError;
  const name = draft.name.trim();
  if (name.length > MAX_NAME_LENGTH) errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;

  if (Object.keys(errors).length > 0 || !ramp.ok) return { ok: false, errors };

  const scenario: Scenario = {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    name,
    currency,
    horizonMonths: numbers.horizonMonths!,
    acceptedCompletionsPerMonth: numbers.acceptedCompletionsPerMonth!,
    baselineMinutesPerCompletion: numbers.baselineMinutesPerCompletion!,
    proposedMinutesPerCompletion: numbers.proposedMinutesPerCompletion!,
    attemptsPerCompletion: numbers.attemptsPerCompletion!,
    labourCashPerMonth: numbers.labourCashPerMonth!,
    cashRatePerHour: numbers.cashRatePerHour!,
    cashSensitiveShare: numbers.cashSensitiveShare!,
    fixedCashPerMonth: numbers.fixedCashPerMonth!,
    variableCashPerAttempt: numbers.variableCashPerAttempt!,
    setupCash: numbers.setupCash!,
    adoptionRamp: ramp.value,
    retainedBuildHours: numbers.retainedBuildHours!,
    retainedMaintenanceHoursPerMonth: numbers.retainedMaintenanceHoursPerMonth!,
    futurePlan: {
      enabled: draft.futurePlan.enabled,
      divisible: draft.futurePlan.divisible,
      startMonth: planNumbers.startMonth!,
      hoursPerMonth: planNumbers.hoursPerMonth!,
      budgetPerMonth: planNumbers.budgetPerMonth!,
    },
  };
  const related = relationshipErrors(scenario);
  if (Object.keys(related).length > 0) return { ok: false, errors: related };
  return { ok: true, scenario, errors: {} };
}

export type ObjectValidation = { ok: true; scenario: Scenario } | { ok: false; problems: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validate an untrusted object (import file, browser storage) against the
 * schema. Every problem is collected; nothing is coerced.
 */
export function validateScenarioObject(value: unknown): ObjectValidation {
  const problems: string[] = [];
  if (!isRecord(value)) return { ok: false, problems: ['Scenario must be an object.'] };
  if (value.schemaVersion !== SCENARIO_SCHEMA_VERSION) {
    problems.push(`schemaVersion must be ${SCENARIO_SCHEMA_VERSION}; found ${JSON.stringify(value.schemaVersion)}.`);
  }
  const name = typeof value.name === 'string' ? value.name : '';
  if (value.name !== undefined && typeof value.name !== 'string') problems.push('name must be text.');
  if (name.length > MAX_NAME_LENGTH) problems.push(`name must be under ${MAX_NAME_LENGTH} characters.`);
  const currency = typeof value.currency === 'string' ? value.currency : '';
  const currencyError = checkCurrency(currency);
  if (currencyError) problems.push(`currency: ${currencyError}`);

  const numbers: Partial<Record<NumericKey, number>> = {};
  for (const key of NUMERIC_KEYS) {
    const raw = value[key];
    if (typeof raw !== 'number') {
      problems.push(`${key} must be a number; found ${describe(raw)}.`);
      continue;
    }
    const spec = NUMERIC_SPECS[key];
    const checked = checkNumber(spec.percent ? raw * 100 : raw, spec);
    if (!checked.ok) problems.push(`${key}: ${checked.error}`);
    else numbers[key] = raw;
  }

  let ramp: number[] = [];
  if (!Array.isArray(value.adoptionRamp)) {
    problems.push('adoptionRamp must be a list of fractions between 0 and 1.');
  } else if (value.adoptionRamp.length > MAX_RAMP_MONTHS) {
    problems.push(`adoptionRamp may list at most ${MAX_RAMP_MONTHS} months.`);
  } else {
    const bad = value.adoptionRamp.findIndex((f) => typeof f !== 'number' || !Number.isFinite(f) || f < 0 || f > 1);
    if (bad >= 0) problems.push(`adoptionRamp[${bad}] must be a fraction between 0 and 1.`);
    else ramp = value.adoptionRamp as number[];
  }

  const planRaw = value.futurePlan;
  const planNumbers: Partial<Record<PlanNumericKey, number>> = {};
  let planEnabled = false;
  let planDivisible = true;
  if (!isRecord(planRaw)) {
    problems.push('futurePlan must be an object.');
  } else {
    if (typeof planRaw.enabled !== 'boolean') problems.push('futurePlan.enabled must be true or false.');
    else planEnabled = planRaw.enabled;
    if (typeof planRaw.divisible !== 'boolean') problems.push('futurePlan.divisible must be true or false.');
    else planDivisible = planRaw.divisible;
    for (const key of PLAN_KEYS) {
      const raw = planRaw[key];
      if (typeof raw !== 'number') {
        problems.push(`futurePlan.${key} must be a number; found ${describe(raw)}.`);
        continue;
      }
      const checked = checkNumber(raw, PLAN_SPECS[key]);
      if (!checked.ok) problems.push(`futurePlan.${key}: ${checked.error}`);
      else planNumbers[key] = raw;
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  const plan: FuturePlan = {
    enabled: planEnabled,
    divisible: planDivisible,
    startMonth: planNumbers.startMonth!,
    hoursPerMonth: planNumbers.hoursPerMonth!,
    budgetPerMonth: planNumbers.budgetPerMonth!,
  };
  const scenario: Scenario = {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    name,
    currency,
    horizonMonths: numbers.horizonMonths!,
    acceptedCompletionsPerMonth: numbers.acceptedCompletionsPerMonth!,
    baselineMinutesPerCompletion: numbers.baselineMinutesPerCompletion!,
    proposedMinutesPerCompletion: numbers.proposedMinutesPerCompletion!,
    attemptsPerCompletion: numbers.attemptsPerCompletion!,
    labourCashPerMonth: numbers.labourCashPerMonth!,
    cashRatePerHour: numbers.cashRatePerHour!,
    cashSensitiveShare: numbers.cashSensitiveShare!,
    fixedCashPerMonth: numbers.fixedCashPerMonth!,
    variableCashPerAttempt: numbers.variableCashPerAttempt!,
    setupCash: numbers.setupCash!,
    adoptionRamp: ramp,
    retainedBuildHours: numbers.retainedBuildHours!,
    retainedMaintenanceHoursPerMonth: numbers.retainedMaintenanceHoursPerMonth!,
    futurePlan: plan,
  };
  const related = relationshipErrors(scenario);
  const relatedProblems = Object.entries(related).map(([key, message]) => `${key}: ${message}`);
  if (relatedProblems.length > 0) return { ok: false, problems: relatedProblems };
  return { ok: true, scenario };
}

function describe(v: unknown): string {
  if (v === undefined) return 'nothing';
  if (v === null) return 'null';
  if (typeof v === 'string') return `text "${v.length > 20 ? `${v.slice(0, 20)}…` : v}"`;
  return typeof v;
}
