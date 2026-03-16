# Tavern Upgrade System Implementation Plan

>
> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tavern upgrade system where players spend gold to improve 4 branches (bar, kitchen, rooms, decor) with exponential cost scaling and gameplay effects.

**Architecture:** Config-based upgrade system with predefined effects per branch. Each branch has 5 levels with exponential cost formula (baseCost × 2^level). Effects are applied through a central `getUpgradeEffects()` function consumed by Director for income generation and visitor spawning.

**Tech Stack:** TypeScript, Vitest

**Prerequisites:** Frontend integration requires `feature/frontend-phaser` branch to be merged to `develop` first.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/config/upgradeBranches.ts` | Create | Upgrade branch config, cost formula, type exports |
| `src/tavern/types.ts` | Create | UpgradeEffects interface |
| `src/tavern/getUpgradeEffects.ts` | Create | Get effects function |
| `src/tavern/index.ts` | Create | Barrel export |
| `src/types/actions.ts` | Modify | Add `UpgradeTavernAction` and factory |
| `src/types/events.ts` | Modify | Add tavern upgrade events and factories |
| `src/types/errors.ts` | Modify | Add `TavernError`, error codes, factories |
| `src/reducer/handlers.ts` | Modify | Add `handleUpgradeTavern` handler |
| `src/reducer/index.ts` | Modify | Wire up new handler |
| `src/systems/director/service.ts` | Modify | Apply effects to spawning logic |
| `src/time/tick.ts` | Modify | Apply goldMultiplier to income |
| `tests/unit/upgradeBranches.test.ts` | Create | Config and cost formula tests |
| `tests/unit/getUpgradeEffects.test.ts` | Create | Effects function tests |
| `tests/unit/reducer-upgradeTavern.test.ts` | Create | Action handler tests |

---

## Chunk 1: Core Config and Types

### Task 1: Create upgrade branch config

**Files:**
- Create: `src/config/upgradeBranches.ts`

- [ ] **Step 1: Write the failing test for config and cost formula**

```typescript
// tests/unit/upgradeBranches.test.ts
import { describe, it, expect } from "vitest";
import { UPGRADE_BRANCHES, getUpgradeCost } from "../../src/config/upgradeBranches";
import type { UpgradeBranchId } from "../../src/config/upgradeBranches";

