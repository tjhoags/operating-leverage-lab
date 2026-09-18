import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, parseScenarioFile, serializeScenario, suggestedFileName } from '../../src/model';
import { scenario } from './helpers';

describe('scenario files', () => {
  it('round-trips a scenario through the versioned file format', () => {
    const original = scenario({ name: 'Round trip', adoptionRamp: [0.25, 0.5, 1] }, { enabled: true, hoursPerMonth: 80, budgetPerMonth: 3200, startMonth: 4 });
    const text = serializeScenario(original, 'contractor-ramped', new Date('2026-01-02T03:04:05Z'));
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe(EXPORT_FORMAT);
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe('2026-01-02T03:04:05.000Z');
    const result = parseScenarioFile(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario).toEqual(original);
      expect(result.presetId).toBe('contractor-ramped');
    }
  });

  it('rejects malformed JSON, wrong formats and wrong versions', () => {
    const notJson = parseScenarioFile('{not json');
    expect(notJson.ok).toBe(false);
    if (!notJson.ok) expect(notJson.problems[0]).toMatch(/Not valid JSON/);
    const array = parseScenarioFile('[1,2,3]');
    expect(array.ok).toBe(false);
    const wrongFormat = parseScenarioFile(JSON.stringify({ format: 'other', version: 1, scenario: scenario() }));
    expect(wrongFormat.ok).toBe(false);
    if (!wrongFormat.ok) expect(wrongFormat.problems[0]).toMatch(/format must be/);
    const wrongVersion = parseScenarioFile(JSON.stringify({ format: EXPORT_FORMAT, version: 2, scenario: scenario() }));
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) expect(wrongVersion.problems[0]).toMatch(/version must be 1/);
  });

  it('rejects economically invalid but syntactically valid files', () => {
    const file = JSON.stringify({ format: EXPORT_FORMAT, version: 1, scenario: scenario({ cashRatePerHour: 500 }) });
    const result = parseScenarioFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatch(/cashRatePerHour: This removes/);
  });

  it('rejects oversized files before parsing', () => {
    const result = parseScenarioFile(' '.repeat(300 * 1024));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatch(/larger than 256 KB/);
  });

  it('suggests a safe file name', () => {
    expect(suggestedFileName(scenario({ name: 'Fixed payroll (fictional example)' }), new Date('2026-05-06T00:00:00Z'))).toBe(
      'fixed-payroll-fictional-example-2026-05-06.olab.json',
    );
    expect(suggestedFileName(scenario({ name: '' }), new Date('2026-05-06T00:00:00Z'))).toBe('scenario-2026-05-06.olab.json');
  });
});
