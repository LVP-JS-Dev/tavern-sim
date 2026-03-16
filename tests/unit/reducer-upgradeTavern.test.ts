import { describe, it, expect } from "vitest";
import { upgradeTavern, isUpgradeTavernAction } from "../../src/types/actions";
import {
  tavernUpgradeApplied,
  tavernUpgradeRejected,
  isTavernUpgradeAppliedEvent,
  isTavernUpgradeRejectedEvent,
} from "../../src/types/events";
import type { GoldU } from "../../src/types";

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
