import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { formatHours, formatMoney, formatNumber, formatPercent, type Results } from '../model';
import { STORAGE_KEY } from '../app/storage';

const TABS = [
  { id: 'calc', label: 'Calculation detail' },
  { id: 'months', label: 'Month by month' },
  { id: 'method', label: 'Methodology and limits' },
  { id: 'scenario', label: 'Scenario file and storage' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const tone = (v: number) => (v > 1e-9 ? 'positive' : v < -1e-9 ? 'negative' : undefined);

export interface ScenarioMessage {
  tone: 'success' | 'error' | 'info';
  text: string;
  problems?: string[];
}

export interface ScenarioPanelProps {
  message: ScenarioMessage | null;
  storageStatus: string;
  canExport: boolean;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onForget: () => void;
}

interface Props {
  results: Results;
  scenarioPanel: ScenarioPanelProps;
  initialTab?: TabId;
}

export function DetailTabs({ results, scenarioPanel, initialTab = 'calc' }: Props) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: TABS.length - 1 - index };
    const delta = moves[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    setTab(TABS[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <section class="card details-card" aria-labelledby="details-heading">
      <h2 id="details-heading" class="visually-hidden">
        Details
      </h2>
      <div class="tablist" role="tablist" aria-label="Details">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            class="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          class="tabpanel"
          hidden={tab !== t.id}
          tabIndex={0}
        >
          {tab === t.id && (
            <>
              {t.id === 'calc' && <CalculationDetail results={results} />}
              {t.id === 'months' && <MonthlyTable results={results} />}
              {t.id === 'method' && <Methodology />}
              {t.id === 'scenario' && <ScenarioPanel {...scenarioPanel} />}
            </>
          )}
        </div>
      ))}
    </section>
  );
}

