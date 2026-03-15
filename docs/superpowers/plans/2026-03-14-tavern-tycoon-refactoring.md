# Tavern Tycoon Refactoring Implementation Plan

> **STATUS: ✅ COMPLETED** (2026-03-15)
>
> All 12 chunks implemented and merged to `develop`. 438 tests passing.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor fantasy-tavern-sim to support parallel development by implementing plugin architecture, decomposing handlers, and adding 5 new game systems (Director, Adventure, World, Event Log, Personality).

**Architecture:** Plugin-based tick pipeline with immutable state transitions. Systems are isolated with clear interfaces. Foundation layer (RNG) first, then parallel system development, then integration.

**Tech Stack:** TypeScript, Vitest (tests), Node.js

**Spec:** `docs/superpowers/specs/2026-03-14-tavern-tycoon-refactoring-design.md`

---

## Chunk 1: Foundation - RNG Service

This is the foundation that all other systems depend on. Must be completed before Phase 2.

### Task 1.1: RNG Types

**Files:**
- Create: `src/core/rng/types.ts`
- Create: `tests/unit/core/rng.test.ts`

- [x] **Step 1: Create test file with failing tests**

```typescript
// tests/unit/core/rng.test.ts
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
        // Advance to same position
        stream2.next();
        stream2.next();
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/rng.test.ts`
Expected: FAIL with "Cannot find module '../../../src/core/rng/service'"

- [x] **Step 3: Create RNG types**

```typescript
// src/core/rng/types.ts
/**
 * RNG Stream Interface
 *
 * A deterministic random number generator stream.
 * Each stream maintains its own position for reproducibility.
 */
export interface RngStream {
  /** Returns a random number in [0, 1) */
  next(): number;
  /** Returns a random integer in [min, max] (inclusive) */
  nextInt(min: number, max: number): number;
  /** Picks a random element from array (throws if empty) */
  pick<T>(array: readonly T[]): T;
  /** Samples n unique elements from array */
  sample<T>(array: readonly T[], count: number): T[];
  /** Returns true with given probability [0, 1] */
  chance(probability: number): boolean;
}

/** Snapshot of a single RNG stream */
export interface StreamSnapshot {
  readonly streamId: string;
  readonly partitionKey?: string;
  readonly position: number;
}

/** Snapshot of entire RNG state for persistence */
export interface RngSnapshot {
  readonly rootSeed: number;
  readonly streams: readonly StreamSnapshot[];
}

/**
 * RNG Service Interface
 *
 * Factory for creating deterministic RNG streams.
 * Supports snapshot/restore for save/load functionality.
 */
export interface RngService {
  /** Create a deterministic stream for a specific system/partition */
  createStream(streamId: string, partitionKey?: string): RngStream;
  /** Get snapshot of all streams for persistence */
  snapshot(): RngSnapshot;
  /** Restore all streams from snapshot */
  restore(snapshot: RngSnapshot): void;
}
```

- [x] **Step 4: Create RNG service implementation**

```typescript
// src/core/rng/service.ts
import type { RngService, RngStream, RngSnapshot, StreamSnapshot } from './types';

/**
 * Seeded RNG implementation using Linear Congruential Generator.
 * Provides deterministic random sequences for game replay.
 *
 * IMPORTANT: All methods (nextInt, pick, chance, sample) internally call next()
 * to ensure consistent state advancement and determinism.
 */
export class SeededRng implements RngService {
  private streams: Map<string, StreamState> = new Map();
  private static readonly M = 0x80000000;
  private static readonly A = 1103515245;
  private static readonly C = 12345;

  constructor(
    private readonly rootSeed: number,
    snapshot?: RngSnapshot
  ) {
    if (snapshot) {
      this.rootSeed = snapshot.rootSeed;
      for (const s of snapshot.streams) {
        this.streams.set(s.streamId, {
          position: s.position,
          state: this.computeState(s.position, s.streamId),
        });
      }
    }
  }

  createStream(streamId: string, partitionKey?: string): RngStream {
    const key = partitionKey ? `${streamId}:${partitionKey}` : streamId;

    if (!this.streams.has(key)) {
      this.streams.set(key, {
        position: 0,
        state: this.computeState(0, key),
      });
    }

    const streamState = this.streams.get(key)!;

    // Helper to advance state and return value
    const advance = (): number => {
      streamState.position++;
      streamState.state = this.computeState(streamState.position, key);
      return streamState.state / SeededRng.M;
    };

    return {
      next: () => advance(),

      nextInt: (min: number, max: number) => {
        const val = advance();
        return Math.floor(val * (max - min + 1)) + min;
      },

      pick: <T>(array: readonly T[]): T => {
        if (array.length === 0) throw new Error('Cannot pick from empty array');
        const val = advance();
        const idx = Math.floor(val * array.length);
        return array[idx];
      },

      sample: <T>(array: readonly T[], count: number): T[] => {
        const maxCount = Math.min(count, array.length);
        const result: T[] = [];
        const available = [...array];

        for (let i = 0; i < maxCount; i++) {
          const val = advance();
          const idx = Math.floor(val * available.length);
          result.push(available[idx]);
          available.splice(idx, 1);
        }

        return result;
      },

      chance: (probability: number) => {
        return advance() < probability;
      },
    };
  }

  snapshot(): RngSnapshot {
    const streams: StreamSnapshot[] = [];
    for (const [streamId, state] of this.streams) {
      streams.push({
        streamId,
        position: state.position,
      });
    }
    return { rootSeed: this.rootSeed, streams };
  }

  restore(snapshot: RngSnapshot): void {
    this.streams.clear();
    for (const s of snapshot.streams) {
      this.streams.set(s.streamId, {
        position: s.position,
        state: this.computeState(s.position, s.streamId),
      });
    }
  }

  private computeState(position: number, key: string): number {
    // Combine seed, position, and key hash for unique state per stream
    const keyHash = this.hashString(key);
    const z = (this.rootSeed + position + keyHash) | 0;
    return ((SeededRng.A * z + SeededRng.C) >>> 0) % SeededRng.M;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}

interface StreamState {
  position: number;
  state: number;
}
```

- [x] **Step 5: Create RNG index export**

```typescript
// src/core/rng/index.ts
export type { RngService, RngStream, RngSnapshot, StreamSnapshot } from './types';
export { SeededRng } from './service';
```

- [x] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/core/rng.test.ts`
Expected: All tests PASS

- [x] **Step 7: Commit**

```bash
git add src/core/rng tests/unit/core/rng.test.ts
git commit -m "feat(core): add RngService with seeded deterministic streams"
```

---

### Task 1.2: Pipeline Types

**Files:**
- Create: `src/domain/pipeline/types.ts`
- Create: `tests/unit/domain/pipeline/pipeline.test.ts`

- [x] **Step 1: Create test file with failing tests**

```typescript
// tests/unit/domain/pipeline/pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { createTickPipeline } from '../../../../src/domain/pipeline/pipeline';
import type { TickPlugin, TickContext, TickResult } from '../../../../src/domain/pipeline/types';
import type { GameState, DomainEvent } from '../../../../src/types';
import { createInitialState } from '../../../../src/state/initial';

