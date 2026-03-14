# Chunk Development Roadmap

## Overview

Each chunk is developed in an isolated feature branch and merged to develop via Pull Request.

## Chunk Status

### ✅ Phase 1: Foundation (Completed)

| Chunk | Name | Branch | PR | Status |
|-------|------|--------|----|----|
| 1-2 | Foundation + State Types | `feature/tavern-tycoon-refactoring-foundation` | #3 | ✅ Ready for Review |

### 🔄 Phase 2: Core Systems (Next)

| Chunk | Name | Branch | Dependencies | Status |
|-------|------|--------|--------------|--------|
| 3 | Director System | `feature/chunk-3-director-system` | Chunk 1 | ⏳ Not Started |
| 4 | Adventure Types | `feature/chunk-4-adventure-types` | Chunk 1, 2 | ⏳ Not Started |
| 5 | Adventure Service | `feature/chunk-5-adventure-service` | Chunk 4 | ⏳ Not Started |
| 6 | Adventure Plugin | `feature/chunk-6-adventure-plugin` | Chunk 5 | ⏳ Not Started |
| 7 | World System | `feature/chunk-7-world-system` | Chunk 1, 2 | ⏳ Not Started |
| 8 | Event Log System | `feature/chunk-8-event-log-system` | None | ⏳ Not Started |
| 9 | Personality System | `feature/chunk-9-personality-system` | None | ⏳ Not Started |

### 🔄 Phase 3: Integration (Final)

| Chunk | Name | Branch | Dependencies | Status |
|-------|------|--------|--------------|--------|
| 10 | Pipeline Integration | `feature/chunk-10-pipeline-integration` | Chunks 1-9 | ⏳ Not Started |
| 11 | CLI Extensions | `feature/chunk-11-cli-extensions` | Chunk 10 | ⏳ Not Started |
| 12 | Final Integration & Testing | `feature/chunk-12-final-integration` | Chunks 1-11 | ⏳ Not Started |

## Workflow

### Starting a New Chunk

```bash
# Create isolated feature branch
git checkout develop
git pull origin develop
git checkout -b feature/chunk-<N>-<name>

# Implement following TDD
# 1. Write failing tests
# 2. Implement minimal code to pass
# 3. Refactor
# 4. Run all tests
# 5. Commit

# Create PR
git push -u origin feature/chunk-<N>-<name>
gh pr create --base develop --title "feat(chunk-N): <name>"
```

### Chunk Completion Checklist

- [ ] All tests pass (`npx vitest run`)
- [ ] Code follows TDD approach
- [ ] TypeScript compiles without errors
- [ ] No console.log or debug code
- [ ] Documentation updated
- [ ] PR description follows template
- [ ] Branch is up to date with develop

## Dependency Graph

```
Chunk 1 (RNG) ──────┬─────────────────────────────────────┐
                     │                                     │
Chunk 2 (State) ─────┼─────────────────────────────────────┤
                     │                                     │
                     ├─→ Chunk 3 (Director)                │
                     │                                     │
                     ├─→ Chunk 4 (Adventure Types)         │
                     │         │                           │
                     │         └─→ Chunk 5 (Adv Service)   │
                     │                 │                   │
                     │                 └─→ Chunk 6 (Adv Plugin)
                     │                                     │
                     ├─→ Chunk 7 (World)                   │
                     │                                     │
                     ├─→ Chunk 8 (Event Log)               │
                     │                                     │
                     └─→ Chunk 9 (Personality)             │
                                                           │
Chunk 10 (Pipeline Integration) ←──────────────────────────┘
         │
         └─→ Chunk 11 (CLI Extensions)
                  │
                  └─→ Chunk 12 (Final Integration)
```

## Parallel Development

Chunks can be developed in parallel if they have no dependencies:

**Batch 1 (Parallel)**:
- Chunk 3: Director System
- Chunk 4: Adventure Types
- Chunk 7: World System
- Chunk 8: Event Log System
- Chunk 9: Personality System

**Batch 2 (After Batch 1)**:
- Chunk 5: Adventure Service (needs Chunk 4)
- Chunk 6: Adventure Plugin (needs Chunk 5)

**Batch 3 (After All Systems)**:
- Chunk 10: Pipeline Integration
- Chunk 11: CLI Extensions
- Chunk 12: Final Integration

## PR Naming Convention

```
feat(chunk-N): <chunk-name>

Example:
feat(chunk-3): director-system
feat(chunk-4): adventure-types
```

## Commit Message Format

```
feat(chunk-N): <description>

Examples:
feat(chunk-3): implement Director service with visitor spawning
feat(chunk-4): add Adventure types and constants
test(chunk-5): add tests for Adventure service
refactor(chunk-6): optimize Adventure plugin performance
```
