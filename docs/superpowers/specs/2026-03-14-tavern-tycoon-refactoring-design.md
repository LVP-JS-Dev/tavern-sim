# Tavern Tycoon Refactoring Design
Date: 2026-03-14
Status: Draft

## Overview
Comprehensive refactoring of the fantasy-tavern-sim project to support parallel development by 5-7 subagents while implementing all systems defined in RFC documentation.

- Plugin Architecture for tick pipeline
- Domain Handlers (decomposed)
- Systems: RNG, Director, Adventure, World, Event Log, Personality
- Full backward compatibility with existing CLI
- Unit tests required for all new systems
- State migrations for v0.1.0 → v0.2.0

## Design Principles
- Single Responsibility Principle per handler/module
- Open/Closed Principle per system isolation
- Dependency Inversion for testability
- Plugin Architecture for extensibility
- Immutability for deterministic replay
- Backward compatibility with existing CLI
- No code duplication (all files under 150 lines)
- No circular dependencies between modules
- Clear separation between layers (types, domain, state, persistence, CLI)
- Implementation is testable in isolation
- Parallel development supported through independent subagents

## File Structure
```
src/
├── core/                          # Foundation layer
│   └── rng/
│       ├── types.ts              # RngService, RngSnapshot
│       ├── service.ts            # SeededRng implementation
│       └── index.ts
│
├── domain/                        # Domain layer
│   ├── handlers/
│   │   ├── tick.handler.ts       # handleTick
│   │   ├── upgrade.handler.ts    # handleUpgradeHero
│   │   ├── offline.handler.ts    # handleOffline
│   │   └── index.ts
│   ├── pipeline/
│       ├── types.ts              # TickPipeline, TickPlugin
│       ├── pipeline.ts            # createTickPipeline
│       └── plugins/
│           ├── timers.plugin.ts     # processTimers (stub)
│           ├── heroes.plugin.ts      # processHeroes
│           ├── director.plugin.ts    # processDirector (stub)
│           ├── adventures.plugin.ts  # processAdventures (stub)
│           ├── world.plugin.ts       # processWorld (stub)
│           └── index.ts
│   └── index.ts
│
├── systems/                       # Game systems
│   ├── director/
│   │   ├── types.ts              # DirectorSlice, Visitor, DirectorState
│   │   ├── service.ts            # DirectorServiceImpl
│   │   ├── spawn.ts              # Visitor spawning logic
│   │   └── index.ts
│   ├── adventure/
│   │   ├── types.ts              # AdventureSlice, Adventure, LootDrop
│   │   ├── service.ts            # AdventureServiceImpl
│   │   ├── loot.ts               # Loot generation
│   │   └── index.ts
│   ├── world/
│   │   ├── types.ts              # WorldSlice, WorldState, TimeOfDay, Weather
│   │   ├── service.ts            # WorldServiceImpl
│   │   └── index.ts
│   ├── event-log/
│   │   ├── types.ts              # EventLogSlice, LogEntry, Notification
│   │   ├── service.ts            # EventLogServiceImpl
│   │   └── index.ts
│   ├── personality/
│   │   ├── types.ts              # PersonalitySlice, Trait, Corruption
│   │   ├── service.ts            # PersonalityServiceImpl
│   │   └── index.ts
│   └── index.ts
│
├── types/                         # Extended types
│   ├── state.ts                  # Add DirectorSlice, AdventureSlice, WorldSlice, EventLogSlice, PersonalitySlice
│   ├── actions.ts                # Add new actions (optional)
│   ├── events.ts                 # Add new events (optional)
│   └── index.ts
│
├── economy/                       # Unchanged
├── progression/                   # Unchanged
├── config/                         # Unchanged
│
├── state/                         # Extended
│   ├── initial.ts                # Add initial states for new slices
│   ├── serialize.ts              # Unchanged
│   ├── migrations.ts             # Add v0.1.0 → v0.2.0 migration
│
├── persistence/                   # Unchanged
│
├── cli/                           # Extended
│   ├── index.ts                 # Add new command handlers
│   ├── commands.ts               # Add log, events, notifications commands
│   └── display.ts                # Add formatters for new data
│
└── index.ts                        # Main entry point
```

