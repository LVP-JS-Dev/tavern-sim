# Frontend Phaser 3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phaser 3 frontend to visualize the tavern simulation with minimal 2D graphics, State Bridge pattern, and browser/LocalStorage deployment.

**Architecture:** In-process architecture where Phaser connects to simulation core via State Bridge. Frontend subscribes to state changes and dispatches user actions. Platform-agnostic design with LocalStorage adapter.

**Tech Stack:** Phaser 3, Vite, TypeScript, LocalStorage

**Spec:** `docs/superpowers/specs/2026-03-15-frontend-phaser-design.md`

---

## File Structure Overview

```
src/frontend/
├── index.ts              # Game entry point
├── config.ts             # Constants (canvas size, tick rate, etc.)
├── bridge/
│   ├── index.ts          # Bridge exports
│   ├── types.ts          # Bridge interfaces
│   ├── StateBridge.ts    # Core bridge implementation
│   └── storage.ts        # LocalStorage adapter
├── scenes/
│   ├── BootScene.ts      # Asset loading
│   ├── TavernScene.ts    # Main game view
│   └── HUDScene.ts       # UI overlay
├── entities/
│   ├── Table.ts          # Table + chairs
│   ├── Visitor.ts        # NPC with movement
│   └── Hero.ts           # Hero sprite
├── ui/
│   └── GoldDisplay.ts    # Gold counter
└── renderer/
    └── TavernRenderer.ts # Floor, decorations

public/
├── index.html
└── assets/sprites/       # Copied from pre_assets
```

---

## Chunk 1: Build Setup & Dependencies

Foundation layer: Vite config, Phaser dependency, public files.

### Task 1.1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Phaser and Vite dependencies**

```bash
npm install phaser
npm install -D vite
```

- [ ] **Step 2: Add npm scripts for frontend**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev:web": "vite",
    "build:web": "vite build",
    "preview:web": "vite preview"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Phaser 3 and Vite dependencies"
```

---

### Task 1.2: Vite Configuration

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1: Create Vite config**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add Vite configuration for frontend build"
```

---

### Task 1.3: Public Files

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Create HTML entry point**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Tavern Tycoon</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a2e;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
    }
    #game-container {
      width: 375px;
      height: 667px;
    }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script type="module" src="/src/frontend/index.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: add HTML entry point for frontend"
```

---

### Task 1.4: Frontend Config

**Files:**
- Create: `src/frontend/config.ts`

- [ ] **Step 1: Create frontend config**

```typescript
// src/frontend/config.ts
/** Canvas dimensions (mobile-first) */
export const CANVAS_WIDTH = 375;
export const CANVAS_HEIGHT = 667;

/** Game tick interval in ms (matches simulation TICK_MS) */
export const TICK_MS = 40;

/** Tile size in pixels */
export const TILE_SIZE = 32;

/** Z-index layers for depth sorting */
export const LAYERS = {
  FLOOR: 0,
  TABLES: 10,
  VISITORS: 20,
  HEROES: 30,
  HUD: 100,
} as const;

/** HUD bar height */
export const HUD_HEIGHT = 60;

/** Action bar height */
export const ACTION_BAR_HEIGHT = 60;

/** Tavern play area */
export const TAVERN_AREA = {
  x: 0,
  y: HUD_HEIGHT,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT - HUD_HEIGHT - ACTION_BAR_HEIGHT,
} as const;

