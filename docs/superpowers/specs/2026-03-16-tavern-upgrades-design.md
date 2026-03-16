# Tavern Upgrade System Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tavern upgrade system where players spend gold to improve 4 branches (bar, kitchen, rooms, decor) with exponential cost scaling and gameplay effects.

**Architecture:** Config-based upgrade system with predefined effects per branch. Each branch has 5 levels with exponential cost formula (baseCost × 2^level). Effects are applied through a central `getUpgradeEffects()` function consumed by Director for income generation and visitor spawning.

**Tech Stack:** TypeScript, Phaser 3, existing StateBridge pattern

**Prerequisites:** Frontend integration requires `feature/frontend-phaser` branch to be merged to `develop` first.

---

## 1. Data Structures

### Upgrade Branch Config

```typescript
// src/config/upgradeBranches.ts
export type UpgradeBranchId = 'bar' | 'kitchen' | 'rooms' | 'decor';

export interface UpgradeBranchConfig {
  readonly id: UpgradeBranchId;
  readonly name: string;           // "Бар", "Кухня", etc.
  readonly baseCost: number;       // Базовая стоимость (в GoldU)
  readonly maxLevel: number;       // 5
  readonly effects: {
    // Значения эффектов по уровням (индекс = уровень)
    readonly goldMultiplier?: readonly number[];
    readonly visitorTiers?: readonly number[];
    readonly capacity?: readonly number[];
    readonly qualityBonus?: readonly number[];
  };
}

export const UPGRADE_BRANCHES: Record<UpgradeBranchId, UpgradeBranchConfig> = {
  bar: {
    id: 'bar',
    name: 'Бар',
    baseCost: 100000, // 10 gold in GoldU (fixed-point)
    maxLevel: 5,
    effects: {
      goldMultiplier: [1, 1.2, 1.5, 2, 2.5, 3],
    },
  },
  kitchen: {
    id: 'kitchen',
    name: 'Кухня',
    baseCost: 150000, // 15 gold
    maxLevel: 5,
    effects: {
      visitorTiers: [1, 1, 2, 2, 3, 3],
    },
  },
  rooms: {
    id: 'rooms',
    name: 'Комнаты',
    baseCost: 200000, // 20 gold
    maxLevel: 5,
    effects: {
      capacity: [3, 4, 5, 6, 7, 8],
    },
  },
  decor: {
    id: 'decor',
    name: 'Декор',
    baseCost: 50000, // 5 gold
    maxLevel: 5,
    effects: {
      qualityBonus: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
    },
  },
};
```

### Cost Formula

```typescript
// src/config/upgradeBranches.ts
import type { GoldU } from '../types';

export function getUpgradeCost(branchId: UpgradeBranchId, currentLevel: number): GoldU {
  const branch = UPGRADE_BRANCHES[branchId];
  return branch.baseCost * Math.pow(2, currentLevel) as GoldU;
}
```

Example costs for Bar (baseCost: 100000 = 10 gold):
- Level 0→1: 100000 × 2^0 = 100000 (10 gold)
- Level 1→2: 100000 × 2^1 = 200000 (20 gold)
- Level 2→3: 100000 × 2^2 = 400000 (40 gold)
- Level 3→4: 100000 × 2^3 = 800000 (80 gold)
- Level 4→5: 100000 × 2^4 = 1600000 (160 gold)
- **Total to max:** 3100000 (310 gold)

### State (existing in TavernSlice)

```typescript
// Already exists in src/types/state.ts
interface TavernSlice {
  readonly level: number;                    // Общий уровень таверны
  readonly upgrades: Record<string, number>; // { bar: 2, kitchen: 1, ... }
}
```

---

## 2. Actions and Reducer

### Action

```typescript
// src/types/actions.ts

export interface UpgradeTavernAction {
  readonly type: "UPGRADE_TAVERN";
  readonly branchId: UpgradeBranchId;
}

// Add to Action union type

// Action factory
export function upgradeTavern(branchId: UpgradeBranchId): UpgradeTavernAction {
  return { type: "UPGRADE_TAVERN", branchId };
}
```

