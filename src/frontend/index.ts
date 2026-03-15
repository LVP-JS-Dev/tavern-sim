import { createGame } from './game';
import { createStateBridge, LocalStorageAdapter } from './bridge';
import { createInitialState } from '../state/initial';
import { migrateState } from '../state/migrations';
import { calculateOfflineProgress } from '../time/offline';
import type { StateBridge } from './bridge';
import type { GoldU } from '../types/state';
import type { GameState } from '../types';

// Re-export sprite keys for use in entities
export { SPRITE_KEYS } from './scenes/BootScene';

// Global bridge instance
let bridge: StateBridge | null = null;

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
    console.log(`[Frontend] Offline progress: +${result.goldEarned} gold`);

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

// Auto-init when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initGame);
}
