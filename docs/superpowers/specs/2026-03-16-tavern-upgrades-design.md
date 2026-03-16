# Tavern Upgrade System Design

#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tavern upgrade system where players spend gold to improve 4 branches (bar, kitchen, rooms, decor) with exponential cost scaling and gameplay effects.

**Architecture:** Config-based upgrade system with predefined effects per branch. Each branch has 5 levels with exponential cost formula (baseCost × 2^level). Effects are applied through a central `getUpgradeEffects()` function consumed by Director for income generation and visitor spawning.

**Tech Stack:** TypeScript, Phaser 3, existing StateBridge pattern

**Prerequisites:** Frontend integration requires `feature/frontend-phaser` branch to be merged to `develop` first.

---

## 1. Data Structures

### Upgrade Branch Config

#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

```typescript
// src/config/upgradeBranches.ts
import type { GoldU } from '../types';

export type UpgradeBranchId = 'bar' | 'kitchen' | 'rooms' | 'decor';

export interface UpgradeBranchConfig {
  readonly id: UpgradeBranchId;
  readonly name: string;           // "Бар", "Кухня", etc.
  readonly baseCost: GoldU;        // Базовая стоимость (в GoldU)
  readonly maxLevel: number;       // 5
  readonly effects: {
    // Значения эффектов по уровням (индекс = уровень)
    readonly goldMultiplier?: readonly number[];
    readonly visitorTiers?: readonly number[];
    readonly capacity?: readonly number[];
    readonly qualityBonus?: readonly number[];
  };
}

```

### Branch Definitions
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

```typescript
export const UPGRADE_BRANCHES: Record<UpgradeBranchId, UpgradeBranchConfig> = {
  bar: {
    id: 'bar',
    name: 'Бар',
    baseCost: 100000 as GoldU, // 10 gold (fixed-point: *10000)
    maxLevel: 5,
    effects: {
      goldMultiplier: [1, 1.2, 1.5, 2, 2.5, 3],
    },
  },
  kitchen: {
    id: 'kitchen',
    name: 'Кухня',
    baseCost: 150000 as GoldU, // 15 gold
    maxLevel: 5,
    effects: {
      visitorTiers: [1, 1, 2, 2, 3, 3],
    },
  },
  rooms: {
    id: 'rooms',
    name: 'Комнаты',
    baseCost: 200000 as GoldU, // 20 gold
    maxLevel: 5,
    effects: {
      capacity: [3, 4, 5, 6, 7, 8],
    },
  },
  decor: {
    id: 'decor',
    name: 'Декор',
    baseCost: 50000 as GoldU, // 5 gold
    maxLevel: 5,
    effects: {
      qualityBonus: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
    },
  },
};
```

### Cost Formula
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
```typescript
// src/config/upgradeBranches.ts
export function getUpgradeCost(branchId: UpgradeBranchId, currentLevel: number): GoldU {
  const branch = UPGRADE_BRANCHES[branchId];
  // Use Math.floor to ensure integer result
  return Math.floor(branch.baseCost * Math.pow(2, currentLevel)) as GoldU;
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
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
```typescript
// Already exists in src/types/state.ts
interface TavernSlice {
  readonly level: number;                    // Общий уровень таверны (0-20)
  readonly upgrades: Record<string, number>; // { bar: 2, kitchen: 1, ... }
}
```

Note: `tavern.level` ranges from 0 (no upgrades) to 20 (all branches maxed). This is intentional - it represents overall tavern progression.

---

## 2. Actions and Reducer

### Action Definition
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
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
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
```typescript
// src/reducer/handlers.ts

import {
  UPGRADE_BRANCHES,
  getUpgradeCost,
  type UpgradeBranchId,
  type UpgradeBranchConfig
} from '../config/upgradeBranches';
import {
  tavernUpgradeApplied,
  tavernUpgradeRejected
} from '../types/events';
import {
  tavernError,
  invalidBranch,
  maxLevelReached,
  insufficientGoldForUpgrade,
  corruptedState
} from '../types/errors';
import type { GameState, ReduceResult, DomainEvent, GoldU } from '../types';
import { success, failure } from '../types';

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
    events.push(tavernUpgradeRejected(branchId, 0, 'INVALID_BRANCH'));
    return failure(state, events, invalidBranch(branchId));
  }

  // 2. Get current level (default 0)
  const currentLevel = state.tavern.upgrades[branchId] ?? 0;

  // 3. Handle corrupted state (level > maxLevel)
  if (currentLevel > branch.maxLevel) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, 'MAX_LEVEL_REACHED'));
    return failure(state, events, corruptedState(branchId, currentLevel));
  }

  // 4. Check: already max level?
  if (currentLevel >= branch.maxLevel) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, 'MAX_LEVEL_REACHED'));
    return failure(state, events, maxLevelReached(branchId));
  }

  // 5. Calculate cost
  const cost = getUpgradeCost(branchId, currentLevel);

  // 6. Check: enough gold?
  const availableGold = state.wallet.gold;
  if (availableGold < cost) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, 'INSUFFICIENT_GOLD'));
    return failure(state, events, insufficientGoldForUpgrade(branchId, cost, availableGold));
  }

  // 7. Apply upgrade
  const newLevel = currentLevel + 1;
  const newGold = state.wallet.gold - cost;

  const newState: GameState = {
    ...state,
    wallet: {
      ...state.wallet,
      gold: newGold,
    },
    tavern: {
      ...state.tavern,
      level: state.tavern.level + 1,  // Increment overall tavern level
      upgrades: {
        ...state.tavern.upgrades,
        [branchId]: newLevel,
      },
    },
    meta: {
      ...state.meta,
      lastSeenAtMs: now,
    },
  };

  // 8. Emit event
  events.push(tavernUpgradeApplied(branchId, newLevel, cost));

  return success(newState, events);
}
```

### Error Types
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
```typescript
// src/types/errors.ts

