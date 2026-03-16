# Tavern Upgrade System Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a tavern upgrade system where players spend gold to improve 4 branches (bar, kitchen, rooms, decor) with exponential cost scaling and gameplay effects.

**Architecture:** Config-based upgrade system with predefined effects per branch. Each branch has 5 levels with exponential cost formula (baseCost × 2^level). Effects are applied through a central `getUpgradeEffects()` function consumed by Director for income generation and visitor spawning.

**Tech Stack:** TypeScript, Phaser 3, existing StateBridge pattern

---

## 1. Data Structures

### Upgrade Branch Config

```typescript
// src/config/upgradeBranches.ts
export type UpgradeBranchId = 'bar' | 'kitchen' | 'rooms' | 'decor';

export interface UpgradeBranchConfig {
  readonly id: UpgradeBranchId;
  readonly name: string;           // "Бар", "Кухня", etc.
  readonly baseCost: number;       // Базовая стоимость
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
    baseCost: 100,
    maxLevel: 5,
    effects: {
      goldMultiplier: [1, 1.2, 1.5, 2, 2.5, 3],
    },
  },
  kitchen: {
    id: 'kitchen',
    name: 'Кухня',
    baseCost: 150,
    maxLevel: 5,
    effects: {
      visitorTiers: [1, 1, 2, 2, 3, 3],
    },
  },
  rooms: {
    id: 'rooms',
    name: 'Комнаты',
    baseCost: 200,
    maxLevel: 5,
    effects: {
      capacity: [3, 4, 5, 6, 7, 8],
    },
  },
  decor: {
    id: 'decor',
    name: 'Декор',
    baseCost: 50,
    maxLevel: 5,
    effects: {
      qualityBonus: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
    },
  },
};
```

### Cost Formula

```typescript
function getUpgradeCost(branchId: UpgradeBranchId, currentLevel: number): number {
  const branch = UPGRADE_BRANCHES[branchId];
  return branch.baseCost * Math.pow(2, currentLevel);
}
```

Example costs for Bar (baseCost: 100):
- Level 0→1: 100 × 2^0 = 100
- Level 1→2: 100 × 2^1 = 200
- Level 2→3: 100 × 2^2 = 400
- Level 3→4: 100 × 2^3 = 800
- Level 4→5: 100 × 2^4 = 1600
- **Total to max:** 3100 gold

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
export const upgradeTavern = (branchId: UpgradeBranchId): Action => ({
  type: 'upgradeTavern',
  payload: { branchId },
});
```

### Reducer Handler

```typescript
// In src/core/reducer.ts

function handleUpgradeTavern(state: GameState, branchId: UpgradeBranchId): GameState {
  const branch = UPGRADE_BRANCHES[branchId];
  const currentLevel = state.tavern.upgrades[branchId] ?? 0;

  // Check: already max level?
  if (currentLevel >= branch.maxLevel) {
    return state;
  }

  const cost = getUpgradeCost(branchId, currentLevel);

  // Check: enough gold?
  if (state.wallet.gold < cost) {
    return state;
  }

  // Apply upgrade
  return {
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
  };
}
```

### Event

```typescript
// src/types/events.ts
interface TavernUpgradedEvent {
  type: 'tavernUpgraded';
  branchId: UpgradeBranchId;
  newLevel: number;
  cost: number;
}
```

---

## 3. Effect Application

### Get Effects Function

```typescript
// src/core/getUpgradeEffects.ts

export interface UpgradeEffects {
  readonly goldMultiplier: number;
  readonly maxCapacity: number;
  readonly visitorTier: number;
  readonly qualityBonus: number;
}

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

**Income Generation:**
```typescript
// In src/core/Director.ts

function generateIncome(state: GameState): number {
  const effects = getUpgradeEffects(state.tavern.upgrades);
  const visitorCount = state.director.visitors.length;

  // Base: 1 gold per visitor, multiplied by bar's goldMultiplier
  return visitorCount * effects.goldMultiplier;
}
```

**Visitor Spawning:**
```typescript
// In src/core/Director.ts

function spawnVisitor(state: GameState): Visitor | null {
  const effects = getUpgradeEffects(state.tavern.upgrades);

  // Check capacity
  if (state.director.visitors.length >= effects.maxCapacity) {
    return null;
  }

  // Determine visitor type based on visitorTier and qualityBonus
  const tier = effects.visitorTier;
  const qualityRoll = Math.random() + effects.qualityBonus;

  const visitorType = selectVisitorType(tier, qualityRoll);

  return createVisitor(visitorType);
}
```