/** Asset paths */
export const ASSETS = {
  SPRITES: 'assets/sprites',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/config.ts
git commit -m "feat: add frontend config constants"
```

---

## Chunk 2: State Bridge

Core communication layer between Phaser and simulation.

### Task 2.1: Bridge Types

**Files:**
- Create: `src/frontend/bridge/types.ts`

- [ ] **Step 1: Create bridge type definitions**

```typescript
// src/frontend/bridge/types.ts
import type { GameState, DomainEvent } from '../../types';
import type { Action } from '../../types/actions';

/**
 * State Bridge interface for connecting Phaser to simulation.
 *
 * The bridge provides:
 * - State subscription for reactive updates
 * - Event subscription for toasts/VFX triggers
 * - Action dispatch for user interactions
 * - Manual tick control for testing
 */
export interface StateBridge {
  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(fn: (state: GameState) => void): () => void;

  /** Subscribe to domain events (for toasts, VFX triggers). */
  subscribeToEvents(fn: (event: DomainEvent) => void): () => void;

  /** Dispatch user action to be processed immediately. */
  dispatch(action: Action): void;

  /** Get current state snapshot. */
  getState(): GameState;

  /** Force advance simulation by one tick. */
  tick(): void;
}

/**
 * Storage adapter interface for persistence.
 * Allows platform-specific implementations (LocalStorage, Telegram CloudStorage, etc.)
 */
export interface StorageAdapter {
  /** Load saved state, returns null if not found */
  load(): GameState | null;

  /** Save current state */
  save(state: GameState): void;

  /** Clear saved state */
  clear(): void;
}

/**
 * Bridge configuration options.
 */
export interface BridgeConfig {
  /** Initial state (from storage or fresh) */
  initialState: GameState;

  /** Storage adapter for persistence */
  storage: StorageAdapter;

  /** Auto-save interval in ms (default: 5000) */
  autoSaveInterval?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/bridge/types.ts
git commit -m "feat: add State Bridge type definitions"
```

---

### Task 2.2: LocalStorage Adapter

**Files:**
- Create: `src/frontend/bridge/storage.ts`
- Create: `tests/unit/frontend/bridge/storage.test.ts`

- [ ] **Step 1: Write failing test for LocalStorage adapter**

```typescript
// tests/unit/frontend/bridge/storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageAdapter } from '../../../../src/frontend/bridge/storage';
import type { GameState } from '../../../../src/types';
import { createInitialState } from '../../../../src/state/initial';

describe('LocalStorageAdapter', () => {
  const STORAGE_KEY = 'tavern-tycoon-save';
  let adapter: LocalStorageAdapter;
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
      get length() { return Object.keys(mockStorage).length; },
      key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    });
    adapter = new LocalStorageAdapter(STORAGE_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('returns null when no save exists', () => {
      expect(adapter.load()).toBeNull();
    });

    it('returns parsed state when save exists', () => {
      const state = createInitialState(Date.now(), 12345);
      mockStorage[STORAGE_KEY] = JSON.stringify(state);

      const loaded = adapter.load();
      expect(loaded).not.toBeNull();
      expect(loaded?.meta.rootSeed).toBe(12345);
    });

    it('returns null on corrupt JSON', () => {
      mockStorage[STORAGE_KEY] = 'not valid json';
      expect(adapter.load()).toBeNull();
    });
  });

  describe('save', () => {
    it('saves state as JSON', () => {
      const state = createInitialState(Date.now(), 99999);
      adapter.save(state);

      const saved = JSON.parse(mockStorage[STORAGE_KEY]);
      expect(saved.meta.rootSeed).toBe(99999);
    });
  });

  describe('clear', () => {
    it('removes saved state', () => {
      mockStorage[STORAGE_KEY] = '{}';
      adapter.clear();
      expect(mockStorage[STORAGE_KEY]).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/frontend/bridge/storage.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement LocalStorage adapter**

```typescript
// src/frontend/bridge/storage.ts
import type { GameState, StorageAdapter } from './types';

/**
 * LocalStorage-based persistence adapter.
 * Used for browser deployments. For Telegram, use TelegramCloudStorageAdapter.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly key: string;

  constructor(key: string = 'tavern-tycoon-save') {
    this.key = key;
  }

  load(): GameState | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;

      const state = JSON.parse(raw) as GameState;
      return state;
    } catch (error) {
      console.error('[LocalStorageAdapter] Failed to load save:', error);
      return null;
    }
  }

  save(state: GameState): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch (error) {
      console.error('[LocalStorageAdapter] Failed to save:', error);
    }
  }

  clear(): void {
    localStorage.removeItem(this.key);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/frontend/bridge/storage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/frontend/bridge/storage.ts tests/unit/frontend/bridge/storage.test.ts
git commit -m "feat: add LocalStorage adapter for state persistence"
```

---

### Task 2.3: State Bridge Implementation

**Files:**
- Create: `src/frontend/bridge/StateBridge.ts`
- Create: `tests/unit/frontend/bridge/StateBridge.test.ts`

- [ ] **Step 1: Write failing tests for StateBridge**

```typescript
// tests/unit/frontend/bridge/StateBridge.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStateBridge } from '../../../../src/frontend/bridge/StateBridge';
import type { GameState, StorageAdapter } from '../../../../src/frontend/bridge/types';
import { createInitialState } from '../../../../src/state/initial';

describe('StateBridge', () => {
  let mockStorage: StorageAdapter;
  let initialState: GameState;

  beforeEach(() => {
    initialState = createInitialState(Date.now(), 12345);
    mockStorage = {
      load: vi.fn(() => null),
      save: vi.fn(),
      clear: vi.fn(),
    };
  });

  describe('subscribe', () => {
    it('notifies subscribers on state change', () => {
      const bridge = createStateBridge({ initialState, storage: mockStorage });
      const listener = vi.fn();

      bridge.subscribe(listener);
      bridge.tick();

      expect(listener).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const bridge = createStateBridge({ initialState, storage: mockStorage });
      const listener = vi.fn();

      const unsub = bridge.subscribe(listener);
      unsub();
      bridge.tick();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('returns current state', () => {
      const bridge = createStateBridge({ initialState, storage: mockStorage });

      const state = bridge.getState();

      expect(state.meta.rootSeed).toBe(12345);
    });
  });

  describe('tick', () => {
    it('advances simulation by one tick', () => {
      const bridge = createStateBridge({ initialState, storage: mockStorage });
      const before = bridge.getState().time.lastTickAtMs;

      bridge.tick();

      const after = bridge.getState().time.lastTickAtMs;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe('auto-save', () => {
    it('saves state periodically', async () => {
      vi.useFakeTimers();

      const bridge = createStateBridge({
        initialState,
        storage: mockStorage,
        autoSaveInterval: 1000,
      });

      vi.advanceTimersByTime(1000);

      expect(mockStorage.save).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/frontend/bridge/StateBridge.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement StateBridge**

```typescript
// src/frontend/bridge/StateBridge.ts
import type { GameState, DomainEvent, StateBridge, BridgeConfig } from './types';
import { SeededRng } from '../../core/rng/service';
import { createTickPipeline } from '../../domain/pipeline';
import { directorPlugin, heroesPlugin, adventuresPlugin, worldPlugin } from '../../domain/pipeline/plugins';
import type { Action } from '../../types/actions';

interface Subscriber {
  fn: (state: GameState) => void;
}

interface EventSubscriber {
  fn: (event: DomainEvent) => void;
}

export function createStateBridge(config: BridgeConfig): StateBridge {
  const { initialState, storage, autoSaveInterval = 5000 } = config;

  let currentState = initialState;
  const subscribers: Set<Subscriber> = new Set();
  const eventSubscribers: Set<EventSubscriber> = new Set();

  // Build pipeline
  const pipeline = createTickPipeline([
    directorPlugin,
    heroesPlugin,
    adventuresPlugin,
    worldPlugin,
  ]);

  // Auto-save interval
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  function startAutoSave(): void {
    if (autoSaveTimer) return;
    autoSaveTimer = setInterval(() => {
      storage.save(currentState);
    }, autoSaveInterval);
  }

  function stopAutoSave(): void {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  function notify(): void {
    for (const sub of subscribers) {
      sub.fn(currentState);
    }
  }

  function notifyEvent(event: DomainEvent): void {
    for (const sub of eventSubscribers) {
      sub.fn(event);
    }
  }

  // Start auto-save
  startAutoSave();

  return {
    subscribe(fn) {
      const sub: Subscriber = { fn };
      subscribers.add(sub);
      // Immediately notify with current state
      fn(currentState);

      return () => {
        subscribers.delete(sub);
      };
    },

    subscribeToEvents(fn) {
      const sub: EventSubscriber = { fn };
      eventSubscribers.add(sub);

      return () => {
        eventSubscribers.delete(sub);
      };
    },

    dispatch(action: Action) {
      // For now, actions are processed via reducer
      // This will be expanded when we add action handling
      console.log('[Bridge] Dispatch:', action);
    },

    getState() {
      return currentState;
    },

    tick() {
      const rng = new SeededRng(currentState.meta.rootSeed);
      const now = Date.now();

      const result = pipeline.process({
        state: currentState,
        rng,
        now,
        accumulatedEvents: [],
      });

      currentState = result.state;

      // Notify event subscribers
      for (const event of result.events) {
        notifyEvent(event);
      }

      // Notify state subscribers
      notify();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/frontend/bridge/StateBridge.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/frontend/bridge/StateBridge.ts tests/unit/frontend/bridge/StateBridge.test.ts
git commit -m "feat: implement StateBridge for Phaser-simulation communication"
```

---

### Task 2.4: Bridge Index Export

**Files:**
- Create: `src/frontend/bridge/index.ts`

- [ ] **Step 1: Create bridge index**

```typescript
// src/frontend/bridge/index.ts
export { createStateBridge } from './StateBridge';
export { LocalStorageAdapter } from './storage';
export type { StateBridge, StorageAdapter, BridgeConfig } from './types';
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/bridge/index.ts
git commit -m "feat: add bridge module exports"
```

---

## Chunk 3: Phaser Game Setup & Boot Scene

Initialize Phaser and create asset loading scene.

### Task 3.1: Phaser Game Config

**Files:**
- Create: `src/frontend/game.ts`

- [ ] **Step 1: Create Phaser game factory**

```typescript
// src/frontend/game.ts
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { TavernScene } from './scenes/TavernScene';
import { HUDScene } from './scenes/HUDScene';

export function createGame(parent: string | HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#2d1b1b',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, TavernScene, HUDScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
    },
  };

  return new Phaser.Game(config);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/game.ts
git commit -m "feat: add Phaser game factory"
```

---

### Task 3.2: Boot Scene

**Files:**
- Create: `src/frontend/scenes/BootScene.ts`

- [ ] **Step 1: Create BootScene**

```typescript
// src/frontend/scenes/BootScene.ts
import Phaser from 'phaser';
import { ASSETS } from '../config';

export class BootScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingUI();
    this.loadAssets();
    this.setupLoadEvents();
  }

  private createLoadingUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Progress bar background
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    // Progress bar fill
    this.progressBar = this.add.graphics();

    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
    });
    this.loadingText.setOrigin(0.5, 0.5);
  }

  private loadAssets(): void {
    // Environment
    this.load.image('table', `${ASSETS.SPRITES}/env/table.png`);
    this.load.image('chair', `${ASSETS.SPRITES}/env/chair.png`);
    this.load.image('floor', `${ASSETS.SPRITES}/bg/floor.png`);

    // Visitors (using placeholders for now)
    this.load.image('visitor-01', `${ASSETS.SPRITES}/visitors/visitor-01-idle.png`);
    this.load.image('visitor-02', `${ASSETS.SPRITES}/visitors/visitor-02-idle.png`);
    this.load.image('visitor-03', `${ASSETS.SPRITES}/visitors/visitor-03-idle.png`);
    this.load.image('visitor-04', `${ASSETS.SPRITES}/visitors/visitor-04-idle.png`);

    // Heroes
    this.load.image('hero-bard', `${ASSETS.SPRITES}/heroes/bard-idle.png`);
    this.load.image('hero-warrior', `${ASSETS.SPRITES}/heroes/warrior-idle.png`);
    this.load.image('hero-mage', `${ASSETS.SPRITES}/heroes/mage-idle.png`);
    this.load.image('hero-rogue', `${ASSETS.SPRITES}/heroes/rogue-idle.png`);

    // UI
    this.load.image('icon-gold', `${ASSETS.SPRITES}/ui/icon-gold.png`);
    this.load.image('button-primary', `${ASSETS.SPRITES}/ui/button-primary.png`);
  }

  private setupLoadEvents(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xffd700, 1);
      this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.progressBox.destroy();
      this.loadingText.destroy();
    });
  }

  create(): void {
    // Start main scenes in parallel
    this.scene.start('TavernScene');
    this.scene.start('HUDScene');

    // Stop boot scene
    this.scene.stop();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/scenes/BootScene.ts
git commit -m "feat: add BootScene for asset loading"
```

---

### Task 3.3: Frontend Entry Point

**Files:**
- Create: `src/frontend/index.ts`

- [ ] **Step 1: Create frontend entry point**

```typescript
// src/frontend/index.ts
import { createGame } from './game';
import { createStateBridge, LocalStorageAdapter } from './bridge';
import { createInitialState } from '../state/initial';
import { migrateState } from '../state/migrations';
import { calculateOfflineProgress } from '../time/offline';
import { SCHEMA_VERSION } from '../types';
import type { StateBridge } from './bridge';
import type { GoldU } from '../types/state';

// Global bridge instance
let bridge: StateBridge | null = null;

export function getBridge(): StateBridge {
  if (!bridge) {
    throw new Error('Bridge not initialized. Call initGame first.');
  }
  return bridge;
}

export function initGame(): void {
  const storage = new LocalStorageAdapter();

  // Load or create initial state
  let state = storage.load();
  if (state) {
    // Migrate if needed
    state = migrateState(state, SCHEMA_VERSION);

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

function applyOfflineProgress(state: any): any {
  const now = Date.now();
  const lastSeen = state.meta.lastSeenAtMs;

  // Calculate total income from heroes
  const incomePerSecondU = Object.values(state.heroes.roster).reduce(
    (sum: number, hero: any) => sum + (hero.incomePerSecondU ?? 0),
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
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/index.ts
git commit -m "feat: add frontend entry point with bridge initialization"
```

---

## Chunk 4: Tavern Scene & Renderer

Main game view with floor and tables.

### Task 4.1: Tavern Renderer

**Files:**
- Create: `src/frontend/renderer/TavernRenderer.ts`

- [ ] **Step 1: Create tavern renderer**

```typescript
// src/frontend/renderer/TavernRenderer.ts
import Phaser from 'phaser';
import { TILE_SIZE, LAYERS, TAVERN_AREA } from '../config';

export class TavernRenderer {
  private scene: Phaser.Scene;
  private floor!: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  render(): void {
    this.renderFloor();
  }

  private renderFloor(): void {
    // Use a solid color as placeholder until floor texture is available
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x4a3728, 1);
    graphics.fillRect(TAVERN_AREA.x, TAVERN_AREA.y, TAVERN_AREA.width, TAVERN_AREA.height);
    graphics.setDepth(LAYERS.FLOOR);

    // Add floor pattern with tileSprite if texture exists
    try {
      this.floor = this.scene.add.tileSprite(
        TAVERN_AREA.x,
        TAVERN_AREA.y,
        TAVERN_AREA.width,
        TAVERN_AREA.height,
        'floor'
      );
      this.floor.setOrigin(0, 0);
      this.floor.setDepth(LAYERS.FLOOR);
    } catch {
      // Texture not loaded yet, use solid color
    }
  }

  update(time: number, delta: number): void {
    // Floor animation if needed
  }

  destroy(): void {
    this.floor?.destroy();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/renderer/TavernRenderer.ts
git commit -m "feat: add TavernRenderer for floor rendering"
```

---

### Task 4.2: Tavern Scene

**Files:**
- Create: `src/frontend/scenes/TavernScene.ts`

- [ ] **Step 1: Create TavernScene**

```typescript
// src/frontend/scenes/TavernScene.ts
import Phaser from 'phaser';
import { getBridge } from '../index';
import { TICK_MS, LAYERS, TAVERN_AREA } from '../config';
import { TavernRenderer } from '../renderer/TavernRenderer';
import { Table } from '../entities/Table';
import { Visitor } from '../entities/Visitor';
import { Hero } from '../entities/Hero';
import type { StateBridge } from '../bridge';

export class TavernScene extends Phaser.Scene {
  private bridge!: StateBridge;
  private unsubscribe?: () => void;

  private renderer!: TavernRenderer;
  private tables: Table[] = [];
  private visitors: Map<string, Visitor> = new Map();
  private heroes: Map<string, Hero> = new Map();

  private lastTickTime = 0;

  constructor() {
    super({ key: 'TavernScene' });
  }

  create(): void {
    this.bridge = getBridge();

    // Initialize renderer
    this.renderer = new TavernRenderer(this);
    this.renderer.render();

    // Create static tables
    this.createTables();

    // Subscribe to state changes
    this.unsubscribe = this.bridge.subscribe((state) => {
      this.syncState(state);
    });

    // Initialize with current state
    this.syncState(this.bridge.getState());
  }

  private createTables(): void {
    // 2x3 grid of tables
    const tablePositions = [
      { x: 80, y: 150 },
      { x: 200, y: 150 },
      { x: 80, y: 280 },
      { x: 200, y: 280 },
      { x: 80, y: 410 },
      { x: 200, y: 410 },
    ];

    tablePositions.forEach((pos, i) => {
      const table = new Table(this, pos.x, pos.y, i);
      this.tables.push(table);
    });
  }

  private syncState(state: any): void {
    this.syncVisitors(state.director?.visitors ?? []);
    this.syncHeroes(state.heroes?.roster ?? {}, state.heroes?.order ?? []);
  }

  private syncVisitors(visitorData: any[]): void {
    const currentIds = new Set(visitorData.map((v) => v.id));

    // Remove visitors that left
    for (const [id, visitor] of this.visitors) {
      if (!currentIds.has(id)) {
        visitor.destroy();
        this.visitors.delete(id);
      }
    }

    // Add or update visitors
    visitorData.forEach((data) => {
      let visitor = this.visitors.get(data.id);
      if (!visitor) {
        // Find a table for the visitor
        const tableIndex = this.visitors.size % this.tables.length;
        const table = this.tables[tableIndex];
        visitor = new Visitor(this, data.id, table, data.type);
        this.visitors.set(data.id, visitor);
      }
    });
  }

  private syncHeroes(roster: Record<string, any>, order: string[]): void {
    // Clear existing heroes
    this.heroes.forEach((hero) => hero.destroy());
    this.heroes.clear();

    // Create heroes at bottom of tavern
    const heroY = TAVERN_AREA.y + TAVERN_AREA.height - 40;
    const spacing = 60;
    const startX = 60;

    order.forEach((heroId, i) => {
      const heroData = roster[heroId];
      if (heroData) {
        const hero = new Hero(this, startX + i * spacing, heroY, heroId);
        this.heroes.set(heroId, hero);
      }
    });
  }

  update(time: number, delta: number): void {
    // Run simulation tick every TICK_MS
    if (time - this.lastTickTime >= TICK_MS) {
      this.bridge.tick();
      this.lastTickTime = time;
    }

    // Update renderer
    this.renderer.update(time, delta);

    // Update visitors
    this.visitors.forEach((visitor) => visitor.update(time, delta));
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.renderer.destroy();
    this.visitors.forEach((v) => v.destroy());
    this.heroes.forEach((h) => h.destroy());
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/scenes/TavernScene.ts
git commit -m "feat: add TavernScene with table grid and state sync"
```

---

## Chunk 5: Game Entities

Table, Visitor, and Hero game objects.

### Task 5.1: Table Entity

**Files:**
- Create: `src/frontend/entities/Table.ts`

- [ ] **Step 1: Create Table entity**

```typescript
// src/frontend/entities/Table.ts
import Phaser from 'phaser';
import { LAYERS, TILE_SIZE } from '../config';

export class Table extends Phaser.GameObjects.Container {
  public readonly index: number;
  private tableSprite: Phaser.GameObjects.Sprite;
  private chairs: Phaser.GameObjects.Sprite[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, index: number) {
    super(scene, x, y);
    this.index = index;

    // Add table sprite
    this.tableSprite = scene.add.sprite(0, 0, 'table');
    this.tableSprite.setOrigin(0.5, 0.5);
    this.add(this.tableSprite);

    // Add chairs around table (2 on each side)
    this.createChairs();

    // Set depth
    this.setDepth(LAYERS.TABLES);

    // Add to scene
    scene.add.existing(this);
  }

  private createChairs(): void {
    const chairOffsets = [
      { x: -TILE_SIZE, y: 0 },   // Left
      { x: TILE_SIZE, y: 0 },    // Right
      { x: 0, y: -TILE_SIZE },   // Top
      { x: 0, y: TILE_SIZE },    // Bottom
    ];

    chairOffsets.forEach((offset) => {
      const chair = this.scene.add.sprite(offset.x, offset.y, 'chair');
      chair.setOrigin(0.5, 0.5);
      chair.setScale(0.8);
      this.chairs.push(chair);
      this.add(chair);
    });
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/entities/Table.ts
git commit -m "feat: add Table entity with chairs"
```

---

### Task 5.2: Visitor Entity

**Files:**
- Create: `src/frontend/entities/Visitor.ts`

- [ ] **Step 1: Create Visitor entity**

```typescript
// src/frontend/entities/Visitor.ts
import Phaser from 'phaser';
import { LAYERS } from '../config';
import type { Table } from './Table';

export class Visitor extends Phaser.GameObjects.Container {
  public readonly visitorId: string;
  private sprite: Phaser.GameObjects.Sprite;
  private targetTable: Table;
  private state: 'walking' | 'sitting' = 'walking';

  constructor(scene: Phaser.Scene, visitorId: string, table: Table, type: string) {
    super(scene, 0, 0);
    this.visitorId = visitorId;
    this.targetTable = table;

    // Determine sprite based on type
    const textureKey = this.getTextureForType(type);

    // Create sprite
    this.sprite = scene.add.sprite(0, 0, textureKey);
    this.sprite.setOrigin(0.5, 0.5);
    this.add(this.sprite);

    // Set initial position (enter from left)
    this.x = -50;
    this.y = table.y;

    // Set depth
    this.setDepth(LAYERS.VISITORS);

    // Add to scene
    scene.add.existing(this);

    // Start walking animation
    this.walkToTable();
  }

  private getTextureForType(type: string): string {
    const typeMap: Record<string, string> = {
      adventurer: 'visitor-01',
      merchant: 'visitor-02',
      noble: 'visitor-03',
      peasant: 'visitor-04',
    };
    return typeMap[type] ?? 'visitor-01';
  }

  private walkToTable(): void {
    const targetPos = this.targetTable.getPosition();

    this.scene.tweens.add({
      targets: this,
      x: targetPos.x,
      y: targetPos.y,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.state = 'sitting';
      },
    });
  }

  update(time: number, delta: number): void {
    // Add subtle bobbing when sitting
    if (this.state === 'sitting') {
      const bob = Math.sin(time / 500) * 2;
      this.sprite.y = bob;
    }
  }

  destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf(this);
    super.destroy(fromScene);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/entities/Visitor.ts
git commit -m "feat: add Visitor entity with walk animation"
```

---

### Task 5.3: Hero Entity

**Files:**
- Create: `src/frontend/entities/Hero.ts`

- [ ] **Step 1: Create Hero entity**

```typescript
// src/frontend/entities/Hero.ts
import Phaser from 'phaser';
import { LAYERS } from '../config';

const HERO_TEXTURES: Record<string, string> = {
  'bard-1': 'hero-bard',
  'warrior-1': 'hero-warrior',
  'mage-1': 'hero-mage',
  'rogue-1': 'hero-rogue',
};

export class Hero extends Phaser.GameObjects.Container {
  public readonly heroId: string;
  private sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number, heroId: string) {
    super(scene, x, y);
    this.heroId = heroId;

    // Get texture for hero type
    const textureKey = HERO_TEXTURES[heroId] ?? 'hero-bard';

    // Create sprite
    this.sprite = scene.add.sprite(0, 0, textureKey);
    this.sprite.setOrigin(0.5, 1); // Bottom-center anchor
    this.sprite.setScale(1.5);
    this.add(this.sprite);

    // Set depth
    this.setDepth(LAYERS.HEROES);

    // Add to scene
    scene.add.existing(this);

    // Add idle bobbing
    this.startIdleAnimation();
  }

  private startIdleAnimation(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      y: -3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf(this.sprite);
    super.destroy(fromScene);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/entities/Hero.ts
git commit -m "feat: add Hero entity with idle animation"
```

---

## Chunk 6: HUD Scene

UI overlay for gold display and controls.

### Task 6.1: Gold Display

**Files:**
- Create: `src/frontend/ui/GoldDisplay.ts`

- [ ] **Step 1: Create GoldDisplay**

```typescript
// src/frontend/ui/GoldDisplay.ts
import Phaser from 'phaser';
import { GOLD_MULTIPLIER } from '../../config/balance';

export class GoldDisplay extends Phaser.GameObjects.Container {
  private goldText: Phaser.GameObjects.Text;
  private incomeText: Phaser.GameObjects.Text;
  private goldIcon: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Gold icon
    this.goldIcon = scene.add.sprite(0, 0, 'icon-gold');
    this.goldIcon.setOrigin(0, 0.5);
    this.goldIcon.setScale(0.5);
    this.add(this.goldIcon);

    // Gold amount
    this.goldText = scene.add.text(30, 0, '0', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffd700',
      fontStyle: 'bold',
    });
    this.goldText.setOrigin(0, 0.5);
    this.add(this.goldText);

    // Income rate
    this.incomeText = scene.add.text(30, 25, '+0/s', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#88ff88',
    });
    this.incomeText.setOrigin(0, 0.5);
    this.add(this.incomeText);

    scene.add.existing(this);
  }

  update(gold: number, incomePerSecond: number): void {
    const displayGold = Math.floor(gold / GOLD_MULTIPLIER);
    const displayIncome = (incomePerSecond / GOLD_MULTIPLIER).toFixed(1);

    this.goldText.setText(this.formatNumber(displayGold));
    this.incomeText.setText(`+${displayIncome}/s`);
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/ui/GoldDisplay.ts
git commit -m "feat: add GoldDisplay UI component"
```

---

### Task 6.2: HUD Scene

**Files:**
- Create: `src/frontend/scenes/HUDScene.ts`

- [ ] **Step 1: Create HUDScene**

```typescript
// src/frontend/scenes/HUDScene.ts
import Phaser from 'phaser';
import { getBridge } from '../index';
import { CANVAS_WIDTH, LAYERS } from '../config';
import { GoldDisplay } from '../ui/GoldDisplay';
import type { StateBridge } from '../bridge';

export class HUDScene extends Phaser.Scene {
  private bridge!: StateBridge;
  private unsubscribe?: () => void;

  private goldDisplay!: GoldDisplay;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    this.bridge = getBridge();

    // Create gold display
    this.goldDisplay = new GoldDisplay(this, 15, 30);

    // Subscribe to state
    this.unsubscribe = this.bridge.subscribe((state) => {
      this.updateUI(state);
    });

    // Create menu button
    this.createMenuButton();

    // Initial update
    this.updateUI(this.bridge.getState());
  }

  private createMenuButton(): void {
    const button = this.add.text(CANVAS_WIDTH - 50, 30, '⚙️', {
      fontSize: '28px',
    });
    button.setOrigin(0.5, 0.5);
    button.setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
      console.log('[HUD] Menu button clicked');
      // TODO: Open menu scene
    });

    button.on('pointerover', () => {
      button.setScale(1.1);
    });

    button.on('pointerout', () => {
      button.setScale(1);
    });
  }

  private updateUI(state: any): void {
    const gold = state.wallet?.gold ?? 0;
    const incomePerSecond = this.calculateIncomePerSecond(state);

    this.goldDisplay.update(gold, incomePerSecond);
  }

  private calculateIncomePerSecond(state: any): number {
    const roster = state.heroes?.roster ?? {};
    return Object.values(roster).reduce(
      (sum: number, hero: any) => sum + (hero.incomePerSecondU ?? 0),
      0
    ) as number;
  }

  shutdown(): void {
    this.unsubscribe?.();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/scenes/HUDScene.ts
git commit -m "feat: add HUDScene with gold display and menu button"
```

---

## Chunk 7: Asset Pipeline & Final Integration

Copy assets and test the complete game.

### Task 7.1: Asset Copy Script

**Files:**
- Create: `scripts/copy-assets.ts`

- [ ] **Step 1: Create asset copy script**

```typescript
// scripts/copy-assets.ts
import { cp, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

const PRE_ASSETS = resolve(__dirname, '../pre_assets/tavern_tycoon_assets');
const PUBLIC_ASSETS = resolve(__dirname, '../public/assets/sprites');

async function copyAssets(): Promise<void> {
  // Create target directories
  const dirs = ['env', 'bg', 'visitors', 'heroes', 'ui'];
  for (const dir of dirs) {
    const target = resolve(PUBLIC_ASSETS, dir);
    if (!existsSync(target)) {
      await mkdir(target, { recursive: true });
    }
  }

  // Copy selected assets
  const copies: Promise<void>[] = [];

  // Environment
  copies.push(cp(`${PRE_ASSETS}/env_props/env_table_01x02_01_v3.png`, `${PUBLIC_ASSETS}/env/table.png`));
  copies.push(cp(`${PRE_ASSETS}/env_props/env_chair_01_v3.png`, `${PUBLIC_ASSETS}/env/chair.png`));

  // Background
  copies.push(cp(`${PRE_ASSETS}/env_bg/env_tavern_fg_shadows_01_v3.png`, `${PUBLIC_ASSETS}/bg/floor.png`));

  // Visitors
  for (let i = 1; i <= 4; i++) {
    const num = i.toString().padStart(2, '0');
    copies.push(cp(`${PRE_ASSETS}/npc_visitors/npc_visitor_${num}_idle_v3.png`, `${PUBLIC_ASSETS}/visitors/visitor-${num}-idle.png`));
  }

  // Heroes (assuming hero_02-06 are the main heroes)
  const heroMap: [string, string][] = [
    ['hero_02', 'bard'],
    ['hero_03', 'warrior'],
    ['hero_04', 'mage'],
    ['hero_05', 'rogue'],
  ];
  for (const [src, dest] of heroMap) {
    copies.push(cp(`${PRE_ASSETS}/heroes/${src}_idle_v3.png`, `${PUBLIC_ASSETS}/heroes/${dest}-idle.png`));
  }

  // UI
  copies.push(cp(`${PRE_ASSETS}/ui_icons/icon_stat_hp_01_v2.png`, `${PUBLIC_ASSETS}/ui/icon-gold.png`));
  copies.push(cp(`${PRE_ASSETS}/ui_core/ui_button_secondary_01_v3.png`, `${PUBLIC_ASSETS}/ui/button-primary.png`));

  await Promise.all(copies);
  console.log('Assets copied successfully!');
}

copyAssets().catch(console.error);
```

- [ ] **Step 2: Add npm script**

Add to `package.json`:

```json
{
  "scripts": {
    "copy-assets": "tsx scripts/copy-assets.ts"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/copy-assets.ts package.json
git commit -m "feat: add asset copy script for frontend build"
```

---

### Task 7.2: Run and Verify

**Files:**
- None (verification)

- [ ] **Step 1: Copy assets**

```bash
npm run copy-assets
```

- [ ] **Step 2: Run development server**

```bash
npm run dev:web
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000 and check:
- [ ] Canvas loads with correct size (375×667)
- [ ] BootScene shows loading bar
- [ ] TavernScene shows floor and tables
- [ ] HUDScene shows gold counter
- [ ] No console errors

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: complete Phaser 3 frontend MVP

- State Bridge connecting Phaser to simulation
- BootScene with asset loading
- TavernScene with tables and visitors
- HUDScene with gold display
- Entity system (Table, Visitor, Hero)
- LocalStorage persistence"
```

---

## Summary

| Chunk | Description | Key Files |
|-------|-------------|-----------|
| 1 | Build Setup | `vite.config.ts`, `package.json`, `config.ts` |
| 2 | State Bridge | `bridge/StateBridge.ts`, `bridge/storage.ts` |
| 3 | Boot Scene | `scenes/BootScene.ts`, `game.ts`, `index.ts` |
| 4 | Tavern Scene | `scenes/TavernScene.ts`, `renderer/TavernRenderer.ts` |
| 5 | Entities | `entities/Table.ts`, `entities/Visitor.ts`, `entities/Hero.ts` |
| 6 | HUD | `scenes/HUDScene.ts`, `ui/GoldDisplay.ts` |
| 7 | Integration | `scripts/copy-assets.ts` |

**Total Tasks:** 17
**Estimated Time:** 4-6 hours