function CalculationDetail({ results: r }: { results: Results }) {
  const s = r.scenario;
  const st = r.steady;
  const cur = s.currency;
  const m = (v: number, d = 0) => formatMoney(v, cur, { decimals: d });
  const ms = (v: number, d = 0) => formatMoney(v, cur, { decimals: d, signed: true });
  const freedMinutes = s.baselineMinutesPerCompletion - s.proposedMinutesPerCompletion;
  const rows: Array<{ line: string; arithmetic: string; result: string; tone?: 'positive' | 'negative'; emphasis?: boolean }> = [
    { line: 'Human hours per month, baseline', arithmetic: `${formatNumber(s.acceptedCompletionsPerMonth)} × ${formatNumber(s.baselineMinutesPerCompletion, 2)} ÷ 60`, result: formatHours(st.baselineHours, 2) },
    { line: 'Human hours per month, after', arithmetic: `${formatNumber(s.acceptedCompletionsPerMonth)} × ${formatNumber(s.proposedMinutesPerCompletion, 2)} ÷ 60`, result: formatHours(st.proposedHours, 2) },
    { line: 'Freed minutes per accepted task', arithmetic: `${formatNumber(s.baselineMinutesPerCompletion, 2)} − ${formatNumber(s.proposedMinutesPerCompletion, 2)}`, result: `${formatNumber(freedMinutes, 2, true)} min` },
    { line: 'Hours changed per month, full adoption', arithmetic: `${formatNumber(s.acceptedCompletionsPerMonth)} × ${formatNumber(freedMinutes, 2, true)} ÷ 60`, result: formatHours(st.hoursFreed, 2, true) },
    { line: 'Cash-changing hours', arithmetic: s.cashRatePerHour === 0 ? 'zero cash rate: no hours remove cash' : `${formatHours(st.hoursFreed, 2, true)} × ${formatPercent(s.cashSensitiveShare)}`, result: formatHours(st.cashChangingHours, 2, true) },
    { line: 'Retained as capacity', arithmetic: st.hoursFreed > 0 ? `${formatHours(st.hoursFreed, 2)} − ${formatHours(st.cashChangingHours, 2)}` : 'no freed hours to retain', result: formatHours(st.retainedHours, 2) },
    { line: 'Cash removed per month', arithmetic: `${formatHours(st.cashChangingHours, 2, true)} × ${m(s.cashRatePerHour, 2)}/h`, result: m(st.cashRemoved, 2), tone: tone(st.cashRemoved) },
    { line: 'Attempts per month', arithmetic: `${formatNumber(s.acceptedCompletionsPerMonth)} accepted × ${formatNumber(s.attemptsPerCompletion, 2)} attempts each`, result: formatNumber(st.attemptsPerMonth, 2) },
    { line: 'Variable cash cost', arithmetic: `${formatNumber(st.attemptsPerMonth, 2)} × ${m(s.variableCashPerAttempt, 2)}`, result: m(st.variableCost, 2), tone: st.variableCost > 0 ? 'negative' : undefined },
    { line: 'Fixed cash cost', arithmetic: 'as entered, charged in full from month 1', result: m(st.fixedCost, 2), tone: st.fixedCost > 0 ? 'negative' : undefined },
    { line: 'New cash cost per month', arithmetic: `${m(st.variableCost, 2)} + ${m(st.fixedCost, 2)}`, result: m(st.newCosts, 2), tone: st.newCosts > 0 ? 'negative' : undefined },
    { line: 'Monthly net cash, full adoption', arithmetic: `${m(st.cashRemoved, 2)} − ${m(st.newCosts, 2)}`, result: ms(st.netCash, 2), tone: tone(st.netCash), emphasis: true },
    { line: 'Ongoing cash cost, before', arithmetic: 'current labour cash expense', result: m(st.baselineOngoingCash, 2) },
    { line: 'Ongoing cash cost, after', arithmetic: `${m(st.baselineOngoingCash, 2)} − ${m(st.cashRemoved, 2)} + ${m(st.newCosts, 2)}`, result: m(st.postOngoingCash, 2) },
    { line: 'Setup cash, month 0', arithmetic: 'one-time, excluded from unit cost', result: ms(-s.setupCash, 2), tone: tone(-s.setupCash) },
    { line: 'Cumulative cash at month 12', arithmetic: 'sum of 12 monthly nets − setup', result: ms(r.cumulativeYearOne, 2), tone: tone(r.cumulativeYearOne), emphasis: true },
  ];
  if (s.horizonMonths > 12) {
    rows.push({ line: `Cumulative cash at month ${s.horizonMonths}`, arithmetic: `sum of ${s.horizonMonths} monthly nets − setup`, result: ms(r.cumulativeHorizon, 2), tone: tone(r.cumulativeHorizon) });
  }
  if (r.unitCost.before !== undefined && r.unitCost.after !== undefined) {
    rows.push(
      { line: 'Cost per completion, before', arithmetic: `${m(st.baselineOngoingCash, 2)} ÷ ${formatNumber(s.acceptedCompletionsPerMonth)} accepted`, result: m(r.unitCost.before, 2) },
      { line: 'Cost per completion, after', arithmetic: `${m(st.postOngoingCash, 2)} ÷ ${formatNumber(s.acceptedCompletionsPerMonth)} accepted`, result: m(r.unitCost.after, 2) },
      { line: 'Setup amortised per completion', arithmetic: `${m(s.setupCash, 2)} ÷ ${s.horizonMonths} ÷ ${formatNumber(s.acceptedCompletionsPerMonth)}, disclosed separately`, result: m(r.unitCost.setupPerCompletion ?? 0, 3) },
    );
  } else {
    rows.push({ line: 'Cost per completion', arithmetic: 'accepted completions are zero', result: 'undefined' });
  }
  if (s.futurePlan.enabled) {
    const p = r.plan;
    rows.push(
      { line: 'Plan hours covered, full adoption', arithmetic: `min(${formatHours(p.hoursPerMonth, 2)} needed, ${formatHours(p.retainedHoursAtFullAdoption, 2)} retained)`, result: formatHours(p.hoursCoveredAtFullAdoption, 2) },
      { line: 'Plan coverage', arithmetic: p.hoursPerMonth > 0 ? `${formatHours(p.hoursCoveredAtFullAdoption, 2)} ÷ ${formatHours(p.hoursPerMonth, 2)}` : 'no hours required', result: formatPercent(p.coverageAtFullAdoption, 1) },
      { line: 'Avoided expense, year one', arithmetic: p.divisible ? `Σ budget × coverage, months ${p.startMonth}–12` : `Σ budget in fully covered months ${p.startMonth}–12`, result: ms(p.avoidedExpenseYearOne, 2), tone: tone(p.avoidedExpenseYearOne) },
      { line: 'Current cash + avoided expense, year one', arithmetic: `${ms(r.cumulativeYearOne, 2)} + ${ms(p.avoidedExpenseYearOne, 2)} (conditional comparison)`, result: ms(p.netAgainstPlanYearOne, 2), tone: tone(p.netAgainstPlanYearOne) },
    );
  }
  return (
    <>
      <p class="prose">
        Every figure on this page with the arithmetic that produced it and the inputs it came from. Figures are at full adoption
        unless the row says otherwise. Internal precision is unrounded; only the display is rounded.
      </p>
      <div class="table-wrap">
        <table data-testid="calc-table">
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col">Arithmetic</th>
              <th scope="col" class="num">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.line} class={row.emphasis ? 'total' : undefined}>
                <td>{row.line}</td>
                <td class="arith">{row.arithmetic}</td>
                <td class="num" data-tone={row.tone}>
                  {row.result}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MonthlyTable({ results: r }: { results: Results }) {
  const cur = r.scenario.currency;
  const planOn = r.scenario.futurePlan.enabled;
  const m = (v: number) => formatMoney(v, cur, { signed: true });
  const yearOne = r.months.slice(0, 12);
  const sum = (pick: (x: (typeof r.months)[number]) => number) => yearOne.reduce((a, x) => a + pick(x), 0);
  return (
    <>
      <p class="prose">
        One row per modelled month. Month 0 carries only the setup cash. Hours and variable costs follow adoption; the fixed cost
        does not. {planOn && 'Plan columns show hours covered by retained capacity and the expense that coverage would avoid.'}
      </p>
      <div class="table-wrap">
        <table data-testid="month-table">
          <thead>
            <tr>
              <th scope="col" class="sticky">
                Month
              </th>
              <th scope="col" class="num">
                Adoption
              </th>
              <th scope="col" class="num">
                Hours changed
              </th>
              <th scope="col" class="num">
                Cash-changing h
              </th>
              <th scope="col" class="num">
                Retained h
              </th>
              <th scope="col" class="num">
                Cash removed
              </th>
              <th scope="col" class="num">
                Variable cost
              </th>
              <th scope="col" class="num">
                Fixed cost
              </th>
              <th scope="col" class="num">
                Net cash
              </th>
              <th scope="col" class="num">
                Cumulative
              </th>
              {planOn && (
                <>
                  <th scope="col" class="num">
                    Plan h covered
                  </th>
                  <th scope="col" class="num">
                    Avoided expense
                  </th>
                  <th scope="col" class="num">
                    Capacity left
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="sticky">0</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num" data-tone={tone(-r.setupCash)}>
                {m(-r.setupCash)}
              </td>
              <td class="num" data-tone={tone(-r.setupCash)}>
                {m(-r.setupCash)}
              </td>
              {planOn && (
                <>
                  <td class="num">—</td>
                  <td class="num">—</td>
                  <td class="num">—</td>
                </>
              )}
            </tr>
            {r.months.map((row) => (
              <tr key={row.month}>
                <td class="sticky">{row.month}</td>
                <td class="num">{formatPercent(row.adoption)}</td>
                <td class="num">{formatNumber(row.hoursFreed, 1, true)}</td>
                <td class="num">{formatNumber(row.cashChangingHours, 1, true)}</td>
                <td class="num">{formatNumber(row.retainedHours, 1)}</td>
                <td class="num" data-tone={tone(row.cashRemoved)}>
                  {formatMoney(row.cashRemoved, cur)}
                </td>
                <td class="num">{formatMoney(row.variableCost, cur)}</td>
                <td class="num">{formatMoney(row.fixedCost, cur)}</td>
                <td class="num" data-tone={tone(row.netCash)}>
                  {m(row.netCash)}
                </td>
                <td class="num" data-tone={tone(row.cumulativeCash)}>
                  {m(row.cumulativeCash)}
                </td>
                {planOn && row.plan && (
                  <>
                    <td class="num">{row.plan.active ? formatNumber(row.plan.hoursCovered, 1) : 'before start'}</td>
                    <td class="num" data-tone={tone(row.plan.avoidedExpense)}>
                      {formatMoney(row.plan.avoidedExpense, cur)}
                    </td>
                    <td class="num">{formatNumber(row.plan.remainingHours, 1)}</td>
                  </>
                )}
              </tr>
            ))}
            <tr class="total">
              <td class="sticky">Year one</td>
              <td class="num">—</td>
              <td class="num">{formatNumber(r.hoursFreedYearOne, 1, true)}</td>
              <td class="num">{formatNumber(sum((x) => x.cashChangingHours), 1, true)}</td>
              <td class="num">{formatNumber(sum((x) => x.retainedHours), 1)}</td>
              <td class="num">{formatMoney(sum((x) => x.cashRemoved), cur)}</td>
              <td class="num">{formatMoney(sum((x) => x.variableCost), cur)}</td>
              <td class="num">{formatMoney(sum((x) => x.fixedCost), cur)}</td>
              <td class="num" data-tone={tone(sum((x) => x.netCash))}>
                {m(sum((x) => x.netCash))}
              </td>
              <td class="num" data-tone={tone(r.cumulativeYearOne)}>
                {m(r.cumulativeYearOne)}
              </td>
              {planOn && (
                <>
                  <td class="num">{formatNumber(sum((x) => x.plan?.hoursCovered ?? 0), 1)}</td>
                  <td class="num" data-tone={tone(r.plan.avoidedExpenseYearOne)}>
                    {formatMoney(r.plan.avoidedExpenseYearOne, cur)}
                  </td>
                  <td class="num">—</td>
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function Methodology() {
  return (
    <div class="prose" style="display:grid; gap:12px">
      <h3>What is compared</h3>
      <p>
        One process, at the same accepted output standard, before and after a proposed change. All money is in the chosen display
        currency, all periods are calendar months, and month 0 is the moment the setup cash is paid. Full precision is kept
        internally; only the display is rounded.
      </p>
      <h3>Formulas</h3>
      <ul>
        <li>
          <code>hours changed = accepted completions × (baseline minutes − after minutes) ÷ 60 × adoption</code>. Negative values are
          preserved as added human work.
        </li>
        <li>
          <code>cash-changing hours = hours changed × cash-sensitive share</code>, or zero when the cash rate is zero. <code>cash removed = cash-changing hours × cash
          rate</code>. A negative result is an added labour cost.
        </li>
        <li>
          <code>retained capacity = hours freed − cash-changing hours</code> when hours freed are positive, otherwise zero. Retained
          hours are reported as hours and never priced.
        </li>
        <li>
          <code>variable cost = accepted completions × attempts per completion × price per attempt × adoption</code>. The fixed cost
          is charged in full from month 1.
        </li>
        <li>
          <code>net cash = cash removed − variable cost − fixed cost</code>, per month. <code>cumulative cash = −setup + Σ net cash</code>.
        </li>
        <li>
          Payback is the first month whose cumulative cash is not negative. The fractional figure assumes uniform cash flow within
          that month. Zero setup means there is no initial investment to recover, and ongoing profitability is reported on its own.
          A negative month never cancels a later valid recovery.
        </li>
        <li>
          <code>cost per accepted completion = ongoing cash cost ÷ accepted completions</code>. The after figure reconciles to the
          cash ledger: labour cash − cash removed + new cash costs. Setup is disclosed separately, never folded in. Zero accepted
          completions makes the unit cost undefined.
        </li>
        <li>
          Future plan: from its start month, <code>hours covered = min(hours needed, retained capacity that month)</code>. A
          divisible expense avoids <code>budget × coverage</code>; an indivisible one avoids the budget only when coverage is
          complete. Nothing is allocated before the start month, and hours that already removed cash are never reused.
        </li>
      </ul>
      <h3>Rules the model enforces</h3>
      <ul>
        <li>A cash reduction cannot exceed the current labour cash expense it removes; such inputs are rejected, not clipped.</li>
        <li>The cash-sensitive share is bounded at 100%, so cash-reducing hours never exceed the hours actually freed.</li>
        <li>Attempts per accepted completion cannot be below one: accepted output can never exceed attempts.</li>
        <li>Blank, non-numeric, non-finite or out-of-range inputs are errors. Blank is never read as zero.</li>
        <li>An imported file is checked in full, including these relationships, before it replaces anything.</li>
      </ul>
      <h3>Limits</h3>
      <ul>
        <li>This is a model of the assumptions you enter. It has no data about your process and validates nothing.</li>
        <li>The cost boundary is the in-scope labour cash plus the incremental costs entered. It is not full enterprise cost accounting.</li>
        <li>No discounting, tax, inflation, price changes, volume growth or quality effects are modelled.</li>
        <li>Adoption is a workload fraction. It does not model learning curves, error rates changing over time, or churn.</li>
        <li>Retained capacity is a planning quantity. Whether it becomes anything useful is outside the model.</li>
        <li>The future plan is a conditional comparison against a plan you state. It infers no hiring probability and no headcount change. Separate build and maintenance commitments are not deducted automatically; the retained hours must still be available after those commitments.</li>
        <li>The three worked examples are fictional and illustrate mechanisms. They are not benchmarks.</li>
      </ul>
    </div>
  );
}

function ScenarioPanel(p: ScenarioPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <p class="prose">
        Scenarios live in this browser and in files you download. Nothing is sent anywhere. The file is plain JSON with a format
        marker and version, so you can keep it in your own notes or version control and load it back here later.
      </p>
      <div class="scenario-actions">
        <button type="button" class="btn btn--primary" onClick={p.onExport} disabled={!p.canExport} data-testid="export-button">
          Download scenario file
        </button>
        <button type="button" class="btn" onClick={() => fileRef.current?.click()} data-testid="import-button">
          Load a scenario file
        </button>
        <input
          ref={fileRef}
          id="import-file"
          class="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Choose a scenario file to load"
          onChange={(e) => {
            const input = e.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            if (file) p.onImportFile(file);
            input.value = '';
          }}
        />
        <button type="button" class="btn" onClick={p.onForget} data-testid="forget-button">
          Remove the saved copy from this browser
        </button>
      </div>
      {!p.canExport && <p class="status-line">Fix the highlighted inputs before downloading; the file only ever holds a valid scenario.</p>}
      <div aria-live="polite" data-testid="scenario-message">
        {p.message && (
          <div class="message" data-tone={p.message.tone} role={p.message.tone === 'error' ? 'alert' : undefined}>
            {p.message.text}
            {p.message.problems && p.message.problems.length > 0 && (
              <ul>
                {p.message.problems.slice(0, 12).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
                {p.message.problems.length > 12 && <li>…and {p.message.problems.length - 12} more.</li>}
              </ul>
            )}
          </div>
        )}
      </div>
      <p class="status-line" data-testid="storage-status">
        {p.storageStatus}
      </p>
      <p class="status-line">
        Storage detail: the scenario is written to this browser's local storage under the key <code class="mono">{STORAGE_KEY}</code>{' '}
        after every valid edit and read back on load. A private window or cleared site data removes it. Scenario data is never put
        into the page address.
      </p>
    </>
  );
}

export { ScenarioPanel, MonthlyTable, CalculationDetail };
