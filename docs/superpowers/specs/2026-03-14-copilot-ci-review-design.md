# GitHub Copilot Code Review CI Integration

**Date:** 2026-03-14
**Status:** Draft
**Author:** Claude

## Overview

Add GitHub Copilot code review capabilities to the Tavern Tycoon project. This approach provides:

1. **Automatic reviews** - Copilot automatically reviews all new PRs (configured in repository settings)
2. **Manual trigger** - Developers can request reviews via GitHub Copilot chat or native commands

## Goals

- Improve code quality through automated AI-assisted reviews
- Catch potential issues before human review
- Provide consistent feedback on all pull requests
- Reduce manual review burden for common issues

## Non-Goals

- Replacing human code review entirely
- Blocking PRs based on Copilot feedback only
- Custom workflow-based review triggers (native features are sufficient)

## Design

### Component 1: copilot-instructions.md

Create `.github/copilot-instructions.md` to provide project context to Copilot for better, more relevant reviews.

**Location:** `.github/copilot-instructions.md`

**Content includes:**
- Project overview (TypeScript idle/tycoon game)
- Architecture patterns (reducer pattern, immutable state)
- Code conventions (TypeScript strict mode, ES2022)
- Testing requirements (Vitest, coverage thresholds)
- Key modules and their responsibilities

### Component 2: Enable Copilot Code Review in Repository Settings

GitHub Copilot code review is configured through repository settings, not a custom workflow.

> **Note:** Copilot code review is a premium feature that uses requests from your monthly quota. Each review consumes quota based on the complexity of the PR. Ensure your organization has sufficient quota for the expected review volume.

**Setup Steps:**
1. Navigate to repository Settings
2. Click "Copilot" in the sidebar
3. Scroll to "Code Review" section under Copilot settings
4. Enable "Automatic code review" toggle
5. Toggle "Use custom instructions when reviewing pull requests" to enable the `copilot-instructions.md` file
6. Configure review behavior:
   - Choose to review all PRs or only when explicitly requested
   - Optionally specify file patterns to include/exclude
7. The `copilot-instructions.md` file will be used for project-specific context

**Behavior:**
- Reviews trigger on PR open and synchronize events (based on settings)
- Reviews are advisory (non-blocking by default)
- Copilot uses the `copilot-instructions.md` for project-specific context
- Copilot can leave suggestions as single-file comments or summary reviews

### Component 3: Manual Review Request

Users can request additional reviews through native GitHub features:

**Options:**
1. **Copilot Chat in PR** - Use `@copilot` in PR comments to ask specific questions
2. **Re-request review** - If automatic review is set to "on request", use the standard review request flow
3. **Copilot in IDE** - Open the PR file in VS Code with Copilot enabled

No custom workflow is needed - GitHub provides native support for these interactions.

## Implementation Details

### copilot-instructions.md Content

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
- Coverage thresholds: 80% lines, 75% branches
- Tests located in `tests/` directory
- Run with `bun test`

## Common Patterns
- Use `success()` and `failure()` for ReduceResult
- Emit events for all significant state changes
- Validate inputs early in handlers
- Use `calculateTotalIncome()` for income calculations
```

## Security Considerations

- **Fork PRs**: Copilot code review respects repository boundaries and permissions
- **Secrets**: No repository secrets required
- **Permissions**: Uses standard GitHub permissions model

## Rollout Plan

1. Create `.github/copilot-instructions.md` with project context
2. Enable Copilot code review in repository settings (Settings > Copilot)
3. Test with a sample PR to verify reviews appear
4. Document in README for team usage

## Success Criteria

- Copilot provides relevant feedback based on project context
- Reviews appear on new PRs within reasonable time
- No interference with existing CI/CD pipeline
- Team finds the reviews useful

## Alternatives Considered

1. **Custom GitHub Action workflow** - Native Copilot features are simpler and better integrated
2. **Third-party AI review tools** - Additional cost and integration complexity
3. **Custom GitHub Action with OpenAI API** - More maintenance, requires API keys
4. **GitHub Copilot Chat in IDE only** - Doesn't provide PR-level review

## References

- [Using Copilot Code Review](https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review)
- [Adding repository custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)
- [GitHub Changelog - Copilot](https://github.blog/changelog/label/copilot/)