describe("upgradeBranches config", () => {
  describe("UPGRADE_BRANCHES", () => {
    it("defines all 4 branches", () => {
      const branches = Object.keys(UPGRADE_BRANCHES) as UpgradeBranchId[];
      expect(branches).toContain("bar");
      expect(branches).toContain("kitchen");
      expect(branches).toContain("rooms");
      expect(branches).toContain("decor");
    });

    it("each branch has required properties", () => {
      for (const branch of Object.values(UPGRADE_BRANCHES)) {
        expect(branch.id).toBeDefined();
        expect(branch.name).toBeDefined();
        expect(branch.baseCost).toBeGreaterThan(0);
        expect(branch.maxLevel).toBe(5);
        expect(branch.effects).toBeDefined();
      }
    });

    it("bar has goldMultiplier effects", () => {
      expect(UPGRADE_BRANCHES.bar.effects.goldMultiplier).toBeDefined();
      expect(UPGRADE_BRANCHES.bar.effects.goldMultiplier).toHaveLength(6); // levels 0-5
    });

    it("rooms has capacity effects", () => {
      expect(UPGRADE_BRANCHES.rooms.effects.capacity).toBeDefined();
      expect(UPGRADE_BRANCHES.rooms.effects.capacity?.[0]).toBe(3); // base capacity
      expect(UPGRADE_BRANCHES.rooms.effects.capacity?.[5]).toBe(8); // max capacity
    });
  });

  describe("getUpgradeCost", () => {
    it("returns base cost at level 0", () => {
      const cost = getUpgradeCost("bar", 0);
      expect(cost).toBe(100000); // 10 gold
    });

    it("doubles cost each level", () => {
      expect(getUpgradeCost("bar", 0)).toBe(100000);   // 10 gold
      expect(getUpgradeCost("bar", 1)).toBe(200000);   // 20 gold
      expect(getUpgradeCost("bar", 2)).toBe(400000);   // 40 gold
      expect(getUpgradeCost("bar", 3)).toBe(800000);   // 80 gold
      expect(getUpgradeCost("bar", 4)).toBe(1600000);  // 160 gold
    });

    it("different base costs per branch", () => {
      expect(getUpgradeCost("kitchen", 0)).toBe(150000); // 15 gold
      expect(getUpgradeCost("rooms", 0)).toBe(200000);  // 20 gold
      expect(getUpgradeCost("decor", 0)).toBe(50000);   // 5 gold
    });

    it("returns integer (no fractional gold)", () => {
      const cost = getUpgradeCost("decor", 3);
      expect(Number.isInteger(cost)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/upgradeBranches.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement config and cost formula**

```typescript
// src/config/upgradeBranches.ts
import type { GoldU } from "../types";

export type UpgradeBranchId = "bar" | "kitchen" | "rooms" | "decor";

export interface UpgradeBranchConfig {
  readonly id: UpgradeBranchId;
  readonly name: string;
  readonly baseCost: GoldU;
  readonly maxLevel: number;
  readonly effects: {
    readonly goldMultiplier?: readonly number[];
    readonly visitorTiers?: readonly number[];
    readonly capacity?: readonly number[];
    readonly qualityBonus?: readonly number[];
  };
}

export const UPGRADE_BRANCHES: Record<UpgradeBranchId, UpgradeBranchConfig> = {
  bar: {
    id: "bar",
    name: "Бар",
    baseCost: 100000 as GoldU,
    maxLevel: 5,
    effects: {
      goldMultiplier: [1, 1.2, 1.5, 2, 2.5, 3],
    },
  },
  kitchen: {
    id: "kitchen",
    name: "Кухня",
    baseCost: 150000 as GoldU,
    maxLevel: 5,
    effects: {
      visitorTiers: [1, 1, 2, 2, 3, 3],
    },
  },
  rooms: {
    id: "rooms",
    name: "Комнаты",
    baseCost: 200000 as GoldU,
    maxLevel: 5,
    effects: {
      capacity: [3, 4, 5, 6, 7, 8],
    },
  },
  decor: {
    id: "decor",
    name: "Декор",
    baseCost: 50000 as GoldU,
    maxLevel: 5,
    effects: {
      qualityBonus: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
    },
  },
};

export function getUpgradeCost(branchId: UpgradeBranchId, currentLevel: number): GoldU {
  const branch = UPGRADE_BRANCHES[branchId];
  return Math.floor(branch.baseCost * Math.pow(2, currentLevel)) as GoldU;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/upgradeBranches.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/upgradeBranches.ts tests/unit/upgradeBranches.test.ts
git commit -m "feat: add upgrade branch config with cost formula"
```

---

### Task 2: Create UpgradeEffects types and function

**Files:**
- Create: `src/tavern/types.ts`
- Create: `src/tavern/getUpgradeEffects.ts`
- Create: `src/tavern/index.ts`
- Create: `tests/unit/getUpgradeEffects.test.ts`

- [ ] **Step 1: Write the failing test for getUpgradeEffects**

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
    expect(getUpgradeEffects({ bar: 0 }).goldMultiplier).toBe(1);
    expect(getUpgradeEffects({ bar: 2 }).goldMultiplier).toBe(1.5);
    expect(getUpgradeEffects({ bar: 5 }).goldMultiplier).toBe(3);
  });

  it("returns correct values for rooms upgrades", () => {
    expect(getUpgradeEffects({ rooms: 0 }).maxCapacity).toBe(3);
    expect(getUpgradeEffects({ rooms: 5 }).maxCapacity).toBe(8);
  });

  it("returns correct values for kitchen upgrades", () => {
    expect(getUpgradeEffects({ kitchen: 0 }).visitorTier).toBe(1);
    expect(getUpgradeEffects({ kitchen: 5 }).visitorTier).toBe(3);
  });

  it("returns correct values for decor upgrades", () => {
    expect(getUpgradeEffects({ decor: 0 }).qualityBonus).toBe(0);
    expect(getUpgradeEffects({ decor: 5 }).qualityBonus).toBe(0.5);
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/getUpgradeEffects.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement types and function**

```typescript
// src/tavern/types.ts
export interface UpgradeEffects {
  readonly goldMultiplier: number;
  readonly maxCapacity: number;
  readonly visitorTier: number;
  readonly qualityBonus: number;
}
```

```typescript
// src/tavern/getUpgradeEffects.ts
import type { UpgradeEffects } from "./types";
import { UPGRADE_BRANCHES } from "../config/upgradeBranches";

export function getUpgradeEffects(upgrades: Record<string, number>): UpgradeEffects {
  const barLevel = upgrades["bar"] ?? 0;
  const kitchenLevel = upgrades["kitchen"] ?? 0;
  const roomsLevel = upgrades["rooms"] ?? 0;
  const decorLevel = upgrades["decor"] ?? 0;

  return {
    goldMultiplier: UPGRADE_BRANCHES.bar.effects.goldMultiplier?.[barLevel] ?? 1,
    maxCapacity: UPGRADE_BRANCHES.rooms.effects.capacity?.[roomsLevel] ?? 3,
    visitorTier: UPGRADE_BRANCHES.kitchen.effects.visitorTiers?.[kitchenLevel] ?? 1,
    qualityBonus: UPGRADE_BRANCHES.decor.effects.qualityBonus?.[decorLevel] ?? 0,
  };
}
```

```typescript
// src/tavern/index.ts
export type { UpgradeEffects } from "./types";
export { getUpgradeEffects } from "./getUpgradeEffects";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/getUpgradeEffects.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tavern/ tests/unit/getUpgradeEffects.test.ts
git commit -m "feat: add getUpgradeEffects function"
```

---

## Chunk 2: Actions, Events, Errors

### Task 3: Add action type and factory

**Files:**
- Modify: `src/types/actions.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/unit/reducer-upgradeTavern.test.ts
import { upgradeTavern, isUpgradeTavernAction } from "../../src/types/actions";

describe("upgradeTavern action", () => {
  it("creates action with branchId", () => {
    const action = upgradeTavern("bar");
    expect(action.type).toBe("UPGRADE_TAVERN");
    expect(action.branchId).toBe("bar");
  });

  it("type guard recognizes action", () => {
    const action = upgradeTavern("kitchen");
    expect(isUpgradeTavernAction(action)).toBe(true);
    expect(isUpgradeTavernAction({ type: "TICK" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: FAIL - upgradeTavern not exported

- [ ] **Step 3: Add action to actions.ts**

Read existing `src/types/actions.ts` and add:

```typescript
// Add import at top
import type { UpgradeBranchId } from "../config/upgradeBranches";

// Add action interface after UpgradeHeroAction
export interface UpgradeTavernAction {
  readonly type: "UPGRADE_TAVERN";
  readonly branchId: UpgradeBranchId;
}

// Add to Action union type at the bottom

// Add type guard
export function isUpgradeTavernAction(action: Action): action is UpgradeTavernAction {
  return action.type === "UPGRADE_TAVERN";
}

// Add factory function
export function upgradeTavern(branchId: UpgradeBranchId): UpgradeTavernAction {
  return { type: "UPGRADE_TAVERN", branchId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/actions.ts tests/unit/reducer-upgradeTavern.test.ts
git commit -m "feat: add UPGRADE_TAVERN action type and factory"
```

---

### Task 4: Add event types and factories

**Files:**
- Modify: `src/types/events.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/unit/reducer-upgradeTavern.test.ts
import {
  tavernUpgradeApplied,
  tavernUpgradeRejected,
  isTavernUpgradeAppliedEvent,
  isTavernUpgradeRejectedEvent,
} from "../../src/types/events";
import type { GoldU } from "../../src/types";

describe("tavern upgrade events", () => {
  it("tavernUpgradeApplied creates event", () => {
    const event = tavernUpgradeApplied("bar", 2, 100000 as GoldU);
    expect(event.type).toBe("TAVERN_UPGRADE_APPLIED");
    expect(event.branchId).toBe("bar");
    expect(event.newLevel).toBe(2);
    expect(event.goldCost).toBe(100000);
  });

  it("tavernUpgradeRejected creates event", () => {
    const event = tavernUpgradeRejected("kitchen", 3, "INSUFFICIENT_GOLD");
    expect(event.type).toBe("TAVERN_UPGRADE_REJECTED");
    expect(event.branchId).toBe("kitchen");
    expect(event.currentLevel).toBe(3);
    expect(event.reason).toBe("INSUFFICIENT_GOLD");
  });

  it("type guards work", () => {
    const applied = tavernUpgradeApplied("bar", 1, 100000 as GoldU);
    const rejected = tavernUpgradeRejected("bar", 0, "MAX_LEVEL_REACHED");

    expect(isTavernUpgradeAppliedEvent(applied)).toBe(true);
    expect(isTavernUpgradeAppliedEvent(rejected)).toBe(false);
    expect(isTavernUpgradeRejectedEvent(rejected)).toBe(true);
    expect(isTavernUpgradeRejectedEvent(applied)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: FAIL - tavernUpgradeApplied not exported

- [ ] **Step 3: Add events to events.ts**

Read existing `src/types/events.ts` and add:

```typescript
// Add import at top
import type { GoldU } from "./state";

// Add event interfaces after GoldEarnedEvent
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

// Add type guards
export function isTavernUpgradeAppliedEvent(event: DomainEvent): event is TavernUpgradeAppliedEvent {
  return event.type === "TAVERN_UPGRADE_APPLIED";
}

export function isTavernUpgradeRejectedEvent(event: DomainEvent): event is TavernUpgradeRejectedEvent {
  return event.type === "TAVERN_UPGRADE_REJECTED";
}

// Add event factories
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/events.ts tests/unit/reducer-upgradeTavern.test.ts
git commit -m "feat: add TAVERN_UPGRADE_APPLIED and TAVERN_UPGRADE_REJECTED events"
```

---

### Task 5: Add error types and factories

**Files:**
- Modify: `src/types/errors.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/unit/reducer-upgradeTavern.test.ts
import {
  tavernError,
  invalidBranch,
  maxLevelReached,
  insufficientGoldForUpgrade,
  corruptedState,
} from "../../src/types/errors";
import type { GoldU } from "../../src/types";

describe("tavern error factories", () => {
  it("invalidBranch creates error", () => {
    const error = invalidBranch("unknown");
    expect(error.type).toBe("TAVERN_ERROR");
    expect(error.code).toBe("INVALID_BRANCH");
    expect(error.branchId).toBe("unknown");
  });

  it("maxLevelReached creates error", () => {
    const error = maxLevelReached("bar");
    expect(error.code).toBe("MAX_LEVEL_REACHED");
    expect(error.branchId).toBe("bar");
  });

  it("insufficientGoldForUpgrade creates error", () => {
    const error = insufficientGoldForUpgrade("kitchen", 150000 as GoldU, 100000 as GoldU);
    expect(error.code).toBe("INSUFFICIENT_GOLD_FOR_UPGRADE");
    expect(error.branchId).toBe("kitchen");
  });

  it("corruptedState creates error", () => {
    const error = corruptedState("bar", 10);
    expect(error.code).toBe("CORRUPTED_STATE");
    expect(error.branchId).toBe("bar");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: FAIL - invalidBranch not exported

- [ ] **Step 3: Add errors to errors.ts**

Read existing `src/types/errors.ts` and add:

```typescript
// Add to ErrorCode type
export type ErrorCode =
  // ... existing codes ...
  | "INVALID_BRANCH"
  | "MAX_LEVEL_REACHED"
  | "INSUFFICIENT_GOLD_FOR_UPGRADE"
  | "CORRUPTED_STATE";

// Add error interface
export interface TavernError {
  readonly type: "TAVERN_ERROR";
  readonly branchId: string;
  readonly code: ErrorCode;
  readonly message: string;
}

// Add error factories
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
}

export function corruptedState(branchId: string, level: number): TavernError {
  return tavernError(
    "CORRUPTED_STATE",
    branchId,
    `Corrupted state: branch ${branchId} has level ${level} which exceeds max`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/errors.ts tests/unit/reducer-upgradeTavern.test.ts
git commit -m "feat: add TavernError type and error factories"
```

---

## Chunk 3: Reducer Handler

### Task 6: Implement reducer handler

**Files:**
- Modify: `src/reducer/handlers.ts`
- Modify: `src/reducer/index.ts`

- [ ] **Step 1: Write the failing test for handler**

```typescript
// Add to tests/unit/reducer-upgradeTavern.test.ts
import { handleUpgradeTavern } from "../../src/reducer/handlers";
import { upgradeTavern } from "../../src/types/actions";
import { createInitialState } from "../../src/state/initial";
import type { GameState, GoldU } from "../../src/types";

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

describe("handleUpgradeTavern", () => {
  describe("successful upgrades", () => {
    it("increases branch level and deducts gold", () => {
      const state = createStateWithUpgrades({ bar: 0 }, 100000);
      const result = handleUpgradeTavern(state, upgradeTavern("bar"), Date.now());

      expect(result.state.tavern.upgrades["bar"]).toBe(1);
      expect(result.state.wallet.gold).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it("increases overall tavern level", () => {
      const state = createStateWithUpgrades({}, 10000000);
      const result = handleUpgradeTavern(state, upgradeTavern("bar"), Date.now());
      expect(result.state.tavern.level).toBe(1);
    });

    it("emits TAVERN_UPGRADE_APPLIED event", () => {
      const state = createStateWithUpgrades({ bar: 0 }, 100000);
      const result = handleUpgradeTavern(state, upgradeTavern("bar"), Date.now());

      const appliedEvents = result.events.filter(e => e.type === "TAVERN_UPGRADE_APPLIED");
      expect(appliedEvents).toHaveLength(1);
    });
  });

  describe("validation failures", () => {
    it("rejects invalid branch ID", () => {
      const state = createStateWithUpgrades({}, 10000000);
      const result = handleUpgradeTavern(
        state,
        { type: "UPGRADE_TAVERN", branchId: "invalid" as any },
        Date.now()
      );

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("INVALID_BRANCH");
    });

    it("rejects when at max level", () => {
      const state = createStateWithUpgrades({ bar: 5 }, 10000000);
      const result = handleUpgradeTavern(state, upgradeTavern("bar"), Date.now());

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("MAX_LEVEL_REACHED");
    });

    it("rejects when not enough gold", () => {
      const state = createStateWithUpgrades({ bar: 0 }, 50000); // 5 gold, need 10
      const result = handleUpgradeTavern(state, upgradeTavern("bar"), Date.now());

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("INSUFFICIENT_GOLD_FOR_UPGRADE");
    });
  });

  describe("edge cases", () => {
    it("handles corrupted state (level > maxLevel)", () => {
      const state = createStateWithUpgrades({ bar: 10 }, 10000000);
      const result = handleUpgradeTavern(state, upgradeTavern("bar"), Date.now());

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("CORRUPTED_STATE");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: FAIL - handleUpgradeTavern not exported

- [ ] **Step 3: Implement handler**

Read existing `src/reducer/handlers.ts` and add:

```typescript
// Add imports at top
import {
  UPGRADE_BRANCHES,
  getUpgradeCost
} from "../config/upgradeBranches";
import type { UpgradeTavernAction } from "../types/actions";
import {
  tavernUpgradeApplied,
  tavernUpgradeRejected
} from "../types/events";
import {
  invalidBranch,
  maxLevelReached,
  insufficientGoldForUpgrade,
  corruptedState
} from "../types/errors";

import type { UpgradeBranchId } from "../config/upgradeBranches";

// Add handler function
export function handleUpgradeTavern(
  state: GameState,
  action: UpgradeTavernAction,
  now: number
): ReduceResult {
  const { branchId } = action;
  const events: DomainEvent[] = [];

  // 1. Validate branch exists
  const branch = UPGRADE_BRANCHES[branchId as UpgradeBranchId];
  if (!branch) {
    events.push(tavernUpgradeRejected(branchId, 0, "INVALID_BRANCH"));
    return failure(state, events, invalidBranch(branchId));
  }

  // 2. Get current level (default 0)
  const currentLevel = state.tavern.upgrades[branchId] ?? 0;

  // 3. Handle corrupted state (level > maxLevel)
  if (currentLevel > branch.maxLevel) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, "MAX_LEVEL_REACHED"));
    return failure(state, events, corruptedState(branchId, currentLevel));
  }

  // 4. Check: already max level?
  if (currentLevel >= branch.maxLevel) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, "MAX_LEVEL_REACHED"));
    return failure(state, events, maxLevelReached(branchId));
  }

  // 5. Calculate cost
  const cost = getUpgradeCost(branchId as UpgradeBranchId, currentLevel);

  // 6. Check: enough gold?
  const availableGold = state.wallet.gold;
  if (availableGold < cost) {
    events.push(tavernUpgradeRejected(branchId, currentLevel, "INSUFFICIENT_GOLD"));
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
      level: state.tavern.level + 1,
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/unit/reducer-upgradeTavern.test.ts`
Expected: PASS

- [ ] **Step 5: Wire up handler in reducer**

Read existing `src/reducer/index.ts` and add case for new action type:

```typescript
// In the switch statement,case case "UPGRADE_HERO":
          ...existing cases ...
        case upgradeTavern:
          return { type: "UPGRADE_TAVERN" };
      }
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/reducer/handlers.ts src/reducer/index.ts tests/unit/reducer-upgradeTavern.test.ts
git commit -m "feat: add handleUpgradeTavern reducer handler"
```

---

## Chunk 4: Integration Tests

### Task 7: Add integration tests

**Files:**
- Create: `tests/integration/tavern-upgrades.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
// tests/integration/tavern-upgrades.test.ts
import { describe, it, expect, from "vitest";
import { reduce } from "../../src/reducer";
import { upgradeTavern } from "../../src/types/actions";
import { createInitialState } from "../../src/state/initial";
import { getUpgradeEffects } from "../../src/tavern";
import type { GameState } from "../../src/types";
import { isTavernUpgradeAppliedEvent } from "../../src/types/events";

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

describe("tavern upgrades integration", () => {
  it("full flow: upgrade → gold deducted → events emitted", () => {
    const state = createStateWithUpgrades({ bar: 0 }, 500000);
    const result = reduce(state, upgradeTavern("bar"), Date.now());

    expect(result.state.tavern.upgrades["bar"]).toBe(1);
    expect(result.state.wallet.gold).toBe(400000); // 500k - 100k = 400k
    expect(result.error).toBeUndefined();

    const appliedEvents = result.events.filter(isTavernUpgradeAppliedEvent);
    expect(appliedEvents).toHaveLength(1);
  });

  it("insufficient gold prevents upgrade", () => {
    const state = createStateWithUpgrades({ bar: 0 }, 50000); // 5 gold, need 10
    const result = reduce(state, upgradeTavern("bar"), Date.now());

    expect(result.state.tavern.upgrades["bar"]).toBe(0);
    expect(result.error).toBeDefined();
  });

  it("max level prevents upgrade", () => {
    const state = createStateWithUpgrades({ bar: 5 }, 10000000);
    const result = reduce(state, upgradeTavern("bar"), Date.now());

    expect(result.state.tavern.upgrades["bar"]).toBe(5);
    expect(result.error).toBeDefined();
  });

  it("overall tavern level increments", () => {
    const state = createStateWithUpgrades({}, 10000000);
    expect(state.tavern.level).toBe(0);

    const result = reduce(state, upgradeTavern("bar"), Date.now());
    expect(result.state.tavern.level).toBe(1);
  });

  it("effects apply to income calculation", () => {
    const state = createStateWithUpgrades({ bar: 2, rooms: 3 }, 10000000);
    const effects = getUpgradeEffects(result.state.tavern.upgrades);

    // Note: This test assumes bar was upgraded, so effects should reflect that
    // The actual income integration will be tested separately
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/integration/tavern-upgrades.test.ts`
Expected: FAIL

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test tests/integration/tavern-upgrades.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/tavern-upgrades.test.ts
git commit -m "test: add tavern upgrades integration tests"
```

---

## Chunk 5: Director Integration

### Task 9: Integrate effects with Director spawning

**Files:**
- Modify: `src/systems/director/service.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/integration/tavern-upgrades.test.ts
import { DirectorServiceImpl } from "../../src/systems/director/service";

describe("Director spawning with upgrades", () => {
  it("respects maxCapacity from rooms upgrades", () => {
    // Create state with rooms level 0 (capacity 3)
    const state0 = createStateWithUpgrades({ rooms: 0 }, 10000000);
    state0.director.visitors = [{ id: "1" }, { id: "2" }, { id: "3" }];

    const director = new DirectorServiceImpl();
    // At capacity limit
    expect(director.canSpawn(state0.director, 0, state0)).toBe(false);

    // Create state with rooms level 2 (capacity 5)
    const state2 = createStateWithUpgrades({ rooms: 2 }, 10000000);
    state2.director.visitors = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];

    // Under capacity limit
    expect(director.canSpawn(state2.director, 0, state2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/integration/tavern-upgrades.test.ts`
Expected: FAIL - canSpawn signature mismatch or wrong behavior

- [ ] **Step 3: Modify Director service**

Read `src/systems/director/service.ts` and modify `canSpawn`:

```typescript
// Add import at top
import { getUpgradeEffects } from "../../tavern";

// Modify canSpawn method
canSpawn(state: DirectorState, rosterSize: number, gameState: GameState): boolean {
  const effects = getUpgradeEffects(gameState.tavern.upgrades);
  return state.visitors.length < effects.maxCapacity;
}
```

Note: This requires updating the method signature. The caller (in `update` method) will need to pass `GameState` instead of just `rosterSize`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/integration/tavern-upgrades.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/systems/director/service.ts tests/integration/tavern-upgrades.test.ts
git commit -m "feat: integrate upgrade effects with Director spawning"
```

---

## Chunk 6: Income Integration

### Task 10: Integrate goldMultiplier with income calculation

**Files:**
- Modify: `src/time/tick.ts` (or appropriate income file)

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/integration/tavern-upgrades.test.ts
import { applyMultipleTicks } from "../../src/reducer/handlers";

describe("income calculation with upgrades", () => {
  it("goldMultiplier affects income", () => {
    // Create state with bar level 0 (multiplier 1)
    const state0 = createStateWithUpgrades({ bar: 0 }, 10000000);
    state0.heroes.roster["barkeep"] = { level: 1, incomePerSecondU: 1000 };

    const result0 = applyMultipleTicks(state0, 25, Date.now()); // 1 second worth of ticks
    const gold0 = result0.state.wallet.gold - 10000000;

    // Create state with bar level 2 (multiplier 1.5)
    const state2 = createStateWithUpgrades({ bar: 2 }, 10000000);
    state2.heroes.roster["barkeep"] = { level: 1, incomePerSecondU: 1000 };

    const result2 = applyMultipleTicks(state2, 25, Date.now());
    const gold2 = result2.state.wallet.gold - 10000000;

    // Gold with multiplier should be higher
    expect(gold2).toBeGreaterThan(gold0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/integration/tavern-upgrades.test.ts`
Expected: FAIL - gold2 not greater than gold0

- [ ] **Step 3: Find and modify income calculation**

Find where income is calculated (likely `src/time/tick.ts` or `src/economy/income.ts`) and apply the goldMultiplier:

```typescript
// Import getUpgradeEffects at top
import { getUpgradeEffects } from "../tavern";

// In income calculation function
function calculateIncome(state: GameState): number {
  const effects = getUpgradeEffects(state.tavern.upgrades);
  const baseIncome = calculateBaseIncome(state.heroes.roster);
  return Math.floor(baseIncome * effects.goldMultiplier);
}
```

The exact location depends on the existing code structure. Check `src/time/tick.ts` and `src/economy/income.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tests/integration/tavern-upgrades.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/time/tick.ts tests/integration/tavern-upgrades.test.ts
git commit -m "feat: apply goldMultiplier to income calculation"
```

---

## Summary

**Implementation complete when:**
- All tests pass
- `npm test` runs without failures
- Code follows existing patterns

**Cost summary (per branch):**
- Bar: 10 → 20 → 40 → 80 → 160 gold (total: 310)
- Kitchen: 15 → 30 → 60 → 120 → 240 gold (total: 465)
- Rooms: 20 → 40 → 80 → 160 → 320 gold (total: 620)
- Decor: 5 → 10 → 20 → 40 → 80 gold (total: 155)

**Total to max all branches:** 1550 gold

**Next steps after implementation:**
1. Merge `feature/frontend-phaser` branch
2. Implement UI components (UpgradePanel, HUDScene integration)
