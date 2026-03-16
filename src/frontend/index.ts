import { createGame } from './game';
import { createStateBridge, LocalStorageAdapter } from './bridge';
import { createInitialState } from '../state/initial';
import { migrateState } from '../state/migrations';
import { calculateOfflineProgress } from '../time/offline';
import { GOLD_MULTIPLIER } from '../config/balance';
import type { StateBridge } from './bridge';
import type { GoldU } from '../types/state';
import type { GameState } from '../types';

// Re-export sprite keys for use in entities
export { SPRITE_KEYS } from './scenes/BootScene';

// Global bridge instance
let bridge: StateBridge | null = null;

// Offline progress result for toast display
let offlineProgress: { goldEarned: GoldU; secondsAway: number } | null = null;

/**
 * Get offline progress to display in toast notification.
 * Returns null if no offline progress or already consumed.
 */
export function consumeOfflineProgress(): { goldEarned: number; secondsAway: number } | null {
  const progress = offlineProgress;
  offlineProgress = null; // Consume after reading
  if (progress && progress.goldEarned > 0) {
    return {
      goldEarned: progress.goldEarned / GOLD_MULTIPLIER,
      secondsAway: progress.secondsAway,
    };
  }
  return null;
}

export function getBridge(): StateBridge {
  if (!bridge) {
    throw new Error('Bridge not initialized. Call initGame first.');
  }
  return bridge;
}

export function initGame(): void {
  const storage = new LocalStorageAdapter('tavern-tycoon-save');

  // Load or create initial state
  let state: GameState;
  const loadedState = storage.load();
  if (loadedState) {
    // Migrate if needed
    const migrationResult = migrateState(loadedState as unknown as Record<string, unknown>);
    if (migrationResult.error) {
      console.error('[Frontend] Migration error:', migrationResult.error);
    }
    state = migrationResult.state;

    // Apply offline progress
    state = applyOfflineProgress(state);
  } else {
    state = createInitialState(Date.now(), Math.floor(Math.random() * 1000000));
  }

  // Create bridge
  bridge = createStateBridge({
    initialState: state,
    storage,
    autoSaveInterval: 5000,
  });

  // Create Phaser game
  createGame('game-container');

  console.log('[Frontend] Game initialized');
}

function applyOfflineProgress(state: GameState): GameState {
  const now = Date.now();
  const lastSeen = state.meta.lastSeenAtMs;

  // Calculate total income from heroes
  const incomePerSecondU = Object.values(state.heroes.roster).reduce(
    (sum, hero) => sum + (hero.incomePerSecondU ?? 0),
    0
  ) as GoldU;

  // Calculate offline earnings
  const result = calculateOfflineProgress(now, lastSeen, incomePerSecondU);

  if (result.goldEarned > 0) {
    // Store for toast display
    const secondsAway = Math.floor((now - lastSeen) / 1000);
    offlineProgress = { goldEarned: result.goldEarned, secondsAway };

    // Log for debugging
    const displayGold = result.goldEarned / GOLD_MULTIPLIER;
    console.log(`[Frontend] Offline progress: +${displayGold.toFixed(1)} gold (${formatTime(secondsAway)})`);

    return {
      ...state,
      wallet: {
        ...state.wallet,
        gold: state.wallet.gold + result.goldEarned,
        lifetimeEarnedGold: state.wallet.lifetimeEarnedGold + result.goldEarned,
      },
    };
  }

  return state;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

// Auto-init when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initGame);
}
