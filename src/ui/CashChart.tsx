import { useMemo, useState } from 'preact/hooks';
import { useElementWidth } from '../app/useElementWidth';
import { formatMoney, formatMoneyCompact, formatMonths, type Results } from '../model';
import { paybackText } from './ResultCards';

interface Point {
  month: number;
  x: number;
  y: number;
  cumulative: number;
  net: number;
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-9)));
  const candidates = [1, 2, 2.5, 5, 10].map((c) => c * magnitude);
  // Closest candidate in log terms, so a 10.5k rough step becomes 10k rather than 20k.
  return candidates.reduce((best, c) => (Math.abs(Math.log(c / rough)) < Math.abs(Math.log(best / rough)) ? c : best));
}

function ticksFor(min: number, max: number, target: number): number[] {
  if (max - min <= 0) return [0];
  const step = niceStep(max - min, target);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

const tone = (v: number) => (v >= -1e-9 ? 'positive' : 'negative');

export function CashChart({ results: r }: { results: Results }) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>(720);
  const [active, setActive] = useState<number | null>(null);
  const cur = r.scenario.currency;
  const horizon = r.scenario.horizonMonths;
  const narrow = width < 560;

  const layout = useMemo(() => {
    const left = narrow ? 48 : 60;
    const right = narrow ? 16 : 24;
    const top = 28;
    const topH = narrow ? 170 : 230;
    const gap = 34;
    const barH = narrow ? 56 : 72;
    const axisH = 26;
    const height = top + topH + gap + barH + axisH;
    const plotW = width - left - right;
    const cumulatives = [-r.setupCash, ...r.months.map((m) => m.cumulativeCash)];
    const nets = r.months.map((m) => m.netCash);
    const cMin = Math.min(0, ...cumulatives);
    const cMax = Math.max(0, ...cumulatives);
    const cTicks = ticksFor(cMin, cMax, narrow ? 3 : 4);
    const cLo = Math.min(cMin, cTicks[0] ?? 0);
    const cHi = Math.max(cMax, cTicks[cTicks.length - 1] ?? 0);
    const cRange = cHi - cLo || 1;
    const yTop = (v: number) => top + ((cHi - v) / cRange) * topH;
    const x = (month: number) => left + (month / horizon) * plotW;
    const points: Point[] = cumulatives.map((c, i) => ({
      month: i,
      x: x(i),
      y: yTop(c),
      cumulative: c,
      net: i === 0 ? -r.setupCash : (nets[i - 1] ?? 0),
    }));
    const nMin = Math.min(0, ...nets);
    const nMax = Math.max(0, ...nets);
    const nRange = nMax - nMin || 1;
    const barTop = top + topH + gap;
    const yBar = (v: number) => barTop + ((nMax - v) / nRange) * barH;
    const slot = plotW / horizon;
    const barW = Math.min(24, Math.max(4, slot * 0.6));
    const labelEvery = Math.max(1, Math.ceil(horizon / Math.max(2, Math.floor(plotW / 34))));
    return { left, right, top, topH, gap, barH, height, plotW, cTicks, yTop, x, points, yBar, barTop, slot, barW, labelEvery, zeroY: yTop(0), barZeroY: yBar(0) };
  }, [width, narrow, r, horizon]);

  const L = layout;
  const last = L.points[L.points.length - 1]!;
  const first = L.points[0]!;
  const payback = r.payback;
  const paybackMonth = payback.status === 'paid_back' ? payback.month : null;
  const linePath = L.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${last.x.toFixed(1)},${L.zeroY.toFixed(1)} L${first.x.toFixed(1)},${L.zeroY.toFixed(1)} Z`;
  const activePoint = active === null ? null : (L.points[active] ?? null);
  const describe = (p: Point) =>
    p.month === 0
      ? `Month 0: setup ${formatMoney(-r.setupCash, cur, { signed: true })}, cumulative ${formatMoney(p.cumulative, cur, { signed: true })}`
      : `Month ${p.month}: net ${formatMoney(p.net, cur, { signed: true })}, cumulative ${formatMoney(p.cumulative, cur, { signed: true })}`;
  const paybackInfo = paybackText(r);

  return (
    <section class="card chart-card" aria-labelledby="chart-heading">
      <div class="chart-card__head">
        <div>
          <h2 id="chart-heading">Cumulative cash, month 0 to {horizon}</h2>
          <p class="card__lead" style="margin-bottom:0">
            Setup cash lands at month 0. Monthly flows follow the adoption ramp. The bars beneath show each month on its own. The
            full figures are in the Month by month table.
          </p>
        </div>
        <ul class="legend" aria-label="Legend">
          <li>
            <i class="line" /> Cumulative cash
          </li>
          <li>
            <i style="background: var(--teal)" /> At or above zero
          </li>
          <li>
            <i style="background: var(--copper)" /> Below zero
          </li>
        </ul>
      </div>
      <div class="chart-frame" ref={frameRef}>
        <svg
          width={width}
          height={L.height}
          viewBox={`0 0 ${width} ${L.height}`}
          role="img"
          aria-label={`Cumulative cash from ${formatMoney(-r.setupCash, cur, { signed: true })} at month 0 to ${formatMoney(last.cumulative, cur, { signed: true })} at month ${horizon}. ${paybackInfo.headline}.`}
        >
          <defs>
            <clipPath id="clip-above">
              <rect x={0} y={0} width={width} height={Math.max(0, L.zeroY)} />
            </clipPath>
            <clipPath id="clip-below">
              <rect x={0} y={L.zeroY} width={width} height={Math.max(0, L.height - L.zeroY)} />
            </clipPath>
          </defs>

          {L.cTicks.map((t) => (
            <g key={`t${t}`}>
              <line class={t === 0 ? 'zero' : 'grid'} x1={L.left} x2={width - L.right} y1={L.yTop(t)} y2={L.yTop(t)} />
              <text class="axis" x={L.left - 8} y={L.yTop(t) + 4} text-anchor="end">
                {formatMoneyCompact(t, cur)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="var(--teal)" fill-opacity="0.12" clip-path="url(#clip-above)" />
          <path d={areaPath} fill="var(--copper)" fill-opacity="0.12" clip-path="url(#clip-below)" />

          {paybackMonth !== null && (
            <g>
              <line x1={L.x(paybackMonth)} x2={L.x(paybackMonth)} y1={L.top - 6} y2={L.top + L.topH} stroke="var(--teal)" stroke-width="1" />
              <text class="axis halo" x={L.x(paybackMonth) + 6} y={L.top - 10} style="fill: var(--teal-dark)">
                Payback · month {paybackMonth}
              </text>
            </g>
          )}

          <path d={linePath} fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

          {L.points.map((p) => (
            <circle
              key={`p${p.month}`}
              cx={p.x}
              cy={p.y}
              r={active === p.month ? 5.5 : 4}
              fill={p.cumulative >= -1e-9 ? 'var(--teal)' : 'var(--copper)'}
              stroke="var(--surface)"
              stroke-width="2"
            />
          ))}

          <text class="axis halo" x={first.x + 8} y={first.y + (first.y < L.zeroY ? -8 : 16)} style="fill: var(--ink-2)">
            Setup {formatMoney(-r.setupCash, cur)}
          </text>
          <text
            class="axis halo"
            x={last.x}
            y={last.y + (last.cumulative >= 0 ? -10 : 18)}
            text-anchor="end"
            style="fill: var(--ink); font-weight: 600"
          >
            {formatMoney(last.cumulative, cur, { signed: true })}
          </text>

          <text class="axis eyebrow" x={L.left} y={L.barTop - 12} style="fill: var(--ink-2); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase">
            Monthly net cash
          </text>
          <line class="zero" x1={L.left} x2={width - L.right} y1={L.barZeroY} y2={L.barZeroY} />
          {r.months.map((m) => {
            const cx = L.x(m.month) ;
            const y0 = L.barZeroY;
            const y1 = L.yBar(m.netCash);
            const h = Math.abs(y1 - y0);
            const rad = Math.min(4, h, L.barW / 2);
            const xL = cx - L.barW / 2;
            const xR = cx + L.barW / 2;
            const d =
              m.netCash >= 0
                ? `M${xL},${y0} L${xL},${y1 + rad} Q${xL},${y1} ${xL + rad},${y1} L${xR - rad},${y1} Q${xR},${y1} ${xR},${y1 + rad} L${xR},${y0} Z`
                : `M${xL},${y0} L${xL},${y1 - rad} Q${xL},${y1} ${xL + rad},${y1} L${xR - rad},${y1} Q${xR},${y1} ${xR},${y1 - rad} L${xR},${y0} Z`;
            return h < 0.5 ? null : <path key={`b${m.month}`} d={d} fill={m.netCash >= 0 ? 'var(--teal)' : 'var(--copper)'} />;
          })}

          {L.points.map((p) =>
            p.month % L.labelEvery === 0 || p.month === horizon ? (
              <text key={`x${p.month}`} class="axis" x={p.x} y={L.height - 8} text-anchor="middle">
                {p.month === 0 ? 'M0' : p.month}
              </text>
            ) : null,
          )}

          {L.points.map((p) => (
            <rect
              key={`h${p.month}`}
              class="hit"
              x={p.x - L.slot / 2}
              y={L.top - 6}
              width={L.slot}
              height={L.height - L.top - 20}
              tabIndex={0}
              role="img"
              aria-label={describe(p)}
              onMouseEnter={() => setActive(p.month)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(p.month)}
              onBlur={() => setActive(null)}
            />
          ))}
          {activePoint && (
            <line x1={activePoint.x} x2={activePoint.x} y1={L.top} y2={L.height - L.left / 2.5} stroke="var(--teal)" stroke-width="1" pointer-events="none" />
          )}
        </svg>
        {activePoint && (
          <div class="chart-tooltip" style={`left:${activePoint.x}px; top:${activePoint.y}px`} aria-hidden="true">
            <strong>{activePoint.month === 0 ? 'Month 0 (setup)' : `Month ${activePoint.month}`}</strong>
            {activePoint.month === 0 ? 'Setup' : 'Net'} {formatMoney(activePoint.net, cur, { signed: true })}
            <br />
            Cumulative {formatMoney(activePoint.cumulative, cur, { signed: true })}
          </div>
        )}
      </div>
      <p class="chart-readout" aria-live="polite" data-testid="chart-readout">
        {activePoint ? describe(activePoint) : 'Hover over or tab through the months to read each value.'}
      </p>
      <div class="stats">
        <div class="stat">
          <span class="eyebrow">Payback</span>
          <span class="stat__value" data-testid="payback-stat">
            {paybackInfo.headline}
          </span>
          <span class="stat__hint">{paybackInfo.detail}</span>
        </div>
        <div class="stat">
          <span class="eyebrow">Cumulative cash, month 12</span>
          <span class="stat__value" data-tone={tone(r.cumulativeYearOne)}>
            {formatMoney(r.cumulativeYearOne, cur, { signed: true })}
          </span>
          <span class="stat__hint">
            After setup cash of {formatMoney(r.setupCash, cur)}.
            {horizon > 12 && ` At month ${horizon}: ${formatMoney(r.cumulativeHorizon, cur, { signed: true })}.`}
          </span>
        </div>
        <div class="stat">
          <span class="eyebrow">Cash at full adoption</span>
          <span class="stat__value" data-tone={tone(r.steady.netCash)}>
            {formatMoney(r.steady.netCash, cur, { signed: true })} /mo
          </span>
          <span class="stat__hint">
            {r.scenario.adoptionRamp.length === 0
              ? 'Reached in month 1.'
              : (() => {
                  const idx = r.months.findIndex((m) => m.adoption >= 1 - 1e-9);
                  return idx >= 0 ? `Reached in month ${idx + 1}.` : `Full adoption is not reached within ${horizon} months.`;
                })()}
            {payback.status === 'paid_back' && ` Fractional payback ${formatMonths(payback.fractionalMonths, 2)}.`}
          </span>
        </div>
      </div>
    </section>
  );
}
