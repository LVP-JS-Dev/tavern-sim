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
  // Validate level is within bounds
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel > branch.maxLevel) {
    throw new RangeError(`Invalid level ${currentLevel} for branch '${branchId}'`);
  }
  return Math.floor(branch.baseCost * Math.pow(2, currentLevel)) as GoldU;
}