### Reducer Handler

```typescript
// src/reducer/handlers.ts

import { UPGRADE_BRANCHES, getUpgradeCost, type UpgradeBranchId } from '../config/upgradeBranches';
import { tavernUpgradeApplied, tavernUpgradeRejected } from '../types/events';
import { insufficientGold, invalidBranch } from '../types/errors';

export function handleUpgradeTavern(
  state: GameState,
  action: UpgradeTavernAction,
  now: number
): ReduceResult {
  const { branchId } = action;
  const events: DomainEvent[] = [];

  // 1. Validate branch exists
  const branch = UPGRADE_BRANCHES[branchId];
  if (!branch) {
    events.push(tavernUpgradeRejected(branchId, 0, "INVALID_BRANCH"));
    return failure(state, events, invalidBranch(branchId));
  }

  // 2. Get current level
  const currentLevel = state.tavern.upgrades[branchId] ?? 0;

  // 3. Check: already max level?
  if (currentLevel >= branch.maxLevel) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, "MAX_LEVEL_REACHED"));
    return failure(state, events, invalidBranch(branchId));
  }

  // 4. Calculate cost
  const cost = getUpgradeCost(branchId, currentLevel);

  // 5. Check: enough gold?
  if (state.wallet.gold < cost) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, "INSUFFICIENT_GOLD"));
    return failure(state, events, insufficientGold(branchId, cost, state.wallet.gold));
  }

  // 6. Apply upgrade
  const newState: GameState = {
    ...state,
    wallet: {
      ...state.wallet,
      gold: state.wallet.gold - cost,
    },
    tavern: {
      ...state.tavern,
      level: state.tavern.level + 1,
      upgrades: {
        ...state.tavern.upgrades,
        [branchId]: currentLevel + 1,
      },
    },
    meta: {
      ...state.meta,
      lastSeenAtMs: now,
    },
  };

  events.push(tavernUpgradeApplied(branchId, currentLevel + 1, cost));

  return success(newState, events);
}
```

### Event

```typescript
// src/types/events.ts

export interface TavernUpgradeAppliedEvent {
  readonly type: "TAVERN_UPGRADE_APPLIED";
  readonly branchId: string;
  readonly newLevel: number;
  readonly goldCost: GoldU;
}

export interface TavernUpgradeRejectedEvent {
  readonly type: "TAVERN_UPGRADE_REJECTED";
  readonly branchId: string;
  readonly currentLevel: number;
  readonly reason: "INVALID_BRANCH" | "MAX_LEVEL_REACHED" | "INSUFFICIENT_GOLD";
}

// Add to DomainEvent union type

// Event factories
export function tavernUpgradeApplied(
  branchId: string,
  newLevel: number,
  goldCost: GoldU
): TavernUpgradeAppliedEvent {
  return { type: "TAVERN_UPGRADE_APPLIED", branchId, newLevel, goldCost };
}

export function tavernUpgradeRejected(
  branchId: string,
  currentLevel: number,
  reason: TavernUpgradeRejectedEvent["reason"]
): TavernUpgradeRejectedEvent {
  return { type: "TAVERN_UPGRADE_REJECTED", branchId, currentLevel, reason };
}
```

### Error Types

```typescript
// src/types/errors.ts

export interface TavernError {
  readonly type: "TAVERN_ERROR";
  readonly branchId: string;
  readonly message: string;
}

export function invalidBranch(branchId: string): TavernError {
  return { type: "TAVERN_ERROR", branchId, message: `Invalid upgrade branch: ${branchId}` };
}
```

---

## 3. Effect Application

### Get Effects Function

