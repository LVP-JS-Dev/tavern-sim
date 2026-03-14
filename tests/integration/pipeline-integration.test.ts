import { describe, it, expect } from 'vitest';
import { createTickPipeline } from '../../src/domain/pipeline/pipeline';
import type { TickContext, TickPlugin } from '../../src/domain/pipeline/types';
import { PLUGIN_ORDER } from '../../src/domain/pipeline/types';
import { SeededRng } from '../../src/core/rng';
import { createInitialState } from '../../src/state/initial';

describe('Pipeline Integration', () => {
  describe('full pipeline with plugins', () => {
    it('should process tick with empty state', () => {
      const plugins: TickPlugin[] = [
        {
          name: 'timer',
          order: PLUGIN_ORDER.TIMERS,
          process: (ctx) => ({ state: ctx.state, events: [] }),
        },
        {
          name: 'tick-index',
          order: PLUGIN_ORDER.TICK_INDEX,
          process: (ctx) => ({
            state: {
              ...ctx.state,
              time: {
                ...ctx.state.time,
                lastTickAtMs: ctx.now,
              },
            },
            events: [],
          }),
        },
      ];

      const pipeline = createTickPipeline(plugins);
      const now = Date.now();
      const ctx: TickContext = {
        state: createInitialState(now, 12345),
        rng: new SeededRng(12345),
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      const result = pipeline.process(ctx);

      expect(result.state.time.lastTickAtMs).toBe(now);
    });

    it('should accumulate events from all plugins', () => {
      const plugins: TickPlugin[] = [
        {
          name: 'plugin-1',
          order: 100,
          process: (ctx) => ({
            state: ctx.state,
            events: [{ type: 'event-1', timestamp: ctx.now, data: {} }],
          }),
        },
        {
          name: 'plugin-2',
          order: 200,
          process: (ctx) => ({
            state: ctx.state,
            events: [{ type: 'event-2', timestamp: ctx.now, data: {} }],
          }),
        },
      ];

      const pipeline = createTickPipeline(plugins);
      const now = Date.now();
      const ctx: TickContext = {
        state: createInitialState(now, 12345),
        rng: new SeededRng(12345),
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      const result = pipeline.process(ctx);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('event-1');
      expect(result.events[1].type).toBe('event-2');
    });

    it('should pass state through plugin chain', () => {
      const plugins: TickPlugin[] = [
        {
          name: 'increment',
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
        },
        {
          name: 'double',
          order: 200,
          process: (ctx) => ({
            state: {
              ...ctx.state,
              wallet: {
                ...ctx.state.wallet,
                gold: ctx.state.wallet.gold * 2,
              },
            },
            events: [],
          }),
        },
      ];

      const pipeline = createTickPipeline(plugins);
      const now = Date.now();
      const ctx: TickContext = {
        state: createInitialState(now, 12345),
        rng: new SeededRng(12345),
        now,
        tick: 1,
        accumulatedEvents: [],
      };

      const result = pipeline.process(ctx);

      // Initial: 10000, after increment: 10100, after double: 20200
      expect(result.state.wallet.gold).toBe(20200);
    });
  });

  describe('deterministic execution', () => {
    it('should produce same results with same seed', () => {
      const plugins: TickPlugin[] = [
        {
          name: 'random-plugin',
          order: 100,
          process: (ctx) => {
            const stream = ctx.rng.createStream('test');
            const value = stream.nextInt(1, 100);
            return {
              state: {
                ...ctx.state,
                wallet: {
                  ...ctx.state.wallet,
                  gold: ctx.state.wallet.gold + value,
                },
              },
              events: [],
            };
          },
        },
      ];

      const pipeline = createTickPipeline(plugins);
      const now = Date.now();

      // First run
      const ctx1: TickContext = {
        state: createInitialState(now, 99999),
        rng: new SeededRng(99999),
        now,
        tick: 1,
        accumulatedEvents: [],
      };
      const result1 = pipeline.process(ctx1);

      // Second run with same seed
      const ctx2: TickContext = {
        state: createInitialState(now, 99999),
        rng: new SeededRng(99999),
        now,
        tick: 1,
        accumulatedEvents: [],
      };
      const result2 = pipeline.process(ctx2);

      expect(result1.state.wallet.gold).toBe(result2.state.wallet.gold);
    });
  });
});
