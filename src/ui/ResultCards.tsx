import { formatHours, formatMoney, formatMonths, formatNumber, formatPercent, type Results } from '../model';

const tone = (v: number): 'positive' | 'negative' | 'neutral' => (v > 1e-9 ? 'positive' : v < -1e-9 ? 'negative' : 'neutral');

export function paybackText(r: Results): { headline: string; detail: string } {
  const p = r.payback;
  const cur = r.scenario.currency;
  if (p.status === 'paid_back') {
    return {
      headline: `Month ${p.month}`,
      detail: `First month the cumulative cash is not negative. Interpolated within that month: ${formatMonths(p.fractionalMonths, 2)}.`,
    };
  }
  if (p.status === 'no_investment') {
    const ongoing =
      p.ongoing === 'positive'
        ? `Ongoing cash is positive at ${formatMoney(r.steady.netCash, cur, { signed: true })} per month at full adoption.`
        : p.ongoing === 'zero'
          ? 'Ongoing cash is exactly zero at full adoption: nothing to recover and nothing gained.'
          : `Ongoing cash is negative at ${formatMoney(r.steady.netCash, cur, { signed: true })} per month at full adoption.`;
    return { headline: 'No initial investment to recover', detail: ongoing };
  }
  const reason =
    p.reason === 'zero_net'
      ? 'Monthly net cash is zero at full adoption, so the setup cash is never recovered.'
      : p.reason === 'negative_net'
        ? 'Monthly net cash is negative at full adoption, so the setup cash is never recovered.'
        : `Cumulative cash is still ${formatMoney(p.cumulativeAtHorizon, cur, { signed: true })} at month ${r.scenario.horizonMonths}.`;
  return { headline: `No payback in ${r.scenario.horizonMonths} months`, detail: reason };
}

