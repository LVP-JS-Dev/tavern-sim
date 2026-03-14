/**
 * Adventure Service Implementation
 *
 * Manages hero adventures, progress tracking, and loot generation.
 */
import type { RngStream } from '../../core/rng';
import type { AdventureContext, Adventure, LootDrop, AdventureType, Rarity } from './types';
import {
  ADVENTURE_BASE_DURATION_MS,
  MAX_ADVENTURES_ACTIVE,
  LOOT_DROP_RATES,
  RARITY_WEIGHTS,
  MIN_DIFFICULTY,
  MAX_DIFFICULTY,
} from './constants';

export class AdventureServiceImpl {
  /**
   * Start a new adventure with the specified heroes.
   */
  startAdventure(
    ctx: AdventureContext,
    type: AdventureType,
    heroIds: readonly string[]
  ): Adventure | null {
    // Validate heroes exist
    if (heroIds.length === 0) return null;

    for (const heroId of heroIds) {
      if (!ctx.state.heroes.roster[heroId]) {
        return null;
      }
    }

    // Check max adventures
    const activeCount = ctx.state.adventures.adventures.filter(
      a => a.status === 'in_progress' || a.status === 'preparing'
    ).length;

    if (activeCount >= MAX_ADVENTURES_ACTIVE) {
      return null;
    }

    const rng = ctx.rng.createStream('adventure');
    const duration = ADVENTURE_BASE_DURATION_MS[type];
    const difficulty = rng.nextInt(MIN_DIFFICULTY, MAX_DIFFICULTY);
    const rarity = this.pickRarity(rng);

    return {
      id: `adv-${ctx.state.adventures.nextAdventureId}`,
      type,
      status: 'preparing',
      heroIds,
      startedAt: ctx.now,
      duration,
      progress: 0,
      difficulty,
      rarity,
    };
  }

  /**
   * Update progress for all active adventures.
   */
  updateProgress(ctx: AdventureContext): readonly Adventure[] {
    return ctx.state.adventures.adventures.map(adventure => {
      if (adventure.status !== 'in_progress') {
        return adventure;
      }

      const elapsed = ctx.now - adventure.startedAt;
      const progress = Math.min(1.0, elapsed / adventure.duration);

      return {
        ...adventure,
        progress,
      };
    });
  }

  /**
   * Complete an adventure and generate loot.
   */
  completeAdventure(
    ctx: AdventureContext,
    adventureId: string
  ): { adventure: Adventure; loot: readonly LootDrop[] } | null {
    const adventure = ctx.state.adventures.adventures.find(a => a.id === adventureId);

    if (!adventure) {
      return null;
    }

    const rng = ctx.rng.createStream('loot');
    const loot = this.generateLoot(rng, adventure);

    const completedAdventure: Adventure = {
      ...adventure,
      status: 'completed',
      loot,
    };

    return {
      adventure: completedAdventure,
      loot,
    };
  }

  /**
   * Generate loot for a completed adventure.
   */
  private generateLoot(rng: RngStream, adventure: Adventure): LootDrop[] {
    const dropCount = LOOT_DROP_RATES[adventure.type];
    const loot: LootDrop[] = [];

    for (let i = 0; i < dropCount; i++) {
      const rarity = this.pickRarity(rng);
      const itemId = this.generateItemId(rng, rarity);

      loot.push({
        itemId,
        quantity: 1,
        rarity,
      });
    }

    return loot;
  }

  /**
   * Pick a rarity based on weighted probabilities.
   */
  private pickRarity(rng: RngStream): Rarity {
    const roll = rng.nextInt(1, 100);
    let cumulative = 0;

    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    for (const rarity of rarities) {
      cumulative += RARITY_WEIGHTS[rarity];
      if (roll <= cumulative) {
        return rarity;
      }
    }

    return 'common';
  }

  /**
   * Generate a random item ID for the given rarity.
   */
  private generateItemId(rng: RngStream, rarity: Rarity): string {
    const prefixes: Record<Rarity, string[]> = {
      common: ['rusty', 'worn', 'simple'],
      uncommon: ['sturdy', 'fine', 'decent'],
      rare: ['excellent', 'superior', 'refined'],
      epic: ['magnificent', 'legendary', 'ancient'],
      legendary: ['mythical', 'divine', 'eternal'],
    };

    const types = ['sword', 'shield', 'potion', 'ring', 'amulet'];
    const prefix = rng.pick(prefixes[rarity]);
    const type = rng.pick(types);

    return `${prefix}-${type}`;
  }
}
