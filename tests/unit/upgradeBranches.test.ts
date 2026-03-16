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
      expect(UPGRADE_BRANCHES.bar.effects.goldMultiplier).toHaveLength(6);
    });

    it("rooms has capacity effects", () => {
      expect(UPGRADE_BRANCHES.rooms.effects.capacity).toBeDefined();
      expect(UPGRADE_BRANCHES.rooms.effects.capacity?.[0]).toBe(3);
      expect(UPGRADE_BRANCHES.rooms.effects.capacity?.[5]).toBe(8);
    });
  });

  describe("getUpgradeCost", () => {
    it("returns base cost at level 0", () => {
      const cost = getUpgradeCost("bar", 0);
      expect(cost).toBe(100000);
    });

    it("doubles cost each level", () => {
      expect(getUpgradeCost("bar", 0)).toBe(100000);
      expect(getUpgradeCost("bar", 1)).toBe(200000);
      expect(getUpgradeCost("bar", 2)).toBe(400000);
      expect(getUpgradeCost("bar", 3)).toBe(800000);
      expect(getUpgradeCost("bar", 4)).toBe(1600000);
    });

    it("different base costs per branch", () => {
      expect(getUpgradeCost("kitchen", 0)).toBe(150000);
      expect(getUpgradeCost("rooms", 0)).toBe(200000);
      expect(getUpgradeCost("decor", 0)).toBe(50000);
    });

    it("returns integer (no fractional gold)", () => {
      const cost = getUpgradeCost("decor", 3);
      expect(Number.isInteger(cost)).toBe(true);
    });
  });
});
