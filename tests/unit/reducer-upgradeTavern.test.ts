import { describe, it, expect } from "vitest";
import { upgradeTavern, isUpgradeTavernAction } from "../../src/types/actions";
import {
  tavernUpgradeApplied,
  tavernUpgradeRejected,
  isTavernUpgradeAppliedEvent,
  isTavernUpgradeRejectedEvent,
} from "../../src/types/events";
import {
  invalidBranch,
  tavernMaxLevelReached as maxLevelReached,
  insufficientGoldForUpgrade,
  corruptedState,
  isTavernError,
} from "../../src/types/errors";
import type { GoldU, GameState } from "../../src/types";
import { createInitialState } from "../../src/state/initial";
import { handleUpgradeTavern } from "../../src/reducer/handlers";
import { reduce } from "../../src/reducer";

function createStateWithUpgrades(
  upgrades: Record<string, number>,
  gold: number = 10000000,
  now?: number,
): GameState {
  const timestamp = now ?? 1700000000000;
  const state = createInitialState(timestamp, 12345);
  return {
    ...state,
    wallet: { ...state.wallet, gold },
    tavern: { ...state.tavern, upgrades },
  };
}

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
    const error = insufficientGoldForUpgrade(
      "kitchen",
      150000 as GoldU,
      100000 as GoldU,
    );
    expect(error.code).toBe("INSUFFICIENT_GOLD_FOR_UPGRADE");
    expect(error.branchId).toBe("kitchen");
    expect(isTavernError(error)).toBe(true);
  });

  it("corruptedState creates error", () => {
    const error = corruptedState("bar", 10);
    expect(error.code).toBe("CORRUPTED_STATE");
    expect(error.branchId).toBe("bar");
  });
});

describe("handleUpgradeTavern", () => {
  describe("successful upgrades", () => {
    it("increases branch level and deducts gold", () => {
      const state = createStateWithUpgrades({ bar: 0 }, 100000);
      const result = handleUpgradeTavern(
        state,
        upgradeTavern("bar"),
        Date.now(),
      );

      expect(result.state.tavern.upgrades["bar"]).toBe(1);
      expect(result.state.wallet.gold).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it("increases overall tavern level", () => {
      const state = createStateWithUpgrades({}, 10000000);
      const result = handleUpgradeTavern(
        state,
        upgradeTavern("bar"),
        Date.now(),
      );
      expect(result.state.tavern.level).toBe(2);
    });

    it("emits TAVERN_UPGRADE_APPLIED event", () => {
      const state = createStateWithUpgrades({ bar: 0 }, 100000);
      const result = handleUpgradeTavern(
        state,
        upgradeTavern("bar"),
        Date.now(),
      );

      const appliedEvents = result.events.filter(
        (e) => e.type === "TAVERN_UPGRADE_APPLIED",
      );
      expect(appliedEvents).toHaveLength(1);
    });
  });

  describe("validation failures", () => {
    it("rejects invalid branch ID", () => {
      const state = createStateWithUpgrades({}, 10000000);
      const result = handleUpgradeTavern(
        state,
        { type: "UPGRADE_TAVERN", branchId: "invalid" as any },
        Date.now(),
      );

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("INVALID_BRANCH");
    });

    it("rejects when at max level", () => {
      const state = createStateWithUpgrades({ bar: 5 }, 10000000);
      const result = handleUpgradeTavern(
        state,
        upgradeTavern("bar"),
        Date.now(),
      );

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("MAX_LEVEL_REACHED");
    });

    it("rejects when not enough gold", () => {
      const state = createStateWithUpgrades({ bar: 0 }, 50000);
      const result = handleUpgradeTavern(
        state,
        upgradeTavern("bar"),
        Date.now(),
      );

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("INSUFFICIENT_GOLD_FOR_UPGRADE");
    });
  });

  describe("edge cases", () => {
    it("handles corrupted state (level > maxLevel)", () => {
      const state = createStateWithUpgrades({ bar: 10 }, 10000000);
      const result = handleUpgradeTavern(
        state,
        upgradeTavern("bar"),
        Date.now(),
      );

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("CORRUPTED_STATE");
    });
  });
});

describe("reduce() integration", () => {
  it("routes UPGRADE_TAVERN to handler", () => {
    const state = createStateWithUpgrades({ bar: 0 }, 100000);
    const result = reduce(state, upgradeTavern("bar"), Date.now());

    expect(result.state.tavern.upgrades["bar"]).toBe(1);
    expect(result.state.wallet.gold).toBe(0);
  });

  it("returns error for unknown action type gracefully", () => {
    const state = createStateWithUpgrades({}, 10000000);
    const result = reduce(state, { type: "UNKNOWN" as any }, Date.now());

    expect(result.error).toBeDefined();
  });
});

import { DirectorServiceImpl } from "../../src/systems/director/service";
import { applyMultipleTicks } from "../../src/reducer/handlers";

describe("Director spawning with upgrades", () => {
  it("respects maxCapacity from rooms upgrades", () => {
    const director = new DirectorServiceImpl();

    // Create state with rooms level 0 (capacity 3)
    const state0 = createStateWithUpgrades({ rooms: 0 }, 10000000);
    state0.director.visitors = [{ id: "1" }, { id: "2" }, { id: "3" }];
    expect(director.canSpawn(state0.director, 0, state0)).toBe(false);

    // Create state with rooms level 2 (capacity 5)
    const state2 = createStateWithUpgrades({ rooms: 2 }, 10000000);
    state2.director.visitors = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    expect(director.canSpawn(state2.director, 0, state2)).toBe(true);
  });
});

describe("income calculation with upgrades", () => {
  it("goldMultiplier affects income", () => {
    // Create state with bar level 0 (multiplier 1)
    const now = Date.now();
    let state0 = createStateWithUpgrades({ bar: 0 }, 10000000, now);
    state0 = {
      ...state0,
      heroes: {
        ...state0.heroes,
        roster: {
          ...state0.heroes.roster,
          "barkeep": { level: 1, incomePerSecondU: 1000 },
        },
      },
    };

    const result0 = applyMultipleTicks(state0, 25, now);
    const goldEarned0 = result0.state.wallet.gold - 10000000;

    // Create state with bar level 2 (multiplier 1.5)
    let state2 = createStateWithUpgrades({ bar: 2 }, 10000000, now);
    state2 = {
      ...state2,
      heroes: {
        ...state2.heroes,
        roster: {
          ...state2.heroes.roster,
          "barkeep": { level: 1, incomePerSecondU: 1000 },
        },
      },
    };

    const result2 = applyMultipleTicks(state2, 25, now);
    const goldEarned2 = result2.state.wallet.gold - 10000000;

    // Gold with multiplier should be higher
    expect(goldEarned2).toBeGreaterThan(goldEarned0);
  });
});