### Test Structure
```
tests/
├── unit/
│   ├── core/
│   │   └── rng.test.ts             # RngService tests (determinism, snapshot/restore)
│   │
│   ├── domain/
│   │   └── pipeline/
│   │       ├── pipeline.test.ts    # TickPipeline ordering, context passing
│   │       └── plugins/
│   │           ├── director.plugin.test.ts
│   │           ├── adventures.plugin.test.ts
│   │           ├── world.plugin.test.ts
│   │           └── heroes.plugin.test.ts
│   │
│   ├── systems/
│   │   ├── director.test.ts        # DirectorService, spawn logic
│   │   ├── adventure.test.ts       # AdventureService, loot generation
│   │   ├── world.test.ts           # WorldService, time progression
│   │   ├── event-log.test.ts       # EventLogService, queries
│   │   └── personality.test.ts     # PersonalityService, trait effects
│   │
│   └── state/
│       └── migrations.test.ts      # v0.1.0 → v0.2.0 migration
│
└── integration/
    └── tick-pipeline.test.ts       # Full pipeline with all plugins
```

## Interface Contracts

### RngService Interface
```typescript
// src/core/rng/types.ts

export interface RngStream {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(array: readonly T[]): T;
  sample<T>(array: readonly T[], count: number): T[];
  chance(probability: number): boolean;
}
export interface RngService {
  /** Create a deterministic stream for a specific system/partition */
  createStream(streamId: string, partitionKey?: string): RngStream;
  /** Get snapshot of all streams for persistence */
  snapshot(): RngSnapshot;
  /** Restore all streams from snapshot */
  restore(snapshot: RngSnapshot): void;
}
export interface StreamSnapshot {
  readonly streamId: string;
  readonly partitionKey?: string;
  readonly position: number;
}
export interface RngSnapshot {
  readonly rootSeed: number;
  readonly streams: readonly StreamSnapshot[];
}
```