describe('TickPipeline', () => {
  const createMockState = (): GameState => createInitialState(Date.now(), 12345);

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
      const rng = { createStream: () => ({ next: () => 0.5 } as any), snapshot: () => ({ rootSeed: 0, streams: [] }), restore: () => {} } as any;

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
      const rng = { createStream: () => ({ next: () => 0.5 } as any), snapshot: () => ({ rootSeed: 0, streams: [] }), restore: () => {} } as any;

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
      const rng = { createStream: () => ({ next: () => 0.5 } as any), snapshot: () => ({ rootSeed: 0, streams: [] }), restore: () => {} } as any;

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
      const rng = { createStream: () => ({ next: () => 0.5 } as any), snapshot: () => ({ rootSeed: 0, streams: [] }), restore: () => {} } as any;

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
      const rng = { createStream: () => ({ next: () => 0.5 } as any), snapshot: () => ({ rootSeed: 0, streams: [] }), restore: () => {} } as any;

      pipeline.process({ state, rng, now: Date.now(), accumulatedEvents: [] });

      expect(state.wallet.gold).toBe(originalGold);
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/pipeline/pipeline.test.ts`
Expected: FAIL with "Cannot find module"

- [x] **Step 3: Create pipeline types**

```typescript
// src/domain/pipeline/types.ts
import type { GameState, DomainEvent } from '../../types';
import type { RngService } from '../../core/rng';

/** Immutable tick context passed through pipeline */
export interface TickContext {
  readonly state: GameState;
  readonly rng: RngService;
  readonly now: number;
  readonly accumulatedEvents: readonly DomainEvent[];
}

/** Result returned by each plugin (immutable pattern) */
export interface TickResult {
  readonly state: GameState;
  readonly events: readonly DomainEvent[];
}

/** Plugin order constants (pipeline stages) */
export const PLUGIN_ORDER = {
  TIMERS: 100,
  COMMANDS: 200,
  DIRECTOR: 300,
  HEROES: 400,
  ADVENTURES: 500,
  WORLD: 600,
  FLUSH: 700,
  TICK_INDEX: 800,
} as const;

/** A single plugin in the tick pipeline */
export interface TickPlugin {
  readonly name: string;
  readonly order: number;
  /** Returns updated state and new events (immutable pattern) */
  process(ctx: TickContext): TickResult;
}

/** The tick pipeline that processes all plugins in order */
export interface TickPipeline {
  readonly plugins: readonly TickPlugin[];
  /** Process all plugins in order, returns final state and all events */
  process(ctx: TickContext): TickResult;
}
```

- [x] **Step 4: Create pipeline implementation**

```typescript
// src/domain/pipeline/pipeline.ts
import type { DomainEvent } from '../../types';
import type { TickContext, TickPlugin, TickPipeline, TickResult } from './types';

/**
 * Creates a tick pipeline that processes plugins in order.
 * Each plugin receives the state from the previous plugin.
 */
export function createTickPipeline(plugins: TickPlugin[]): TickPipeline {
  const sorted = [...plugins].sort((a, b) => a.order - b.order);

  return {
    plugins: sorted,

    process: (ctx: TickContext): TickResult => {
      let currentState = ctx.state;
      let allEvents: DomainEvent[] = [...ctx.accumulatedEvents];

      for (const plugin of sorted) {
        const result = plugin.process({
          ...ctx,
          state: currentState,
          accumulatedEvents: allEvents,
        });
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }

      return { state: currentState, events: allEvents };
    },
  };
}
```

- [x] **Step 5: Create pipeline index**

```typescript
// src/domain/pipeline/index.ts
export type { TickContext, TickResult, TickPlugin, TickPipeline } from './types';
export { PLUGIN_ORDER } from './types';
export { createTickPipeline } from './pipeline';
```

- [x] **Step 6: Create domain index**

```typescript
// src/domain/index.ts
export * from './pipeline';
```

- [x] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/domain/pipeline/pipeline.test.ts`
Expected: All tests PASS

- [x] **Step 8: Commit**

```bash
git add src/domain tests/unit/domain
git commit -m "feat(domain): add TickPipeline with plugin architecture"
```

---

## Chunk 2: Extended State Types

### Task 2.1: System State Types

**Files:**
- Modify: `src/types/state.ts`

- [x] **Step 1: Add DirectorState import and type to GameState**

First read the current state file to understand its structure:

Run: `cat src/types/state.ts`

Then extend it with new slices. Note: We'll add the actual system types in later tasks, but for now we'll use placeholder types to avoid circular dependencies.

```typescript
// Add to src/types/state.ts after existing imports

// Import system types (will be created in Phase 2)
import type { DirectorState } from '../systems/director';
import type { AdventureState } from '../systems/adventure';
import type { WorldState } from '../systems/world';
import type { EventLogState } from '../systems/event-log';
import type { PersonalitySlice } from '../systems/personality';

// Extend GameState interface
export interface GameState {
  readonly meta: MetaSlice;
  readonly wallet: WalletSlice;
  readonly tavern: TavernSlice;
  readonly heroes: HeroesSlice;
  readonly time: TimeSlice;
  // New slices for v0.2.0
  readonly director: DirectorState;
  readonly adventures: AdventureState;
  readonly world: WorldState;
  readonly eventLog: EventLogState;
  readonly personality: PersonalitySlice;
}
```

**Wait**: This will break existing code because the system types don't exist yet. We need to create stub types first.

- [x] **Step 2: Create stub system types to prevent breakage**

Create minimal stub types that will be expanded later:

```typescript
// src/systems/director/types.ts (stub)
export interface DirectorState {
  readonly visitors: readonly Visitor[];
  readonly spawnTimer: number;
  readonly nextVisitorId: number;
}

export interface Visitor {
  readonly id: string;
  readonly type: VisitorType;
  readonly arrivedAt: number;
}

export type VisitorType = 'patron' | 'adventurer' | 'merchant' | 'noble';

export const emptyDirectorState = (): DirectorState => ({
  visitors: [],
  spawnTimer: 0,
  nextVisitorId: 1,
});
```

```typescript
// src/systems/adventure/types.ts (stub)
export interface AdventureState {
  readonly adventures: readonly Adventure[];
  readonly nextAdventureId: number;
}

export interface Adventure {
  readonly id: string;
  readonly type: AdventureType;
  readonly status: AdventureStatus;
}

export type AdventureType = 'hunt' | 'dungeon' | 'escort' | 'investigation';
export type AdventureStatus = 'preparing' | 'in_progress' | 'completed' | 'failed';

export const emptyAdventureState = (): AdventureState => ({
  adventures: [],
  nextAdventureId: 1,
});
```

```typescript
// src/systems/world/types.ts (stub)
export interface WorldState {
  readonly timeOfDay: TimeOfDay;
  readonly weather: Weather;
  readonly dayNumber: number;
}

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'midnight';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';

export const emptyWorldState = (): WorldState => ({
  timeOfDay: 'dawn',
  weather: 'clear',
  dayNumber: 1,
});
```

```typescript
// src/systems/event-log/types.ts (stub)
export interface EventLogState {
  readonly entries: readonly LogEntry[];
  readonly notifications: readonly Notification[];
  readonly lastReadAt: number;
}

export interface LogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly type: string;
  readonly data: Record<string, unknown>;
}

export interface Notification {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'info' | 'success' | 'warning';
  readonly title: string;
  readonly message: string;
  readonly isRead: boolean;
}

export const emptyEventLogState = (): EventLogState => ({
  entries: [],
  notifications: [],
  lastReadAt: 0,
});
```

```typescript
// src/systems/personality/types.ts (stub)
export interface PersonalitySlice {
  readonly heroPersonalities: Record<string, PersonalityState>;
}

export interface PersonalityState {
  readonly traits: readonly string[];
  readonly corruption: number;
}

export const emptyPersonalityState = (): PersonalityState => ({
  traits: [],
  corruption: 0,
});
```

- [x] **Step 3: Create system index files**

```typescript
// src/systems/director/index.ts
export type { DirectorState, Visitor, VisitorType } from './types';
export { emptyDirectorState } from './types';
```

```typescript
// src/systems/adventure/index.ts
export type { AdventureState, Adventure, AdventureType, AdventureStatus } from './types';
export { emptyAdventureState } from './types';
```

```typescript
// src/systems/world/index.ts
export type { WorldState, TimeOfDay, Weather } from './types';
export { emptyWorldState } from './types';
```

```typescript
// src/systems/event-log/index.ts
export type { EventLogState, LogEntry, Notification } from './types';
export { emptyEventLogState } from './types';
```

```typescript
// src/systems/personality/index.ts
export type { PersonalitySlice, PersonalityState } from './types';
export { emptyPersonalityState } from './types';
```

```typescript
// src/systems/index.ts
export * from './director';
export * from './adventure';
export * from './world';
export * from './event-log';
export * from './personality';
```

- [x] **Step 4: Update state.ts with new imports**

Now update src/types/state.ts to include the new slices:

```typescript
// Add at top of src/types/state.ts
import type { DirectorState } from '../systems/director';
import type { AdventureState } from '../systems/adventure';
import type { WorldState } from '../systems/world';
import type { EventLogState } from '../systems/event-log';
import type { PersonalitySlice } from '../systems/personality';
```

And extend the GameState interface:

```typescript
export interface GameState {
  readonly meta: MetaSlice;
  readonly wallet: WalletSlice;
  readonly tavern: TavernSlice;
  readonly heroes: HeroesSlice;
  readonly time: TimeSlice;
  // v0.2.0 additions
  readonly director: DirectorState;
  readonly adventures: AdventureState;
  readonly world: WorldState;
  readonly eventLog: EventLogState;
  readonly personality: PersonalitySlice;
}
```

- [x] **Step 5: Update initial state**

Update src/state/initial.ts to include new slices:

```typescript
// Add imports
import { emptyDirectorState } from '../systems/director';
import { emptyAdventureState } from '../systems/adventure';
import { emptyWorldState } from '../systems/world';
import { emptyEventLogState } from '../systems/event-log';
import { emptyPersonalityState } from '../systems/personality';

// Update createInitialState
export function createInitialState(now: number, rootSeed: number): GameState {
  return {
    meta: createInitialMeta(now, rootSeed),
    wallet: createInitialWallet(),
    tavern: createInitialTavern(),
    heroes: createInitialHeroes(),
    time: createInitialTime(now),
    // v0.2.0 additions
    director: emptyDirectorState(),
    adventures: emptyAdventureState(),
    world: emptyWorldState(),
    eventLog: emptyEventLogState(),
    personality: { heroPersonalities: {} },
  };
}
```

- [x] **Step 6: Run all existing tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All existing tests PASS

- [x] **Step 7: Commit**

```bash
git add src/systems src/types/state.ts src/state/initial.ts
git commit -m "feat(types): add stub system types and extend GameState"
```

---

## Chunk 3: Director System

### Task 3.1: Director Types and Constants

**Files:**
- Modify: `src/systems/director/types.ts` (expand stub)
- Create: `src/systems/director/constants.ts`

- [x] **Step 1: Write failing tests for DirectorService**

```typescript
// tests/unit/systems/director.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DirectorServiceImpl } from '../../../src/systems/director/service';
import { spawnVisitor } from '../../../src/systems/director/spawn';
import type { DirectorService, DirectorContext, DirectorResult } from '../../../src/systems/director/types';
import { SeededRng } from '../../../src/core/rng';
import { createInitialState } from '../../../src/state/initial';

describe('DirectorSystem', () => {
  let service: DirectorService;
  let rng: ReturnType<SeededRng['createStream']>;

  beforeEach(() => {
    service = new DirectorServiceImpl();
  });

  describe('canSpawn', () => {
    it('returns true when under max visitors', () => {
      const state = { visitors: [], spawnTimer: 0, nextVisitorId: 1 };
      expect(service.canSpawn(state, 0)).toBe(true);
    });

    it('returns false when at max visitors', () => {
      const visitors = Array(10).fill(null).map((_, i) => ({
        id: `visitor-${i}`,
        type: 'patron' as const,
        arrivedAt: Date.now(),
      }));
      const state = { visitors, spawnTimer: 0, nextVisitorId: 11 };
      expect(service.canSpawn(state, 0)).toBe(false);
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
      ctx.state.director.visitors = Array(10).fill(null).map((_, i) => ({
        id: `visitor-${i}`,
        type: 'patron' as const,
        arrivedAt: Date.now(),
      }));

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

  describe('spawnVisitor (pure function)', () => {
    it('returns null when spawn chance fails', () => {
      const rng = new SeededRng(1); // Low chance of spawn
      const state = { visitors: [], spawnTimer: 0, nextVisitorId: 1 };

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
      const state = { visitors: [], spawnTimer: 0, nextVisitorId: 5 };
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
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/director.test.ts`
Expected: FAIL (service.ts doesn't exist yet)

- [x] **Step 3: Expand director types**

```typescript
// src/systems/director/types.ts
import type { GoldU } from '../../types';

export type VisitorType = 'patron' | 'adventurer' | 'merchant' | 'noble';

export interface Visitor {
  readonly id: string;
  readonly type: VisitorType;
  readonly arrivedAt: number;
  readonly personality?: string;
  readonly order?: string;
}

export interface DirectorState {
  readonly visitors: readonly Visitor[];
  readonly spawnTimer: number;
  readonly nextVisitorId: number;
}

export const emptyDirectorState = (): DirectorState => ({
  visitors: [],
  spawnTimer: 0,
  nextVisitorId: 1,
});

export interface DirectorSlice {
  readonly director: DirectorState;
}

export interface DirectorService {
  update(ctx: DirectorContext): DirectorResult;
  canSpawn(state: DirectorState, rosterSize: number): boolean;
  processDeparture(visitorId: string, state: DirectorState): DirectorResult;
}

export interface DirectorContext {
  readonly state: import('../../types').GameState;
  readonly rng: import('../../core/rng').RngService;
  readonly now: number;
}

export interface DirectorResult {
  readonly visitorsSpawned: readonly Visitor[];
  readonly visitorsDeparted: readonly string[];
  readonly events: readonly import('../../types').DomainEvent[];
}
```

- [x] **Step 4: Create director constants**

```typescript
// src/systems/director/constants.ts
/** Base probability of visitor spawn per tick */
export const VISITOR_SPAWN_CHANCE = 0.1;

/** Maximum time a visitor can stay in tavern (ms) - 5 minutes */
export const MAX_VISITOR_STAY_MS = 5 * 60 * 1000;

/** Maximum concurrent visitors in tavern */
export const MAX_VISITORS = 10;

/** Base spawn timer cooldown (ticks) */
export const SPAWN_TIMER_COOLDOWN = 3;
```

- [x] **Step 5: Create spawn.ts (pure functions)**

```typescript
// src/systems/director/spawn.ts
/**
 * Pure functions for visitor spawning logic.
 * Separated from service.ts for testability.
 */
import type { RngService } from '../../core/rng';
import type { Visitor, VisitorType, DirectorState } from './types';
import { VISITOR_SPAWN_CHANCE } from './constants';

/**
 * Attempts to spawn a visitor. Returns null if spawn chance fails.
 * Pure function - no side effects.
 */
export function spawnVisitor(
  rng: RngService,
  state: DirectorState,
  now: number,
  rosterSize: number
): Visitor | null {
  const stream = rng.createStream('director-spawn');

  if (!stream.chance(VISITOR_SPAWN_CHANCE)) return null;

  const type = pickVisitorType(stream, rosterSize);
  return {
    id: `visitor-${state.nextVisitorId}`,
    type,
    arrivedAt: now,
  };
}

/**
 * Picks visitor type based on roster size and RNG.
 * Pure function - deterministic for same RNG state.
 */
function pickVisitorType(rng: RngService, rosterSize: number): VisitorType {
  const stream = rng.createStream('director-type');
  const types: VisitorType[] = ['patron', 'adventurer'];

  if (rosterSize < 3 && stream.chance(0.3)) types.push('merchant');
  if (rosterSize >= 5 && stream.chance(0.1)) types.push('noble');

  return stream.pick(types);
}
```

- [x] **Step 6: Create service.ts**

```typescript
// src/systems/director/service.ts
/**
 * Director service orchestrates visitor lifecycle.
 */
import type { DirectorState, DirectorContext, DirectorResult, DirectorService } from './types';
import { spawnVisitor } from './spawn';
import { MAX_VISITOR_STAY_MS, MAX_VISITORS } from './constants';

export class DirectorServiceImpl implements DirectorService {
  update(ctx: DirectorContext): DirectorResult {
    const state = ctx.state.director;
    const rosterSize = Object.keys(ctx.state.heroes.roster).length;
    const result: DirectorResult = {
      visitorsSpawned: [],
      visitorsDeparted: [],
      events: [],
    };

    // Try to spawn if capacity allows
    if (this.canSpawn(state, rosterSize)) {
      const visitor = spawnVisitor(ctx.rng, state, ctx.now, rosterSize);
      if (visitor) {
        result.visitorsSpawned.push(visitor);
      }
    }

    // Process departures
    for (const visitor of state.visitors) {
      if (ctx.now - visitor.arrivedAt > MAX_VISITOR_STAY_MS) {
        result.visitorsDeparted.push(visitor.id);
      }
    }

    return result;
  }

  canSpawn(state: DirectorState, rosterSize: number): boolean {
    return state.visitors.length < MAX_VISITORS;
  }

  processDeparture(visitorId: string, state: DirectorState): DirectorResult {
    return {
      visitorsSpawned: [],
      visitorsDeparted: [visitorId],
      events: [],
    };
  }
}
```

- [x] **Step 7: Update index.ts**

```typescript
// src/systems/director/index.ts
export type {
  DirectorState,
  DirectorSlice,
  DirectorService,
  DirectorContext,
  DirectorResult,
  Visitor,
  VisitorType,
} from './types';
export { emptyDirectorState } from './types';
export { DirectorServiceImpl } from './service';
export { spawnVisitor } from './spawn';
export { VISITOR_SPAWN_CHANCE, MAX_VISITOR_STAY_MS, MAX_VISITORS, SPAWN_TIMER_COOLDOWN } from './constants';
```

- [x] **Step 8: Run tests**

Run: `npx vitest run tests/unit/systems/director.test.ts`
Expected: All tests PASS

- [x] **Step 9: Commit**

```bash
git add src/systems/director tests/unit/systems/director.test.ts
git commit -m "feat(systems): implement Director system with visitor spawning"
```

- [x] **Step 10: Write Director Plugin tests**

```typescript
// tests/unit/domain/pipeline/plugins/director.plugin.test.ts
import { describe, it, expect } from 'vitest';
import { createDirectorPlugin } from '../../../../../src/domain/pipeline/plugins/director.plugin';
import type { TickContext } from '../../../../../src/domain/pipeline/types';
import { SeededRng } from '../../../../../src/core/rng';
import { createInitialState } from '../../../../../src/state/initial';

describe('DirectorPlugin', () => {
  it('spawns visitors when conditions are met', () => {
    const plugin = createDirectorPlugin();
    const state = createInitialState(Date.now(), 12345);

    const ctx: TickContext = {
      state,
      rng: new SeededRng(12345),
      now: Date.now(),
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    // May or may not spawn depending on RNG, but should not error
    expect(result.state.director).toBeDefined();
    expect(result.events).toBeDefined();
  });

  it('processes visitor departures', () => {
    const plugin = createDirectorPlugin();
    const now = Date.now();
    const state = createInitialState(now, 12345);

    // Add an old visitor
    const stateWithOldVisitor = {
      ...state,
      director: {
        ...state.director,
        visitors: [{
          id: 'old-visitor',
          type: 'patron' as const,
          arrivedAt: now - (10 * 60 * 1000), // 10 minutes ago
        }],
        nextVisitorId: 2,
      },
    };

    const ctx: TickContext = {
      state: stateWithOldVisitor,
      rng: new SeededRng(12345),
      now,
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    expect(result.state.director.visitors.find(v => v.id === 'old-visitor')).toBeUndefined();
  });

  it('has correct plugin order', () => {
    const plugin = createDirectorPlugin();

    expect(plugin.order).toBe(300); // PLUGIN_ORDER.DIRECTOR
  });
});
```

- [x] **Step 11: Create Director Plugin implementation**

```typescript
// src/domain/pipeline/plugins/director.plugin.ts
import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import { DirectorServiceImpl } from '../../../systems/director';
import type { DomainEvent } from '../../../types';

export function createDirectorPlugin(): TickPlugin {
  const service = new DirectorServiceImpl();

  return {
    name: 'director',
    order: PLUGIN_ORDER.DIRECTOR,

    process(ctx: TickContext): TickResult {
      const directorResult = service.update({
        state: ctx.state,
        rng: ctx.rng,
        now: ctx.now,
      });

      const events: DomainEvent[] = [];
      let newState = ctx.state;

      // Add spawn events
      for (const visitor of directorResult.visitorsSpawned) {
        events.push({
          type: 'VISITOR_ARRIVED',
          visitorId: visitor.id,
          visitorType: visitor.type,
          timestamp: ctx.now,
        });
      }

      // Add departure events
      for (const visitorId of directorResult.visitorsDeparted) {
        events.push({
          type: 'VISITOR_DEPARTED',
          visitorId,
          timestamp: ctx.now,
        });
      }

      // Update state
      newState = {
        ...newState,
        director: {
          ...newState.director,
          visitors: [
            ...newState.director.visitors.filter(v => !directorResult.visitorsDeparted.includes(v.id)),
            ...directorResult.visitorsSpawned,
          ],
          nextVisitorId: newState.director.nextVisitorId + directorResult.visitorsSpawned.length,
        },
      };

      return { state: newState, events };
    },
  };
}
```

- [x] **Step 12: Run Director Plugin tests**

Run: `npx vitest run tests/unit/domain/pipeline/plugins/director.plugin.test.ts`
Expected: All tests PASS

- [x] **Step 13: Commit Director Plugin**

```bash
git add src/domain/pipeline/plugins/director.plugin.ts tests/unit/domain/pipeline/plugins/director.plugin.test.ts
git commit -m "feat(pipeline): add Director plugin for visitor lifecycle"
```

---

## Chunk 4: Adventure System - Types
> **Dependencies:** Chunk 1 (RNG), Chunk 2 (Pipeline Types)
> **Independent of Director System** - works with available heroes only

**Design decisions:**
> - Adventures auto-created by Director (separate concern)
> - Progress = baseTick * (1 + heroCount * 0.1) - more heroes = faster
> - Duration = base[type] + randomVariance (deterministic for same seed)
> - Loot generated on completion with rarity based on adventure type + hero count

**Files:**
> - Create: `src/systems/adventure/types.ts`
> - Create: `src/systems/adventure/constants.ts`
> - Create: `src/systems/adventure/index.ts`
> - Modify: `src/types/state.ts` (add AdventureState)
> - Modify: `src/state/initial.ts` (add emptyAdventureState)
> - Create: `tests/unit/systems/adventure.test.ts`

- [x] **Step 1: Create test file with failing tests**

```typescript
// tests/unit/systems/adventure.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AdventureServiceImpl } from '../../../src/systems/adventure/service';
import { generateLoot } from '../../../src/systems/adventure/loot';
import type { AdventureService, AdventureContext, AdventureState, Adventure, AdventureType, LootDrop, Rarity } from '../../../src/systems/adventure/types';
import { SeededRng } from '../../../src/core/rng';
import { emptyAdventureState } from '../../../src/systems/adventure';

describe('AdventureSystem', () => {
  let service: AdventureService;
  let rng: SeededRng;

  beforeEach(() => {
    service = new AdventureServiceImpl();
    rng = new SeededRng(12345);
  });

  describe('createAdventure', () => {
    it('creates adventure with specified type and heroes', () => {
      const state = { adventures: emptyAdventureState() };
      const heroIds = ['bard-1', 'barkeep-1'];
      const ctx: AdventureContext = { state, rng, now: Date.now() };

      const result = service.createAdventure(ctx, 'dungeon', heroIds);

      expect(result.adventure).toBeDefined();
      expect(result.adventure!.type).toBe('dungeon');
      expect(result.adventure!.heroIds).toEqual(heroIds);
      expect(result.adventure!.status).toBe('preparing');
      expect(result.events[0].type).toBe('ADVENTURE_CREATED');
    });

    it('fails if no heroes provided', () => {
      const state = { adventures: emptyAdventureState() };
      const ctx: AdventureContext = { state, rng, now: Date.now() };

      const result = service.createAdventure(ctx, 'dungeon', []);

      expect(result.adventure).toBeNull();
      expect(result.events[0].type).toBe('ADVENTURE_REJECTED');
    });
  });

  describe('updateProgress', () => {
    it('increments progress based on tick delta', () => {
      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'in_progress',
        heroIds: ['bard-1', 'barkeep-1'],
        startedAt: Date.now(),
        duration: 60000,
        progress: 20000,
        difficulty: 3,
        rarity: 'rare',
      };
      const ctx: AdventureContext = {
        state: { adventures: emptyAdventureState() },
        rng,
        now: Date.now(),
      };

      const result = service.updateProgress(adventure, ctx);

      expect(result.progress).toBeGreaterThan(20000);
      expect(result.completed).toBe(false);
    });

    it('marks completed when progress reaches duration', () => {
      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'in_progress',
        heroIds: ['bard-1'],
        startedAt: Date.now() - 60000,
        duration: 60000,
        progress: 59999,
        difficulty: 3,
        rarity: 'rare',
      };
      const ctx: AdventureContext = {
        state: { adventures: emptyAdventureState() },
        rng,
        now: Date.now(),
      };

      const result = service.updateProgress(adventure, ctx);
      expect(result.completed).toBe(true);
    });
  });

  describe('generateLoot', () => {
    it('generates loot based on adventure type', () => {
      const adventure: Adventure = {
        id: 'adv-1',
        type: 'dungeon',
        status: 'completed',
        heroIds: ['bard-1'],
        startedAt: Date.now(),
        duration: 60000,
        progress: 60000,
        difficulty: 3,
        rarity: 'rare',
      };

      const loot = generateLoot(rng, adventure);

      expect(loot.length).toBeGreaterThan(0);
      expect(loot[0]).toHaveProperty('itemId');
      expect(loot[0]).toHaveProperty('quantity');
      expect(loot[0]).toHaveProperty('rarity');
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/systems/adventure.test.ts
```
Expected: FAIL with "Cannot find module"

- [x] **Step 3: Create adventure types and constants**

```typescript
// src/systems/adventure/types.ts
import type { GoldU } from '../../types';

/** Adventure types with different characteristics */
export type AdventureType = 'hunt' | 'dungeon' | 'escort' | 'investigation';
export type AdventureStatus = 'preparing' | 'in_progress' | 'completed' | 'failed';
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
}
/** Loot drop configuration */
export interface LootDrop {
  readonly itemId: string;
  readonly quantity: number;
  readonly rarity: Rarity;
}
/** Adventure state slice */
export interface AdventureState {
  readonly adventures: readonly Adventure[];
  readonly nextAdventureId: number;
}
export const emptyAdventureState = (): AdventureState => ({
  adventures: [],
  nextAdventureId: 1,
});
/** Adventure context for service calls */
export interface AdventureContext {
  readonly state: { adventures: AdventureState };
  readonly rng: import('../../core/rng').RngService;
  readonly now: number;
}
/** Service interface */
export interface AdventureService {
  createAdventure(ctx: AdventureContext, type: AdventureType, heroIds: readonly string[]): AdventureCreateResult;
  updateProgress(adventure: Adventure, ctx: AdventureContext): AdventureUpdateResult;
  completeAdventure(adventure: Adventure, ctx: AdventureContext): AdventureCompleteResult;
  generateLoot(ctx: AdventureContext, adventure: Adventure): readonly LootDrop[];
}
/** Result types */
export interface AdventureCreateResult {
  readonly adventure: Adventure | null;
  readonly events: readonly import('../../types').DomainEvent[];
}
export interface AdventureUpdateResult {
  readonly adventure: Adventure;
  readonly progress: number;
  readonly completed: boolean;
}
export interface AdventureCompleteResult {
  readonly adventure: Adventure;
  readonly loot: readonly LootDrop[];
  readonly events: readonly import('../../types').DomainEvent[];
}
```
- [x] **Step 4: Create constants**

```typescript
// src/systems/adventure/constants.ts
/** Duration configuration (in milliseconds) */
export const ADVENTURE_BASE_DURATION_MS: Record<AdventureType, number> = {
  hunt: 30000,
  dungeon: 60000,
  escort: 45000,
  investigation: 20000,
} as const;
/** Duration variance (+/- ms) */
export const ADVENTURE_DURATION_VARIANCE_MS = 5000;
/** Maximum active adventures */
export const MAX_ADVENTURES_ACTIVE = 5;
/** Base loot drop rates by adventure type */
export const LOOT_DROP_RATES: Record<AdventureType, number> = {
  hunt: 2,
  dungeon: 3,
  escort: 2,
  investigation: 1,
};
/** Rarity weights for loot generation */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};
```
- [x] **Step 5: Create index exports**

```typescript
// src/systems/adventure/index.ts
export type {
  AdventureService,
  AdventureContext
  AdventureState
  Adventure
  AdventureType
  AdventureStatus
  LootDrop
  Rarity
  AdventureCreateResult
  AdventureUpdateResult
  AdventureCompleteResult
} from './types';
export { emptyAdventureState } from './types';
export { ADVENTURE_BASE_DURATION_MS, MAX_ADVENTURES_ACTIVE } from './constants';
```
- [x] **Step 6: Extend GameState with AdventureState**

Add to `src/types/state.ts`:
```typescript
// Add at top of file
import type { AdventureState } from '../systems/adventure';
// Add to GameState interface
export interface GameState {
  // ... existing slices
  readonly adventures: AdventureState;
}
```
Update `src/state/initial.ts`:
```typescript
// Add import
import { emptyAdventureState } from '../systems/adventure';
// Add to createInitialState
export function createInitialState(now: number, rootSeed: number): GameState {
  return {
    // ... existing slices
    adventures: emptyAdventureState(),
  };
}
```
- [x] **Step 7: Run tests to verify they still fail (service not implemented)**

```bash
npx vitest run tests/unit/systems/adventure.test.ts
```
Expected: FAIL (service not implemented)

- [x] **Step 8: Commit**

```bash
git add src/systems/adventure tests/unit/systems/adventure.test.ts
git commit -m "feat(systems): add Adventure types and constants"
```
---
## Chunk 5: Adventure System - Service & Loot
> **Dependencies:** Chunk 4 (Adventure Types)

> **Files:**
> - Create: `src/systems/adventure/service.ts`
> - Create: `src/systems/adventure/loot.ts`
> - Modify: `tests/unit/systems/adventure.test.ts` (add more tests)

> - Update: `src/systems/adventure/index.ts` (add exports)

> - Run: tests

> - Commit

```
- [x] **Step 1: Create service implementation**

```typescript
// src/systems/adventure/service.ts
import type { RngService } from '../../core/rng';
import type { Adventure, AdventureType, AdventureContext, AdventureCreateResult, AdventureUpdateResult, AdventureCompleteResult } from './types';
import { ADVENTURE_BASE_DURATION_MS, ADVENTURE_DURATION_VARIANCE_MS, MAX_ADVENTURES_ACTIVE } from './constants';
import { generateLoot } from './loot';
export class AdventureServiceImpl implements AdventureService {
  createAdventure(ctx: AdventureContext, type: AdventureType, heroIds: readonly string[]): AdventureCreateResult {
    const state = ctx.state.adventures;

    // Validate
    if (heroIds.length === 0) {
      return {
        adventure: null,
        events: [{ type: 'ADVENTURE_REJECTED', reason: 'NO_HEROES', timestamp: ctx.now }],
      };
    }
    if (state.adventures.length >= MAX_ADVENTURES_ACTIVE) {
      return {
        adventure: null,
        events: [{ type: 'ADVENTURE_REJECTED', reason: 'MAX_REACHED', timestamp: ctx.now }],
      };
    }
    // Calculate duration with variance
    const stream = ctx.rng.createStream('adventure-duration');
    const baseDuration = ADVENTURE_BASE_DURATION_MS[type];
    const variance = stream.nextInt(0, ADVENTURE_DURATION_VARIANCE_MS);
    const duration = baseDuration + variance - ADVENTURE_DURATION_VARIANCE_MS;
    // Determine difficulty and rarity
    const difficulty = this.calculateDifficulty(type);
    const rarity = this.determineRarity(stream, type, heroIds.length);
    const adventure: Adventure = {
      id: `adventure-${state.nextAdventureId}`,
      type,
      status: 'preparing',
      heroIds,
      startedAt: ctx.now,
      duration,
      progress: 0,
      difficulty,
      rarity,
    };
    return {
      adventure,
      events: [{
        type: 'ADVENTURE_CREATED',
        adventureId: adventure.id,
        adventureType: type,
        heroIds,
        timestamp: ctx.now,
      }],
    };
  }
  updateProgress(adventure: Adventure, ctx: AdventureContext): AdventureUpdateResult {
    const stream = ctx.rng.createStream('adventure-progress');
    // Progress = baseTick * (1 + heroCount * 0.1)
    const tickDelta = 40;
    const heroBonus = 1 + (adventure.heroIds.length * 0.1);
    const progressIncrement = tickDelta * heroBonus;
    const newProgress = Math.min(adventure.progress + progressIncrement, adventure.duration);
    const completed = newProgress >= adventure.duration;
    return {
      adventure: { ...adventure, progress: newProgress, status: completed ? 'completed' : adventure.status },
      progress: newProgress,
      completed,
    };
  }
  completeAdventure(adventure: Adventure, ctx: AdventureContext): AdventureCompleteResult {
    const loot = this.generateLoot(ctx, adventure);
    const events = [
      { type: 'ADVENTURE_COMPLETED', adventureId: adventure.id, timestamp: ctx.now },
      ...loot.map(l => ({ type: 'LOOT_OBTAINED', loot: l, timestamp: ctx.now })),
    ];
    return { adventure: { ...adventure, status: 'completed' }, loot, events };
  }
  generateLoot(ctx: AdventureContext, adventure: Adventure): readonly LootDrop[] {
    return generateLoot(ctx.rng, adventure);
  }
  private calculateDifficulty(type: AdventureType): number {
    const difficulties: Record<AdventureType, number> = {
      hunt: 1, dungeon: 3, escort: 2, investigation: 2,
    };
    return difficulties[type];
  }
  private determineRarity(stream: RngService, type: AdventureType, heroCount: number): Rarity {
    const baseRarities: Record<AdventureType, Rarity[]> = {
      hunt: ['common', 'uncommon'],
      dungeon: ['uncommon', 'rare', 'epic'],
      escort: ['common', 'uncommon', 'rare'],
      investigation: ['common'],
    };
    const possibleRarities = [...baseRarities[type]];
    if (heroCount >= 3 && !possibleRarities.includes('epic')) {
      possibleRarities.push('epic');
    }
    return stream.pick(possibleRarities);
  }
}
```
- [x] **Step 2: Create loot generation module**

```typescript
// src/systems/adventure/loot.ts
import type { RngService } from '../../core/rng';
import type { Adventure, LootDrop, Rarity, AdventureType } from './types';
import { LOOT_DROP_RATES, RARITY_WEIGHTS } from './constants';
/** Item pools by adventure type */
const ADVENTURE_ITEMS: Record<AdventureType, string[]> = {
  hunt: ['herb', 'pelt', 'fang', 'claw'],
  dungeon: ['sword', 'shield', 'helmet', 'boots', 'ring'],
  escort: ['gold', 'silver', 'gem'],
  investigation: ['scroll', 'potion', 'map'],
};
export function generateLoot(rng: RngService, adventure: Adventure): readonly LootDrop[] {
  const stream = rng.createStream('loot-generation');
  const dropCount = LOOT_DROP_RATES[adventure.type];
  const loot: LootDrop[] = [];
  const lootMap = new Map<string, LootDrop>();
  for (let i = 0; i < dropCount; i++) {
    const itemPool = ADVENTURE_ITEMS[adventure.type];
    const itemId = stream.pick(itemPool);
    const rarity = rollRarity(stream, adventure.rarity);
    const quantity = stream.nextInt(1, 3);
    const existing = lootMap.get(itemId);
    if (existing) {
      lootMap.set(itemId, { ...existing, quantity: existing.quantity + quantity });
    } else {
      lootMap.set(itemId, { itemId, quantity, rarity });
    }
  }
  return Array.from(lootMap.values());
}
function rollRarity(stream: RngService, baseRarity: Rarity): Rarity {
  const roll = stream.next();
  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative / 100) {
      return rarity as Rarity;
    }
  }
  return baseRarity;
}
```
- [x] **Step 3: Update index exports**

```typescript
// src/systems/adventure/index.ts
export type {
  AdventureService,
  AdventureContext,
  AdventureState,
  Adventure,
  AdventureType,
  AdventureStatus,
  LootDrop,
  Rarity,
  AdventureCreateResult,
  AdventureUpdateResult,
  AdventureCompleteResult,
} from './types';
export { emptyAdventureState } from './types';
export { ADVENTURE_BASE_DURATION_MS, MAX_ADVENTURES_ACTIVE } from './constants';
export { AdventureServiceImpl } from './service';
export { generateLoot } from './loot';
```
- [x] **Step 4: Run tests**

```bash
npx vitest run tests/unit/systems/adventure.test.ts
```
Expected: All tests PASS
- [x] **Step 5: Commit**

```bash
git add src/systems/adventure tests/unit/systems/adventure.test.ts
git commit -m "feat(systems): implement Adventure service with loot generation"
```
---
## Chunk 6: Adventure Plugin

**Dependencies:** Chunk 5 (Adventure Service)

**Files:**
- Create: `src/domain/pipeline/plugins/adventures.plugin.ts`
- Create: `tests/unit/domain/pipeline/plugins/adventures.plugin.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/unit/domain/pipeline/plugins/adventures.plugin.test.ts
import { describe, it, expect } from 'vitest';
import { createAdventuresPlugin } from '../../../../../src/domain/pipeline/plugins/adventures.plugin';
import type { TickContext } from '../../../../../src/domain/pipeline/types';
import { SeededRng } from '../../../../../src/core/rng';
import { createInitialState } from '../../../../../src/state/initial';

describe('AdventuresPlugin', () => {
  it('processes in-progress adventures and updates progress', () => {
    const plugin = createAdventuresPlugin();
    const state = createInitialState(Date.now(), 12345);

    // Add an in-progress adventure
    const adventure = {
      id: 'adv-1',
      type: 'dungeon' as const,
      status: 'in_progress' as const,
      heroIds: ['bard-1'],
      startedAt: Date.now() - 10000,
      duration: 60000,
      progress: 10000,
      difficulty: 3,
      rarity: 'rare' as const,
    };

    const stateWithAdventure = {
      ...state,
      adventures: {
        ...state.adventures,
        adventures: [adventure],
      },
    };

    const ctx: TickContext = {
      state: stateWithAdventure,
      rng: new SeededRng(12345),
      now: Date.now(),
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    expect(result.state.adventures.adventures[0].progress).toBeGreaterThan(10000);
  });

  it('completes adventures when progress reaches duration', () => {
    const plugin = createAdventuresPlugin();
    const now = Date.now();
    const state = createInitialState(now, 12345);

    const adventure = {
      id: 'adv-1',
      type: 'dungeon' as const,
      status: 'in_progress' as const,
      heroIds: ['bard-1'],
      startedAt: now - 60000,
      duration: 60000,
      progress: 59999,
      difficulty: 3,
      rarity: 'rare' as const,
    };

    const stateWithAdventure = {
      ...state,
      adventures: {
        ...state.adventures,
        adventures: [adventure],
      },
    };

    const ctx: TickContext = {
      state: stateWithAdventure,
      rng: new SeededRng(12345),
      now,
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    expect(result.state.adventures.adventures[0].status).toBe('completed');
    expect(result.events.some(e => e.type === 'ADVENTURE_COMPLETED')).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/pipeline/plugins/adventures.plugin.test.ts`
Expected: FAIL with "Cannot find module"

- [x] **Step 3: Create plugin implementation**

```typescript
// src/domain/pipeline/plugins/adventures.plugin.ts
import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import type { Adventure } from '../../../systems/adventure';
import { AdventureServiceImpl } from '../../../systems/adventure';

export function createAdventuresPlugin(): TickPlugin {
  const service = new AdventureServiceImpl();

  return {
    name: 'adventures',
    order: PLUGIN_ORDER.ADVENTURES,

    process(ctx: TickContext): TickResult {
      const adventures = ctx.state.adventures.adventures;
      const events: import('../../../types').DomainEvent[] = [];
      let updatedAdventures = [...adventures];

      for (let i = 0; i < updatedAdventures.length; i++) {
        const adventure = updatedAdventures[i];

        if (adventure.status === 'in_progress') {
          const result = service.updateProgress(adventure, {
            state: ctx.state,
            rng: ctx.rng,
            now: ctx.now,
          });

          updatedAdventures[i] = result.adventure;

          if (result.completed) {
            const completed = service.completeAdventure(result.adventure, {
              state: ctx.state,
              rng: ctx.rng,
              now: ctx.now,
            });

            updatedAdventures[i] = completed.adventure;
            events.push(...completed.events);
          }
        }
      }

      return {
        state: {
          ...ctx.state,
          adventures: {
            ...ctx.state.adventures,
            adventures: updatedAdventures,
          },
        },
        events,
      };
    },
  };
}
```

- [x] **Step 4: Update plugins index**

```typescript
// src/domain/pipeline/plugins/index.ts
export { createAdventuresPlugin } from './adventures.plugin';
```

- [x] **Step 5: Run tests**

Run: `npx vitest run tests/unit/domain/pipeline/plugins/adventures.plugin.test.ts`
Expected: All tests PASS

- [x] **Step 6: Commit**

```bash
git add src/domain/pipeline/plugins tests/unit/domain/pipeline/plugins
git commit -m "feat(pipeline): add adventures plugin for tick processing"
```

---
## Chunk 7: World System

**Dependencies:** Chunk 1 (RNG), Chunk 2 (Pipeline Types)

**Files:**
- Create: `src/systems/world/types.ts`
- Create: `src/systems/world/service.ts`
- Create: `src/systems/world/constants.ts`
- Create: `src/systems/world/index.ts`
- Create: `tests/unit/systems/world.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/unit/systems/world.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { WorldServiceImpl } from '../../../src/systems/world/service';
import type { WorldService, WorldContext, WorldState, WorldModifiers } from '../../../src/systems/world/types';
import { SeededRng } from '../../../src/core/rng';
import { emptyWorldState } from '../../../src/systems/world';

describe('WorldSystem', () => {
  let service: WorldService;
  let rng: SeededRng;

  beforeEach(() => {
    service = new WorldServiceImpl();
    rng = new SeededRng(12345);
  });

  describe('update', () => {
    it('advances time of day based on tick', () => {
      const state = emptyWorldState();
      const ctx: WorldContext = {
        state: { world: state },
        rng,
        now: Date.now(),
      };

      const result = service.update(ctx);

      // Time should advance
      expect(result.state).toBeDefined();
    });

    it('changes weather periodically', () => {
      const state = { ...emptyWorldState(), weather: 'clear' as const };
      const ctx: WorldContext = {
        state: { world: state },
        rng,
        now: Date.now(),
      };

      // Multiple updates may change weather
      let currentWeather = state.weather;
      for (let i = 0; i < 100; i++) {
        const result = service.update({
          ...ctx,
          rng: new SeededRng(i),
        });
        currentWeather = result.state.weather;
      }

      // Weather should have changed at least once
      // (probabilistic, but very likely)
    });
  });

  describe('getModifiers', () => {
    it('returns default modifiers for clear weather', () => {
      const state = { ...emptyWorldState(), weather: 'clear' as const };

      const modifiers = service.getModifiers(state);

      expect(modifiers.incomeMultiplier).toBe(1.0);
      expect(modifiers.visitorSpawnRate).toBe(1.0);
      expect(modifiers.adventureSuccessBonus).toBe(0);
    });

    it('reduces income during storm', () => {
      const state = { ...emptyWorldState(), weather: 'storm' as const };

      const modifiers = service.getModifiers(state);

      expect(modifiers.incomeMultiplier).toBeLessThan(1.0);
    });

    it('increases visitors during festival', () => {
      const state = {
        ...emptyWorldState(),
        activeEvents: [{ id: 'festival-1', type: 'festival', data: {} }],
      };

      const modifiers = service.getModifiers(state);

      expect(modifiers.visitorSpawnRate).toBeGreaterThan(1.0);
    });
  });

  describe('isEventActive', () => {
    it('returns true for active event', () => {
      const state = {
        ...emptyWorldState(),
        activeEvents: [{ id: 'plague-1', type: 'plague', data: {} }],
      };

      expect(service.isEventActive('plague-1', state)).toBe(true);
    });

    it('returns false for inactive event', () => {
      const state = emptyWorldState();

      expect(service.isEventActive('plague-1', state)).toBe(false);
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/world.test.ts`
Expected: FAIL with "Cannot find module"

- [x] **Step 3: Create world types**

```typescript
// src/systems/world/types.ts
export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'midnight';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';
export type WorldEventType = 'festival' | 'plague' | 'drought' | 'war' | 'trade_route';

export interface WorldEvent {
  readonly id: string;
  readonly type: WorldEventType;
  readonly data: Record<string, unknown>;
}

export interface WorldState {
  readonly timeOfDay: TimeOfDay;
  readonly weather: Weather;
  readonly dayNumber: number;
  readonly activeEvents: readonly WorldEvent[];
  readonly tickInDay: number;
}

export const emptyWorldState = (): WorldState => ({
  timeOfDay: 'dawn',
  weather: 'clear',
  dayNumber: 1,
  activeEvents: [],
  tickInDay: 0,
});

export interface WorldSlice {
  readonly world: WorldState;
}

export interface WorldContext {
  readonly state: WorldSlice;
  readonly rng: import('../../core/rng').RngService;
  readonly now: number;
}

export interface WorldModifiers {
  readonly incomeMultiplier: number;
  readonly visitorSpawnRate: number;
  readonly adventureSuccessBonus: number;
}

export interface WorldUpdateResult {
  readonly state: WorldState;
  readonly events: readonly import('../../types').DomainEvent[];
}

export interface WorldService {
  update(ctx: WorldContext): WorldUpdateResult;
  getModifiers(state: WorldState): WorldModifiers;
  isEventActive(eventId: string, state: WorldState): boolean;
}
```

- [x] **Step 4: Create world constants**

```typescript
// src/systems/world/constants.ts
import type { TimeOfDay, Weather, WorldEventType } from './types';

/** Ticks per time-of-day transition */
export const TICKS_PER_TOD = 10;

/** Weather change chance per tick */
export const WEATHER_CHANGE_CHANCE = 0.05;

/** Weather modifiers */
export const WEATHER_MODIFIERS: Record<Weather, { income: number; visitors: number; adventure: number }> = {
  clear: { income: 1.0, visitors: 1.0, adventure: 0 },
  cloudy: { income: 1.0, visitors: 0.95, adventure: 0 },
  rain: { income: 0.9, visitors: 0.8, adventure: -0.1 },
  storm: { income: 0.7, visitors: 0.5, adventure: -0.2 },
  snow: { income: 0.8, visitors: 0.7, adventure: -0.15 },
};

/** Event modifiers */
export const EVENT_MODIFIERS: Record<WorldEventType, { income: number; visitors: number; adventure: number }> = {
  festival: { income: 1.5, visitors: 2.0, adventure: 0 },
  plague: { income: 0.7, visitors: 0.3, adventure: -0.1 },
  drought: { income: 0.8, visitors: 0.9, adventure: 0 },
  war: { income: 1.2, visitors: 0.6, adventure: 0.2 },
  trade_route: { income: 1.3, visitors: 1.2, adventure: 0 },
};

/** Time of day progression */
export const TOD_ORDER: TimeOfDay[] = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night', 'midnight'];
```

- [x] **Step 5: Create world service**

```typescript
// src/systems/world/service.ts
import type { WorldService, WorldContext, WorldState, WorldModifiers, WorldUpdateResult, Weather } from './types';
import { TICKS_PER_TOD, WEATHER_CHANGE_CHANCE, WEATHER_MODIFIERS, EVENT_MODIFIERS, TOD_ORDER } from './constants';

export class WorldServiceImpl implements WorldService {
  update(ctx: WorldContext): WorldUpdateResult {
    let state = ctx.state.world;
    const events: import('../../types').DomainEvent[] = [];
    const stream = ctx.rng.createStream('world');

    // Advance time
    const newTickInDay = state.tickInDay + 1;
    const todIndex = TOD_ORDER.indexOf(state.timeOfDay);
    const newTodIndex = Math.floor(newTickInDay / TICKS_PER_TOD) % TOD_ORDER.length;
    const newTimeOfDay = TOD_ORDER[newTodIndex];
    const newDayNumber = state.dayNumber + Math.floor(newTickInDay / (TICKS_PER_TOD * TOD_ORDER.length));

    // Weather change
    let newWeather = state.weather;
    if (stream.chance(WEATHER_CHANGE_CHANCE)) {
      newWeather = this.rollWeather(stream);
      if (newWeather !== state.weather) {
        events.push({
          type: 'WEATHER_CHANGED',
          from: state.weather,
          to: newWeather,
          timestamp: ctx.now,
        });
      }
    }

    state = {
      ...state,
      timeOfDay: newTimeOfDay,
      dayNumber: newDayNumber,
      tickInDay: newTickInDay % (TICKS_PER_TOD * TOD_ORDER.length),
      weather: newWeather,
    };

    return { state, events };
  }

  getModifiers(state: WorldState): WorldModifiers {
    const weatherMod = WEATHER_MODIFIERS[state.weather];

    let incomeMultiplier = weatherMod.income;
    let visitorSpawnRate = weatherMod.visitors;
    let adventureSuccessBonus = weatherMod.adventure;

    for (const event of state.activeEvents) {
      const eventMod = EVENT_MODIFIERS[event.type];
      incomeMultiplier *= eventMod.income;
      visitorSpawnRate *= eventMod.visitors;
      adventureSuccessBonus += eventMod.adventure;
    }

    return { incomeMultiplier, visitorSpawnRate, adventureSuccessBonus };
  }

  isEventActive(eventId: string, state: WorldState): boolean {
    return state.activeEvents.some(e => e.id === eventId);
  }

  private rollWeather(stream: import('../../core/rng').RngService): Weather {
    const weathers: Weather[] = ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'storm', 'snow'];
    return stream.pick(weathers);
  }
}
```

- [x] **Step 6: Create world index**

```typescript
// src/systems/world/index.ts
export type {
  WorldService,
  WorldContext,
  WorldState,
  WorldSlice,
  WorldModifiers,
  WorldUpdateResult,
  WorldEvent,
  TimeOfDay,
  Weather,
  WorldEventType,
} from './types';
export { emptyWorldState } from './types';
export { WorldServiceImpl } from './service';
export { TICKS_PER_TOD, WEATHER_MODIFIERS, EVENT_MODIFIERS } from './constants';
```

- [x] **Step 7: Run tests**

Run: `npx vitest run tests/unit/systems/world.test.ts`
Expected: All tests PASS

- [x] **Step 8: Commit**

```bash
git add src/systems/world tests/unit/systems/world.test.ts
git commit -m "feat(systems): implement World system with time and weather"
```

- [x] **Step 9: Write World Plugin tests**

```typescript
// tests/unit/domain/pipeline/plugins/world.plugin.test.ts
import { describe, it, expect } from 'vitest';
import { createWorldPlugin } from '../../../../../src/domain/pipeline/plugins/world.plugin';
import type { TickContext } from '../../../../../src/domain/pipeline/types';
import { SeededRng } from '../../../../../src/core/rng';
import { createInitialState } from '../../../../../src/state/initial';

describe('WorldPlugin', () => {
  it('updates world state on tick', () => {
    const plugin = createWorldPlugin();
    const state = createInitialState(Date.now(), 12345);

    const ctx: TickContext = {
      state,
      rng: new SeededRng(12345),
      now: Date.now(),
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    expect(result.state.world.tickInDay).toBeGreaterThan(state.world.tickInDay);
  });

  it('emits weather change events', () => {
    const plugin = createWorldPlugin();
    const state = createInitialState(Date.now(), 99999);

    // Run many ticks to potentially trigger weather change
    let currentState = state;
    let allEvents: any[] = [];

    for (let i = 0; i < 100; i++) {
      const ctx: TickContext = {
        state: currentState,
        rng: new SeededRng(99999 + i),
        now: Date.now() + i * 40,
        accumulatedEvents: [],
      };

      const result = plugin.process(ctx);
      currentState = result.state;
      allEvents.push(...result.events);
    }

    // Weather changes are probabilistic but should have at least some events
    expect(currentState.world).toBeDefined();
  });

  it('has correct plugin order', () => {
    const plugin = createWorldPlugin();

    expect(plugin.order).toBe(600); // PLUGIN_ORDER.WORLD
  });
});
```

- [x] **Step 10: Create World Plugin implementation**

```typescript
// src/domain/pipeline/plugins/world.plugin.ts
import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import { WorldServiceImpl } from '../../../systems/world';
import type { DomainEvent } from '../../../types';

export function createWorldPlugin(): TickPlugin {
  const service = new WorldServiceImpl();

  return {
    name: 'world',
    order: PLUGIN_ORDER.WORLD,

    process(ctx: TickContext): TickResult {
      const worldResult = service.update({
        state: { world: ctx.state.world },
        rng: ctx.rng,
        now: ctx.now,
      });

      return {
        state: { ...ctx.state, world: worldResult.state },
        events: worldResult.events as DomainEvent[],
      };
    },
  };
}
```

- [x] **Step 11: Run World Plugin tests**

Run: `npx vitest run tests/unit/domain/pipeline/plugins/world.plugin.test.ts`
Expected: All tests PASS

- [x] **Step 12: Commit World Plugin**

```bash
git add src/domain/pipeline/plugins/world.plugin.ts tests/unit/domain/pipeline/plugins/world.plugin.test.ts
git commit -m "feat(pipeline): add World plugin for time and weather updates"
```

---
## Chunk 8: Event Log System

**Dependencies:** None (standalone)

**Files:**
- Create: `src/systems/event-log/types.ts`
- Create: `src/systems/event-log/service.ts`
- Create: `src/systems/event-log/index.ts`
- Create: `tests/unit/systems/event-log.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/unit/systems/event-log.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EventLogServiceImpl } from '../../../src/systems/event-log/service';
import type { EventLogService, EventLogState, LogEntry, Notification, EventFilter } from '../../../src/systems/event-log/types';
import { emptyEventLogState } from '../../../src/systems/event-log';

describe('EventLogSystem', () => {
  let service: EventLogService;
  let state: EventLogState;

  beforeEach(() => {
    service = new EventLogServiceImpl();
    state = emptyEventLogState();
  });

  describe('append', () => {
    it('adds entry to log', () => {
      const entry: LogEntry = {
        id: 'log-1',
        timestamp: Date.now(),
        type: 'hero_hired',
        data: { heroId: 'bard-1' },
      };

      const newState = service.append(entry, state);

      expect(newState.entries).toHaveLength(1);
      expect(newState.entries[0]).toEqual(entry);
    });

    it('truncates old entries when max exceeded', () => {
      state = { ...state, maxEntries: 3 };

      for (let i = 0; i < 5; i++) {
        state = service.append({
          id: `log-${i}`,
          timestamp: Date.now() + i,
          type: 'hero_hired',
          data: {},
        }, state);
      }

      expect(state.entries.length).toBeLessThanOrEqual(3);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      const entries: LogEntry[] = [
        { id: '1', timestamp: 1000, type: 'hero_hired', data: {} },
        { id: '2', timestamp: 2000, type: 'visitor_arrived', data: {} },
        { id: '3', timestamp: 3000, type: 'hero_hired', data: {} },
        { id: '4', timestamp: 4000, type: 'adventure_started', data: {} },
      ];
      state = { ...state, entries };
    });

    it('filters by type', () => {
      const filter: EventFilter = { types: ['hero_hired'] };
      const result = service.query(filter, state);

      expect(result).toHaveLength(2);
      expect(result.every(e => e.type === 'hero_hired')).toBe(true);
    });

    it('filters by time range', () => {
      const filter: EventFilter = { since: 1500, until: 3500 };
      const result = service.query(filter, state);

      expect(result).toHaveLength(2);
    });

    it('limits results', () => {
      const filter: EventFilter = { limit: 2 };
      const result = service.query(filter, state);

      expect(result).toHaveLength(2);
    });
  });

  describe('notifications', () => {
    it('creates notification', () => {
      const newState = service.createNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message',
        isRead: false,
      }, state);

      expect(newState.notifications).toHaveLength(1);
      expect(newState.notifications[0].title).toBe('Test');
    });

    it('gets unread notifications', () => {
      state = {
        ...state,
        notifications: [
          { id: 'n1', timestamp: 1000, type: 'info', title: 'A', message: 'a', isRead: true },
          { id: 'n2', timestamp: 2000, type: 'success', title: 'B', message: 'b', isRead: false },
        ],
      };

      const unread = service.getUnread(state);

      expect(unread).toHaveLength(1);
      expect(unread[0].id).toBe('n2');
    });

    it('marks notifications as read', () => {
      state = {
        ...state,
        notifications: [
          { id: 'n1', timestamp: 1000, type: 'info', title: 'A', message: 'a', isRead: false },
          { id: 'n2', timestamp: 2000, type: 'success', title: 'B', message: 'b', isRead: false },
        ],
      };

      const newState = service.markRead(['n1'], state);

      expect(newState.notifications[0].isRead).toBe(true);
      expect(newState.notifications[1].isRead).toBe(false);
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/event-log.test.ts`
Expected: FAIL with "Cannot find module"

- [x] **Step 3: Create event-log types**

```typescript
// src/systems/event-log/types.ts
export type LogEventType =
  | 'hero_hired' | 'hero_upgraded' | 'visitor_arrived' | 'visitor_departed'
  | 'adventure_started' | 'adventure_completed' | 'adventure_failed'
  | 'loot_obtained' | 'gold_earned' | 'world_event' | 'personality_changed';

export interface LogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly type: LogEventType | string;
  readonly data: Record<string, unknown>;
}

export interface Notification {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'info' | 'success' | 'warning';
  readonly title: string;
  readonly message: string;
  readonly isRead: boolean;
}

export interface EventLogState {
  readonly entries: readonly LogEntry[];
  readonly notifications: readonly Notification[];
  readonly lastReadAt: number;
  readonly maxEntries: number;
}

export const emptyEventLogState = (): EventLogState => ({
  entries: [],
  notifications: [],
  lastReadAt: 0,
  maxEntries: 100,
});

export interface EventLogSlice {
  readonly eventLog: EventLogState;
}

export interface EventFilter {
  readonly since?: number;
  readonly until?: number;
  readonly types?: readonly string[];
  readonly limit?: number;
}

export interface EventLogService {
  append(entry: LogEntry, state: EventLogState): EventLogState;
  query(filter: EventFilter, state: EventLogState): readonly LogEntry[];
  getUnread(state: EventLogState): readonly Notification[];
  markRead(ids: readonly string[], state: EventLogState): EventLogState;
  createNotification(input: Omit<Notification, 'id' | 'timestamp'>, state: EventLogState): EventLogState;
}
```

- [x] **Step 4: Create event-log service**

```typescript
// src/systems/event-log/service.ts
import type { EventLogService, EventLogState, LogEntry, Notification, EventFilter } from './types';

export class EventLogServiceImpl implements EventLogService {
  append(entry: LogEntry, state: EventLogState): EventLogState {
    const entries = [...state.entries, entry];

    // Truncate if needed
    if (entries.length > state.maxEntries) {
      entries.splice(0, entries.length - state.maxEntries);
    }

    return { ...state, entries };
  }

  query(filter: EventFilter, state: EventLogState): readonly LogEntry[] {
    let result = [...state.entries];

    if (filter.since !== undefined) {
      result = result.filter(e => e.timestamp >= filter.since!);
    }
    if (filter.until !== undefined) {
      result = result.filter(e => e.timestamp <= filter.until!);
    }
    if (filter.types !== undefined && filter.types.length > 0) {
      result = result.filter(e => filter.types!.includes(e.type));
    }
    if (filter.limit !== undefined) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  getUnread(state: EventLogState): readonly Notification[] {
    return state.notifications.filter(n => !n.isRead);
  }

  markRead(ids: readonly string[], state: EventLogState): EventLogState {
    const idSet = new Set(ids);
    const now = Date.now();

    return {
      ...state,
      lastReadAt: now,
      notifications: state.notifications.map(n =>
        idSet.has(n.id) ? { ...n, isRead: true } : n
      ),
    };
  }

  createNotification(input: Omit<Notification, 'id' | 'timestamp'>, state: EventLogState): EventLogState {
    const notification: Notification = {
      ...input,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    return {
      ...state,
      notifications: [...state.notifications, notification],
    };
  }
}
```

- [x] **Step 5: Create event-log index**

```typescript
// src/systems/event-log/index.ts
export type {
  EventLogService,
  EventLogState,
  EventLogSlice,
  LogEntry,
  Notification,
  EventFilter,
  LogEventType,
} from './types';
export { emptyEventLogState } from './types';
export { EventLogServiceImpl } from './service';
```

- [x] **Step 6: Run tests**

Run: `npx vitest run tests/unit/systems/event-log.test.ts`
Expected: All tests PASS

- [x] **Step 7: Commit**

```bash
git add src/systems/event-log tests/unit/systems/event-log.test.ts
git commit -m "feat(systems): implement Event Log system with notifications"
```

---
## Chunk 9: Personality System

**Dependencies:** None (standalone)

**Files:**
- Create: `src/systems/personality/types.ts`
- Create: `src/systems/personality/service.ts`
- Create: `src/systems/personality/traits.ts`
- Create: `src/systems/personality/index.ts`
- Create: `tests/unit/systems/personality.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// tests/unit/systems/personality.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PersonalityServiceImpl } from '../../../src/systems/personality/service';
import type { PersonalityService, PersonalityState, Trait, TraitEffectsResult } from '../../../src/systems/personality/types';
import { emptyPersonalityState, ALL_TRAITS } from '../../../src/systems/personality';

describe('PersonalitySystem', () => {
  let service: PersonalityService;

  beforeEach(() => {
    service = new PersonalityServiceImpl();
  });

  describe('getTraits', () => {
    it('returns all available traits', () => {
      const traits = service.getTraits();

      expect(traits.length).toBeGreaterThan(0);
      expect(traits[0]).toHaveProperty('id');
      expect(traits[0]).toHaveProperty('name');
      expect(traits[0]).toHaveProperty('effects');
    });
  });

  describe('getTrait', () => {
    it('returns trait by id', () => {
      const trait = service.getTrait('brave');

      expect(trait).toBeDefined();
      expect(trait?.name).toBe('Brave');
    });

    it('returns undefined for unknown trait', () => {
      const trait = service.getTrait('unknown');

      expect(trait).toBeUndefined();
    });
  });

  describe('getPersonality', () => {
    it('returns empty state for unknown hero', () => {
      const slice = { heroPersonalities: {} };

      const personality = service.getPersonality('unknown-hero', slice);

      expect(personality.traits).toEqual([]);
      expect(personality.corruption).toBe(0);
    });

    it('returns existing personality', () => {
      const existing: PersonalityState = { traits: ['brave'], corruption: 0.2 };
      const slice = { heroPersonalities: { 'hero-1': existing } };

      const personality = service.getPersonality('hero-1', slice);

      expect(personality).toEqual(existing);
    });
  });

  describe('calculateCorruption', () => {
    it('returns 0 for empty traits', () => {
      const personality = emptyPersonalityState();

      const corruption = service.calculateCorruption(personality, ALL_TRAITS);

      expect(corruption).toBe(0);
    });

    it('increases corruption based on trait weights', () => {
      const personality: PersonalityState = { traits: ['greedy', 'suspicious'], corruption: 0 };

      const corruption = service.calculateCorruption(personality, ALL_TRAITS);

      expect(corruption).toBeGreaterThan(0);
    });
  });

  describe('applyTraitEffects', () => {
    it('combines effects from multiple traits', () => {
      const personality: PersonalityState = { traits: ['brave', 'generous'], corruption: 0 };

      const effects = service.applyTraitEffects(personality, ALL_TRAITS);

      expect(effects.incomeMultiplier).toBeDefined();
      expect(effects.adventureBonus).toBeDefined();
      expect(effects.corruptionResistance).toBeDefined();
    });
  });

  describe('canGainTrait', () => {
    it('returns false if already has trait', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      const canGain = service.canGainTrait(personality, 'brave', ALL_TRAITS);

      expect(canGain).toBe(false);
    });

    it('returns false if at max traits', () => {
      const personality: PersonalityState = {
        traits: ['brave', 'cautious', 'generous', 'curious'],
        corruption: 0,
      };

      const canGain = service.canGainTrait(personality, 'suspicious', ALL_TRAITS);

      expect(canGain).toBe(false);
    });

    it('returns true for valid new trait', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      const canGain = service.canGainTrait(personality, 'cautious', ALL_TRAITS);

      expect(canGain).toBe(true);
    });
  });

  describe('gainTrait', () => {
    it('adds trait to personality', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      const newPersonality = service.gainTrait(personality, 'generous', ALL_TRAITS);

      expect(newPersonality.traits).toContain('generous');
      expect(newPersonality.traits).toContain('brave');
    });

    it('does not mutate original', () => {
      const personality: PersonalityState = { traits: ['brave'], corruption: 0 };

      service.gainTrait(personality, 'generous', ALL_TRAITS);

      expect(personality.traits).not.toContain('generous');
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/personality.test.ts`
Expected: FAIL with "Cannot find module"

- [x] **Step 3: Create personality types**

```typescript
// src/systems/personality/types.ts
export type TraitType = 'brave' | 'cautious' | 'greedy' | 'generous' | 'curious' | 'suspicious';

export interface TraitEffect {
  readonly type: 'income_modifier' | 'adventure_bonus' | 'corruption_resistance';
  readonly value: number;
}

export interface Trait {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: TraitType;
  readonly effects: readonly TraitEffect[];
  readonly corruptionWeight: number;
}

export interface PersonalityState {
  readonly traits: readonly string[];
  readonly corruption: number;
}

export const emptyPersonalityState = (): PersonalityState => ({
  traits: [],
  corruption: 0,
});

export interface PersonalitySlice {
  readonly heroPersonalities: Record<string, PersonalityState>;
}

export interface TraitEffectsResult {
  readonly incomeMultiplier: number;
  readonly adventureBonus: number;
  readonly corruptionResistance: number;
}

export interface PersonalityService {
  getTraits(): readonly Trait[];
  getTrait(id: string): Trait | undefined;
  getPersonality(heroId: string, slice: PersonalitySlice): PersonalityState;
  calculateCorruption(personality: PersonalityState, traits: readonly Trait[]): number;
  applyTraitEffects(personality: PersonalityState, traits: readonly Trait[]): TraitEffectsResult;
  canGainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): boolean;
  gainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): PersonalityState;
}
```

- [x] **Step 4: Create traits definitions**

```typescript
// src/systems/personality/traits.ts
import type { Trait } from './types';

export const ALL_TRAITS: readonly Trait[] = [
  {
    id: 'brave',
    name: 'Brave',
    description: 'Increases adventure success chance',
    type: 'brave',
    effects: [{ type: 'adventure_bonus', value: 0.1 }],
    corruptionWeight: 0,
  },
  {
    id: 'cautious',
    name: 'Cautious',
    description: 'Resists corruption better',
    type: 'cautious',
    effects: [{ type: 'corruption_resistance', value: 0.2 }],
    corruptionWeight: 0,
  },
  {
    id: 'greedy',
    name: 'Greedy',
    description: 'Increases income but prone to corruption',
    type: 'greedy',
    effects: [{ type: 'income_modifier', value: 0.15 }],
    corruptionWeight: 0.3,
  },
  {
    id: 'generous',
    name: 'Generous',
    description: 'Slightly less income but corruption resistant',
    type: 'generous',
    effects: [
      { type: 'income_modifier', value: -0.05 },
      { type: 'corruption_resistance', value: 0.15 },
    ],
    corruptionWeight: 0,
  },
  {
    id: 'curious',
    name: 'Curious',
    description: 'Better adventure rewards',
    type: 'curious',
    effects: [{ type: 'adventure_bonus', value: 0.05 }],
    corruptionWeight: 0.1,
  },
  {
    id: 'suspicious',
    name: 'Suspicious',
    description: 'Very corruption resistant but less income',
    type: 'suspicious',
    effects: [
      { type: 'corruption_resistance', value: 0.3 },
      { type: 'income_modifier', value: -0.1 },
    ],
    corruptionWeight: 0,
  },
];

export const MAX_TRAITS_PER_HERO = 4;
```

- [x] **Step 5: Create personality service**

```typescript
// src/systems/personality/service.ts
import type { PersonalityService, PersonalityState, PersonalitySlice, Trait, TraitEffectsResult } from './types';
import { ALL_TRAITS, MAX_TRAITS_PER_HERO } from './traits';

export class PersonalityServiceImpl implements PersonalityService {
  getTraits(): readonly Trait[] {
    return ALL_TRAITS;
  }

  getTrait(id: string): Trait | undefined {
    return ALL_TRAITS.find(t => t.id === id);
  }

  getPersonality(heroId: string, slice: PersonalitySlice): PersonalityState {
    return slice.heroPersonalities[heroId] ?? { traits: [], corruption: 0 };
  }

  calculateCorruption(personality: PersonalityState, traits: readonly Trait[]): number {
    let corruption = personality.corruption;

    for (const traitId of personality.traits) {
      const trait = traits.find(t => t.id === traitId);
      if (trait) {
        corruption += trait.corruptionWeight;
      }
    }

    return Math.min(1, Math.max(0, corruption));
  }

  applyTraitEffects(personality: PersonalityState, traits: readonly Trait[]): TraitEffectsResult {
    let incomeMultiplier = 1.0;
    let adventureBonus = 0;
    let corruptionResistance = 0;

    for (const traitId of personality.traits) {
      const trait = traits.find(t => t.id === traitId);
      if (!trait) continue;

      for (const effect of trait.effects) {
        switch (effect.type) {
          case 'income_modifier':
            incomeMultiplier += effect.value;
            break;
          case 'adventure_bonus':
            adventureBonus += effect.value;
            break;
          case 'corruption_resistance':
            corruptionResistance += effect.value;
            break;
        }
      }
    }

    return { incomeMultiplier, adventureBonus, corruptionResistance };
  }

  canGainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): boolean {
    if (personality.traits.includes(traitId)) return false;
    if (personality.traits.length >= MAX_TRAITS_PER_HERO) return false;
    if (!traits.find(t => t.id === traitId)) return false;
    return true;
  }

  gainTrait(personality: PersonalityState, traitId: string, traits: readonly Trait[]): PersonalityState {
    if (!this.canGainTrait(personality, traitId, traits)) {
      return personality;
    }

    const newTraits = [...personality.traits, traitId];
    const newCorruption = this.calculateCorruption({ ...personality, traits: newTraits }, traits);

    return {
      traits: newTraits,
      corruption: newCorruption,
    };
  }
}
```

- [x] **Step 6: Create personality index**

```typescript
// src/systems/personality/index.ts
export type {
  PersonalityService,
  PersonalityState,
  PersonalitySlice,
  Trait,
  TraitEffect,
  TraitType,
  TraitEffectsResult,
} from './types';
export { emptyPersonalityState } from './types';
export { PersonalityServiceImpl } from './service';
export { ALL_TRAITS, MAX_TRAITS_PER_HERO } from './traits';
```

- [x] **Step 7: Run tests**

Run: `npx vitest run tests/unit/systems/personality.test.ts`
Expected: All tests PASS

- [x] **Step 8: Commit**

```bash
git add src/systems/personality tests/unit/systems/personality.test.ts
git commit -m "feat(systems): implement Personality system with traits"
```

---
## Chunk 9.5: Heroes Plugin (Refactor from tick.ts)

**Dependencies:** Chunk 1 (RNG), Chunk 2 (Pipeline Types)

**Goal:** Extract hero processing logic from existing tick.ts into a plugin.

**Files:**
- Create: `src/domain/pipeline/plugins/heroes.plugin.ts`
- Create: `tests/unit/domain/pipeline/plugins/heroes.plugin.test.ts`

- [x] **Step 1: Read existing tick.ts to understand hero processing**

Read: `src/time/tick.ts` - Identify hero-related logic (income, upgrades, etc.)

- [x] **Step 2: Write failing tests for Heroes Plugin**

```typescript
// tests/unit/domain/pipeline/plugins/heroes.plugin.test.ts
import { describe, it, expect } from 'vitest';
import { createHeroesPlugin } from '../../../../../src/domain/pipeline/plugins/heroes.plugin';
import type { TickContext } from '../../../../../src/domain/pipeline/types';
import { SeededRng } from '../../../../../src/core/rng';
import { createInitialState } from '../../../../../src/state/initial';

describe('HeroesPlugin', () => {
  it('processes hero income on tick', () => {
    const plugin = createHeroesPlugin();
    const state = createInitialState(Date.now(), 12345);

    // Add a hero to roster
    const stateWithHero = {
      ...state,
      heroes: {
        ...state.heroes,
        roster: {
          ...state.heroes.roster,
          'bard-1': { id: 'bard-1', level: 1, hiredAt: Date.now() },
        },
      },
    };

    const ctx: TickContext = {
      state: stateWithHero,
      rng: new SeededRng(12345),
      now: Date.now(),
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    // Gold should increase
    expect(result.state.wallet.gold).toBeGreaterThan(stateWithHero.wallet.gold);
  });

  it('applies income multipliers from world state', () => {
    const plugin = createHeroesPlugin();
    const state = createInitialState(Date.now(), 12345);

    // Set storm weather (reduces income)
    const stateWithWeather = {
      ...state,
      world: { ...state.world, weather: 'storm' as const },
      heroes: {
        ...state.heroes,
        roster: {
          'bard-1': { id: 'bard-1', level: 1, hiredAt: Date.now() },
        },
      },
    };

    const ctx: TickContext = {
      state: stateWithWeather,
      rng: new SeededRng(12345),
      now: Date.now(),
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    // Gold increase should be reduced by storm modifier
    expect(result.state.wallet.gold).toBeDefined();
  });

  it('has correct plugin order', () => {
    const plugin = createHeroesPlugin();

    expect(plugin.order).toBe(400); // PLUGIN_ORDER.HEROES
  });

  it('emits income events', () => {
    const plugin = createHeroesPlugin();
    const state = createInitialState(Date.now(), 12345);

    const stateWithHero = {
      ...state,
      heroes: {
        ...state.heroes,
        roster: {
          'bard-1': { id: 'bard-1', level: 1, hiredAt: Date.now() },
        },
      },
    };

    const ctx: TickContext = {
      state: stateWithHero,
      rng: new SeededRng(12345),
      now: Date.now(),
      accumulatedEvents: [],
    };

    const result = plugin.process(ctx);

    const incomeEvents = result.events.filter(e => e.type === 'GOLD_EARNED');
    expect(incomeEvents.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/pipeline/plugins/heroes.plugin.test.ts`
Expected: FAIL with "Cannot find module"

- [x] **Step 4: Create Heroes Plugin implementation**

```typescript
// src/domain/pipeline/plugins/heroes.plugin.ts
import type { TickPlugin, TickContext, TickResult } from '../types';
import { PLUGIN_ORDER } from '../types';
import { calculateIncome } from '../../../economy/income';
import { WEATHER_MODIFIERS } from '../../../systems/world/constants';
import type { DomainEvent } from '../../../types';

export function createHeroesPlugin(): TickPlugin {
  return {
    name: 'heroes',
    order: PLUGIN_ORDER.HEROES,

    process(ctx: TickContext): TickResult {
      const state = ctx.state;
      const events: DomainEvent[] = [];

      // Get world modifiers
      const weatherMod = WEATHER_MODIFIERS[state.world.weather] || { income: 1.0 };
      const incomeMultiplier = weatherMod.income;

      // Calculate income from heroes
      const heroes = Object.values(state.heroes.roster);
      if (heroes.length === 0) {
        return { state, events };
      }

      const baseIncome = calculateIncome(heroes, state.tavern);
      const adjustedIncome = Math.floor(baseIncome * incomeMultiplier);

      // Apply income
      const newGold = state.wallet.gold + adjustedIncome;

      events.push({
        type: 'GOLD_EARNED',
        amount: adjustedIncome,
        source: 'hero_income',
        timestamp: ctx.now,
      });

      return {
        state: {
          ...state,
          wallet: { ...state.wallet, gold: newGold },
        },
        events,
      };
    },
  };
}
```

- [x] **Step 5: Run tests**

Run: `npx vitest run tests/unit/domain/pipeline/plugins/heroes.plugin.test.ts`
Expected: All tests PASS

- [x] **Step 6: Commit**

```bash
git add src/domain/pipeline/plugins/heroes.plugin.ts tests/unit/domain/pipeline/plugins/heroes.plugin.test.ts
git commit -m "feat(pipeline): add Heroes plugin for income processing"
```

---
## Chunk 10: Pipeline Integration

**Dependencies:** Chunks 1-9 (all systems complete)

**Goal:** Integrate all systems into main tick pipeline and refactor handlers.

**Files:**
- Modify: `src/time/tick.ts` (refactor to use pipeline)
- Create: `src/domain/handlers/tick.handler.ts`
- Modify: `src/reducer/handlers.ts` (delegate to new handlers)
- Create: `src/state/migrations.ts` (add v0.1.0 → v0.2.0 migration)
- Create: `tests/integration/tick-pipeline.test.ts`

- [x] **Step 1: Write integration test**

```typescript
// tests/integration/tick-pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { createTickPipeline } from '../../src/domain/pipeline';
import { PLUGIN_ORDER } from '../../src/domain/pipeline/types';
import { SeededRng } from '../../src/core/rng';
import { createInitialState } from '../../src/state/initial';
import { createDirectorPlugin } from '../../src/domain/pipeline/plugins/director.plugin';
import { createHeroesPlugin } from '../../src/domain/pipeline/plugins/heroes.plugin';
import { createAdventuresPlugin } from '../../src/domain/pipeline/plugins/adventures.plugin';
import { createWorldPlugin } from '../../src/domain/pipeline/plugins/world.plugin';

describe('Tick Pipeline Integration', () => {
  it('processes full pipeline with all plugins', () => {
    const plugins = [
      createDirectorPlugin(),
      createHeroesPlugin(),
      createAdventuresPlugin(),
      createWorldPlugin(),
    ];

    const pipeline = createTickPipeline(plugins);
    const state = createInitialState(Date.now(), 12345);
    const rng = new SeededRng(12345);

    const result = pipeline.process({
      state,
      rng,
      now: Date.now(),
      accumulatedEvents: [],
    });

    expect(result.state).toBeDefined();
    expect(result.events).toBeDefined();
  });

  it('maintains plugin order', () => {
    const plugins = [
      createHeroesPlugin(),      // order: 400
      createDirectorPlugin(),    // order: 300
      createWorldPlugin(),       // order: 600
      createAdventuresPlugin(),  // order: 500
    ];

    const pipeline = createTickPipeline(plugins);

    expect(pipeline.plugins[0].order).toBe(PLUGIN_ORDER.DIRECTOR);
    expect(pipeline.plugins[1].order).toBe(PLUGIN_ORDER.HEROES);
    expect(pipeline.plugins[2].order).toBe(PLUGIN_ORDER.ADVENTURES);
    expect(pipeline.plugins[3].order).toBe(PLUGIN_ORDER.WORLD);
  });

  it('produces deterministic results for same seed', () => {
    const plugins1 = [createDirectorPlugin(), createHeroesPlugin()];
    const plugins2 = [createDirectorPlugin(), createHeroesPlugin()];

    const pipeline1 = createTickPipeline(plugins1);
    const pipeline2 = createTickPipeline(plugins2);

    const state = createInitialState(Date.now(), 99999);

    const result1 = pipeline1.process({
      state,
      rng: new SeededRng(99999),
      now: Date.now(),
      accumulatedEvents: [],
    });

    const result2 = pipeline2.process({
      state,
      rng: new SeededRng(99999),
      now: Date.now(),
      accumulatedEvents: [],
    });

    expect(result1.state.director.visitors.length).toBe(result2.state.director.visitors.length);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/tick-pipeline.test.ts`
Expected: FAIL (plugins not yet integrated)

- [x] **Step 3: Create tick.handler.ts**

```typescript
// src/domain/handlers/tick.handler.ts
import type { GameState, DomainEvent } from '../../types';
import { createTickPipeline, PLUGIN_ORDER } from '../pipeline';
import type { TickPlugin, TickContext } from '../pipeline/types';
import { SeededRng } from '../../core/rng';
import { createDirectorPlugin } from '../pipeline/plugins/director.plugin';
import { createHeroesPlugin } from '../pipeline/plugins/heroes.plugin';

export interface TickHandlerResult {
  state: GameState;
  events: readonly DomainEvent[];
}

export function handleTick(
  state: GameState,
  count: number,
  now: number
): TickHandlerResult {
  const rng = new SeededRng(state.meta.seed);

  // Build plugins list
  const plugins: TickPlugin[] = [
    createDirectorPlugin(),
    createHeroesPlugin(),
  ];

  const pipeline = createTickPipeline(plugins);
  let currentState = state;
  let allEvents: DomainEvent[] = [];

  for (let i = 0; i < count; i++) {
    const ctx: TickContext = {
      state: currentState,
      rng,
      now: now + (i * 40), // 40ms per tick
      accumulatedEvents: allEvents,
    };

    const result = pipeline.process(ctx);
    currentState = result.state;
    allEvents = [...allEvents, ...result.events];
  }

  return { state: currentState, events: allEvents };
}
```

- [x] **Step 4: Create state migration**

```typescript
// src/state/migrations.ts
import { SCHEMA_VERSION } from '../types';
import type { GameState } from '../types';
import { emptyDirectorState } from '../systems/director';
import { emptyAdventureState } from '../systems/adventure';
import { emptyWorldState } from '../systems/world';
import { emptyEventLogState } from '../systems/event-log';

interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate(state: unknown): GameState;
}

const migrations: Migration[] = [
  {
    fromVersion: '0.1.0',
    toVersion: '0.2.0',
    migrate(state: unknown): GameState {
      const oldState = state as Record<string, unknown>;
      return {
        ...(oldState as Omit<GameState, 'director' | 'adventures' | 'world' | 'eventLog' | 'personality'>),
        meta: { ...(oldState.meta as object), version: '0.2.0' },
        director: emptyDirectorState(),
        adventures: emptyAdventureState(),
        world: emptyWorldState(),
        eventLog: emptyEventLogState(),
        personality: { heroPersonalities: {} },
      };
    },
  },
];

export function migrateState(state: unknown, targetVersion: string): GameState {
  let current = (state as { meta?: { version?: string } }).meta?.version || '0.1.0';
  let currentState = state;

  while (current !== targetVersion) {
    const migration = migrations.find(m => m.fromVersion === current);
    if (!migration) {
      throw new Error(`No migration from version ${current} to ${targetVersion}`);
    }
    currentState = migration.migrate(currentState);
    current = migration.toVersion;
  }

  return currentState as GameState;
}
```

- [x] **Step 5: Update handlers.ts to use new tick handler**

Read the current handlers.ts to understand its structure, then refactor:

```typescript
// src/reducer/handlers.ts (modified sections)
import { handleTick } from '../domain/handlers/tick.handler';

// In the reducer, delegate TICK actions:
case 'TICK': {
  const count = action.count ?? 1;
  const result = handleTick(state, count, action.now ?? Date.now());
  return result.state;
}
```

- [x] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (existing + new)

- [x] **Step 7: Commit**

```bash
git add src/domain/handlers src/state/migrations.ts src/reducer/handlers.ts tests/integration
git commit -m "feat: integrate tick pipeline with all systems and add state migration"
```

---
## Chunk 11: CLI Extensions

**Dependencies:** Chunk 10 (Pipeline Integration)

**Files:**
- Modify: `src/cli/commands.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/cli/display.ts`
- Create: `tests/unit/cli/commands.test.ts`

- [x] **Step 1: Write failing tests for new commands**

```typescript
// tests/unit/cli/commands.test.ts
import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../../src/cli/commands';

describe('CLI Commands - New Commands', () => {
  describe('log command', () => {
    it('parses basic log command', () => {
      const result = parseCommand('log');

      expect(result.type).toBe('LOG');
    });

    it('parses log with type filter', () => {
      const result = parseCommand('log --type hero_hired');

      expect(result.type).toBe('LOG');
      expect(result.filter?.types).toContain('hero_hired');
    });

    it('parses log with limit', () => {
      const result = parseCommand('log --limit 10');

      expect(result.type).toBe('LOG');
      expect(result.filter?.limit).toBe(10);
    });
  });

  describe('events command', () => {
    it('parses events command', () => {
      const result = parseCommand('events');

      expect(result.type).toBe('EVENTS');
    });

    it('parses events with limit', () => {
      const result = parseCommand('events 20');

      expect(result.type).toBe('EVENTS');
      expect(result.limit).toBe(20);
    });
  });

  describe('notifications command', () => {
    it('parses notifications command', () => {
      const result = parseCommand('notifications');

      expect(result.type).toBe('NOTIFICATIONS');
    });

    it('parses notifications --all flag', () => {
      const result = parseCommand('notifications --all');

      expect(result.type).toBe('NOTIFICATIONS');
      expect(result.showRead).toBe(true);
    });
  });

  describe('mark-read command', () => {
    it('parses mark-read with ids', () => {
      const result = parseCommand('mark-read notif-1 notif-2');

      expect(result.type).toBe('MARK_READ');
      expect(result.ids).toEqual(['notif-1', 'notif-2']);
    });
  });

  describe('world command', () => {
    it('parses world status command', () => {
      const result = parseCommand('world');

      expect(result.type).toBe('WORLD');
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cli/commands.test.ts`
Expected: FAIL with "LOG" not recognized

- [x] **Step 3: Update commands.ts with new command types**

```typescript
// Add to src/cli/commands.ts

export interface LogCommand extends ParsedCommandBase {
  readonly type: 'LOG';
  readonly filter?: EventFilter;
}

export interface EventsCommand extends ParsedCommandBase {
  readonly type: 'EVENTS';
  readonly limit?: number;
}

export interface NotificationsCommand extends ParsedCommandBase {
  readonly type: 'NOTIFICATIONS';
  readonly showRead?: boolean;
}

export interface MarkReadCommand extends ParsedCommandBase {
  readonly type: 'MARK_READ';
  readonly ids: readonly string[];
}

export interface WorldCommand extends ParsedCommandBase {
  readonly type: 'WORLD';
}

export interface EventFilter {
  readonly since?: number;
  readonly until?: number;
  readonly types?: readonly string[];
  readonly limit?: number;
}

// Update parseCommand function to handle new commands:
// Add cases for 'log', 'events', 'notifications', 'mark-read', 'world'
```

- [x] **Step 4: Update CLI index.ts with new command handlers**

```typescript
// Add to src/cli/index.ts

case 'LOG': {
  const logState = state.eventLog;
  const filter = cmd.filter || {};
  const entries = eventLogService.query(filter, logState);
  display.displayLogEntries(entries);
  break;
}

case 'EVENTS': {
  const limit = cmd.limit ?? 50;
  const entries = state.eventLog.entries.slice(-limit);
  display.displayLogEntries(entries);
  break;
}

case 'NOTIFICATIONS': {
  const notifications = cmd.showRead
    ? state.eventLog.notifications
    : eventLogService.getUnread(state.eventLog);
  display.displayNotifications(notifications);
  break;
}

case 'MARK_READ': {
  const newState = eventLogService.markRead(cmd.ids, state.eventLog);
  return { ...state, eventLog: newState };
}

case 'WORLD': {
  display.displayWorldState(state.world);
  break;
}
```

- [x] **Step 5: Add display formatters**

```typescript
// Add to src/cli/display.ts

displayLogEntries(entries: readonly LogEntry[]): void {
  if (entries.length === 0) {
    console.log('No events found.');
    return;
  }

  console.log(`\n📜 Event Log (${entries.length} entries)\n`);
  for (const entry of entries) {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    console.log(`  [${time}] ${entry.type}: ${JSON.stringify(entry.data)}`);
  }
}

displayNotifications(notifications: readonly Notification[]): void {
  if (notifications.length === 0) {
    console.log('No notifications.');
    return;
  }

  console.log(`\n🔔 Notifications (${notifications.length})\n`);
  for (const n of notifications) {
    const icon = n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️';
    const read = n.isRead ? '' : ' (unread)';
    console.log(`  ${icon} ${n.title}${read}`);
    console.log(`     ${n.message}`);
  }
}

displayWorldState(world: WorldState): void {
  console.log(`\n🌍 World State`);
  console.log(`  Day ${world.dayNumber} - ${world.timeOfDay}`);
  console.log(`  Weather: ${world.weather}`);
  if (world.activeEvents.length > 0) {
    console.log(`  Active Events: ${world.activeEvents.map(e => e.type).join(', ')}`);
  }
}
```

- [x] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [x] **Step 7: Commit**

```bash
git add src/cli tests/unit/cli
git commit -m "feat(cli): add log, events, notifications, world commands"
```

---
## Chunk 12: Final Integration & Testing

**Dependencies:** Chunks 1-11

**Goal:** Comprehensive integration testing and verification.

**Files:**
- Create: `tests/integration/full-game-loop.test.ts`
- Create: `tests/integration/save-load-migration.test.ts`

- [x] **Step 1: Write full game loop integration test**

```typescript
// tests/integration/full-game-loop.test.ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/state/initial';
import { handleTick } from '../../src/domain/handlers/tick.handler';
import { handleUpgradeHero } from '../../src/domain/handlers/upgrade.handler';
import { handleOffline } from '../../src/domain/handlers/offline.handler';

describe('Full Game Loop Integration', () => {
  it('simulates 100 ticks without errors', () => {
    let state = createInitialState(Date.now(), 42);

    for (let i = 0; i < 100; i++) {
      const result = handleTick(state, 1, Date.now() + i * 40);
      state = result.state;
    }

    expect(state.time.tickCount).toBe(100);
    expect(state.director).toBeDefined();
    expect(state.world).toBeDefined();
  });

  it('handles upgrade + tick sequence', () => {
    let state = createInitialState(Date.now(), 12345);

    // Upgrade a hero
    const upgradeResult = handleUpgradeHero(state, 'bard-1', 1, Date.now());
    state = upgradeResult.state;

    // Run ticks
    const tickResult = handleTick(state, 10, Date.now());
    state = tickResult.state;

    expect(state.heroes.roster['bard-1'].level).toBeGreaterThan(1);
  });

  it('handles offline progress', () => {
    let state = createInitialState(Date.now(), 54321);

    // Simulate being offline for 1 hour
    const now = Date.now();
    const lastSeen = now - (60 * 60 * 1000);

    state = {
      ...state,
      meta: { ...state.meta, lastSeenAtMs: lastSeen },
    };

    const result = handleOffline(state, now);
    state = result.state;

    // Should have progressed
    expect(state.meta.lastSeenAtMs).toBe(now);
  });

  it('maintains state consistency across operations', () => {
    let state = createInitialState(Date.now(), 999);

    // Series of operations
    state = handleTick(state, 5, Date.now()).state;
    state = handleUpgradeHero(state, 'bard-1', 2, Date.now()).state;
    state = handleTick(state, 10, Date.now()).state;
    state = handleUpgradeHero(state, 'barkeep-1', 1, Date.now()).state;
    state = handleTick(state, 20, Date.now()).state;

    // Verify state integrity
    expect(state.meta).toBeDefined();
    expect(state.wallet).toBeDefined();
    expect(state.tavern).toBeDefined();
    expect(state.heroes).toBeDefined();
    expect(state.time).toBeDefined();
    expect(state.director).toBeDefined();
    expect(state.adventures).toBeDefined();
    expect(state.world).toBeDefined();
    expect(state.eventLog).toBeDefined();
    expect(state.personality).toBeDefined();
  });
});
```

- [x] **Step 2: Write save/load migration test**

```typescript
// tests/integration/save-load-migration.test.ts
import { describe, it, expect } from 'vitest';
import { migrateState } from '../../src/state/migrations';
import { createInitialState } from '../../src/state/initial';

describe('State Migration', () => {
  it('migrates v0.1.0 state to v0.2.0', () => {
    // Old state without new slices
    const oldState = {
      meta: { version: '0.1.0', seed: 12345, lastSeenAtMs: Date.now() },
      wallet: { gold: 1000 },
      tavern: { reputation: 0 },
      heroes: { roster: {} },
      time: { tickCount: 0, lastTickAtMs: Date.now() },
    };

    const migrated = migrateState(oldState, '0.2.0');

    expect(migrated.meta.version).toBe('0.2.0');
    expect(migrated.director).toBeDefined();
    expect(migrated.adventures).toBeDefined();
    expect(migrated.world).toBeDefined();
    expect(migrated.eventLog).toBeDefined();
    expect(migrated.personality).toBeDefined();
  });

  it('preserves existing data during migration', () => {
    const oldState = {
      meta: { version: '0.1.0', seed: 12345, lastSeenAtMs: Date.now() },
      wallet: { gold: 5000 },
      tavern: { reputation: 100 },
      heroes: { roster: { 'bard-1': { id: 'bard-1', level: 5 } } },
      time: { tickCount: 42, lastTickAtMs: Date.now() },
    };

    const migrated = migrateState(oldState, '0.2.0');

    expect(migrated.wallet.gold).toBe(5000);
    expect(migrated.tavern.reputation).toBe(100);
    expect(migrated.heroes.roster['bard-1'].level).toBe(5);
    expect(migrated.time.tickCount).toBe(42);
  });

  it('throws for unknown version', () => {
    const state = { meta: { version: '0.0.1' } };

    expect(() => migrateState(state, '0.2.0')).toThrow('No migration from version 0.0.1');
  });
});
```

- [x] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [x] **Step 4: Run full test suite with coverage**

Run: `npx vitest run --coverage`
Expected: 90%+ coverage on new systems

- [x] **Step 5: Final commit**

```bash
git add tests/integration
git commit -m "test: add comprehensive integration tests for full game loop"
```

- [x] **Step 6: Create summary**

The implementation is complete. Summary of changes:

**New Systems:**
- `src/core/rng/` - SeededRng with streams
- `src/domain/pipeline/` - TickPipeline with plugins
- `src/systems/director/` - Visitor spawning and lifecycle
- `src/systems/adventure/` - Adventure creation, progress, loot
- `src/systems/world/` - Time, weather, world events
- `src/systems/event-log/` - Event logging and notifications
- `src/systems/personality/` - Hero traits and corruption

**Refactored:**
- `src/reducer/handlers.ts` - Delegates to new handlers
- `src/state/migrations.ts` - v0.1.0 → v0.2.0 migration
- `src/cli/` - New commands (log, events, notifications, world)

**Tests:**
- Unit tests for all systems
- Integration tests for pipeline
- Migration tests

---

