import { describe, it, expect, beforeEach } from 'vitest';
import { AdventurePluginImpl } from '../../../src/systems/adventure/plugin';
import type { TickContext, TickResult } from '../../../src/domain/pipeline/types';
import { PLUGIN_ORDER } from '../../../src/domain/pipeline/types';
import { SeededRng } from '../../../src/core/rng';
import { createInitialState } from '../../../src/state/initial';
import type { Adventure } from '../../../src/systems/adventure/types';

describe('AdventurePlugin', () => {
  let plugin: AdventurePluginImpl;

  beforeEach(() => {
    plugin = new AdventurePluginImpl();
  });

  describe('plugin properties', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('adventure');
    });

    it('should have correct order', () => {
      expect(plugin.order).toBe(PLUGIN_ORDER.ADVENTURES);
    });
  });

  describe('process', () => {
    it('should update progress for active adventures', () => {
      const now = Date.now();
      const ctx: TickContext = {
        state: createInitialState(now, 12345),
        rng: new SeededRng(12345),
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      // Add an active adventure
      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'in_progress',
        heroIds: ['hero-1'],
        startedAt: now - 30000,
        duration: 60000,
        progress: 0.5,
        difficulty: 3,
        rarity: 'rare',
      };

      (ctx.state.adventures as any) = {
        adventures: [adventure],
        nextAdventureId: 2,
      };

      const result = plugin.process(ctx);

      expect(result.state.adventures.adventures[0].progress).toBe(0.5);
    });

    it('should complete adventures that reach 100% progress', () => {
      const now = Date.now();
      const ctx: TickContext = {
        state: createInitialState(now, 12345),
        rng: new SeededRng(12345),
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      // Add an adventure that's complete
      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'in_progress',
        heroIds: ['hero-1'],
        startedAt: now - 60000,
        duration: 60000,
        progress: 1.0,
        difficulty: 3,
        rarity: 'rare',
      };

      (ctx.state.adventures as any) = {
        adventures: [adventure],
        nextAdventureId: 2,
      };

      (ctx.state.heroes.roster as any) = {
        'hero-1': { id: 'hero-1', name: 'Alice', level: 1 },
      };

      const result = plugin.process(ctx);

      expect(result.state.adventures.adventures[0].status).toBe('completed');
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should return unchanged state for empty adventure list', () => {
      const now = Date.now();
      const ctx: TickContext = {
        state: createInitialState(now, 12345),
        rng: new SeededRng(12345),
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      const result = plugin.process(ctx);

      expect(result.state.adventures.adventures).toEqual([]);
      expect(result.events).toEqual([]);
    });
  });
});
