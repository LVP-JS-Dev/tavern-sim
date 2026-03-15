import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/state/initial';
import { SeededRng } from '../../src/core/rng';
import { createTickPipeline } from '../../src/domain/pipeline/pipeline';
import type { TickContext, TickPlugin } from '../../src/domain/pipeline/types';
import { PLUGIN_ORDER } from '../../src/domain/pipeline/types';

describe('Full System Integration', () => {
  describe('game initialization', () => {
    it('should create initial state with all systems', () => {
      const now = Date.now();
      const state = createInitialState(now, 12345);

      // Check all v0.2.0 systems are initialized
      expect(state.director).toBeDefined();
      expect(state.adventures).toBeDefined();
      expect(state.world).toBeDefined();
      expect(state.eventLog).toBeDefined();
      expect(state.personality).toBeDefined();

      // Check initial values
      expect(state.director.visitors).toEqual([]);
      expect(state.adventures.adventures).toEqual([]);
      expect(state.world.dayNumber).toBe(1);
      expect(state.eventLog.entries).toEqual([]);
      expect(Object.keys(state.personality.heroPersonalities)).toHaveLength(0);
    });
  });

  describe('deterministic simulation', () => {
    it('should produce identical results with same seed', () => {
      const now = Date.now();
      const seed = 99999;

      // First simulation
      const state1 = createInitialState(now, seed);
      const rng1 = new SeededRng(seed);
      const pipeline1 = createTickPipeline([]);

      const ctx1: TickContext = {
        state: state1,
        rng: rng1,
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      const result1 = pipeline1.process(ctx1);

      // Second simulation with same seed
      const state2 = createInitialState(now, seed);
      const rng2 = new SeededRng(seed);
      const pipeline2 = createTickPipeline([]);

      const ctx2: TickContext = {
        state: state2,
        rng: rng2,
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      const result2 = pipeline2.process(ctx2);

      // Results should be identical
      expect(result1.state).toEqual(result2.state);
      expect(result1.events).toEqual(result2.events);
    });
  });

  describe('state immutability', () => {
    it('should preserve original state after pipeline processing', () => {
      const now = Date.now();
      const originalState = createInitialState(now, 12345);
      const rng = new SeededRng(12345);

      const plugin: TickPlugin = {
        name: 'test',
        order: 100,
        process: (ctx) => ({
          state: {
            ...ctx.state,
            wallet: {
              ...ctx.state.wallet,
              gold: ctx.state.wallet.gold + 100,
            },
          },
          events: [],
        }),
      };

      const pipeline = createTickPipeline([plugin]);

      const ctx: TickContext = {
        state: originalState,
        rng,
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      const result = pipeline.process(ctx);

      // Original state should be unchanged
      expect(originalState.wallet.gold).toBe(10000);
      // Result should have new value
      expect(result.state.wallet.gold).toBe(10100);
    });
  });

  describe('system integration', () => {
    it('should handle multiple ticks without errors', () => {
      const now = Date.now();
      let state = createInitialState(now, 12345);
      const rng = new SeededRng(12345);
      const pipeline = createTickPipeline([]);

      // Run 10 ticks
      for (let i = 0; i < 10; i++) {
        const ctx: TickContext = {
          state,
          rng,
          now: now + i * 1000,
          tick: i + 1,
          accumulatedEvents: [],
        };

        const result = pipeline.process(ctx);
        state = result.state;
      }

      // Should complete without errors
      expect(state).toBeDefined();
      // Verify state was processed (time plugin should have run)
      expect(state.time.lastTickAtMs).toBeGreaterThanOrEqual(now);
    });
  });
});
