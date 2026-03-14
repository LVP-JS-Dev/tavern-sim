# GitHub Copilot CI Code Review Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub Copilot code review integration by creating project-specific instructions and a README with setup documentation.

**Architecture:** Create `.github/copilot-instructions.md` with Tavern Tycoon context, then create README.md with project overview and Copilot setup. No code changes required - uses native GitHub Copilot repository settings.

**Tech Stack:** Markdown, GitHub Copilot (native feature)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `.github/copilot-instructions.md` | Create | Project context for Copilot reviews |
| `README.md` | Create | Project overview and Copilot documentation |

---

## Chunk 1: Create Copilot Instructions

### Task 1: Create copilot-instructions.md

**Files:**
- Create: `.github/copilot-instructions.md`

- [ ] **Step 1: Create .github directory**

```bash
mkdir -p .github
```

- [ ] **Step 2: Create copilot-instructions.md with project context**

Create file `.github/copilot-instructions.md`:

```markdown
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
```

- [ ] **Step 3: Verify file was created correctly**

Run: `cat .github/copilot-instructions.md | head -20`
Expected: First 20 lines of the copilot instructions file

- [ ] **Step 4: Commit**

```bash
git add .github/copilot-instructions.md
git commit -m "feat(ci): add GitHub Copilot instructions for code review

Add copilot-instructions.md with project-specific context:
- Architecture patterns (reducer, immutable state)
- Key modules and their responsibilities
- Code conventions and testing requirements
- Common patterns and review focus areas"
```

---

## Chunk 2: Create README with Copilot Documentation

### Task 2: Create README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md with project overview and Copilot section**

Create file `README.md`:

```markdown
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
```

- [ ] **Step 2: Verify README was created**

Run: `wc -l README.md && head -15 README.md`
Expected: Line count (~70 lines) and first 15 lines of README

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with project overview and Copilot documentation

Create README.md with:
- Quick start instructions
- Architecture overview
- Project structure
- Development commands
- Testing information with actual coverage thresholds
- GitHub Copilot code review setup and usage"
```

---

## Verification

- [ ] **Step 1: Verify all files exist**

Run: `ls -la .github/copilot-instructions.md README.md`
Expected: Both files listed with details

- [ ] **Step 2: Verify file contents are correct**

Run: `grep -c "Copilot" .github/copilot-instructions.md README.md`
Expected: Both files contain "Copilot" references

- [ ] **Step 3: Verify commits**

Run: `git log --oneline -3`
Expected: See the two commits created

---

## Post-Implementation (Manual Steps)

After completing this plan, the repository admin must:

1. **Enable Copilot in Repository Settings**
   - Go to Settings > Copilot > Code Review
   - Enable "Automatic code review"
   - Enable "Use custom instructions when reviewing pull requests"

2. **Test the Integration**
   - Create a test PR
   - Verify Copilot provides a review
   - Confirm the review references project-specific context

3. **Transfer Repository** (if needed)
   - Transfer repository to `LVP-JS-Dev` organization
   - Re-enable Copilot settings after transfer (may need reconfiguration)

---

## Success Criteria

- [ ] `.github/copilot-instructions.md` created with project context
- [ ] `README.md` created with project overview and Copilot documentation
- [ ] All commits made with descriptive messages
- [ ] Copilot enabled in repository settings (manual)
- [ ] Test PR receives Copilot review (manual verification)