export function ResultCards({ results: r, onAddPlan }: { results: Results; onAddPlan: () => void }) {
  const cur = r.scenario.currency;
  const s = r.steady;
  const ramped = r.scenario.adoptionRamp.some((f) => f < 1);
  const firstMonth = r.months[0];
  const payback = paybackText(r);
  const plan = r.plan;
  const netTone = tone(s.netCash);
  const cashLine =
    s.cashRemoved < 0
      ? 'The new process needs more billed human time than before, so labour cash rises.'
      : s.cashRemoved === 0
        ? 'No existing cash expense is removed. The new costs are the whole story.'
        : s.netCash >= 0
          ? 'Cash removed exceeds the new cash costs it creates. This is the recurring figure, before setup.'
          : 'Cash removed does not cover the new cash costs. This is the recurring figure, before setup.';

  return (
    <div class="result-cards">
      <section class="card result" aria-labelledby="result-cash">
        <h3 id="result-cash">Result 1: Cash</h3>
        <p class="result__figure num" data-tone={netTone} data-testid="cash-figure">
          {formatMoney(s.netCash, cur, { signed: true })}
        </p>
        <p class="result__caption">per month at full adoption</p>
        <dl class="rows">
          <div>
            <dt>Cash removed</dt>
            <dd data-tone={tone(s.cashRemoved)}>{formatMoney(s.cashRemoved, cur)}</dd>
          </div>
          <div>
            <dt>New cash cost</dt>
            <dd>{formatMoney(s.newCosts, cur)}</dd>
          </div>
          {ramped && firstMonth && (
            <div>
              <dt>Month 1 on this ramp</dt>
              <dd data-tone={tone(firstMonth.netCash)}>{formatMoney(firstMonth.netCash, cur, { signed: true })}</dd>
            </div>
          )}
          <div>
            <dt>Setup, month 0</dt>
            <dd data-tone={tone(-r.setupCash)}>{formatMoney(-r.setupCash, cur)}</dd>
          </div>
          <div>
            <dt>Year one total</dt>
            <dd data-tone={tone(r.cumulativeYearOne)} data-testid="year-one">
              {formatMoney(r.cumulativeYearOne, cur, { signed: true })}
            </dd>
          </div>
          <div>
            <dt>Payback</dt>
            <dd data-testid="payback">{payback.headline}</dd>
          </div>
        </dl>
        <p class="result__note">{cashLine}</p>
      </section>

      <section class="card result" aria-labelledby="result-capacity">
        <h3 id="result-capacity">Result 2: Capacity</h3>
        <p class="result__figure num" data-testid="hours-figure">
          {formatHours(s.hoursFreed, s.hoursFreed % 1 === 0 ? 0 : 1, true)}
        </p>
        <p class="result__caption">{s.hoursFreed < 0 ? 'additional human hours needed per month at full adoption' : 'human hours changed per month at full adoption'}</p>
        <dl class="rows">
          <div>
            <dt>Per accepted task</dt>
            <dd>{formatNumber(r.scenario.baselineMinutesPerCompletion - r.scenario.proposedMinutesPerCompletion, 1, true)} min</dd>
          </div>
          <div>
            <dt>{s.hoursFreed < 0 ? 'Added hours costing cash' : 'Removing cash expense'}</dt>
            <dd>{formatHours(Math.abs(s.cashChangingHours), 1)}</dd>
          </div>
          <div>
            <dt>Retained as capacity</dt>
            <dd data-testid="retained-hours">{formatHours(s.retainedHours, 1)}</dd>
          </div>
          <div>
            <dt>Year one total</dt>
            <dd>{formatHours(r.hoursFreedYearOne, 0, true)}</dd>
          </div>
        </dl>
        <p class="result__note">
          Hours are not cash. Hours that reduce the bill appear in Result 1 and are not counted here as capacity. Retained hours are
          shown as hours; no money value is assigned to them.
        </p>
      </section>

      <section class="card result result--plan" aria-labelledby="result-plan">
        <h3 id="result-plan" class="eyebrow--copper">
          Result 3: Future plan
        </h3>
        {!plan.enabled ? (
          <>
            <p class="result__figure result__figure--text" data-testid="plan-figure">
              Not modelled
            </p>
            <p class="result__caption">no future spending plan entered</p>
            <dl class="rows">
              <div>
                <dt>Retained capacity</dt>
                <dd>{formatHours(plan.retainedHoursAtFullAdoption, 1)} / mo</dd>
              </div>
              <div>
                <dt>Plan needs</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Avoided expense</dt>
                <dd>—</dd>
              </div>
            </dl>
            <p class="result__note">
              Optional and off by default. Add a plan only where a specific future cost is genuinely on the table. Unknown future
              spending is not zero, and it is never realised savings.
            </p>
            <div>
              <button type="button" class="btn btn--small" onClick={onAddPlan}>
                Add a future plan
              </button>
            </div>
          </>
        ) : (
          <>
            <p class="result__figure num" data-tone={tone(plan.avoidedExpenseYearOne)} data-testid="plan-figure">
              {formatMoney(plan.avoidedExpenseYearOne, cur, { signed: true })}
            </p>
            <p class="result__caption">potential avoided expense, year one, if the plan were real</p>
            <dl class="rows">
              <div>
                <dt>Retained capacity</dt>
                <dd>{formatHours(plan.retainedHoursAtFullAdoption, 1)} / mo</dd>
              </div>
              <div>
                <dt>Plan needs</dt>
                <dd>{formatHours(plan.hoursPerMonth, 1)} / mo</dd>
              </div>
              <div>
                <dt>Hours covered</dt>
                <dd data-testid="plan-covered">{formatHours(plan.hoursCoveredAtFullAdoption, 1)}</dd>
              </div>
              <div>
                <dt>Capacity left over</dt>
                <dd>{formatHours(plan.remainingHoursAtFullAdoption, 1)}</dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>{formatPercent(plan.coverageAtFullAdoption)}</dd>
              </div>
              <div>
                <dt>Months fully covered</dt>
                <dd>
                  {plan.monthsFullyCovered} of {plan.monthsActive}
                </dd>
              </div>
              <div>
                <dt>Cash + avoided, year one</dt>
                <dd data-tone={tone(plan.netAgainstPlanYearOne)}>{formatMoney(plan.netAgainstPlanYearOne, cur, { signed: true })}</dd>
              </div>
            </dl>
            <p class="result__note result__note--copper">
              {plan.divisible
                ? 'Assumed divisible: partial coverage avoids a proportional share of the budget.'
                : 'Assumed indivisible: the budget is avoided only in months where every required hour is covered.'}{' '}
              Starts month {plan.startMonth}; nothing is allocated before it. This is a conditional comparison against a stated plan,
              not current cash and not a headcount decision.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