---

## 4. UI - Upgrade Panel

### UpgradePanel Component

```typescript
// src/frontend/ui/UpgradePanel.ts

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
    const costText = scene.add.text(0, 20, '100 💰', {
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
        costText.setText(`${cost} 💰`);

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
| `src/config/upgradeBranches.ts` | Create | Upgrade branch config |
| `src/core/getUpgradeEffects.ts` | Create | Get effects function |
| `src/types/actions.ts` | Modify | Add `upgradeTavern` action |
| `src/types/events.ts` | Modify | Add `TavernUpgradedEvent` |
| `src/core/reducer.ts` | Modify | Handle `upgradeTavern` action |
| `src/core/Director.ts` | Modify | Apply effects to income and spawning |
| `src/frontend/ui/UpgradePanel.ts` | Create | UI component |
| `src/frontend/scenes/HUDScene.ts` | Modify | Integrate UpgradePanel |
| `tests/unit/upgradeBranches.test.ts` | Create | Config and cost formula tests |
| `tests/unit/getUpgradeEffects.test.ts` | Create | Effects function tests |
| `tests/unit/reducer-upgradeTavern.test.ts` | Create | Action handler tests |
| `tests/integration/tavern-upgrades.test.ts` | Create | Integration tests |

---

## 6. Key Tests

### Reducer Tests

```typescript
// tests/unit/reducer-upgradeTavern.test.ts

describe('upgradeTavern action', () => {
  it('increases branch level and deducts gold', () => {
    const state = createTestState({ gold: 100, upgrades: { bar: 0 } });
    const result = reducer(state, upgradeTavern('bar'));

    expect(result.tavern.upgrades['bar']).toBe(1);
    expect(result.wallet.gold).toBe(0);
  });

  it('does nothing when not enough gold', () => {
    const state = createTestState({ gold: 50, upgrades: { bar: 0 } });
    const result = reducer(state, upgradeTavern('bar'));

    expect(result.tavern.upgrades['bar']).toBe(0);
    expect(result.wallet.gold).toBe(50);
  });

  it('does nothing when at max level', () => {
    const state = createTestState({ gold: 1000, upgrades: { bar: 5 } });
    const result = reducer(state, upgradeTavern('bar'));

    expect(result.tavern.upgrades['bar']).toBe(5);
  });

  it('costs double each level (exponential)', () => {
    const state1 = createTestState({ gold: 100, upgrades: { bar: 0 } });
    const result1 = reducer(state1, upgradeTavern('bar'));
    expect(result1.wallet.gold).toBe(0); // 100 - 100 = 0

    const state2 = createTestState({ gold: 200, upgrades: { bar: 1 } });
    const result2 = reducer(state2, upgradeTavern('bar'));
    expect(result2.wallet.gold).toBe(0); // 200 - 200 = 0

    const state3 = createTestState({ gold: 400, upgrades: { bar: 2 } });
    const result3 = reducer(state3, upgradeTavern('bar'));
    expect(result3.wallet.gold).toBe(0); // 400 - 400 = 0
  });

  it('increases overall tavern level', () => {
    const state = createTestState({ gold: 1000, tavernLevel: 0, upgrades: {} });

    const result1 = reducer(state, upgradeTavern('bar'));
    expect(result1.tavern.level).toBe(1);

    const result2 = reducer(result1, upgradeTavern('kitchen'));
    expect(result2.tavern.level).toBe(2);
  });
});
```

### Effects Tests

```typescript
// tests/unit/getUpgradeEffects.test.ts

describe('getUpgradeEffects', () => {
  it('returns default values with no upgrades', () => {
    const effects = getUpgradeEffects({});
    expect(effects.goldMultiplier).toBe(1);
    expect(effects.maxCapacity).toBe(3);
    expect(effects.visitorTier).toBe(1);
    expect(effects.qualityBonus).toBe(0);
  });

  it('returns correct values at max level', () => {
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
- Action + reducer for state management
- Director applies effects to simulation
- UI panel with 4 buttons in HUDScene

**Cost summary (per branch):**
- Bar: 100 → 200 → 400 → 800 → 1600 (total: 3100)
- Kitchen: 150 → 300 → 600 → 1200 → 2400 (total: 4650)
- Rooms: 200 → 400 → 800 → 1600 → 3200 (total: 6200)
- Decor: 50 → 100 → 200 → 400 → 800 (total: 1550)

**Total to max all branches:** 15,500 gold