```typescript
// src/tavern/getUpgradeEffects.ts

import type { UpgradeEffects } from './types';
import { UPGRADE_BRANCHES, type UpgradeBranchId } from '../config/upgradeBranches';

export function getUpgradeEffects(upgrades: Record<string, number>): UpgradeEffects {
  const barLevel = upgrades['bar'] ?? 0;
  const kitchenLevel = upgrades['kitchen'] ?? 0;
  const roomsLevel = upgrades['rooms'] ?? 0;
  const decorLevel = upgrades['decor'] ?? 0;

  return {
    goldMultiplier: UPGRADE_BRANCHES.bar.effects.goldMultiplier?.[barLevel] ?? 1,
    maxCapacity: UPGRADE_BRANCHES.rooms.effects.capacity?.[roomsLevel] ?? 3,
    visitorTier: UPGRADE_BRANCHES.kitchen.effects.visitorTiers?.[kitchenLevel] ?? 1,
    qualityBonus: UPGRADE_BRANCHES.decor.effects.qualityBonus?.[decorLevel] ?? 0,
  };
}
```

```typescript
// src/tavern/types.ts

export interface UpgradeEffects {
  readonly goldMultiplier: number;
  readonly maxCapacity: number;
  readonly visitorTier: number;
  readonly qualityBonus: number;
}
```

### Director Integration

**Income Generation (in tick processing):**

The Director service at `src/systems/director/service.ts` should use `getUpgradeEffects()` to modify income calculation. This integrates with the existing tick pipeline.

```typescript
// Integration point in src/time/tick.ts or DirectorService

import { getUpgradeEffects } from '../tavern/getUpgradeEffects';

// When calculating gold income from visitors:
function calculateVisitorIncome(state: GameState): GoldU {
  const effects = getUpgradeEffects(state.tavern.upgrades);
  const visitorCount = state.director.visitors.length;

  // Base: 1 gold per visitor per tick, multiplied by bar's goldMultiplier
  return Math.floor(visitorCount * effects.goldMultiplier * 1000) as GoldU;
}
```

**Visitor Spawning (in DirectorService):**

```typescript
// Integration point in src/systems/director/service.ts

import { getUpgradeEffects } from '../../tavern/getUpgradeEffects';

// In canSpawn() or update() method:
function canSpawnVisitor(state: GameState): boolean {
  const effects = getUpgradeEffects(state.tavern.upgrades);

  // Check capacity
  if (state.director.visitors.length >= effects.maxCapacity) {
    return false;
  }

  return true;
}

// When determining visitor type:
function selectVisitorType(state: GameState): VisitorType {
  const effects = getUpgradeEffects(state.tavern.upgrades);
  const tier = effects.visitorTier;
  const qualityRoll = Math.random() + effects.qualityBonus;

  // Higher tier and qualityBonus = better visitors
  // Implementation depends on existing visitor type system
  return determineVisitorByTier(tier, qualityRoll);
}
```

---

## 4. UI - Upgrade Panel (Frontend)

**Note:** This section requires the `feature/frontend-phaser` branch to be merged first.

### UpgradePanel Component

