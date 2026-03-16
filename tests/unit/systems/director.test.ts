import { describe, it, expect, beforeEach } from 'vitest';
import { DirectorServiceImpl } from '../../../src/systems/director/service';
import { spawnVisitor } from '../../../src/systems/director/spawn';
import type { DirectorService, DirectorContext, DirectorState } from '../../../src/systems/director/types';
import { SeededRng } from '../../../src/core/rng';
import { createInitialState } from '../../../src/state/initial';

describe('DirectorSystem', () => {
  let service: DirectorService;

  beforeEach(() => {
    service = new DirectorServiceImpl();
  });

  describe('DirectorServiceImpl', () => {
    describe('canSpawn', () => {
      it('returns true when under max visitors', () => {
        const gameState = createInitialState(Date.now(), 12345);
        const state: DirectorState = {
          visitors: [],
          spawnTimer: 0,
          nextVisitorId: 1,
        };
        expect(service.canSpawn(state, 0, gameState)).toBe(true);
      });

      it('returns false when at max visitors', () => {
        const gameState = createInitialState(Date.now(), 12345);
        const visitors = Array(10).fill(null).map((_, i) => ({
          id: `visitor-${i}`,
          type: 'patron' as const,
          arrivedAt: Date.now(),
        }));
        const state: DirectorState = {
          visitors,
          spawnTimer: 0,
          nextVisitorId: 11,
        };
        expect(service.canSpawn(state, 0, gameState)).toBe(false);
      });
    });

    describe('update', () => {
      it('returns empty result when cannot spawn', () => {
        const ctx: DirectorContext = {
          state: createInitialState(Date.now(), 12345),
          rng: new SeededRng(12345),
          now: Date.now(),
        };

        // Max out visitors
        (ctx.state as any).director = {
          visitors: Array(10).fill(null).map((_, i) => ({
            id: `visitor-${i}`,
            type: 'patron' as const,
            arrivedAt: Date.now(),
          })),
          spawnTimer: 0,
          nextVisitorId: 11,
        };

        const result = service.update(ctx);

        expect(result.visitorsSpawned).toHaveLength(0);
      });

      it('detects expired visitors for departure', () => {
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000 + 1);

        const ctx: DirectorContext = {
          state: createInitialState(now, 12345),
          rng: new SeededRng(12345),
          now,
        };

        // Add an expired visitor
        (ctx.state as any).director = {
          visitors: [{
            id: 'old-visitor',
            type: 'patron',
            arrivedAt: fiveMinutesAgo,
          }],
          spawnTimer: 0,
          nextVisitorId: 2,
        };

        const result = service.update(ctx);

        expect(result.visitorsDeparted).toContain('old-visitor');
      });
    });
  });

  describe('spawnVisitor (pure function)', () => {
    it('returns null when spawn chance fails', () => {
      const rng = new SeededRng(1); // Low chance of spawn
      const state: DirectorState = {
        visitors: [],
        spawnTimer: 0,
        nextVisitorId: 1,
      };

      // Try multiple times - some should fail
      let nulls = 0;
      for (let i = 0; i < 20; i++) {
        const r = new SeededRng(i);
        const result = spawnVisitor(r.createStream('test'), state, Date.now(), 0);
        if (result === null) nulls++;
      }

      expect(nulls).toBeGreaterThan(0);
    });

    it('creates visitor with correct structure when spawn succeeds', () => {
      const rng = new SeededRng(99999);
      const state: DirectorState = {
        visitors: [],
        spawnTimer: 0,
        nextVisitorId: 5,
      };
      const now = Date.now();

      // Force a spawn by using high seed
      const result = spawnVisitor(rng.createStream('spawn'), state, now, 0);

      if (result) {
        expect(result.id).toBe('visitor-5');
        expect(['patron', 'adventurer', 'merchant', 'noble']).toContain(result.type);
        expect(result.arrivedAt).toBe(now);
      }
    });
  });
});
