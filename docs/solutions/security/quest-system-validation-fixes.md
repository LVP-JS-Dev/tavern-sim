---
title: "NPC Quest Rewards System - Code Review Issues"
category: security-issues
tags:
  - quest-system
  - code-review
  - npc-rewards
  - backend-api
  - frontend-store
  - database-migrations
  - security
  - architecture
  - performance
problem_type: multi-category-issues
severity: critical
components:
  - backend/src/services/quest.js
  - backend/src/routes/quest.js
  - migrations/002_quests.sql
  - frontend/src/store/gameStore.ts
  - frontend/src/types/game.ts
  - frontend/src/components/quests/*.tsx
created_date: 2026-02-13
issue_count: 13
issue_categories:
  - security
  - architecture
  - performance
  - code-quality
---

# NPC Quest Rewards System - Code Review Issues

## Problem Symptom

After implementing the quest system (35/42 tasks complete), a comprehensive code review identified 13 issues across security, architecture, performance, and code quality. The most critical issues could allow players to bypass progression systems, claim invalid rewards, or exploit race conditions.

## Investigation Steps Tried

1. **Security review** - Analyzed authentication, authorization, input validation
2. **Architecture review** - Examined code organization, frontend-backend contracts
3. **Performance review** - Profiled query patterns, caching strategies
4. **Code quality review** - Checked for duplication, dead code, type safety

## Root Cause Analysis

The issues stem from several patterns:

1. **Incomplete implementation** - Functions created but not connected (e.g., `updateGoldCollectedSnapshot`)
2. **Missing authorization layer** - Business logic executed without verifying player permissions
3. **Code duplication** - Same constants/functions in frontend and backend
4. **Type contract drift** - Frontend types evolved separately from API responses
5. **Non-atomic operations** - Check-then-act patterns without transactions

## Working Solutions

### Issue 1: Reward Validation Bypass (P1)

**Location:** `backend/src/services/quest.js:227-229`

```javascript
// BEFORE: Only logs warning
if (!validateRewardsForLevel(quest.level, rewards)) {
  console.warn(`Rewards out of range for quest ${questId}:`, rewards);
}

// AFTER: Block invalid claims
if (!validateRewardsForLevel(quest.level, rewards)) {
  await pool.query('ROLLBACK');
  throw new Error(`Invalid rewards for quest level ${quest.level}`);
}
```

### Issue 2: No Level Authorization (P1)

**Location:** `backend/src/services/quest.js:174-194`

```javascript
export async function acceptQuest(userId, templateId) {
  await pool.query('BEGIN');
  try {
    // NEW: Verify template exists and get level
    const templateResult = await pool.query(
      `SELECT level FROM quest_templates WHERE id = $1 AND is_active = true`,
      [templateId]
    );
    if (templateResult.rows.length === 0) {
      throw new Error('Quest template not found');
    }
    const questLevel = templateResult.rows[0].level;

    // NEW: Check level unlock
    const gameStateResult = await pool.query(
      `SELECT total_level FROM game_states WHERE user_id = $1`,
      [userId]
    );
    const completedCount = await getCompletedQuestCount(userId);
    const unlockedLevels = getUnlockedLevels(
      gameStateResult.rows[0]?.total_level || 0,
      completedCount
    );
    if (!unlockedLevels.includes(questLevel)) {
      throw new Error(`Quest level ${questLevel} not unlocked`);
    }

    // Existing count check and insert...
  }
}
```

### Issue 3: Gold Snapshot Not Connected (P2 - High Impact)

**Location:** `backend/src/routes/game.js` - add to collect endpoint

```javascript
import { updateGoldCollectedSnapshot } from '../services/quest.js';

// In POST /collect handler, after updating game state:
await updateGoldCollectedSnapshot(userId, totalCollected);
```

### Issue 4: Frontend-Backend Contract Mismatch (P1)

**Location:** `backend/src/routes/quest.js:189` - update `formatPlayerQuest`

```javascript
function formatPlayerQuest(quest) {
  return {
    id: quest.id,
    templateId: quest.quest_template_id,
    key: quest.key,
    name: quest.name,
    description: quest.description,
    level: quest.level,
    // Transform flat fields into objectives array
    objectives: [{
      type: quest.objective_type,
      target: quest.objective_target,
      branch: quest.branch,
      current: quest.currentProgress ?? 0,
    }],
    baseRewards: {
      gold: quest.base_gold_reward,
      supplies: quest.base_supplies_reward,
      moodBoost: quest.base_mood_reward,
    },
    state: quest.state,
    progress: quest.progress,
    acceptedAt: quest.accepted_at,
    completedAt: quest.completed_at,
    expiresAt: quest.expires_at,
  };
}
```

### Issue 5: Input Validation (P2)

**Location:** `backend/src/routes/quest.js` - add validation middleware

```javascript
const validateQuestId = (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid quest ID' });
  }
  req.questId = id;
  next();
};

router.post('/:id/accept', validateQuestId, async (req, res) => {
  const templateId = req.questId;
  // ...
});
```

### Issue 6: Race Condition Fix (P2)

**Location:** `backend/src/services/quest.js:174` - atomic insert

```javascript
export async function acceptQuest(userId, templateId) {
  const result = await pool.query(
    `INSERT INTO player_quests (user_id, quest_template_id, state, accepted_at)
     SELECT $1, $2, 'active', CURRENT_TIMESTAMP
     WHERE (
       SELECT COUNT(*) FROM player_quests
       WHERE user_id = $1 AND state = 'active'
     ) < 3
     RETURNING *`,
    [userId, templateId]
  );

  if (result.rows.length === 0) {
    throw new Error('Maximum active quests reached (3)');
  }
  return result.rows[0];
}
```

## Prevention Strategies

### 1. Server-Authoritative Design

Never trust client-provided values for game economy:
```javascript
// WRONG: Client sends reward values
POST /api/quest/complete { questId: "q1", goldReward: 100 }

// RIGHT: Server determines rewards from quest definition
POST /api/quest/complete { questId: "q1" }
```

### 2. Authorization Middleware Chain

```javascript
router.post('/quest/complete',
  authMiddleware,           // Verifies JWT
  ownershipMiddleware,      // Verifies resource ownership
  questController.complete  // Handler
);
```

### 3. Shared Types Package

```
project/
├── shared/
│   ├── types/quest.ts      # Single source of truth
│   └── validators/quest.ts
├── frontend/
└── backend/
```

### 4. Contract Testing

```typescript
it('API response should match TypeScript interface', async () => {
  const response = await fetch('/api/game/quests');
  const data = await response.json();
  const quest: FrontendQuest = data.active[0];
  expect(quest.objectives).toBeDefined();
});
```

## Test Cases

| Issue | Test Name | Description |
|-------|-----------|-------------|
| Reward bypass | `should reject invalid reward values` | Server ignores client-provided rewards |
| Level auth | `should reject locked quest levels` | User can't accept level 5 quest at level 1 |
| Gold snapshot | `should track cumulative gold collected` | collect_gold quests progress correctly |
| Contract | `should return objectives array` | API matches frontend Quest type |
| Validation | `should reject non-numeric IDs` | `parseInt("abc")` returns 400 error |
| Race condition | `should enforce max 3 quests concurrently` | Parallel accepts still limited to 3 |

## Code Review Checklist

- [ ] Are reward values sourced from server-side definitions?
- [ ] Is level authorization checked before quest acceptance?
- [ ] Are all quest-related functions actually called?
- [ ] Do frontend types match API response shapes?
- [ ] Is every route parameter validated?
- [ ] Are check-then-act patterns wrapped in transactions?

## Cross-References

- **Proposal:** `openspec/changes/add-npc-quest-rewards/proposal.md`
- **Design:** `openspec/changes/add-npc-quest-rewards/design.md`
- **Spec:** `openspec/changes/add-npc-quest-rewards/specs/quest-system/spec.md`
- **Todos:** `todos/001-pending-p1-*.md` through `todos/013-pending-p3-*.md`
- **Architecture docs:** `docs/02_Architecture.md`
- **Tech constraints:** `tech_constraints.md`

## Effort Summary

| Priority | Issues | Estimated Effort |
|----------|--------|-----------------|
| P0 (Critical) | 4 | ~2.5 hours |
| P1 (Important) | 4 | ~3 hours |
| P2 (Nice-to-have) | 5 | ~3 hours |
| **Total** | 13 | ~8.5 hours |

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Quest system implemented | 35/42 tasks complete |
| 2026-02-13 | Code review performed | 4 parallel review agents |
| 2026-02-13 | Issues documented | 13 todos created in todos/ |
| 2026-02-13 | Solution compounded | This documentation created |
