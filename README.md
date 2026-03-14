# Tavern Tycoon

An incremental/tycoon game built with TypeScript. Manage a fantasy tavern, hire heroes, and earn gold through idle gameplay mechanics.

## Quick Start

```bash
# Install dependencies
bun install

# Run the game (CLI interface)
bun run dev
```

## Architecture

- **Reducer Pattern**: All state transitions go through the reducer
- **Immutable State**: State is never mutated; always return new objects
- **Event Sourcing Light**: Actions produce events that describe what happened
- **Fixed-Point Arithmetic**: Gold values use GoldU type (multiply by GOLD_MULTIPLIER = 1000)

## Project Structure

```
src/
├── reducer/     # State management and action handlers
├── state/       # State types and initial state factory
├── economy/     # Gold calculations and income
├── time/        # Tick processing and offline progress
├── config/      # Game balance and hero definitions
└── cli/         # Terminal-based game interface
```

## Development

```bash
# Run the CLI game
bun run dev

# Run type checking
bun run typecheck

# Build the project
bun run build

# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

## Testing

- **Framework**: Vitest for unit and integration tests
- **Coverage Thresholds**: 70% statements, 60% branches, 70% functions, 70% lines
- **Location**: Tests in `tests/` directory
- **Run**: `bun test`

## GitHub Copilot Code Review

This repository uses GitHub Copilot for automated code review. Copilot provides feedback on pull requests based on the project context defined in `.github/copilot-instructions.md`.

### Features
- **Automatic reviews**: Copilot reviews all new PRs automatically
- **Project-aware**: Reviews are tailored to Tavern Tycoon's architecture and conventions
- **Non-blocking**: Reviews are advisory and don't block PRs

### Manual Review Request
- Use `@copilot` in PR comments to ask specific questions
- Re-request review from Copilot through the standard review flow

### Setup (for repository admins)
1. Navigate to repository Settings
2. Click "Copilot" in the sidebar
3. Enable "Automatic code review" in the Code Review section
4. Toggle "Use custom instructions when reviewing pull requests"

> **Note:** Copilot code review is a premium feature that consumes quota from your monthly allocation.

For more information, see the [Copilot Code Review documentation](https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review).

## License

MIT