```typescript
// src/frontend/ui/UpgradePanel.ts

import type { StateBridge } from '../bridge/StateBridge';
import type { GameState } from '../../types';
import { UPGRADE_BRANCHES, getUpgradeCost, type UpgradeBranchId } from '../../config/upgradeBranches';
import { upgradeTavern } from '../../types/actions';

export class UpgradePanel {
  private container: Phaser.GameObjects.Container;
  private branchButtons: Map<UpgradeBranchId, Phaser.GameObjects.Container>;

  constructor(scene: Phaser.Scene, private bridge: StateBridge) {
    this.container = scene.add.container(10, 607);
    this.branchButtons = new Map();

    this.createButtons(scene);
  }

  private createButtons(scene: Phaser.Scene): void {
    const branches: UpgradeBranchId[] = ['bar', 'kitchen', 'rooms', 'decor'];

    branches.forEach((branchId, index) => {
      const config = UPGRADE_BRANCHES[branchId];
      const x = index * 160; // 4 buttons in a row

      const button = this.createBranchButton(scene, config, x);
      this.branchButtons.set(branchId, button);
      this.container.add(button);
    });
  }

  private createBranchButton(
    scene: Phaser.Scene,
    config: UpgradeBranchConfig,
    x: number
  ): Phaser.GameObjects.Container {
    const button = scene.add.container(x, 0);

    // Button background
    const bg = scene.add.rectangle(0, 0, 150, 80, 0x4a3728);
    button.add(bg);

    // Branch name
    const nameText = scene.add.text(0, -25, config.name, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);
    button.add(nameText);

    // Level (updated in syncState)
    const levelText = scene.add.text(0, 0, 'Ур. 0/5', {
      fontSize: '12px',
      color: '#ffcc00'
    }).setOrigin(0.5);
    button.add(levelText);
    button.setData('levelText', levelText);

    // Cost (updated in syncState)
    const costText = scene.add.text(0, 20, '10 💰', {
      fontSize: '11px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    button.add(costText);
    button.setData('costText', costText);

    // Interactivity
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.onUpgradeClick(config.id));

    return button;
  }

  private onUpgradeClick(branchId: UpgradeBranchId): void {
    this.bridge.dispatch(upgradeTavern(branchId));
  }

  syncState(state: GameState): void {
    for (const [branchId, button] of this.branchButtons) {
      const config = UPGRADE_BRANCHES[branchId];
      const currentLevel = state.tavern.upgrades[branchId] ?? 0;
      const cost = getUpgradeCost(branchId, currentLevel);

      const levelText = button.getData('levelText') as Phaser.GameObjects.Text;
      const costText = button.getData('costText') as Phaser.GameObjects.Text;

      if (currentLevel >= config.maxLevel) {
        levelText.setText('МАКС');
        costText.setText('—');
      } else {
        levelText.setText(`Ур. ${currentLevel}/${config.maxLevel}`);
        costText.setText(`${cost / 10000} 💰`); // Convert GoldU to display gold

        const canAfford = state.wallet.gold >= cost;
        costText.setColor(canAfford ? '#ffcc00' : '#666666');
      }
    }
  }
}
```

### HUDScene Integration

```typescript
// In src/frontend/scenes/HUDScene.ts

import { UpgradePanel } from '../ui/UpgradePanel';

export class HUDScene extends Phaser.Scene {
  private upgradePanel!: UpgradePanel;

  create(): void {
    // ... existing code ...

    this.upgradePanel = new UpgradePanel(this, this.bridge);
  }

  private syncState(state: GameState): void {
    // ... existing code ...

    this.upgradePanel.syncState(state);
  }
}
```

---

## 5. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/config/upgradeBranches.ts` | Create | Upgrade branch config and cost formula |
| `src/tavern/types.ts` | Create | UpgradeEffects interface |
| `src/tavern/getUpgradeEffects.ts` | Create | Get effects function |
| `src/tavern/index.ts` | Create | Barrel export |
| `src/types/actions.ts` | Modify | Add `UpgradeTavernAction` and factory |
| `src/types/events.ts` | Modify | Add `TavernUpgradeAppliedEvent`, `TavernUpgradeRejectedEvent` |
| `src/types/errors.ts` | Modify | Add `TavernError` type |
| `src/reducer/handlers.ts` | Modify | Add `handleUpgradeTavern` handler |
| `src/reducer/index.ts` | Modify | Wire up new handler |
| `src/systems/director/service.ts` | Modify | Apply effects to spawning logic |
| `src/time/tick.ts` | Modify | Apply goldMultiplier to income |
| `src/frontend/ui/UpgradePanel.ts` | Create | UI component (after frontend merge) |
| `src/frontend/scenes/HUDScene.ts` | Modify | Integrate UpgradePanel (after frontend merge) |
| `tests/unit/upgradeBranches.test.ts` | Create | Config and cost formula tests |
| `tests/unit/getUpgradeEffects.test.ts` | Create | Effects function tests |
| `tests/unit/reducer-upgradeTavern.test.ts` | Create | Action handler tests |
| `tests/integration/tavern-upgrades.test.ts` | Create | Integration tests |

