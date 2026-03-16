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
