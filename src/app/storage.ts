import { SCENARIO_SCHEMA_VERSION, type Scenario, validateScenarioObject } from '../model';

export const STORAGE_KEY = 'operating-leverage-lab.scenario.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredState {
  version: typeof SCENARIO_SCHEMA_VERSION;
  presetId: string | null;
  scenario: Scenario;
  savedAt: string;
}

export type LoadResult =
  | { status: 'loaded'; state: StoredState }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'invalid'; problems: string[] };

/** Returns window.localStorage only if it can actually be written to. */
export function getLocalStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function loadStored(storage: StorageLike | null): LoadResult {
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', problems: ['Stored scenario is not valid JSON.'] };
  }
  if (typeof parsed !== 'object' || parsed === null) return { status: 'invalid', problems: ['Stored scenario is not an object.'] };
  const record = parsed as Record<string, unknown>;
  if (record.version !== SCENARIO_SCHEMA_VERSION) {
    return { status: 'invalid', problems: [`Stored version ${JSON.stringify(record.version)} is not supported.`] };
  }
  const validated = validateScenarioObject(record.scenario);
  if (!validated.ok) return { status: 'invalid', problems: validated.problems };
  return {
    status: 'loaded',
    state: {
      version: SCENARIO_SCHEMA_VERSION,
      presetId: typeof record.presetId === 'string' ? record.presetId : null,
      scenario: validated.scenario,
      savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
    },
  };
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; reason: string };

export function saveStored(
  storage: StorageLike | null,
  presetId: string | null,
  scenario: Scenario,
  now: Date = new Date(),
): SaveResult {
  if (!storage) return { ok: false, reason: 'Browser storage is unavailable.' };
  const state: StoredState = { version: SCENARIO_SCHEMA_VERSION, presetId, scenario, savedAt: now.toISOString() };
  try {
    const serialized = JSON.stringify(state);
    storage.setItem(STORAGE_KEY, serialized);
    // Read back so the reported status reflects what the browser actually kept.
    const readBack = storage.getItem(STORAGE_KEY);
    if (readBack !== serialized) return { ok: false, reason: 'The browser did not keep the saved scenario.' };
    return { ok: true, savedAt: state.savedAt };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Browser storage rejected the write.' };
  }
}

export type ClearResult = { ok: true } | { ok: false; reason: string };

export function clearStored(storage: StorageLike | null): ClearResult {
  if (!storage) return { ok: false, reason: 'Browser storage is unavailable; deletion cannot be verified.' };
  try {
    storage.removeItem(STORAGE_KEY);
    if (storage.getItem(STORAGE_KEY) !== null) {
      return { ok: false, reason: 'The browser still contains the saved scenario.' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Deletion could not be verified.' };
  }
}
