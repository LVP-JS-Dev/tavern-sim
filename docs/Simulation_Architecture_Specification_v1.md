# Simulation Architecture Specification

Project: Tavern Tycoon Scope: Vertical Slice (Architecturally
Final-Ready) Version: v1.0

------------------------------------------------------------------------

## 1. Purpose & Scope

### 1.1 Purpose

This document defines the architecture of the Simulation Layer of Tavern
Tycoon. It establishes: - Deterministic simulation rules - State
ownership boundaries - Update lifecycle - Module responsibilities -
Mutation constraints - Extensibility guarantees

### 1.2 Scope

The Simulation Layer includes: - GameState - SimulationEngine -
Director - RNG system - Command system - World module - NPC system -
Hero lifecycle (slice scope) - Determinism guarantees

It excludes: - Rendering (Phaser) - UI state (React) - Asset loading -
Backend logic

------------------------------------------------------------------------

## 2. Architectural Principles

### 2.1 Single Source of Truth

All authoritative game data exists exclusively in Domain GameState.

### 2.2 Controlled Mutation

Mutation is allowed only inside SimulationEngine during update ticks.

### 2.3 Deterministic Simulation

Simulation must produce identical results given: - Same sessionSeed -
Same command sequence - Same initial GameState

No usage of Math.random() is allowed.

### 2.4 Simulation ≠ Rendering

Simulation operates independently from render framerate. - Simulation
tick: fixed (\~25 FPS) - Rendering tick: variable (up to 60 FPS)

### 2.5 Command-Based Interaction

All external interactions enter simulation via Command Queue.

### 2.6 Performance-First Constraints

Simulation must avoid: - Dynamic physics - Runtime navmesh generation -
Per-frame allocations - Unbounded entity growth

------------------------------------------------------------------------

## 3. Core State Model

GameState structure:

GameState { meta economy world simulation heroes log }

### Serialization Rules

Serialized: - All GameState modules

Not serialized: - RNG instance - Derived geometry - Phaser objects

Save format: JSON.

------------------------------------------------------------------------

## 4. Simulation Engine

Responsibilities: - Processing commands - Updating Director - Updating
NPCs - Maintaining deterministic behavior

Tick Model: - Accumulator-based fixed step (\~40ms per tick)

Mutation Boundaries: - Allowed only inside SimulationEngine - Forbidden
in Phaser and UI

------------------------------------------------------------------------

## 5. Deterministic Random System

Seed generated per session: hash(userId + sessionStartTime)

RNG lives inside SimulationEngine and is passed to Director.

Forbidden usage: - Phaser - UI - Outside simulation tick

------------------------------------------------------------------------

## 6. Command System

Commands are appended to simulation.commandQueue and processed at start
of each simulation tick.

Slice commands: - PLACE_TABLE - REMOVE_TABLE

Commands processed sequentially. No async mutation allowed.

------------------------------------------------------------------------

## 7. Director Module

Responsibilities: - Generate visitor events - Generate hero visits -
Distribute gold visually - Control spawn timing

Slice: - Periodic visitor spawn - Occasional hero spawn - Seat
assignment - Payment

------------------------------------------------------------------------

## 8. World Module

Grid Model: - Fixed cell size - Corridor non-buildable - Table zone
buildable

Placement fails if: - Outside zone - Overlaps table - Intersects
corridor

Seat allocation handled via world.requestSeat().

Relocation: - NPC overlapping placement receives RelocateAction. - No
simulation pause.

------------------------------------------------------------------------

## 9. NPC System

States: - Walking - Sitting - Leaving

Visitor lifecycle: Spawn → Walk → Sit → Pay → Leave → Despawn

Hero lifecycle (slice): Spawn → Walk → Sit → Pay → Leave → Cooldown

------------------------------------------------------------------------

## 10. Update Flow

Per tick: 1. Accumulator check 2. Process command queue 3. Director
update 4. NPC update loop 5. Cleanup 6. State ready for render

------------------------------------------------------------------------

## 11. Failure Handling & Invariants

Core invariants: - NPC must always have valid state - Seat cannot be
double-allocated - Hero cannot spawn if unavailable - No state mutation
outside engine

------------------------------------------------------------------------

## 12. Performance Constraints

-   Max NPC: 10
-   Simulation tick: 25 FPS
-   No physics engine
-   No dynamic pathfinding
-   Single NPC atlas

------------------------------------------------------------------------

## 13. Extensibility Guarantees

Architecture supports: - Personality layer - Trait evolution - Adventure
system - Rare events - Worker offload - Upgrade modifiers

------------------------------------------------------------------------

## 14. Non-Goals (Slice Scope)

Not included in Vertical Slice: - Trait system - Adventure system - Loot
crafting - Density mechanics - Hero corruption
