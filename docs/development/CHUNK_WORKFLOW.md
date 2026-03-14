# Chunk Development Workflow

## Quick Start

### Starting a New Chunk

```bash
# 1. Ensure develop is up to date
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/chunk-<N>-<name>

# 3. Start TDD cycle
# Write failing test → Run test → Implement → Run test → Refactor → Commit

# 4. Run all tests
npx vitest run

# 5. Create PR
git push -u origin feature/chunk-<N>-<name>
gh pr create --base develop --template .github/PULL_REQUEST_TEMPLATE/chunk.md
```

## TDD Workflow

Each chunk MUST follow TDD:

### 1. RED - Write Failing Test

```bash
# Create test file
touch tests/unit/systems/my-system.test.ts

# Run test to verify it fails
npx vitest run tests/unit/systems/my-system.test.ts
```

### 2. GREEN - Minimal Implementation

```bash
# Write minimal code to pass test
# Run test to verify it passes
npx vitest run tests/unit/systems/my-system.test.ts
```

### 3. REFACTOR - Clean Up

```bash
# Refactor while keeping tests green
# Run tests after each change
npx vitest run
```

## Branch Naming

```
feature/chunk-<number>-<kebab-case-name>

Examples:
feature/chunk-3-director-system
feature/chunk-4-adventure-types
feature/chunk-5-adventure-service
```

## Commit Messages

```
<type>(chunk-<N>): <description>

Types:
- feat: New feature
- test: Adding tests
- refactor: Refactoring code
- docs: Documentation changes
- fix: Bug fixes

Examples:
feat(chunk-3): implement Director service
test(chunk-3): add tests for visitor spawning
refactor(chunk-3): optimize spawn algorithm
```

## PR Requirements

### Before Creating PR

- [ ] All tests pass (`npx vitest run`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] No lint errors (`npx eslint src tests`)
- [ ] Branch up to date with develop
- [ ] PR title follows convention

### PR Template

Use `.github/PULL_REQUEST_TEMPLATE/chunk.md`

### PR Title Format

```
feat(chunk-N): <chunk-name>

Example:
feat(chunk-3): director-system
```

## Testing Strategy

### Unit Tests

```bash
# Run specific chunk tests
npx vitest run tests/unit/systems/<system-name>

# Run all unit tests
npx vitest run tests/unit
```

### Integration Tests

```bash
# Run integration tests
npx vitest run tests/integration
```

### All Tests

```bash
# Run entire test suite
npx vitest run
```

## Dependency Management

### Check Dependencies

```bash
# View chunk dependencies
cat docs/development/CHUNK_ROADMAP.md
```

### Merge Order

Chunks must be merged in dependency order:

1. **Independent chunks** can be developed in parallel
2. **Dependent chunks** must wait for dependencies to merge
3. **Integration chunks** must wait for all system chunks

## Troubleshooting

### Tests Failing After Merge

```bash
# Rebase on latest develop
git checkout feature/chunk-N-name
git fetch origin
git rebase origin/develop

# Fix conflicts and re-run tests
npx vitest run
```

### Merge Conflicts

```bash
# Fetch latest
git fetch origin

# Rebase on develop
git rebase origin/develop

# Resolve conflicts manually
# Then continue rebase
git rebase --continue
```

### Outdated Branch

```bash
# Update branch with develop
git checkout feature/chunk-N-name
git merge develop

# Or rebase (cleaner history)
git rebase develop
```

## Best Practices

### DO ✅

- Follow TDD strictly
- Run all tests before committing
- Keep chunks small and focused
- Write clear test descriptions
- Update documentation
- Use conventional commit messages
- Create PR early for visibility

### DON'T ❌

- Skip tests
- Implement features not in chunk scope
- Commit failing tests
- Force push to shared branches
- Merge without PR review
- Skip code review
- Ignore TypeScript errors

## Resources

- [Main Refactoring Plan](../superpowers/plans/2026-03-14-tavern-tycoon-refactoring.md)
- [Chunk Roadmap](./CHUNK_ROADMAP.md)
- [PR Template](../../.github/PULL_REQUEST_TEMPLATE/chunk.md)
- [TDD Guide](https://testdriven.io/test-driven-development/)

## Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review existing PRs for similar issues
3. Ask in team chat
4. Create issue with `chunk-implementation` label
