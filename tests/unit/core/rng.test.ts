import { describe, it, expect, beforeEach } from 'vitest';
import { SeededRng } from '../../../src/core/rng/service';
import type { RngService, RngStream } from '../../../src/core/rng/types';

describe('RngService', () => {
  describe('SeededRng', () => {
    let rng: RngService;

    beforeEach(() => {
      rng = new SeededRng(12345);
    });

    describe('determinism', () => {
      it('produces same sequence for same seed', () => {
        const rng1 = new SeededRng(12345);
        const rng2 = new SeededRng(12345);

        const seq1 = [rng1.createStream('test').next(), rng1.createStream('test').next(), rng1.createStream('test').next()];
        const seq2 = [rng2.createStream('test').next(), rng2.createStream('test').next(), rng2.createStream('test').next()];

        expect(seq1).toEqual(seq2);
      });

      it('produces different sequences for different seeds', () => {
        const rng1 = new SeededRng(12345);
        const rng2 = new SeededRng(54321);

        const seq1 = [rng1.createStream('test').next(), rng1.createStream('test').next()];
        const seq2 = [rng2.createStream('test').next(), rng2.createStream('test').next()];

        expect(seq1).not.toEqual(seq2);
      });
    });

    describe('snapshot/restore', () => {
      it('captures current state in snapshot', () => {
        const stream = rng.createStream('test');
        stream.next();
        stream.next();

        const snapshot = rng.snapshot();

        expect(snapshot.rootSeed).toBe(12345);
        expect(snapshot.streams.length).toBeGreaterThan(0);
      });

      it('restores to previous state', () => {
        const stream = rng.createStream('test');
        const val1 = stream.next();
        const val2 = stream.next();

        const snapshot = rng.snapshot();

        const val3 = stream.next();
        const val4 = stream.next();

        rng.restore(snapshot);

        const stream2 = rng.createStream('test');
        // After restore, stream2 starts at position 2 (from snapshot)
        // Next call advances to position 3, which should equal val3
        const val5 = stream2.next();

        expect(val5).toBe(val3);
      });
    });
  });

  describe('RngStream', () => {
    let stream: RngStream;

    beforeEach(() => {
      const rng = new SeededRng(12345);
      stream = rng.createStream('test');
    });

    describe('next', () => {
      it('returns a number between 0 and 1', () => {
        for (let i = 0; i < 100; i++) {
          const val = stream.next();
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThan(1);
        }
      });
    });

    describe('nextInt', () => {
      it('returns integer within range (inclusive)', () => {
        for (let i = 0; i < 100; i++) {
          const val = stream.nextInt(1, 10);
          expect(val).toBeGreaterThanOrEqual(1);
          expect(val).toBeLessThanOrEqual(10);
          expect(Number.isInteger(val)).toBe(true);
        }
      });

      it('returns min when min equals max', () => {
        expect(stream.nextInt(5, 5)).toBe(5);
      });
    });

    describe('pick', () => {
      it('returns element from array', () => {
        const arr = ['a', 'b', 'c'];
        for (let i = 0; i < 20; i++) {
          expect(arr).toContain(stream.pick(arr));
        }
      });

      it('throws on empty array', () => {
        expect(() => stream.pick([])).toThrow('Cannot pick from empty array');
      });
    });

    describe('sample', () => {
      it('returns unique elements', () => {
        const arr = ['a', 'b', 'c', 'd', 'e'];
        const result = stream.sample(arr, 3);

        expect(result).toHaveLength(3);
        expect(new Set(result).size).toBe(3);
      });

      it('returns all elements when count exceeds array length', () => {
        const arr = ['a', 'b'];
        const result = stream.sample(arr, 5);

        expect(result).toHaveLength(2);
      });

      it('returns empty array for count 0', () => {
        expect(stream.sample(['a', 'b'], 0)).toEqual([]);
      });
    });

    describe('chance', () => {
      it('always returns true for probability 1', () => {
        for (let i = 0; i < 50; i++) {
          expect(stream.chance(1)).toBe(true);
        }
      });

      it('always returns false for probability 0', () => {
        for (let i = 0; i < 50; i++) {
          expect(stream.chance(0)).toBe(false);
        }
      });

      it('returns approximately correct distribution', () => {
        const rng = new SeededRng(99999);
        const s = rng.createStream('chance-test');
        let trueCount = 0;
        const trials = 1000;

        for (let i = 0; i < trials; i++) {
          if (s.chance(0.3)) trueCount++;
        }

        // Should be approximately 30% ± 5%
        expect(trueCount).toBeGreaterThan(trials * 0.25);
        expect(trueCount).toBeLessThan(trials * 0.35);
      });
    });
  });
});
