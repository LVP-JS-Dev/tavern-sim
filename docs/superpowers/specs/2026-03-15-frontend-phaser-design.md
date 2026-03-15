# Frontend Design: Phaser 3 Tavern

**Created:** 2026-03-15
**Status:** Approved
**Target:** MVP

---

## Overview

Minimal 2D tavern visualization using Phaser 3. The frontend connects to the existing simulation core in-process, providing visual representation of game state with simple sprites and basic interactivity.

### Goals

- Visualize tavern with tables, visitors, and heroes
- Display real-time gold accumulation
- Support basic hero upgrade interaction
- Mobile-first design (375×667)
- Platform-agnostic architecture (Telegram integration later)

### Non-Goals

- Character animations (only static/walk sprites)
- World map or adventure visualization
- Complex UI panels
- Multiplayer
- Platform-specific features (Telegram, Steam, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER                            │
│  ┌───────────────────────────────────────────────┐  │
│  │              PHASER 3 GAME                    │  │
│  │  ┌─────────────┐  ┌────────────────────────┐ │  │
│  │  │  SCENES     │  │  GAME OBJECTS          │ │  │
│  │  │  - Tavern   │  │  - Tables, Chairs      │ │  │
│  │  │  - HUD      │  │  - Visitors (NPCs)     │ │  │
│  │  │  - Menu     │  │  - Heroes              │ │  │
│  │  └──────┬──────┘  └────────────────────────┘ │  │
│  │         │                                     │  │
│  │  ┌──────▼──────────────────────────────────┐ │  │
│  │  │         STATE BRIDGE                    │ │  │
│  │  │  - subscribe(onChange)                  │ │  │
│  │  │  - dispatch(action)                     │ │  │
│  │  │  - getState() → GameState               │ │  │
│  │  └──────┬──────────────────────────────────┘ │  │
│  └─────────┼─────────────────────────────────────┘  │
│            │                                        │
│  ┌─────────▼─────────────────────────────────────┐  │
│  │         SIMULATION CORE (existing)            │  │
│  │  - GameState, Pipeline, Plugins              │  │
│  │  - RNG, Director, Adventures, etc.           │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │         STORAGE ADAPTER                       │  │
│  │  - LocalStorage (now)                        │  │
│  │  - Telegram CloudStorage (later)             │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Key Principles

1. **Simulation core unchanged** — frontend only consumes the existing API
2. **State Bridge** — single point of communication between Phaser and simulation
3. **Storage Adapter** — abstraction for persistence (LocalStorage now, platform-specific later)
4. **Platform-agnostic** — no Telegram/Steam dependencies in core frontend code

---

## Project Structure

```
fantasy-tavern-sim/
├── src/
│   ├── core/              # RNG (existing)
│   ├── domain/            # Pipeline (existing)
│   ├── systems/           # Game systems (existing)
│   ├── types/             # Types (existing)
│   ├── economy/           # Economy (existing)
│   ├── state/             # State & migrations (existing)
│   │
│   ├── frontend/          # ★ NEW
│   │   ├── index.ts                # Entry point
│   │   ├── config.ts               # Game constants
│   │   │
│   │   ├── bridge/
│   │   │   ├── index.ts
│   │   │   ├── subscriber.ts       # subscribe/dispatch pattern
│   │   │   └── storage.ts          # StorageAdapter interface + LocalStorage impl
│   │   │
│   │   ├── scenes/
│   │   │   ├── BootScene.ts        # Asset loading
│   │   │   ├── TavernScene.ts      # Main game view
│   │   │   ├── HUDScene.ts         # Gold, buttons overlay
│   │   │   └── MenuScene.ts        # Pause/settings
│   │   │
│   │   ├── entities/
│   │   │   ├── Table.ts            # Table + chairs container
│   │   │   ├── Visitor.ts          # NPC sprite + movement
│   │   │   └── Hero.ts             # Hero sprite
│   │   │
│   │   ├── ui/
│   │   │   ├── GoldDisplay.ts      # Gold counter
│   │   │   ├── UpgradePanel.ts     # Hero upgrade button
│   │   │   └── MenuButton.ts       # Settings button
│   │   │
│   │   └── renderer/
│   │       └── TavernRenderer.ts   # Floor, walls, decorations
│   │
│   └── cli/               # CLI (existing, stays)
│
├── public/                # ★ NEW - browser static files
│   ├── index.html
│   └── assets/
│       └── sprites/       # Copied from pre_assets
│
├── pre_assets/            # Source assets (not in bundle)
│
├── vite.config.ts         # ★ NEW
└── package.json           # Updated with Phaser + Vite
```

---

## Components

### Scenes

| Scene | Purpose | Z-Index |
|-------|---------|---------|
| **BootScene** | Load assets, show progress bar, init Bridge | — |
| **TavernScene** | Main view — tavern with visitors | 0 |
| **HUDScene** | Overlay — gold, menu button | 100 |
| **MenuScene** | Modal — pause/settings | 200 |

### Game Objects

| Object | Description | Layer |
|--------|-------------|-------|
| **Floor** | TileSprite for floor (optimized draw calls) | 0 |
| **Table** | Sprite + chair sprites around it | 10 |
| **Visitor** | Container: NPC sprite + walk-to-table logic | 20 |
| **Hero** | Static sprite (idle pose) | 30 |

### UI Elements (HUDScene)

| Element | Position | Content |
|---------|----------|---------|
| **GoldDisplay** | Top-left (10, 10) | "🪙 1,234" (divide by `GOLD_MULTIPLIER`) |
| **IncomeRate** | Below gold | "+10/сек" |
| **MenuButton** | Top-right (325, 10) | ⚙️ icon |
| **UpgradePanel** | Bottom (10, 607) | "Upgrade Hero" button |

---

## Data Flow

### Game Loop

```
┌─────────────────────────────────────────────────────────┐
│                    TICK LOOP (60 FPS)                   │
│                                                         │
│  1. Phaser update() called every frame                  │
│  2. Check: has 40ms passed since last game tick?        │
│     └─ Yes → call simulation.tick()                     │
│     └─ No  → skip                                       │
│  3. Bridge.notify() broadcasts new state to subscribers │
│  4. Scenes update sprites based on new state            │
└─────────────────────────────────────────────────────────┘
```

### State Bridge API

```typescript
import type { GameState, DomainEvent } from '../types';
import type { GameAction } from '../types/actions';

interface StateBridge {
  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(fn: (state: GameState) => void): () => void;

  /** Subscribe to domain events (for toasts, VFX triggers). */
  subscribeToEvents(fn: (event: DomainEvent) => void): () => void;

  /** Dispatch user action to be processed in next tick. */
  dispatch(action: GameAction): void;

  /** Get current state snapshot. */
  getState(): GameState;

  /** Force advance simulation by one tick. */
  tick(): void;
}
```

> **Note:** `dispatch` queues user actions (like `UPGRADE_HERO`) for the next tick cycle.
> Actions are processed by the reducer, not directly by the pipeline.
> The simulation advances via `tick()` which calls `pipeline.process()`.

### Usage in Scene

```typescript
class TavernScene extends Phaser.Scene {
  private unsubscribe?: () => void;

  create() {
    // Tables are static scene elements, not state-driven
    this.createTables();

    this.unsubscribe = bridge.subscribe((state) => {
      this.syncVisitors(state.director.visitors);
      this.syncHeroes(state.heroes.roster, state.heroes.order);
    });
  }

  shutdown() {
    this.unsubscribe?.();
  }
}
```

> **Note:** Visitor positions are managed by the frontend (not in GameState).
> The Director only tracks visitor lifecycle; visual position/animation
> is handled by `Visitor.ts` entity.

### Offline Progress

```
On game start:
1. Load state from LocalStorage
2. Calculate total incomePerSecondU from state.heroes.roster
3. Call calculateOfflineProgress(now, state.meta.lastSeenAtMs, incomePerSecondU)
4. Apply gold earned to state.wallet.gold
5. Show toast "While you were away: +X gold"
```

```typescript
import { calculateOfflineProgress } from '../time/offline';

function applyOfflineProgress(state: GameState): { state: GameState; goldEarned: GoldU } {
  const incomePerSecondU = Object.values(state.heroes.roster)
    .reduce((sum, hero) => sum + hero.incomePerSecondU, 0);

  const result = calculateOfflineProgress(
    Date.now(),
    state.meta.lastSeenAtMs,
    incomePerSecondU
  );

  return {
    state: {
      ...state,
      wallet: {
        ...state.wallet,
        gold: state.wallet.gold + result.goldEarned,
        lifetimeEarnedGold: state.wallet.lifetimeEarnedGold + result.goldEarned,
      },
    },
    goldEarned: result.goldEarned,
  };
}
```

---

## Assets

### Source

Assets located in `pre_assets/tavern_tycoon_assets/` (336 PNG files).

### Selection for MVP (~25 files)

| Category | Count | Files |
|----------|-------|-------|
| env_props | 5 | table, chair, barrel, counter, lantern |
| env_bg | 1 | tavern floor pattern |
| npc_visitors | 8 | 4 types × (idle + walk) |
| heroes | 5 | bard, warrior, mage, rogue, cleric (idle) |
| ui_core | 5 | button-primary, button-danger, panel, icon-gold, icon-settings |

### Target Structure

```
public/assets/sprites/
├── env/
│   ├── table.png
│   ├── chair.png
│   ├── barrel.png
│   ├── counter.png
│   └── lantern.png
├── bg/
│   └── floor.png
├── visitors/
│   ├── visitor-01-idle.png
│   ├── visitor-01-walk.png
│   └── ...
├── heroes/
│   ├── bard-idle.png
│   └── ...
└── ui/
    ├── button-primary.png
    ├── button-danger.png
    ├── panel.png
    ├── icon-gold.png
    └── icon-settings.png
```

---

## UI Layout

### Canvas: 375 × 667 px (iPhone SE)

```
┌─────────────────────────────────────┐
│ ┌─────────────┐           ┌───────┐ │
│ │ 🪙 1,234    │           │  ⚙️   │ │  ← HUD (60px)
│ │ +10/сек     │           └───────┘ │
│ └─────────────┘                     │
├─────────────────────────────────────┤
│                                     │
│     ┌───┐  ┌───┐  ┌───┐            │
│     │ T │  │ T │  │ T │            │  ← Tables (4-6)
│     └───┘  └───┘  └───┘            │
│                                     │
│        🧙  🧝  ⚔️  🏹               │  ← Heroes (idle)
│                                     │
│     🚶    🚶      🪑                │  ← Visitors
│                                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  [Upgrade Hero]                 │ │  ← Action bar (60px)
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Dimensions

| Element | Size |
|---------|------|
| Canvas | 375 × 667 px |
| HUD bar | 375 × 60 px |
| Tavern area | 375 × 547 px |
| Action bar | 375 × 60 px |
| Tile | 32 × 32 px |
| Table | 64 × 64 px |

### Z-Order

| Layer | Z |
|-------|---|
| Floor | 0 |
| Tables | 10 |
| Visitors | 20 |
| Heroes | 30 |
| HUD | 100 |

---

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Game Engine | Phaser 3 | ^3.80.1 |
| Build Tool | Vite | ^6.0.0 |
| Language | TypeScript | ^5.8.0 |
| State Management | Custom Bridge | — |
| Storage | LocalStorage | — |
| Testing | Vitest | ^3.0.0 |

### New Dependencies

```json
{
  "dependencies": {
    "phaser": "^3.80.1"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

---

## Acceptance Criteria

### Must Have

- [ ] Phaser 3 initialized with 375×667 canvas
- [ ] BootScene loads all assets with progress bar
- [ ] TavernScene displays floor (TileSprite) and 4-6 tables
- [ ] Visitors spawn and walk to tables
- [ ] Heroes displayed at bottom of tavern
- [ ] HUDScene shows gold counter updating in real-time
- [ ] State Bridge connects Phaser to simulation core
- [ ] LocalStorage persistence (save/load)
- [ ] Offline progress calculated on startup

### Nice to Have

- [ ] MenuScene with pause functionality
- [ ] Hero upgrade button functional
- [ ] Toast notifications for events
- [ ] Sound effects (placeholder)

---

## Future Considerations

Not in MVP, but architecture should support:

1. **Platform Adapters** — Telegram, Steam, mobile native
2. **Texture Atlas** — for performance optimization
3. **Animations** — character walk cycles, VFX
4. **World Map** — adventure visualization
5. **Multi-scene navigation** — hero roster, settings

---

## References

- MVP Plan: `docs/plans/2026-02-14-tavern-tycoon-mvp-plan.md`
- Simulation Architecture: `docs/superpowers/plans/2026-03-14-tavern-tycoon-refactoring.md`
- Phaser 3 Docs: https://photonstorm.github.io/phaser3-docs/