```typescript
// src/core/rng/service.ts
import type { RngService, RngSnapshot } from './types';

export class SeededRng implements RngService {
  private position = 0;
  private state = 0;
  private static readonly M = 0x80000000;

  constructor(
    private readonly seed: number,
    snapshot?: RngSnapshot
  ) {
    if (snapshot) {
      this.position = snapshot.position;
    }
  }

  next(): number {
    this.position++;
    const z = (this.seed + this.position) | 0;
    this.state = (this.state ^ z) & 0xFFFFFFFF;
    return (this.state * SeededRng.M) >>> 31;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    return array[this.nextInt(0, array.length - 1)];
  }

  sample<T>(array: readonly T[], count: number): T[] {
    const maxCount = Math.min(count, array.length);
    const result: T[] = [];
    const available = [...array];
    for (let i = 0; i < maxCount; i++) {
      const index = this.nextInt(0, available.length - 1);
      result.push(available[index]);
      available.splice(index, 1);
    }
    return result;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  snapshot(): RngSnapshot {
    return { seed: this.seed, position: this.position };
  }

  restore(snapshot: RngSnapshot): void {
    (this as any).position = snapshot.position;
    (this as any).state = 0;
  }
}
```
```
### TickPipeline Interface
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
export interface TickPlugin {
  readonly name: string;
  readonly order: number;
  /** Returns updated state and new events (immutable pattern) */
  process(ctx: TickContext): TickResult;
}
export interface TickPipeline {
  readonly plugins: readonly TickPlugin[];
  /** Process all plugins in order, returns final state and all events */
  process(ctx: TickContext): TickResult;
}

export function createTickPipeline(plugins: TickPlugin[]): TickPipeline;
```
```typescript
// src/domain/pipeline/pipeline.ts
import type { GameState, DomainEvent, RngService } from '../../types';
import type { TickContext, TickPlugin, TickPipeline, TickResult } from './types';
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
```
### DirectorService Interface
```typescript
// src/systems/director/types.ts
import type { GoldU } from '../../../types';
import type { RngSnapshot } from '../../../core/rng';
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
export const emptyDirectorState: (): DirectorState => ({
  visitors: [],
  spawnTimer: 0,
  nextVisitorId: 1,
});
export interface DirectorSlice {
  readonly director: DirectorState;
}
```
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
```typescript
// src/systems/director/types.ts (continued)
export interface DirectorService {
  update(ctx: DirectorContext): DirectorResult;
  canSpawn(state: DirectorState, rosterSize: number): boolean;
  spawnVisitor(rng: RngService, state: DirectorState, now: number): Visitor | null;
  processDeparture(visitorId: string, state: DirectorState): DirectorResult;
}
export interface DirectorContext {
  state: GameState;
  rng: RngService;
  now: number;
}
export interface DirectorResult {
  visitorsSpawned: readonly Visitor[];
  visitorsDeparted: readonly string[];
  events: readonly DomainEvent[];
}
```
```typescript
// src/systems/director/spawn.ts
/**
 * Pure functions for visitor spawning logic.
 * This module is separate from service.ts to keep spawning rules testable
 * and independent of state management concerns.
 *
 * Responsibility split:
 * - spawn.ts: Pure functions (no side effects, deterministic for given RNG state)
 * - service.ts: State orchestration, timer management, coordination
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
  if (!rng.chance(VISITOR_SPAWN_CHANCE)) return null;

  const type = pickVisitorType(rng, rosterSize);
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
  const types: VisitorType[] = ['patron', 'adventurer'];
  if (rosterSize < 3 && rng.chance(0.3)) types.push('merchant');
  if (rosterSize >= 5 && rng.chance(0.1)) types.push('noble');
  return rng.pick(types);
}
```
```typescript
// src/systems/director/service.ts
/**
 * Director service orchestrates visitor lifecycle.
 * Uses spawn.ts for pure spawning logic, handles state management here.
 */
import type { DirectorState, DirectorSlice, RngService, GoldU } from './types';
import type { Visitor } from './spawn';
import { spawnVisitor } from './spawn';
import type { DirectorService, DirectorContext, DirectorResult } from './types';
import { MAX_VISITOR_STAY_MS, MAX_VISITORS } from './constants';

export class DirectorServiceImpl implements DirectorService {
  update(ctx: DirectorContext): DirectorResult {
    const state = ctx.state.director;
    const rosterSize = Object.keys(ctx.state.heroes.roster).length;
    const result: DirectorResult = {
      visitorsSpawned: [],
      visitorsDeparted: [],
      events: []
    };

    // Process spawn timer
    if (state.spawnTimer <= 0 && this.canSpawn(state, rosterSize)) {
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
      events: []
    };
  }
}
```
```
### AdventureService Interface
```typescript
// src/systems/adventure/types.ts
import type { GoldU } from '../../../types';
import type { RngSnapshot } from '../../../core/rng';
export type AdventureStatus = 'preparing' | 'in_progress' | 'completed' | 'failed' | 'abandoned';
export type AdventureType = 'hunt' | 'dungeon' | 'escort' | 'investigation';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export interface Adventure {
  readonly id: string;
  readonly type: AdventureType;
  readonly status: AdventureStatus;
  readonly heroIds: readonly string[];
  readonly startedAt: number;
  readonly duration: number;
  readonly progress: number;
}
export interface LootDrop {
  readonly itemId: string;
  readonly quantity: number;
  readonly rarity: Rarity;
}
export interface AdventureState {
  readonly adventures: readonly Adventure[];
  readonly nextAdventureId: number;
}
export const emptyAdventureState: (): AdventureState => ({
  adventures: [],
  nextAdventureId: 1,
});
export interface AdventureSlice {
  readonly adventures: AdventureState;
}
export interface AdventureService {
  start(adventureId: string, heroIds: readonly string[], ctx: AdventureContext): AdventureResult;
  update(adventure: Adventure, ctx: AdventureContext): AdventureUpdateResult;
  complete(adventure: Adventure, ctx: AdventureContext): AdventureCompleteResult;
  generateLoot(adventure: Adventure, rng: RngService): readonly LootDrop[];
}
export interface AdventureContext {
  state: GameState;
  rng: RngService;
  now: number;
}
export interface AdventureResult {
  adventure: Adventure;
  events: readonly DomainEvent[];
}
export interface AdventureUpdateResult {
  adventure: Adventure;
  progress: number;
  events: readonly DomainEvent[];
}
export interface AdventureCompleteResult {
  state: GameState;
  loot: readonly LootDrop[];
  events: readonly DomainEvent[];
}
```
```
### WorldService Interface
```typescript
// src/systems/world/types.ts
import type { RngSnapshot } from '../../../core/rng';
export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'midnight'
export type Weather = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow'
export type WorldEventType = 'festival' | 'plague' | 'drought' | 'war' | 'trade_route'
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
}
export const emptyWorldState: (): WorldState => ({
  timeOfDay: 'dawn',
  weather: 'clear',
  dayNumber: 1,
  activeEvents: [],
});
export interface WorldSlice {
  readonly world: WorldState;
}
export interface WorldService {
  update(ctx: WorldContext): WorldUpdateResult;
  getModifiers(state: WorldState): WorldModifiers;
  isEventActive(eventId: string, state: WorldState): boolean;
}
export interface WorldModifiers {
  readonly incomeMultiplier: number;
  readonly visitorSpawnRate: number;
  readonly adventureSuccessBonus: number;
}
export interface WorldContext {
  state: GameState;
  rng: RngService;
  now: number;
}
export interface WorldUpdateResult {
  state: WorldState;
  events: readonly DomainEvent[];
}
```
```
### EventLogService Interface
```typescript
// src/systems/event-log/types.ts
import type { DomainEvent } from '../../../types';
export type LogEventType =
  | 'hero_hired' | 'hero_upgraded' | 'visitor_arrived' | 'visitor_departed'
  | 'adventure_started' | 'adventure_completed' | 'adventure_failed'
  | 'loot_obtained' | 'gold_earned' | 'world_event' | 'personality_changed'
