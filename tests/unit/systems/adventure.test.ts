import { describe, it, expect } from 'vitest';
import type { Adventure, AdventureType, AdventureStatus, LootDrop, Rarity } from '../../../src/systems/adventure/types';
import { ADVENTURE_BASE_DURATION_MS, MAX_ADVENTURES_ACTIVE, LOOT_DROP_RATES, RARITY_WEIGHTS } from '../../../src/systems/adventure/constants';

describe('Adventure Types & Constants', () => {
  describe('ADVENTURE_BASE_DURATION_MS', () => {
    it('should define durations for all adventure types', () => {
      expect(ADVENTURE_BASE_DURATION_MS.hunt).toBeDefined();
      expect(ADVENTURE_BASE_DURATION_MS.dungeon).toBeDefined();
      expect(ADVENTURE_BASE_DURATION_MS.escort).toBeDefined();
      expect(ADVENTURE_BASE_DURATION_MS.investigation).toBeDefined();
    });

    it('should have reasonable durations (10-120 seconds)', () => {
      Object.values(ADVENTURE_BASE_DURATION_MS).forEach(duration => {
        expect(duration).toBeGreaterThanOrEqual(10000);
        expect(duration).toBeLessThanOrEqual(120000);
      });
    });
  });

  describe('MAX_ADVENTURES_ACTIVE', () => {
    it('should be a positive number', () => {
      expect(MAX_ADVENTURES_ACTIVE).toBeGreaterThan(0);
      expect(MAX_ADVENTURES_ACTIVE).toBeLessThanOrEqual(10);
    });
  });

  describe('LOOT_DROP_RATES', () => {
    it('should define drop rates for all adventure types', () => {
      expect(LOOT_DROP_RATES.hunt).toBeDefined();
      expect(LOOT_DROP_RATES.dungeon).toBeDefined();
      expect(LOOT_DROP_RATES.escort).toBeDefined();
      expect(LOOT_DROP_RATES.investigation).toBeDefined();
    });

    it('should have reasonable drop counts (1-5)', () => {
      Object.values(LOOT_DROP_RATES).forEach(count => {
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('RARITY_WEIGHTS', () => {
    it('should define weights for all rarities', () => {
      expect(RARITY_WEIGHTS.common).toBeDefined();
      expect(RARITY_WEIGHTS.uncommon).toBeDefined();
      expect(RARITY_WEIGHTS.rare).toBeDefined();
      expect(RARITY_WEIGHTS.epic).toBeDefined();
      expect(RARITY_WEIGHTS.legendary).toBeDefined();
    });

    it('should have decreasing weights for higher rarities', () => {
      expect(RARITY_WEIGHTS.common).toBeGreaterThan(RARITY_WEIGHTS.uncommon);
      expect(RARITY_WEIGHTS.uncommon).toBeGreaterThan(RARITY_WEIGHTS.rare);
      expect(RARITY_WEIGHTS.rare).toBeGreaterThan(RARITY_WEIGHTS.epic);
      expect(RARITY_WEIGHTS.epic).toBeGreaterThan(RARITY_WEIGHTS.legendary);
    });

    it('should sum to approximately 100', () => {
      const sum = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    });
  });

  describe('Adventure interface', () => {
    it('should have required fields', () => {
      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'preparing',
        heroIds: ['hero-1'],
        startedAt: Date.now(),
        duration: 60000,
        progress: 0,
        difficulty: 3,
        rarity: 'rare',
      };

      expect(adventure.id).toBe('adv-1');
      expect(adventure.type).toBe('dungeon');
      expect(adventure.status).toBe('preparing');
      expect(adventure.heroIds).toEqual(['hero-1']);
      expect(adventure.duration).toBe(60000);
      expect(adventure.progress).toBe(0);
      expect(adventure.difficulty).toBe(3);
      expect(adventure.rarity).toBe('rare');
    });
  });

  describe('LootDrop interface', () => {
    it('should have required fields', () => {
      const loot: LootDrop = {
        itemId: 'sword-1',
        quantity: 2,
        rarity: 'epic',
      };

      expect(loot.itemId).toBe('sword-1');
      expect(loot.quantity).toBe(2);
      expect(loot.rarity).toBe('epic');
    });
  });
});