---

## 6. Key Tests

### Test Helpers (following existing pattern)

```typescript
// Following pattern from tests/unit/reducer.test.ts

function createStateWithUpgrades(
  upgrades: Record<string, number>,
  gold: number = 10000000 // 1000 gold
): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, 12345);

  return {
    ...state,
    wallet: {
      ...state.wallet,
      gold,
    },
    tavern: {
      ...state.tavern,
      upgrades,
    },
  };
}
```

### Reducer Tests

```typescript
// tests/unit/reducer-upgradeTavern.test.ts

import { describe, it, expect } from "vitest";
import { reduce, handleUpgradeTavern } from "../../src/reducer";
import { upgradeTavern } from "../../src/types/actions";
import { createInitialState } from "../../src/state/initial";
import type { GameState } from "../../src/types";

function createStateWithUpgrades(
  upgrades: Record<string, number>,
  gold: number = 10000000
): GameState {
  const now = 1700000000000;
  const state = createInitialState(now, 12345);
  return {
    ...state,
    wallet: { ...state.wallet, gold },
    tavern: { ...state.tavern, upgrades },
  };
}

describe("UPGRADE_TAVERN action handling", () => {
  it("increases branch level and deducts gold", () => {
    const state = createStateWithUpgrades({ bar: 0 }, 100000); // 10 gold
    const result = reduce(state, upgradeTavern('bar'), Date.now());

    expect(result.state.tavern.upgrades['bar']).toBe(1);
    expect(result.state.wallet.gold).toBe(0); // 10 - 10 = 0
  });

  it("does nothing when not enough gold", () => {
    const state = createStateWithUpgrades({ bar: 0 }, 50000); // 5 gold
    const result = reduce(state, upgradeTavern('bar'), Date.now());

    expect(result.state.tavern.upgrades['bar']).toBe(0);
    expect(result.state.wallet.gold).toBe(50000);
    expect(result.error).toBeDefined();
  });

  it("does nothing when at max level", () => {
    const state = createStateWithUpgrades({ bar: 5 }, 10000000);
    const result = reduce(state, upgradeTavern('bar'), Date.now());

    expect(result.state.tavern.upgrades['bar']).toBe(5);
    expect(result.error).toBeDefined();
  });

  it("costs double each level (exponential)", () => {
    // Level 0→1: 10 gold
    const state0 = createStateWithUpgrades({ bar: 0 }, 100000);
    const result0 = reduce(state0, upgradeTavern('bar'), Date.now());
    expect(result0.state.wallet.gold).toBe(0);

    // Level 1→2: 20 gold
    const state1 = createStateWithUpgrades({ bar: 1 }, 200000);
    const result1 = reduce(state1, upgradeTavern('bar'), Date.now());
    expect(result1.state.wallet.gold).toBe(0);

    // Level 2→3: 40 gold
    const state2 = createStateWithUpgrades({ bar: 2 }, 400000);
    const result2 = reduce(state2, upgradeTavern('bar'), Date.now());
    expect(result2.state.wallet.gold).toBe(0);
  });

  it("increases overall tavern level", () => {
    const state = createStateWithUpgrades({}, 10000000);
    expect(state.tavern.level).toBe(0);

    const result1 = reduce(state, upgradeTavern('bar'), Date.now());
    expect(result1.state.tavern.level).toBe(1);

    const result2 = reduce(result1.state, upgradeTavern('kitchen'), Date.now());
    expect(result2.state.tavern.level).toBe(2);
  });

  it("emits TAVERN_UPGRADE_APPLIED event on success", () => {
    const state = createStateWithUpgrades({ bar: 0 }, 100000);
    const result = reduce(state, upgradeTavern('bar'), Date.now());

    const appliedEvents = result.events.filter(e => e.type === "TAVERN_UPGRADE_APPLIED");
    expect(appliedEvents).toHaveLength(1);
    expect(appliedEvents[0]).toMatchObject({
      branchId: 'bar',
      newLevel: 1,
    });
  });

  it("emits TAVERN_UPGRADE_REJECTED event on failure", () => {
    const state = createStateWithUpgrades({ bar: 0 }, 0); // No gold
    const result = reduce(state, upgradeTavern('bar'), Date.now());

    const rejectedEvents = result.events.filter(e => e.type === "TAVERN_UPGRADE_REJECTED");
    expect(rejectedEvents).toHaveLength(1);
    expect(rejectedEvents[0]?.reason).toBe("INSUFFICIENT_GOLD");
  });
});
```

