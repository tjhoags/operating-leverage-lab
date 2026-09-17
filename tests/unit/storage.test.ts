import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, clearStored, loadStored, saveStored, type StorageLike } from '../../src/app/storage';
import { scenario } from './helpers';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

describe('browser storage adapter', () => {
  it('reports unavailable storage and empty storage distinctly', () => {
    expect(loadStored(null)).toEqual({ status: 'unavailable' });
    expect(loadStored(new MemoryStorage())).toEqual({ status: 'empty' });
    expect(saveStored(null, null, scenario()).ok).toBe(false);
  });

  it('saves, reads back and clears a scenario', () => {
    const storage = new MemoryStorage();
    const saved = saveStored(storage, 'fixed-payroll', scenario({ name: 'Kept' }), new Date('2026-03-04T05:06:07Z'));
    expect(saved).toEqual({ ok: true, savedAt: '2026-03-04T05:06:07.000Z' });
    const loaded = loadStored(storage);
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.state.scenario.name).toBe('Kept');
      expect(loaded.state.presetId).toBe('fixed-payroll');
    }
    clearStored(storage);
    expect(loadStored(storage)).toEqual({ status: 'empty' });
  });

  it('treats corrupt or invalid stored data as invalid rather than loading it', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{oops');
    expect(loadStored(storage).status).toBe('invalid');
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, scenario: { ...scenario(), setupCash: -1 } }));
    const invalid = loadStored(storage);
    expect(invalid.status).toBe('invalid');
    if (invalid.status === 'invalid') expect(invalid.problems[0]).toMatch(/setupCash/);
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 9, scenario: scenario() }));
    expect(loadStored(storage).status).toBe('invalid');
  });

  it('reports a failed write honestly', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const result = saveStored(storage, null, scenario());
    expect(result).toEqual({ ok: false, reason: 'QuotaExceededError' });
  });
});


describe('storage failure verification', () => {
  it('rejects a stale non-null readback after a save', () => {
    const storage = new MemoryStorage();
    storage.map.set(STORAGE_KEY, 'old saved copy');
    storage.setItem = () => {};
    expect(saveStored(storage, null, scenario()).ok).toBe(false);
  });
  it('never confirms deletion when removal or readback is unavailable', () => {
    expect(clearStored(null).ok).toBe(false);
    const storage = new MemoryStorage();
    storage.map.set(STORAGE_KEY, 'saved copy');
    storage.removeItem = () => { throw new Error('SecurityError'); };
    expect(clearStored(storage).ok).toBe(false);
    expect(storage.map.get(STORAGE_KEY)).toBe('saved copy');
    storage.removeItem = () => {};
    expect(clearStored(storage).ok).toBe(false);
    storage.getItem = () => { throw new Error('SecurityError'); };
    expect(clearStored(storage).ok).toBe(false);
  });
});