export interface LogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly type: LogEventType;
  readonly data: Record<string, unknown>;
}
export interface Notification {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'info' | 'success' | 'warning'
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
export const emptyEventLogState: (): EventLogState => ({
  entries: [],
  notifications: [],
  lastReadAt: 0,
  maxEntries: 100,
});
export interface EventLogSlice {
  readonly eventLog: EventLogState;
}
export interface EventLogService {
  append(event: LogEntry, state: EventLogState): EventLogState;
  query(filter: EventFilter, state: EventLogState): readonly LogEntry[];
  getUnread(state: EventLogState): readonly Notification[];
  markRead(notificationIds: readonly string[], state: EventLogState): EventLogState;
  createNotification(notification: Omit<Notification, 'id'>, state: EventLogState): EventLogState;
}
export interface EventFilter {
  readonly since?: number;
  readonly until?: number;
  readonly types?: readonly LogEventType[];
  readonly limit?: number;
}
```
```
### PersonalityService Interface
```typescript
// src/systems/personality/types.ts
import type { HeroState } from '../../../types';
export type TraitType = 'brave' | 'cautious' | 'greedy' | 'generous' | 'curious' | 'suspicious'
export interface Trait {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: TraitType;
  readonly effects: readonly TraitEffect[];
}
export interface TraitEffect {
  readonly type: 'income_modifier' | 'adventure_bonus' | 'corruption_resistance';
  readonly value: number;
}
export interface PersonalityState {
  readonly traits: readonly string[];
  readonly corruption: number;
}
export const emptyPersonalityState: (): PersonalityState => ({
  traits: [],
  corruption: 0,
});
/**
 * PersonalitySlice stores personality data in a separate map keyed by hero ID.
 * This avoids duplicating HeroState and keeps concerns separated.
 * The PersonalityService joins personality data with HeroState when needed.
 */
export interface PersonalitySlice {
  /** Map heroId -> PersonalityState */
  readonly heroPersonalities: Record<string, PersonalityState>;
}
export interface PersonalityService {
  getTraits(): readonly Trait[];
  getTrait(id: string): Trait | undefined;
  /** Get personality for a specific hero, or empty state if none */
  getPersonality(heroId: string): PersonalityState;
  calculateCorruption(personality: PersonalityState): number;
  applyTraitEffects(personality: PersonalityState): TraitEffectsResult;
  canGainTrait(personality: PersonalityState, traitId: string): boolean;
  /** Returns new PersonalityState with trait added */
  gainTrait(personality: PersonalityState, traitId: string): PersonalityState;
}
export interface TraitEffectsResult {
  readonly incomeMultiplier: number;
  readonly adventureBonus: number;
  readonly corruptionResistance: number;
}
```
```
## State Extensions
```typescript
// src/types/state.ts - Extended GameState
import type { DirectorState } from '../systems/director';
import type { AdventureState } from '../systems/adventure';
import type { WorldState } from '../systems/world';
import type { EventLogState } from '../systems/event-log';
import type { PersonalitySlice } from '../systems/personality';
export interface GameState {
  readonly meta: MetaSlice;
  readonly wallet: WalletSlice;
  readonly tavern: TavernSlice;
  readonly heroes: HeroesSlice;
  readonly time: TimeSlice;
  readonly director: DirectorState;      // NEW
  readonly adventures: AdventureState;  // NEW
  readonly world: WorldState;            // NEW
  readonly eventLog: EventLogState;       // NEW
  readonly personality: PersonalitySlice; // NEW
}
```
```
## State Migrations
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
  migrate(state: any): GameState;
}
const migrations: Migration[] = [
  {
    fromVersion: '0.1.0',
    toVersion: '0.2.0',
    migrate(state: any): GameState {
      return {
        ...state,
        meta: { ...state.meta, version: '0.2.0' },
        director: emptyDirectorState(),
        adventures: emptyAdventureState(),
        world: emptyWorldState(),
        eventLog: emptyEventLogState(),
        personality: { heroes: {} },
      };
    },
  },
];
export function migrateState(state: any, targetVersion: string): GameState {
  let current = state.meta?.version || '0.1.0';
  while (current !== targetVersion) {
    const migration = migrations.find(m => m.fromVersion === current);
    if (!migration) throw new Error(`No migration from ${current}`);
    state = migration.migrate(state);
    current = migration.toVersion;
  }
  return state as GameState;
}
```
```
## CLI Extensions
```typescript
// src/cli/types.ts - Base types for commands
export interface ParsedCommandBase {
  readonly raw: string;
  readonly timestamp: number;
}
```
```typescript
// src/cli/commands.ts - New commands
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
export interface ClearNotificationsCommand extends ParsedCommandBase {
  readonly type: 'CLEAR_NOTIFICATIONS';
}
```
```
## Parallel Development Plan
### Dependency Graph
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPENDENCY GRAPH                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────┐                                           │
│                    │  RngService  │ ◄── Foundation for all systems         │
│                    └──────┬───────┘                                           │
│                           │                                              │
│         ┌─────────────────────┼─────────────────────┐                   │
│         │                   │                   │                   │                   │
│         ▼                   ▼                   ▼                   ▼                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ DirectorSvc │   │ AdventureSvc │   │   WorldSvc    │   │ EventLogSvc  │  │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘  │
│         │                   │                   │                   │                   │
│         │                   │                   │                   │                   │
│         ▼                   ▼                   ▼                   ▼                   │
│         └─────────────────────┴─────────────────────┘                   │
│                          │ PersonalitySvc │                                             │
│                          └────────────────┘                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```
### Phase 1: Foundation (Week 1)
**Duration**: 2-3 days
**Blocking**: YES - all other agents must wait

