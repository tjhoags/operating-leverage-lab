import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_PRESET_ID,
  PRESETS,
  compute,
  parseDraft,
  parseScenarioFile,
  presetById,
  serializeScenario,
  suggestedFileName,
  toDraft,
  type NumericKey,
  type PlanNumericKey,
  type Scenario,
  type ScenarioDraft,
} from '../model';
import { AssumptionsForm } from '../ui/AssumptionsForm';
import { CashChart } from '../ui/CashChart';
import { CostCards } from '../ui/CostCards';
import { DetailTabs, type ScenarioMessage } from '../ui/DetailTabs';
import { Footer } from '../ui/Footer';
import { Header } from '../ui/Header';
import { PresetCards } from '../ui/PresetCards';
import { ResultCards } from '../ui/ResultCards';
import { clearStored, getLocalStorage, loadStored, saveStored, type StorageLike } from './storage';

interface SaveState {
  tone: 'ok' | 'error' | 'info';
  text: string;
}

function canonical(s: Scenario): string {
  return JSON.stringify(s, Object.keys(s).sort().concat(Object.keys(s.futurePlan).sort()));
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface InitialState {
  presetId: string;
  scenario: Scenario;
  save: SaveState;
  storageNote: string;
}

function initialState(storage: StorageLike | null): InitialState {
  const fallback = presetById(DEFAULT_PRESET_ID)!;
  const loaded = loadStored(storage);
  if (loaded.status === 'loaded') {
    const preset = loaded.state.presetId ? presetById(loaded.state.presetId) : undefined;
    return {
      presetId: preset ? preset.id : fallback.id,
      scenario: loaded.state.scenario,
      save: { tone: 'ok', text: `Restored the scenario saved in this browser${loaded.state.savedAt ? ` at ${timeLabel(loaded.state.savedAt)}` : ''}.` },
      storageNote: 'A saved scenario was found in this browser and restored on load.',
    };
  }
  if (loaded.status === 'unavailable') {
    return {
      presetId: fallback.id,
      scenario: fallback.scenario,
      save: { tone: 'error', text: 'Browser storage is unavailable here. Edits will not survive a reload; download a file to keep them.' },
      storageNote: 'Browser storage is unavailable in this session.',
    };
  }
  if (loaded.status === 'invalid') {
    return {
      presetId: fallback.id,
      scenario: fallback.scenario,
      save: { tone: 'error', text: 'The scenario saved in this browser was invalid and was ignored. Loaded the default example instead.' },
      storageNote: `Ignored an invalid saved scenario: ${loaded.problems[0] ?? 'unknown problem'}`,
    };
  }
  return {
    presetId: fallback.id,
    scenario: fallback.scenario,
    save: { tone: 'info', text: 'Not saved yet. Valid edits are saved in this browser automatically.' },
    storageNote: 'Nothing saved in this browser yet.',
  };
}

export function App() {
  const storage = useMemo(() => getLocalStorage(), []);
  const initial = useMemo(() => initialState(storage), [storage]);
  const [basePresetId, setBasePresetId] = useState(initial.presetId);
  const [draft, setDraft] = useState<ScenarioDraft>(() => toDraft(initial.scenario));
  const [lastValid, setLastValid] = useState<Scenario>(initial.scenario);
  const [save, setSave] = useState<SaveState>(initial.save);
  const [storageNote, setStorageNote] = useState(initial.storageNote);
  const [message, setMessage] = useState<ScenarioMessage | null>(null);
  const [planOpen, setPlanOpen] = useState(initial.scenario.futurePlan.enabled);
  const mounted = useRef(false);
  const skipNextSave = useRef(false);

  const parsed = useMemo(() => parseDraft(draft), [draft]);
  const errorCount = Object.keys(parsed.errors).length;
  const basePreset = presetById(basePresetId) ?? PRESETS[0]!;
  const isCustom = parsed.ok ? canonical(parsed.scenario) !== canonical(basePreset.scenario) : true;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!parsed.ok) {
      setSave({
        tone: 'error',
        text: `Not saved: fix ${errorCount} input${errorCount === 1 ? '' : 's'}. Results show the last valid scenario.`,
      });
      return;
    }
    setLastValid(parsed.scenario);
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const result = saveStored(storage, isCustom ? null : basePresetId, parsed.scenario);
    if (result.ok) {
      setSave({ tone: 'ok', text: `Saved in this browser at ${timeLabel(result.savedAt)}.` });
      setStorageNote(`Last saved at ${timeLabel(result.savedAt)}.`);
    } else {
      setSave({ tone: 'error', text: `Could not save in this browser: ${result.reason}` });
    }
  }, [parsed, storage, basePresetId, isCustom, errorCount]);

  const results = useMemo(() => compute(lastValid), [lastValid]);

  const selectPreset = useCallback((id: string) => {
    const preset = presetById(id);
    if (!preset) return;
    setBasePresetId(id);
    setDraft(toDraft(preset.scenario));
    setPlanOpen(preset.scenario.futurePlan.enabled);
    setMessage(null);
  }, []);

  const onNumber = (key: NumericKey, value: string) => setDraft((d) => ({ ...d, numbers: { ...d.numbers, [key]: value } }));
  const onPlanNumber = (key: PlanNumericKey, value: string) =>
    setDraft((d) => ({ ...d, futurePlan: { ...d.futurePlan, numbers: { ...d.futurePlan.numbers, [key]: value } } }));
  const onText = (key: 'name' | 'currency' | 'adoptionRamp', value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const onPlanFlag = (key: 'enabled' | 'divisible', value: boolean) =>
    setDraft((d) => ({ ...d, futurePlan: { ...d.futurePlan, [key]: value } }));

  const addPlan = () => {
    setPlanOpen(true);
    setDraft((d) => ({ ...d, futurePlan: { ...d.futurePlan, enabled: true } }));
    requestAnimationFrame(() => {
      document.getElementById('futurePlan.startMonth')?.focus();
    });
  };

  const onReset = () => {
    selectPreset(basePresetId);
    setMessage({ tone: 'info', text: `Reset to the ${basePreset.title} example.` });
  };

  const onExport = () => {
    if (!parsed.ok) {
      setMessage({ tone: 'error', text: 'Fix the highlighted inputs before downloading.' });
      return;
    }
    const text = serializeScenario(parsed.scenario, isCustom ? null : basePresetId);
    const name = suggestedFileName(parsed.scenario);
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ tone: 'success', text: `Download started: ${name}. Check your browser's download list to confirm it saved.` });
    } catch (error) {
      setMessage({ tone: 'error', text: `Could not start the download: ${error instanceof Error ? error.message : 'unknown error'}` });
    }
  };

  const onImportFile = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage({ tone: 'error', text: `Could not read ${file.name}. The current scenario is unchanged.` });
      return;
    }
    const result = parseScenarioFile(text);
    if (!result.ok) {
      setMessage({
        tone: 'error',
        text: `${file.name} was not loaded. The current scenario is unchanged. Problems found:`,
        problems: result.problems,
      });
      return;
    }
    const preset = result.presetId ? presetById(result.presetId) : undefined;
    if (preset) setBasePresetId(preset.id);
    setDraft(toDraft(result.scenario));
    setPlanOpen(result.scenario.futurePlan.enabled);
    setMessage({ tone: 'success', text: `Loaded "${result.scenario.name || 'unnamed scenario'}" from ${file.name}.` });
  };

  const onForget = () => {
    const cleared = clearStored(storage);
    if (cleared.ok) {
      skipNextSave.current = true;
      const preset = presetById(DEFAULT_PRESET_ID)!;
      setBasePresetId(preset.id);
      setDraft(toDraft(preset.scenario));
      setPlanOpen(false);
      setSave({ tone: 'info', text: 'Saved copy removed. The next valid edit saves again.' });
      setStorageNote('Nothing saved in this browser now.');
      setMessage({ tone: 'info', text: 'Removed the saved scenario from this browser and loaded the default example.' });
    } else {
      setMessage({ tone: 'error', text: `Could not verify removal: ${cleared.reason} Your current scenario is unchanged.` });
    }
  };

  return (
    <div class="page">
      <a class="skip-link" href="#results">
        Skip to results
      </a>
      <Header />
      <main>
        <PresetCards activePresetId={basePresetId} isCustom={isCustom} onSelect={selectPreset} />
        <div class="workspace">
          <AssumptionsForm
            draft={draft}
            errors={parsed.errors}
            lastValid={lastValid}
            presetTitle={basePreset.title}
            saveStatus={save.text}
            saveTone={save.tone}
            onNumber={onNumber}
            onPlanNumber={onPlanNumber}
            onText={onText}
            onPlanFlag={onPlanFlag}
            onReset={onReset}
            planOpen={planOpen}
            onPlanOpenChange={setPlanOpen}
          />
          <div class="results" id="results" data-stale={parsed.ok ? 'false' : 'true'} tabIndex={-1}>
            {!parsed.ok && (
              <p class="stale-banner" role="status" data-testid="stale-banner">
                Results show the last valid scenario. Fix {errorCount} highlighted input{errorCount === 1 ? '' : 's'} to update them.
              </p>
            )}
            <ResultCards results={results} onAddPlan={addPlan} />
            <p class="separate-note">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M3 8h10M8 3v10" stroke="var(--copper)" stroke-width="2" />
                <path d="M2 2l12 12" stroke="var(--copper)" stroke-width="2" />
              </svg>
              <span>
                Three separate measurements in three different units. They are not additive: adding them would count the same freed
                hour twice.
              </span>
            </p>
            <CashChart results={results} />
            <CostCards results={results} />
          </div>
        </div>
        <DetailTabs
          results={results}
          scenarioPanel={{
            message,
            storageStatus: storageNote,
            canExport: parsed.ok,
            onExport,
            onImportFile,
            onForget,
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
