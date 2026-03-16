import type { GameState } from '../../types';
import type { StorageAdapter } from './types';

/**
 * LocalStorage adapter for persisting game state.
 *
 * Uses a configurable key to store state as JSON in localStorage.
 * Handles JSON parse errors gracefully by returning null.
 */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly key: string) {}

  load(): GameState | null {
    try {
      const stored = localStorage.getItem(this.key);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return parsed as GameState;
    } catch (error) {
      // Return null on any parse errors
      return null;
    }
  }

  save(state: GameState): void {
    localStorage.setItem(this.key, JSON.stringify(state));
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }
}
