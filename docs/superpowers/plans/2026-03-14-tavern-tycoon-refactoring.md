# Tavern Tycoon Refactoring Implementation Plan

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

- [ ] **Step 1: Create test file with failing tests**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/core/rng.test.ts`
Expected: FAIL with "Cannot find module '../../../src/core/rng/service'"

- [ ] **Step 3: Create RNG types**

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

- [ ] **Step 4: Create RNG service implementation**

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

- [ ] **Step 5: Create RNG index export**

```typescript
// src/core/rng/index.ts
export type { RngService, RngStream, RngSnapshot, StreamSnapshot } from './types';
export { SeededRng } from './service';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/core/rng.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/rng tests/unit/core/rng.test.ts
git commit -m "feat(core): add RngService with seeded deterministic streams"
```

---

### Task 1.2: Pipeline Types

**Files:**
- Create: `src/domain/pipeline/types.ts`
- Create: `tests/unit/domain/pipeline/pipeline.test.ts`

- [ ] **Step 1: Create test file with failing tests**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/pipeline/pipeline.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create pipeline types**

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

- [ ] **Step 4: Create pipeline implementation**

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

- [ ] **Step 5: Create pipeline index**

```typescript
// src/domain/pipeline/index.ts
export type { TickContext, TickResult, TickPlugin, TickPipeline } from './types';
export { PLUGIN_ORDER } from './types';
export { createTickPipeline } from './pipeline';
```

- [ ] **Step 6: Create domain index**

```typescript
// src/domain/index.ts
export * from './pipeline';
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/domain/pipeline/pipeline.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/domain tests/unit/domain
git commit -m "feat(domain): add TickPipeline with plugin architecture"
```

---

## Chunk 2: Extended State Types

### Task 2.1: System State Types

**Files:**
- Modify: `src/types/state.ts`

- [ ] **Step 1: Add DirectorState import and type to GameState**

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

- [ ] **Step 2: Create stub system types to prevent breakage**

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

- [ ] **Step 3: Create system index files**

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

- [ ] **Step 4: Update state.ts with new imports**

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

- [ ] **Step 5: Update initial state**

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

- [ ] **Step 6: Run all existing tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All existing tests PASS

- [ ] **Step 7: Commit**

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

- [ ] **Step 1: Write failing tests for DirectorService**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/systems/director.test.ts`
Expected: FAIL (service.ts doesn't exist yet)

- [ ] **Step 3: Expand director types**

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

- [ ] **Step 4: Create director constants**

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

- [ ] **Step 5: Create spawn.ts (pure functions)**

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

- [ ] **Step 6: Create service.ts**

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

- [ ] **Step 7: Update index.ts**

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

- [ ] **Step 8: Run tests**

Run: `npx vitest run tests/unit/systems/director.test.ts`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/systems/director tests/unit/systems/director.test.ts
git commit -m "feat(systems): implement Director system with visitor spawning"
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

- [ ] **Step 1: Create test file with failing tests**

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

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/systems/adventure.test.ts
```
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create adventure types and constants**

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
- [ ] **Step 4: Create constants**

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
- [ ] **Step 5: Create index exports**

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
- [ ] **Step 6: Extend GameState with AdventureState**

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
- [ ] **Step 7: Run tests to verify they still fail (service not implemented)**

```bash
npx vitest run tests/unit/systems/adventure.test.ts
```
Expected: FAIL (service not implemented)

- [ ] **Step 8: Commit**

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
- [ ] **Step 1: Create service implementation**

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
- [ ] **Step 2: Create loot generation module**

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
- [ ] **Step 3: Update index exports**

```typescript
// src/systems/adventure/index.ts
export type {
  AdventureService
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
export { AdventureServiceImpl } from './service';
export { generateLoot } from './loot';
```
- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/systems/adventure.test.ts
```
Expected: All tests PASS
- [ ] **Step 5: Commit**

```bash
git add src/systems/adventure tests/unit/systems/adventure.test.ts
git commit -m "feat(systems): implement Adventure service with loot generation"
```
---
## Chunk 6: Adventure System - Plugin
> **Dependencies:** Chunk 5 (Adventure Service)
> **Files:**
> - Create: `src/domain/pipeline/plugins/adventures.plugin.ts`
> - Create: `tests/unit/domain/pipeline/plugins/adventures.plugin.test.ts`
> - Update: `src/domain/pipeline/plugins/index.ts` (add export)
> - Run: tests
> - Commit
> - [ ] **Step 1: Create test file with failing tests**
> - [ ] **Step 2: Run test to verify it fails**
> - [ ] **Step 3: Create plugin implementation**
> - [ ] **Step 4: Run tests**
> - [ ] **Step 5: Commit

```
---
## Chunk 7: World System
> **Dependencies:** Chunk 1 (RNG), Chunk 2 (Pipeline Types)
> **Files:**
> - Create: `src/systems/world/types.ts`
> - Create: `src/systems/world/service.ts`
> - Create: `src/systems/world/constants.ts`
> - Create: `src/systems/world/index.ts`
> - Create: `src/domain/pipeline/plugins/world.plugin.ts`
> - Create: `tests/unit/systems/world.test.ts`
> - Create: `tests/unit/domain/pipeline/plugins/world.plugin.test.ts`
> - Modify: `src/types/state.ts` (add WorldState)
> - Modify: `src/state/initial.ts` (add emptyWorldState)
> - Run: tests
> - Commit
```
- [ ] **Steps 1-5**: Similar to Adventure System pattern
---
## Chunk 8: Event Log System
> **Dependencies:** None (standalone)
> **Files:**
> - Create: `src/systems/event-log/types.ts`
> - Create: `src/systems/event-log/service.ts`
> - Create: `src/systems/event-log/index.ts`
> - Create: `tests/unit/systems/event-log.test.ts`
> - Modify: `src/types/state.ts` (add EventLogState)
> - Modify: `src/state/initial.ts` (add emptyEventLogState)
> - Run: tests
> - Commit
```
- [ ] **Steps 1-4**: Similar to Adventure System pattern
---
## Chunk 9: Personality System
> **Dependencies:** None (standalone)
> **Files:**
> - Create: `src/systems/personality/types.ts`
> - Create: `src/systems/personality/service.ts`
> - Create: `src/systems/personality/traits.ts`
> - Create: `src/systems/personality/index.ts`
> - Create: `tests/unit/systems/personality.test.ts`
> - Modify: `src/types/state.ts` (add PersonalitySlice)
> - Modify: `src/state/initial.ts` (add emptyPersonalityState)
> - Run: tests
> - Commit
```
- [ ] **Steps 1-4**: Similar to Event Log System pattern
---
## Chunk 10: Pipeline Integration
> **Dependencies:** Chunks 1-9 (all systems)
> **Goal:** Integrate all systems into main tick pipeline
> **Files:**
> - Modify: `src/time/tick.ts` (refactor to use pipeline)
> - Create: `src/domain/handlers/tick.handler.ts`
> - Modify: `src/reducer/handlers.ts` (use new handlers)
> - Create: `src/state/migrations.ts` (add v0.1.0 → v0.2.0 migration)
> - Create: `tests/integration/tick-pipeline.test.ts`
> - Run: all tests
> - Commit
```
- [ ] **Steps 1-7**: Create pipeline, integrate systems, update handlers, add migration, test
---
## Chunk 11: CLI Extensions
> **Dependencies:** Chunk 10 (Pipeline Integration)
> **Files:**
> - Modify: `src/cli/commands.ts` (add adventure, log, events, world commands)
> - Modify: `src/cli/index.ts` (add command handlers)
> - Modify: `src/cli/display.ts` (add formatters)
> - Create: `tests/unit/cli/new-commands.test.ts`
> - Run: tests
> - Commit
```
- [ ] **Steps 1-6**: Add commands, handlers, formatters, test
---
## Chunk 12: Final Integration & Testing
> **Dependencies:** Chunks 1-11
> **Files:**
> - Create: `tests/integration/full-pipeline.test.ts`
> - Create: `tests/integration/save-load-migration.test.ts`
> - Run: all tests
> - Commit
```
- [ ] **Steps 1-4**: Write integration tests, run all tests, commit
---

