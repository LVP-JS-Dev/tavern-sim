/**
 * Adventure System Types
 *
 * Manages hero adventures, quests, and expeditions.
 */
import type { GoldU } from '../../types';

/** Types of adventures heroes can embark on */
export type AdventureType = 'hunt' | 'dungeon' | 'escort' | 'investigation';

/** Adventure status lifecycle */
export type AdventureStatus = 'preparing' | 'in_progress' | 'completed' | 'failed';

/** Item rarity tiers */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** A single adventure instance */
export interface Adventure {
  readonly id: string;
  readonly type: AdventureType;
  readonly status: AdventureStatus;
  readonly heroIds: readonly string[];
  readonly startedAt: number;
  readonly duration: number;
  readonly progress: number;
  readonly difficulty: number;
  readonly rarity: Rarity;
  readonly loot?: readonly LootDrop[];
}

/** Loot drop from completed adventure */
export interface LootDrop {
  readonly itemId: string;
  readonly quantity: number;
  readonly rarity: Rarity;
}

/** Adventure system state */
export interface AdventureState {
  readonly adventures: readonly Adventure[];
  readonly nextAdventureId: number;
}

/** Empty state factory */
export const emptyAdventureState = (): AdventureState => ({
  adventures: [],
  nextAdventureId: 1,
});

/** Adventure context for service calls */
export interface AdventureContext {
  readonly state: import('../../types').GameState;
  readonly rng: import('../../core/rng').RngService;
  readonly now: number;
}

/** Adventure service interface */
export interface AdventureService {
  /** Start a new adventure */
  startAdventure(
    ctx: AdventureContext,
    type: AdventureType,
    heroIds: readonly string[]
  ): Adventure | null;

  /** Update adventure progress */
  updateProgress(ctx: AdventureContext): readonly Adventure[];

  /** Complete adventure and generate loot */
  completeAdventure(
    ctx: AdventureContext,
    adventureId: string
  ): { adventure: Adventure; loot: readonly LootDrop[] } | null;
}