### Effects Tests

```typescript
// tests/unit/getUpgradeEffects.test.ts

import { describe, it, expect } from "vitest";
import { getUpgradeEffects } from "../../src/tavern/getUpgradeEffects";

describe("getUpgradeEffects", () => {
  it("returns default values with no upgrades", () => {
    const effects = getUpgradeEffects({});
    expect(effects.goldMultiplier).toBe(1);
    expect(effects.maxCapacity).toBe(3);
    expect(effects.visitorTier).toBe(1);
    expect(effects.qualityBonus).toBe(0);
  });

  it("returns correct values for bar upgrades", () => {
    const effects0 = getUpgradeEffects({ bar: 0 });
    expect(effects0.goldMultiplier).toBe(1);

    const effects2 = getUpgradeEffects({ bar: 2 });
    expect(effects2.goldMultiplier).toBe(1.5);

    const effects5 = getUpgradeEffects({ bar: 5 });
    expect(effects5.goldMultiplier).toBe(3);
  });

  it("returns correct values for rooms upgrades", () => {
    const effects0 = getUpgradeEffects({ rooms: 0 });
    expect(effects0.maxCapacity).toBe(3);

    const effects5 = getUpgradeEffects({ rooms: 5 });
    expect(effects5.maxCapacity).toBe(8);
  });

  it("combines effects from multiple branches", () => {
    const effects = getUpgradeEffects({ bar: 3, kitchen: 2, rooms: 4, decor: 1 });
    expect(effects.goldMultiplier).toBe(2);
    expect(effects.visitorTier).toBe(2);
    expect(effects.maxCapacity).toBe(7);
    expect(effects.qualityBonus).toBe(0.1);
  });

  it("returns max values at max level", () => {
    const effects = getUpgradeEffects({ bar: 5, kitchen: 5, rooms: 5, decor: 5 });
    expect(effects.goldMultiplier).toBe(3);
    expect(effects.maxCapacity).toBe(8);
    expect(effects.visitorTier).toBe(3);
    expect(effects.qualityBonus).toBe(0.5);
  });
});
```

---

## 7. Summary

**Design approved:**
- 4 upgrade branches with exponential cost scaling
- Config-based approach with predefined effects
- Action + reducer for state management (SCREAMING_SNAKE_CASE convention)
- Director applies effects to simulation
- UI panel with 4 buttons in HUDScene

**Cost summary (per branch, in GoldU):**
- Bar (base: 100000): 100k → 200k → 400k → 800k → 1.6M (total: 3.1M = 310 gold)
- Kitchen (base: 150000): 150k → 300k → 600k → 1.2M → 2.4M (total: 4.65M = 465 gold)
- Rooms (base: 200000): 200k → 400k → 800k → 1.6M → 3.2M (total: 6.2M = 620 gold)
- Decor (base: 50000): 50k → 100k → 200k → 400k → 800k (total: 1.55M = 155 gold)

**Total to max all branches:** 15.5M GoldU = 1550 gold

**Implementation order:**
1. Backend: config, types, actions, events, reducer handler
2. Backend: effects function, Director integration
3. Tests: unit tests for all backend components
4. Frontend: UI panel (after `feature/frontend-phaser` merge)
5. Integration tests