#### Agent 1: RNG Service
**Files**:
- `src/core/rng/types.ts`
- `src/core/rng/service.ts`
- `src/core/rng/index.ts`
- `tests/unit/core/rng.test.ts`

**Deliverables**:
- [ ] RngService interface
- [ ] SeededRng implementation
- [ ] Unit tests with 100% coverage

#### Agent 7: Architecture Integration (Part 1)
**Files**:
- `src/domain/pipeline/types.ts`
- `src/domain/pipeline/pipeline.ts`
- `src/types/state.ts` (extend with new slices)

**Deliverables**:
- [ ] TickPipeline interface
- [ ] createTickPipeline function
- [ ] Extended GameState type
- [ ] Type exports for all system interfaces

### Phase 2: Core Systems (Week 2-3)
**Duration**: 5-7 days
**Blocking**: NO - parallel development

#### Agent 2: Director System
**Files**:
- `src/systems/director/types.ts`
- `src/systems/director/service.ts`
- `src/systems/director/spawn.ts`
- `src/systems/director/constants.ts`
- `src/domain/pipeline/plugins/director.plugin.ts`
- `tests/unit/systems/director.test.ts`

**Dependencies**: Agent 1 (RNG), Agent 7 (interfaces)

#### Agent 3: Adventure System
**Files**:
- `src/systems/adventure/types.ts`
- `src/systems/adventure/service.ts`
- `src/systems/adventure/loot.ts`
- `src/domain/pipeline/plugins/adventures.plugin.ts`
- `tests/unit/systems/adventure.test.ts`

**Dependencies**: Agent 1 (RNG), Agent 7 (interfaces)

