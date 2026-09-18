import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import {
  expandRamp,
  formatMoney,
  formatNumber,
  type FieldErrors,
  type FieldPath,
  type NumericKey,
  type PlanNumericKey,
  type Scenario,
  type ScenarioDraft,
} from '../model';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'NZD', 'SEK', 'SGD'] as const;

export interface FormProps {
  draft: ScenarioDraft;
  errors: FieldErrors;
  lastValid: Scenario;
  presetTitle: string;
  saveStatus: string;
  saveTone: 'ok' | 'error' | 'info';
  onNumber: (key: NumericKey, value: string) => void;
  onPlanNumber: (key: PlanNumericKey, value: string) => void;
  onText: (key: 'name' | 'currency' | 'adoptionRamp', value: string) => void;
  onPlanFlag: (key: 'enabled' | 'divisible', value: boolean) => void;
  onReset: () => void;
  planOpen: boolean;
  onPlanOpenChange: (open: boolean) => void;
}

interface FieldProps {
  id: string;
  label: string;
  unit?: string;
  help?: ComponentChildren;
  error?: string;
  value: string;
  onInput: (value: string) => void;
  inputMode?: 'decimal' | 'numeric' | 'text';
}

function Field({ id, label, unit, help, error, value, onInput, inputMode = 'decimal' }: FieldProps) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div class="field" data-invalid={error ? 'true' : 'false'}>
      <label class="field__label" for={id}>
        {label}
      </label>
      <div class="field__control">
        <input
          id={id}
          name={id}
          type="text"
          inputMode={inputMode}
          autocomplete="off"
          spellcheck={false}
          value={value}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
        />
        {unit && <span class="field__unit">{unit}</span>}
      </div>
      {help && (
        <p class="field__help" id={helpId}>
          {help}
        </p>
      )}
      {error && (
        <p class="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Chevron() {
  return (
    <svg class="group__chevron" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  );
}

interface GroupProps {
  title: string;
  subtitle?: string;
  summary: string;
  /** Initial state for an uncontrolled group. */
  defaultOpen?: boolean;
  /** Controlled state; when given, onToggle must keep it in sync. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  errorCount: number;
  children: ComponentChildren;
  id: string;
}

function Group({ title, subtitle, summary, defaultOpen = true, open, onToggle, errorCount, children, id }: GroupProps) {
  return (
    <details
      class="group"
      id={id}
      open={open ?? defaultOpen}
      onToggle={(e) => onToggle?.((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span class="group__title">
          {title}
          {subtitle && <small>{subtitle}</small>}
        </span>
        <span class="group__summary">
          {errorCount > 0 ? <span class="field__error">{errorCount} to fix</span> : <span>{summary}</span>}
          <Chevron />
        </span>
      </summary>
      <div class="group__body">{children}</div>
    </details>
  );
}

const countErrors = (errors: FieldErrors, keys: FieldPath[]) => keys.filter((k) => errors[k]).length;

export function AssumptionsForm(props: FormProps) {
  const { draft, errors, lastValid, onNumber, onPlanNumber, onText, onPlanFlag } = props;
  const n = draft.numbers;
  const cur = lastValid.currency;
  const rampPreview = useMemo(() => expandRamp(lastValid.adoptionRamp, lastValid.horizonMonths), [lastValid]);
  const shareValid = !errors.cashSensitiveShare && !errors.cashRatePerHour;

  const summaries = {
    workload: `${formatNumber(lastValid.acceptedCompletionsPerMonth)}/mo · ${formatNumber(lastValid.baselineMinutesPerCompletion, 1)}→${formatNumber(lastValid.proposedMinutesPerCompletion, 1)} min`,
    labour: `${formatMoney(lastValid.labourCashPerMonth, cur)}/mo · ${formatNumber(lastValid.cashSensitiveShare * 100)}% cash-sensitive`,
    costs: `${formatMoney(lastValid.fixedCashPerMonth, cur)}/mo · setup ${formatMoney(lastValid.setupCash, cur)}`,
    adoption:
      lastValid.adoptionRamp.length === 0
        ? `full from month 1 · ${lastValid.horizonMonths} mo`
        : `${lastValid.adoptionRamp.map((f) => `${formatNumber(f * 100)}%`).join(' → ')} · ${lastValid.horizonMonths} mo`,
    retained: `${formatNumber(lastValid.retainedBuildHours)} h build · ${formatNumber(lastValid.retainedMaintenanceHoursPerMonth)} h/mo`,
    plan: lastValid.futurePlan.enabled
      ? `${formatMoney(lastValid.futurePlan.budgetPerMonth, cur)}/mo from month ${lastValid.futurePlan.startMonth}`
      : 'not modelled',
  };

  return (
    <form
      class="card assumptions"
      aria-labelledby="assumptions-heading"
      onSubmit={(e) => e.preventDefault()}
      noValidate
    >
      <div class="assumptions__head">
        <div class="assumptions__head-row">
          <h2 id="assumptions-heading">Assumptions</h2>
          <div class="field" data-invalid={errors.currency ? 'true' : 'false'} style="min-width: 120px">
            <label class="visually-hidden" for="currency">
              Currency
            </label>
            <div class="field__control" style="min-height: 36px">
              <select
                id="currency"
                value={CURRENCIES.includes(draft.currency as (typeof CURRENCIES)[number]) ? draft.currency : 'USD'}
                aria-describedby={errors.currency ? 'currency-error' : undefined}
                onChange={(e) => onText('currency', (e.currentTarget as HTMLSelectElement).value)}
                style="padding: 4px 8px; font-size: 13px"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {errors.currency && (
              <p class="field__error" id="currency-error" role="alert">
                {errors.currency}
              </p>
            )}
          </div>
        </div>
        <Field
          id="name"
          label="Scenario name"
          value={draft.name}
          inputMode="text"
          onInput={(v) => onText('name', v)}
          error={errors.name}
        />
        <p class="assumptions__status" data-tone={props.saveTone === 'error' ? 'error' : 'info'} aria-live="polite">
          {props.saveStatus}
        </p>
        <p class="group__intro">All amounts are per month unless a field says otherwise. A blank field is treated as missing, never as zero.</p>
      </div>

      <Group
        id="group-workload"
        title="Volume and time"
        summary={summaries.workload}
        errorCount={countErrors(errors, ['acceptedCompletionsPerMonth', 'baselineMinutesPerCompletion', 'proposedMinutesPerCompletion', 'attemptsPerCompletion'])}
      >
        <Field
          id="acceptedCompletionsPerMonth"
          label="Accepted completions"
          unit="per month"
          value={n.acceptedCompletionsPerMonth}
          error={errors.acceptedCompletionsPerMonth}
          onInput={(v) => onNumber('acceptedCompletionsPerMonth', v)}
          help="Work the process actually completes and you accept. Attempts that fail are counted separately below. The same accepted workload is assumed before and after."
        />
        <Field
          id="baselineMinutesPerCompletion"
          label="Human minutes per task, baseline"
          unit="minutes"
          value={n.baselineMinutesPerCompletion}
          error={errors.baselineMinutesPerCompletion}
          onInput={(v) => onNumber('baselineMinutesPerCompletion', v)}
          help="Include review and rework, not just the first pass."
        />
        <Field
          id="proposedMinutesPerCompletion"
          label="Human minutes per task, after"
          unit="minutes"
          value={n.proposedMinutesPerCompletion}
          error={errors.proposedMinutesPerCompletion}
          onInput={(v) => onNumber('proposedMinutesPerCompletion', v)}
          help="Include the review, exceptions and rework the new process still needs. A larger number than baseline means the change adds work, and the model charges for it."
        />
        <Field
          id="attemptsPerCompletion"
          label="Attempts per accepted completion"
          unit="attempts"
          value={n.attemptsPerCompletion}
          error={errors.attemptsPerCompletion}
          onInput={(v) => onNumber('attemptsPerCompletion', v)}
          help="Billable runs per accepted result, including failures and retries. 1.25 means the variable charge is paid 1.25 times per accepted completion; it says nothing about which tasks needed a second run."
        />
      </Group>

      <Group
        id="group-labour"
        title="Labour cash"
        summary={summaries.labour}
        errorCount={countErrors(errors, ['labourCashPerMonth', 'cashRatePerHour', 'cashSensitiveShare'])}
      >
        <Field
          id="labourCashPerMonth"
          label="Current labour cash expense"
          unit={`${cur} per month`}
          value={n.labourCashPerMonth}
          error={errors.labourCashPerMonth}
          onInput={(v) => onNumber('labourCashPerMonth', v)}
          help="What you pay today for this process, in cash. It is the baseline for cost per completion and the ceiling on any cash reduction."
        />
        <Field
          id="cashRatePerHour"
          label="Cash rate per changed hour"
          unit={`${cur} per hour`}
          value={n.cashRatePerHour}
          error={errors.cashRatePerHour}
          onInput={(v) => onNumber('cashRatePerHour', v)}
          help="What you would genuinely stop paying per freed hour, or start paying per added hour. Zero for salaried staff whose pay does not change."
        />
        <Field
          id="cashSensitiveShare"
          label="Cash-sensitive share of changed hours"
          unit="per cent"
          value={n.cashSensitiveShare}
          error={errors.cashSensitiveShare}
          onInput={(v) => onNumber('cashSensitiveShare', v)}
          help="The portion of changed hours that changes the bill. Freed hours in this share reduce cash; the rest stay as retained capacity. Added hours in this share cost cash."
        />
        {shareValid && lastValid.cashSensitiveShare * lastValid.cashRatePerHour === 0 && (
          <p class="callout">
            With a zero rate or a zero share, payroll stays fixed. Freed time becomes capacity, not cash. There is no default assumption
            that salary equals the value of an hour.
          </p>
        )}
      </Group>

      <Group
        id="group-costs"
        title="New cash costs"
        summary={summaries.costs}
        errorCount={countErrors(errors, ['fixedCashPerMonth', 'variableCashPerAttempt', 'setupCash'])}
      >
        <Field
          id="fixedCashPerMonth"
          label="Fixed incremental cash cost"
          unit={`${cur} per month`}
          value={n.fixedCashPerMonth}
          error={errors.fixedCashPerMonth}
          onInput={(v) => onNumber('fixedCashPerMonth', v)}
          help="Subscription plus contracted maintenance. Charged in full from month 1, whatever the adoption ramp says."
        />
        <Field
          id="variableCashPerAttempt"
          label="Variable cash cost per attempt"
          unit={`${cur} per attempt`}
          value={n.variableCashPerAttempt}
          error={errors.variableCashPerAttempt}
          onInput={(v) => onNumber('variableCashPerAttempt', v)}
          help="Charged on every attempt, including the ones that fail and get retried. Scales with adoption."
        />
        <Field
          id="setupCash"
          label="One-time setup cash"
          unit={`${cur} once`}
          value={n.setupCash}
          error={errors.setupCash}
          onInput={(v) => onNumber('setupCash', v)}
          help="Cash paid out at month 0: implementation fees, contracted build, migration. Not salaried time; record that under retained salaried time."
        />
      </Group>

      <Group
        id="group-adoption"
        title="Adoption and horizon"
        summary={summaries.adoption}
        defaultOpen={false}
        errorCount={countErrors(errors, ['adoptionRamp', 'horizonMonths'])}
      >
        <Field
          id="adoptionRamp"
          label="Adoption by month"
          unit="% list"
          inputMode="text"
          value={draft.adoptionRamp}
          error={errors.adoptionRamp}
          onInput={(v) => onText('adoptionRamp', v)}
          help="Percent of the workload on the new process for each early month, e.g. 25, 50, 100. Later months repeat the last value. Leave blank for full adoption from month 1. Freed hours, cash-changing hours and variable costs follow this ramp; fixed costs do not."
        />
        {!errors.adoptionRamp && !errors.horizonMonths && (
          <ul class="ramp-preview" aria-label="Adoption preview by month">
            {rampPreview.map((f, i) => (
              <li key={i}>
                M{i + 1} {formatNumber(f * 100)}%
              </li>
            ))}
          </ul>
        )}
        <Field
          id="horizonMonths"
          label="Horizon"
          unit="months"
          inputMode="numeric"
          value={n.horizonMonths}
          error={errors.horizonMonths}
          onInput={(v) => onNumber('horizonMonths', v)}
          help="Whole months to model after month 0, from 12 to 60. Year-one figures always cover the first 12 months."
        />
      </Group>

      <Group
        id="group-retained"
        title="Retained salaried time"
        subtitle="Recorded in hours, never priced"
        summary={summaries.retained}
        defaultOpen={false}
        errorCount={countErrors(errors, ['retainedBuildHours', 'retainedMaintenanceHoursPerMonth'])}
      >
        <p class="group__intro">
          Time from people you keep paying either way. It is a resource commitment, not a cash outflow, so it never enters the cash
          ledger or the payback.
        </p>
        <Field
          id="retainedBuildHours"
          label="Build time, one-time"
          unit="hours"
          value={n.retainedBuildHours}
          error={errors.retainedBuildHours}
          onInput={(v) => onNumber('retainedBuildHours', v)}
        />
        <Field
          id="retainedMaintenanceHoursPerMonth"
          label="Maintenance time"
          unit="hours per month"
          value={n.retainedMaintenanceHoursPerMonth}
          error={errors.retainedMaintenanceHoursPerMonth}
          onInput={(v) => onNumber('retainedMaintenanceHoursPerMonth', v)}
        />
      </Group>

      <Group
        id="group-plan"
        title="Future spending plan"
        subtitle="Optional counterfactual"
        summary={summaries.plan}
        open={props.planOpen}
        onToggle={props.onPlanOpenChange}
        errorCount={countErrors(errors, ['futurePlan.startMonth', 'futurePlan.hoursPerMonth', 'futurePlan.budgetPerMonth'])}
      >
        <p class="group__intro">
          A hire or contract you might otherwise make later. Allow for build and maintenance commitments yourself: they are recorded separately and not deducted from plan capacity. Only retained capacity, after adoption and after the hours that already
          reduce cash, can cover it. This is a conditional comparison, kept apart from current cash.
        </p>
        <label class="field--check">
          <input
            type="checkbox"
            id="futurePlan.enabled"
            checked={draft.futurePlan.enabled}
            onChange={(e) => onPlanFlag('enabled', (e.currentTarget as HTMLInputElement).checked)}
          />
          <span>
            Model a future spending plan
            <small>Off by default. Unknown future spending is not zero and is never realised savings.</small>
          </span>
        </label>
        {draft.futurePlan.enabled && (
          <>
            <Field
              id="futurePlan.startMonth"
              label="Plan start month"
              unit="month"
              inputMode="numeric"
              value={draft.futurePlan.numbers.startMonth}
              error={errors['futurePlan.startMonth']}
              onInput={(v) => onPlanNumber('startMonth', v)}
              help="First month the spend would otherwise begin. Nothing is allocated before it."
            />
            <Field
              id="futurePlan.hoursPerMonth"
              label="Hours the plan needs"
              unit="hours per month"
              value={draft.futurePlan.numbers.hoursPerMonth}
              error={errors['futurePlan.hoursPerMonth']}
              onInput={(v) => onPlanNumber('hoursPerMonth', v)}
            />
            <Field
              id="futurePlan.budgetPerMonth"
              label="Budget the plan would cost"
              unit={`${cur} per month`}
              value={draft.futurePlan.numbers.budgetPerMonth}
              error={errors['futurePlan.budgetPerMonth']}
              onInput={(v) => onPlanNumber('budgetPerMonth', v)}
              help="The cash you would spend if nobody in-house absorbed the work."
            />
            <label class="field--check">
              <input
                type="checkbox"
                id="futurePlan.divisible"
                checked={draft.futurePlan.divisible}
                onChange={(e) => onPlanFlag('divisible', (e.currentTarget as HTMLInputElement).checked)}
              />
              <span>
                Expense is divisible
                <small>
                  Ticked: partial coverage avoids a proportional share of the budget. Unticked: the budget is avoided only in months
                  where the hours are fully covered.
                </small>
              </span>
            </label>
          </>
        )}
      </Group>

      <div class="form-actions">
        <button type="button" class="btn" onClick={props.onReset}>
          Reset to {props.presetTitle}
        </button>
      </div>
    </form>
  );
}
