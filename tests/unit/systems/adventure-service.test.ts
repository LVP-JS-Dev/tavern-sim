import { describe, it, expect, beforeEach } from 'vitest';
import { AdventureServiceImpl } from '../../../src/systems/adventure/service';
import type { AdventureService, AdventureContext } from '../../../src/systems/adventure/types';
import type { Adventure, LootDrop } from '../../../src/systems/adventure/types';
import { SeededRng } from '../../../src/core/rng';
import { createInitialState } from '../../../src/state/initial';

describe('AdventureService', () => {
  let service: AdventureService;

  beforeEach(() => {
    service = new AdventureServiceImpl();
  });

  describe('startAdventure', () => {
    it('should create a new adventure with valid heroes', () => {
      const ctx: AdventureContext = {
        state: createInitialState(Date.now(), 12345),
        rng: new SeededRng(12345),
        now: Date.now(),
      };

      // Add a hero to the roster
      (ctx.state.heroes.roster as any) = {
        'hero-1': { id: 'hero-1', name: 'Alice', level: 1 },
      };

      const adventure = service.startAdventure(ctx, 'dungeon', ['hero-1']);

      expect(adventure).not.toBeNull();
      expect(adventure!.type).toBe('dungeon');
      expect(adventure!.status).toBe('preparing');
      expect(adventure!.heroIds).toEqual(['hero-1']);
      expect(adventure!.progress).toBe(0);
    });

    it('should return null when no heroes provided', () => {
      const ctx: AdventureContext = {
        state: createInitialState(Date.now(), 12345),
        rng: new SeededRng(12345),
        now: Date.now(),
      };

      const adventure = service.startAdventure(ctx, 'dungeon', []);

      expect(adventure).toBeNull();
    });

    it('should return null when hero does not exist', () => {
      const ctx: AdventureContext = {
        state: createInitialState(Date.now(), 12345),
        rng: new SeededRng(12345),
        now: Date.now(),
      };

      const adventure = service.startAdventure(ctx, 'dungeon', ['non-existent']);

      expect(adventure).toBeNull();
    });

    it('should assign appropriate duration based on adventure type', () => {
      const ctx: AdventureContext = {
        state: createInitialState(Date.now(), 12345),
        rng: new SeededRng(12345),
        now: Date.now(),
      };

      (ctx.state.heroes.roster as any) = {
        'hero-1': { id: 'hero-1', name: 'Alice', level: 1 },
      };

      const hunt = service.startAdventure(ctx, 'hunt', ['hero-1']);
      const dungeon = service.startAdventure(ctx, 'dungeon', ['hero-1']);

      expect(hunt!.duration).toBeLessThan(dungeon!.duration);
    });
  });

  describe('updateProgress', () => {
    it('should update progress for active adventures', () => {
      const ctx: AdventureContext = {
        state: createInitialState(Date.now(), 12345),
        rng: new SeededRng(12345),
        now: Date.now(),
      };

      (ctx.state.heroes.roster as any) = {
        'hero-1': { id: 'hero-1', name: 'Alice', level: 1 },
      };

      // Add an active adventure
      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'in_progress',
        heroIds: ['hero-1'],
        startedAt: ctx.now - 30000,
        duration: 60000,
        progress: 0.5,
        difficulty: 3,
        rarity: 'rare',
      };

      (ctx.state.adventures as any) = {
        adventures: [adventure],
        nextAdventureId: 2,
      };

      const updated = service.updateProgress(ctx);

      expect(updated).toHaveLength(1);
      expect(updated[0].progress).toBe(0.5); // 30 seconds elapsed of 60 second duration
    });
  });

  describe('completeAdventure', () => {
    it('should complete adventure and generate loot', () => {
      const ctx: AdventureContext = {
        state: createInitialState(Date.now(), 12345),
        rng: new SeededRng(12345),
        now: Date.now(),
      };

      (ctx.state.heroes.roster as any) = {
        'hero-1': { id: 'hero-1', name: 'Alice', level: 1 },
      };

      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'in_progress',
        heroIds: ['hero-1'],
        startedAt: ctx.now - 60000,
        duration: 60000,
        progress: 1.0,
        difficulty: 3,
        rarity: 'rare',
      };

      (ctx.state.adventures as any) = {
        adventures: [adventure],
        nextAdventureId: 2,
      };

      const result = service.completeAdventure(ctx, 'adv-1');

      expect(result).not.toBeNull();
      expect(result!.adventure.status).toBe('completed');
      expect(result!.loot.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent adventure', () => {
      const ctx: AdventureContext = {
        state: createInitialState(Date.now(), 12345),
        rng: new SeededRng(12345),
        now: Date.now(),
      };

      const result = service.completeAdventure(ctx, 'non-existent');

      expect(result).toBeNull();
    });
  });
});
