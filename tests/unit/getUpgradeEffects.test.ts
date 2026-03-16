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