// Add to ErrorCode union
export type ErrorCode =
  // ... existing codes ...
  | "INVALID_BRANCH"
  | "MAX_LEVEL_REACHED"
  | "INSUFFICIENT_GOLD_FOR_UPGRADE"
  | "CORRUPTED_STATE";

// New error type
export interface TavernError {
  readonly type: "TAVERN_ERROR";
  readonly branchId: string;
  readonly code: ErrorCode;
  readonly message: string;
}

// Error factories
export function tavernError(
  code: ErrorCode,
  branchId: string,
  message: string
): TavernError {
  return { type: "TAVERN_ERROR", code, branchId, message };
}

export function invalidBranch(branchId: string): TavernError {
  return tavernError("INVALID_BRANCH", branchId, `Invalid upgrade branch: ${branchId}`);
}

export function maxLevelReached(branchId: string): TavernError {
  return tavernError("MAX_LEVEL_REACHED", branchId, `Branch ${branchId} is already at max level`);
}

export function insufficientGoldForUpgrade(
  branchId: string,
  cost: GoldU,
  available: GoldU
): TavernError {
  return tavernError(
    "INSUFFICIENT_GOLD_FOR_UPGRADE",
    branchId,
    `Insufficient gold: need ${cost} to upgrade ${branchId}, have ${available}`
  );
export function corruptedState(branchId: string, level: number): TavernError {
  return tavernError(
    "CORRUPTED_STATE",
    branchId,
    `Corrupted state: branch ${branchId} has level ${level} which exceeds max`
  );
```

---

## 3. Events Types
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
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

---

## 4. Effect Application

### Upgrade Effects Interface
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
```typescript
// src/tavern/types.ts

export interface UpgradeEffects {
  readonly goldMultiplier: number;
  readonly maxCapacity: number;
  readonly visitorTier: number;
  readonly qualityBonus: number;
}
```

### Get Effects Function
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
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

### Director Integration
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
The existing `src/systems/director/service.ts`:

The `canSpawn` method:
```typescript
// In src/systems/director/service.ts
// Import { getUpgradeEffects } from '../../tavern';
import { UPGRADE_BRANCHES } from '../../config/upgradeBranches';

import type { DirectorState, GameState } from '../../types';

export class DirectorServiceImpl {
  // ... existing code ...

  // Modified canSpawn to check capacity from upgrades
  canSpawn(state: DirectorState, rosterSize: number, gameState: GameState): boolean {
    const effects = getUpgradeEffects(gameState.tavern.upgrades);
    return state.visitors.length < effects.maxCapacity;
  }

  // Modified spawn logic to use effects
  // ... in spawn method, pass gameState and use effects
}
```

### Income Integration
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
```typescript
// In src/time/tick.ts orimport { getUpgradeEffects } from '../tavern';
import type { GameState, from '../types';

// In income calculation:
function calculateIncome(state: GameState): number {
  const effects = getUpgradeEffects(state.tavern.upgrades);
  const baseIncome = calculateBaseIncome(state.heroes.roster);
  return Math.floor(baseIncome * effects.goldMultiplier);
}
```

---

## 5. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/config/upgradeBranches.ts` | Create | Upgrade branch config, cost formula, type exports |
| `src/tavern/types.ts` | Create | UpgradeEffects interface |
| `src/tavern/getUpgradeEffects.ts` | Create | Get effects function |
| `src/tavern/index.ts` | Create | Barrel export |
| `src/types/actions.ts` | Modify | Add `UpgradeTavernAction` and factory |
| `src/types/events.ts` | Modify | Add `TavernUpgradeAppliedEvent`, `TavernUpgradeRejectedEvent`, factories |
| `src/types/errors.ts` | Modify | Add `TavernError`, error codes, factories |
| `src/reducer/handlers.ts` | Modify | Add `handleUpgradeTavern` handler |
| `src/reducer/index.ts` | Modify | Wire up new handler |
| `src/systems/director/service.ts` | Modify | Apply effects to spawning logic |
| `src/time/tick.ts` | Modify | Apply goldMultiplier to income |
| `src/frontend/ui/UpgradePanel.ts` | Create *(conditional)* UI component |
| `src/frontend/scenes/HUDScene.ts` | Modify *(conditional)* Integrate UpgradePanel |
| `tests/unit/upgradeBranches.test.ts` | Create | Config and cost formula tests |
| `tests/unit/getUpgradeEffects.test.ts` | Create | Effects function tests |
| `tests/unit/reducer-upgradeTavern.test.ts` | Create | Action handler tests |
| `tests/integration/tavern-upgrades.test.ts` | Create | Integration tests |

**\* = Frontend files are conditional on require `feature/frontend-phaser` branch to be merged to `develop` first.*

---

## 6. Key Tests

### Test Helpers (following existing pattern)
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
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
    wallet: { ...state.wallet, gold },
    tavern: { ...state.tavern, upgrades },
  };
}
```

### Reducer Tests
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
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
  describe("successful upgrades", () => {
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

  describe("edge cases", () => {
    it("handles corrupted state (level > maxLevel)", () => {
      const state = createStateWithUpgrades({ bar: 10 }, 10000000); // Level 10 > max 5
      const result = reduce(state, upgradeTavern('bar'), Date.now());

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("CORRUPTED_STATE");
    });

    it("rejects invalid branch ID", () => {
      const state = createStateWithUpgrades({}, 10000000);
      const result = reduce(state, { type: "UPGRADE_TAVERN", branchId: "invalid" as any }, Date.now());

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("INVALID_BRANCH");
    });
  });
});
```

### Effects Tests
#
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
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
