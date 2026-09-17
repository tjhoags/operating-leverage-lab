import { useMemo } from 'preact/hooks';
import { PRESETS, compute, formatHours, formatMoney, type Payback, type Results } from '../model';

function paybackLine(r: Results): string {
  const p: Payback = r.payback;
  if (p.status === 'paid_back') return `Payback in month ${p.month}`;
  if (p.status === 'no_investment') return 'No setup cash to recover';
  return `No payback in ${r.scenario.horizonMonths} months`;
}

interface Props {
  activePresetId: string;
  isCustom: boolean;
  onSelect: (id: string) => void;
}

export function PresetCards({ activePresetId, isCustom, onSelect }: Props) {
  const computed = useMemo(() => PRESETS.map((p) => ({ preset: p, results: compute(p.scenario) })), []);
  return (
    <section aria-labelledby="presets-heading">
      <div class="section-heading">
        <h2 id="presets-heading" class="eyebrow">
          Start from a worked example
        </h2>
        <p>Three fictional scenarios. Change any input and the scenario becomes yours.</p>
      </div>
      <div class="presets" role="group" aria-label="Fictional example scenarios">
        {computed.map(({ preset, results }, index) => {
          const active = preset.id === activePresetId;
          return (
            <button
              key={preset.id}
              type="button"
              class="preset"
              aria-pressed={active}
              data-preset={preset.id}
              onClick={() => onSelect(preset.id)}
            >
              <span class="eyebrow">Example {index + 1}</span>
              <span class="preset__title">{preset.title}</span>
              <span class="preset__blurb">{preset.blurb}</span>
              <span class="preset__result">
                <span>
                  {formatMoney(results.steady.netCash, results.scenario.currency, { signed: true })} per month at full adoption ·{' '}
                  {formatHours(results.steady.hoursFreed, 0, true)}
                </span>
                {paybackLine(results)}
              </span>
              {active && isCustom && <span class="preset__custom">Edited: your inputs now differ from this example.</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
