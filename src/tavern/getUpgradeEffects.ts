import type { UpgradeEffects } from "./types";
import { UPGRADE_BRANCHES, type UpgradeBranchId } from "../config/upgradeBranches";

/**
 * Normalizes a level value to ensure it's within valid bounds.
 * Clamps to [0, maxLevel] for the given branch.
 */
function normalizeLevel(branchId: UpgradeBranchId, level: number | undefined): number {
  if (level === undefined || !Number.isInteger(level)) {
    return 0;
  }
  const maxLevel = UPGRADE_BRANCHES[branchId].maxLevel;
  return Math.min(Math.max(level, 0), maxLevel);
}

export function getUpgradeEffects(upgrades: Record<string, number>): UpgradeEffects {
  const barLevel = normalizeLevel("bar", upgrades["bar"]);
  const kitchenLevel = normalizeLevel("kitchen", upgrades["kitchen"]);
  const roomsLevel = normalizeLevel("rooms", upgrades["rooms"]);
  const decorLevel = normalizeLevel("decor", upgrades["decor"]);

  return {
    goldMultiplier: UPGRADE_BRANCHES.bar.effects.goldMultiplier?.[barLevel] ?? 1,
    maxCapacity: UPGRADE_BRANCHES.rooms.effects.capacity?.[roomsLevel] ?? 3,
    visitorTier: UPGRADE_BRANCHES.kitchen.effects.visitorTiers?.[kitchenLevel] ?? 1,
    qualityBonus: UPGRADE_BRANCHES.decor.effects.qualityBonus?.[decorLevel] ?? 0,
  };
}