#### Agent 4: World System
**Files**:
- `src/systems/world/types.ts`
- `src/systems/world/service.ts`
- `src/domain/pipeline/plugins/world.plugin.ts`
- `tests/unit/systems/world.test.ts`

**Dependencies**: Agent 1 (RNG), Agent 7 (interfaces)

#### Agent 5: Event Log System
**Files**:
- `src/systems/event-log/types.ts`
- `src/systems/event-log/service.ts`
- `src/cli/commands.ts` (add log, events, notifications commands)
- `src/cli/display.ts` (add formatters)
- `tests/unit/systems/event-log.test.ts`

**Dependencies**: Agent 7 (interfaces)

#### Agent 6: Personality System
**Files**:
- `src/systems/personality/types.ts`
- `src/systems/personality/service.ts`
- `tests/unit/systems/personality.test.ts`

**Dependencies**: Agent 7 (interfaces)

### Phase 3: Integration (Week 4)
**Duration**: 3-4 days
**Blocking**: NO

#### Agent 7: Architecture Integration (Part 2)
**Files**:
- `src/domain/handlers/tick.handler.ts` (refactor from handlers.ts)
- `src/domain/handlers/upgrade.handler.ts`
- `src/domain/handlers/offline.handler.ts`
- `src/domain/pipeline/plugins/heroes.plugin.ts` (refactor from tick.ts)
- `src/state/initial.ts` (add new initial states)
- `src/state/migrations.ts` (add v0.1.0 → v0.2.0)
- `src/reducer/index.ts` (update to use new handlers)
- `src/cli/index.ts` (add new command handlers)
- `tests/integration/tick-pipeline.test.ts`
- `tests/integration/state-migration.test.ts`

**Deliverables**:
- [ ] Refactored handlers (each under 150 lines)
- [ ] Plugin implementations for tick pipeline
- [ ] State migration from v0.1.0 to v0.2.0
- [ ] Integration tests for full pipeline
- [ ] All existing tests passing
- [ ] CLI backward compatible

## Testing Requirements
### Unit Tests
- RNG Service: 100% coverage
- Director System: 90%+ coverage
- Adventure System: 90%+ coverage
- World System: 90%+ coverage
- Event Log System: 90%+ coverage
- Personality System: 90%+ coverage

- All handlers: 90%+ coverage
- All plugins: 90%+ coverage
- State migrations: 100% coverage

### Integration Tests
- Full tick pipeline with all plugins
- State save/load with new slices
- CLI commands with new systems
- Game loop with multiple ticks

### Existing Tests
- All existing unit tests must pass
- All existing integration tests shall pass
- Minimal changes to existing test files (only imports if needed)

## CLI Commands
### Existing Commands (Unchanged)
- `status` / `s` - Display current game state
- `tick` / `t` [count] - Advance time
- `upgrade` / `u` <heroId> [levels] - Upgrade a hero
- `heroes` / `h` - List all heroes
- `income` / `i` - Show income breakdown
- `save` - Save game state
- `load` - Load game state
- `offline` / `o` - Calculate and apply offline progress
- `reset` - Reset game state with confirmation
- `help` / `?` - Show help
- `exit` / `quit` / `q` - Exit CLI

- `clear` - Clear screen

### New Commands
- `log` [filter] - Query event log
  - `--since <timestamp>` - Show events since timestamp
  - `--until <timestamp>` - Show events until timestamp
  - `--type <type>` - Filter by event type
  - `--limit <n>` - Limit number of results
- `events` - Show all events (alias for `log --limit 50`)
- `notifications` - Show unread notifications
  - `--all` - Show all notifications (including read)
- `mark-read` <ids...> - Mark notifications as read
- `clear-notifications` - Clear all notifications

## Acceptance Criteria
- [ ] All existing CLI commands work without changes
- [ ] All existing tests pass
- [ ] All new systems have unit tests with 90%+ coverage
- [ ] Integration tests verify full pipeline works
- [ ] State migration from v0.1.0 to v0.2.0 works correctly
- [ ] Each handler file is under 150 lines
- [ ] Each plugin file is under 150 lines
- [ ] No circular dependencies between modules
- [ ] Clear separation between layers
- [ ] Documentation is comprehensive and aligns with RFC
- [ ] Parallel development verified (agents can work independently)
