import { describe, it, expect } from 'vitest';
import { createTickPipeline } from '../../../../src/domain/pipeline/pipeline';
import type { TickPlugin, TickContext, TickResult } from '../../../../src/domain/pipeline/types';
import type { GameState, DomainEvent } from '../../../../src/types';

describe('TickPipeline', () => {
  const createMockState = (): GameState => {
    return {
      meta: {
        version: '0.1.0',
        createdAtMs: Date.now(),
        lastSeenAtMs: Date.now(),
        rootSeed: 12345,
      },
      wallet: {
        gold: 10000,
        lifetimeEarnedGold: 10000,
      },
      tavern: {
        level: 1,
        upgrades: {},
      },
      heroes: {
        roster: {},
        order: [],
      },
      time: {
        lastTickAtMs: Date.now(),
      },
    } as GameState;
  };

  const createMockRng = () => ({
    createStream: () => ({
      next: () => 0.5,
      nextInt: () => 5,
      pick: <T>(arr: T[]) => arr[0],
      sample: <T>(arr: T[]) => arr,
      chance: () => true,
    }),
    snapshot: () => ({ rootSeed: 0, streams: [] }),
    restore: () => {},
  });

  describe('plugin ordering', () => {
    it('executes plugins in order (lowest first)', () => {
      const state = createMockState();
      const order: string[] = [];

      const plugin1: TickPlugin = {
        name: 'plugin-300',
        order: 300,
        process: (ctx) => {
          order.push('plugin-300');
          return { state: ctx.state, events: [] };
        },
      };

      const plugin2: TickPlugin = {
        name: 'plugin-100',
        order: 100,
        process: (ctx) => {
          order.push('plugin-100');
          return { state: ctx.state, events: [] };
        },
      };

      const plugin3: TickPlugin = {
        name: 'plugin-200',
        order: 200,
        process: (ctx) => {
          order.push('plugin-200');
          return { state: ctx.state, events: [] };
        },
      };

      const pipeline = createTickPipeline([plugin1, plugin2, plugin3]);
      const rng = createMockRng();

      pipeline.process({ state, rng, now: Date.now(), accumulatedEvents: [] });

      expect(order).toEqual(['plugin-100', 'plugin-200', 'plugin-300']);
    });
  });

  describe('state propagation', () => {
    it('passes updated state to next plugin', () => {
      const state = createMockState();
      let receivedGold: number | undefined;

      const plugin1: TickPlugin = {
        name: 'modifier',
        order: 100,
        process: (ctx) => ({
          state: { ...ctx.state, wallet: { ...ctx.state.wallet, gold: 999 } },
          events: [],
        }),
      };

      const plugin2: TickPlugin = {
        name: 'reader',
        order: 200,
        process: (ctx) => {
          receivedGold = ctx.state.wallet.gold;
          return { state: ctx.state, events: [] };
        },
      };

      const pipeline = createTickPipeline([plugin1, plugin2]);
      const rng = createMockRng();

      pipeline.process({ state, rng, now: Date.now(), accumulatedEvents: [] });

      expect(receivedGold).toBe(999);
    });
  });

  describe('event accumulation', () => {
    it('accumulates events from all plugins', () => {
      const state = createMockState();

      const plugin1: TickPlugin = {
        name: 'event-gen-1',
        order: 100,
        process: (ctx) => ({
          state: ctx.state,
          events: [{ type: 'TEST_EVENT_1', payload: {} } as DomainEvent],
        }),
      };

      const plugin2: TickPlugin = {
        name: 'event-gen-2',
        order: 200,
        process: (ctx) => ({
          state: ctx.state,
          events: [{ type: 'TEST_EVENT_2', payload: {} } as DomainEvent],
        }),
      };

      const pipeline = createTickPipeline([plugin1, plugin2]);
      const rng = createMockRng();

      const result = pipeline.process({ state, rng, now: Date.now(), accumulatedEvents: [] });

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('TEST_EVENT_1');
      expect(result.events[1].type).toBe('TEST_EVENT_2');
    });

    it('includes accumulated events in result', () => {
      const state = createMockState();
      const initialEvents: DomainEvent[] = [{ type: 'INITIAL', payload: {} } as DomainEvent];

      const plugin: TickPlugin = {
        name: 'test',
        order: 100,
        process: (ctx) => ({
          state: ctx.state,
          events: [{ type: 'NEW', payload: {} } as DomainEvent],
        }),
      };

      const pipeline = createTickPipeline([plugin]);
      const rng = createMockRng();

      const result = pipeline.process({ state, rng, now: Date.now(), accumulatedEvents: initialEvents });

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('INITIAL');
      expect(result.events[1].type).toBe('NEW');
    });
  });

  describe('immutability', () => {
    it('does not mutate original state', () => {
      const state = createMockState();
      const originalGold = state.wallet.gold;

      const plugin: TickPlugin = {
        name: 'mutator',
        order: 100,
        process: (ctx) => ({
          state: { ...ctx.state, wallet: { ...ctx.state.wallet, gold: 5000 } },
          events: [],
        }),
      };

      const pipeline = createTickPipeline([plugin]);
      const rng = createMockRng();

      pipeline.process({ state, rng, now: Date.now(), accumulatedEvents: [] });

      expect(state.wallet.gold).toBe(originalGold);
    });
  });
});
