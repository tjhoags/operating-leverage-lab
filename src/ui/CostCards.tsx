import { formatHours, formatMoney, formatNumber, type Results } from '../model';

export function CostCards({ results: r }: { results: Results }) {
  const cur = r.scenario.currency;
  const u = r.unitCost;
  const undefinedCost = u.before === undefined || u.after === undefined;
  const changeTone = u.changePercent === undefined ? undefined : u.changePercent < 0 ? 'positive' : u.changePercent > 0 ? 'negative' : undefined;
  return (
    <div class="cost-grid">
      <section class="card" aria-labelledby="unit-cost-heading">
        <h2 id="unit-cost-heading">Cost per accepted completion</h2>
        <p class="card__lead">
          Divided by accepted completions, not attempts. Failed attempts and retries raise the numerator and never the denominator.
        </p>
        {undefinedCost ? (
          <p class="callout" data-testid="unit-cost-undefined">
            Undefined. Accepted completions are zero, so there is no denominator. Monthly cash figures above still apply; a cost
            per completion does not.
          </p>
        ) : (
          <div class="unit-cost__figures">
            <div class="unit-cost__figure">
              <span class="eyebrow">Before</span>
              <b data-testid="unit-before">{formatMoney(u.before, cur, { decimals: 2 })}</b>
            </div>
            <span class="unit-cost__arrow" aria-hidden="true">
              →
            </span>
            <div class="unit-cost__figure">
              <span class="eyebrow">After</span>
              <b data-tone={changeTone} data-testid="unit-after">
                {formatMoney(u.after, cur, { decimals: 2 })}
              </b>
            </div>
            {u.changePercent !== undefined && (
              <span class="unit-cost__delta">
                {formatNumber(u.changePercent, 1, true)}% per completion at full adoption
              </span>
            )}
          </div>
        )}
        <div class="boundary">
          <strong>Cost boundary</strong>
          Included: the in-scope labour cash expense entered above (fixed payroll stays in it if you entered it), the fixed
          incremental cash cost and the variable cost on every attempt. Excluded: the one-time setup cash, retained salaried time
          and any cost outside this process. {u.setupPerCompletion !== undefined && (
            <>
              Disclosed separately: setup spread over {r.scenario.horizonMonths} months is{' '}
              <span class="mono">{formatMoney(u.setupPerCompletion, cur, { decimals: 3 })}</span> per completion.
            </>
          )}
        </div>
      </section>
      <section class="card card--quiet" aria-labelledby="resource-heading">
        <h2 id="resource-heading">Resource commitment</h2>
        <p class="card__lead">Salaried time you keep paying for either way. Recorded in hours, never converted to cash, never in payback.</p>
        <dl class="rows">
          <div>
            <dt>Build, one-time</dt>
            <dd>{formatHours(r.resource.buildHours, 0)}</dd>
          </div>
          <div>
            <dt>Maintain, monthly</dt>
            <dd>{formatHours(r.resource.maintenanceHoursPerMonth, 0)}</dd>
          </div>
          <div>
            <dt>Year one total</dt>
            <dd>{formatHours(r.resource.yearOneHours, 0)}</dd>
          </div>
        </dl>
        <p class="result__note result__note--copper">
          Deliberately excluded from cash payback: these hours require no additional cash payment. Payroll remains in the cost boundary. Build and maintenance still compete with other work.
        </p>
      </section>
    </div>
  );
}
