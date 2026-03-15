import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageAdapter } from '../../../../src/frontend/bridge/storage';
import { createInitialState } from '../../../../src/state/initial';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Set global localStorage mock
(global as any).localStorage = localStorageMock;

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  const testKey = 'tavern-tycoon-test';

  beforeEach(() => {
    adapter = new LocalStorageAdapter(testKey);
    // Clear localStorage before each test
    localStorageMock.clear();
    // Clear mock call history
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('load', () => {
    it('returns null when no saved state exists', () => {
      const result = adapter.load();
      expect(result).toBeNull();
    });

    it('loads state from localStorage', () => {
      const state = createInitialState(Date.now(), 12345);
      localStorage.setItem(testKey, JSON.stringify(state));

      const result = adapter.load();
      expect(result).not.toBeNull();
      expect(result?.meta.rootSeed).toBe(12345);
    });

    it('returns null on JSON parse errors', () => {
      localStorage.setItem(testKey, 'invalid-json{');

      const result = adapter.load();
      expect(result).toBeNull();
    });

    it('uses configured storage key', () => {
      const customKey = 'custom-key';
      const customAdapter = new LocalStorageAdapter(customKey);
      const state = createInitialState(Date.now(), 99999);
      localStorage.setItem(customKey, JSON.stringify(state));

      const result = customAdapter.load();
      expect(result?.meta.rootSeed).toBe(99999);
    });
  });

  describe('save', () => {
    it('saves state to localStorage', () => {
      const state = createInitialState(Date.now(), 54321);
      adapter.save(state);

      const saved = JSON.parse(localStorage.getItem(testKey) || '{}');
      expect(saved.meta.rootSeed).toBe(54321);
    });

    it('overwrites existing saved state', () => {
      const state1 = createInitialState(Date.now(), 11111);
      const state2 = createInitialState(Date.now(), 22222);

      adapter.save(state1);
      adapter.save(state2);

      const saved = JSON.parse(localStorage.getItem(testKey) || '{}');
      expect(saved.meta.rootSeed).toBe(22222);
    });
  });

  describe('clear', () => {
    it('removes saved state from localStorage', () => {
      const state = createInitialState(Date.now(), 12345);
      adapter.save(state);

      adapter.clear();

      expect(localStorage.getItem(testKey)).toBeNull();
    });

    it('does not throw when clearing non-existent state', () => {
      expect(() => adapter.clear()).not.toThrow();
    });
  });
});
