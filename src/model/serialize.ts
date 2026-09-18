import type { Scenario } from './types';
import { validateScenarioObject } from './validate';

export const EXPORT_FORMAT = 'operating-leverage-lab-scenario' as const;
export const EXPORT_VERSION = 1 as const;
export const MAX_IMPORT_BYTES = 256 * 1024;

export interface ScenarioFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  presetId: string | null;
  scenario: Scenario;
}

export function serializeScenario(scenario: Scenario, presetId: string | null, now: Date = new Date()): string {
  const file: ScenarioFile = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    presetId,
    scenario,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type ImportResult =
  | { ok: true; scenario: Scenario; presetId: string | null }
  | { ok: false; problems: string[] };

/**
 * Parse an untrusted scenario file. The result is either a fully validated
 * scenario or a list of problems; a caller never receives a partial scenario.
 */
export function parseScenarioFile(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, problems: [`File is larger than ${MAX_IMPORT_BYTES / 1024} KB.`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, problems: [`Not valid JSON: ${error instanceof Error ? error.message : 'parse error'}.`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, problems: ['The file must contain a JSON object.'] };
  }
  const file = parsed as Record<string, unknown>;
  const problems: string[] = [];
  if (file.format !== EXPORT_FORMAT) {
    problems.push(`format must be "${EXPORT_FORMAT}"; found ${JSON.stringify(file.format)}.`);
  }
  if (file.version !== EXPORT_VERSION) {
    problems.push(`version must be ${EXPORT_VERSION}; found ${JSON.stringify(file.version)}.`);
  }
  if (problems.length > 0) return { ok: false, problems };
  const validated = validateScenarioObject(file.scenario);
  if (!validated.ok) return validated;
  const presetId = typeof file.presetId === 'string' && file.presetId.length <= 64 ? file.presetId : null;
  return { ok: true, scenario: validated.scenario, presetId };
}

export function suggestedFileName(scenario: Scenario, now: Date = new Date()): string {
  const slug = scenario.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const date = now.toISOString().slice(0, 10);
  return `${slug || 'scenario'}-${date}.olab.json`;
}
