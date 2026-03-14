# Copilot Instructions for Tavern Tycoon

## Project Overview
Tavern Tycoon is an incremental/tycoon game built with TypeScript. Players manage a fantasy tavern, hire heroes, and earn gold through idle gameplay mechanics.

## Architecture
- **Reducer Pattern**: All state transitions go through the reducer (`src/reducer/`)
- **Immutable State**: State is never mutated; always return new objects
- **Event Sourcing Light**: Actions produce events that describe what happened
- **Fixed-Point Arithmetic**: Gold values use GoldU type (multiply by GOLD_MULTIPLIER = 1000)

## Key Modules
- `src/reducer/` - State management and action handlers
- `src/state/` - State types and initial state factory
- `src/economy/` - Gold calculations and income
- `src/time/` - Tick processing and offline progress
- `src/config/` - Game balance and hero definitions
- `src/cli/` - Terminal-based game interface

## Code Conventions
- TypeScript strict mode enabled
- ES2022 target with NodeNext modules
- Path alias: `@/*` maps to `./src/*`
- Prefer `type` imports for type-only imports
- All handlers must be pure functions

## Testing
- Vitest for unit and integration tests
- Coverage thresholds: 70% statements, 60% branches, 70% functions, 70% lines
- Tests located in `tests/` directory
- Run with `bun test`

## Common Patterns
- Use `success()` and `failure()` for ReduceResult
- Emit events for all significant state changes
- Validate inputs early in handlers
- Use `calculateTotalIncome()` for income calculations

## Review Focus Areas
When reviewing code, pay attention to:
- State immutability violations
- Missing event emissions
- Incorrect fixed-point arithmetic
- Impure handler functions
- Missing input validation
