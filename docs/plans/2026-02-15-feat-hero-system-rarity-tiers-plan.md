---
title: Implement Hero System - Rarity Tiers, Leveling, and Adventure Mechanics
type: feat
date: 2026-02-15
---

# Implement Hero System - Rarity Tiers, Leveling, and Adventure Mechanics

## Overview

Complete the Phase 2 Hero System implementation by adding rarity tiers, hero leveling/upgrades, adventure trigger mechanics, and passive income generation. The codebase has a solid foundation with state machines and basic UI screens, but critical progression mechanics are missing.

## Problem Statement

The current Hero System has these critical gaps:

1. **No rarity tier system** - All heroes are identical, removing progression depth
2. **No hero leveling** - Cannot upgrade individual heroes
3. **No adventure trigger UI** - Users cannot send heroes on adventures
4. **No offline resolution** - Adventures completed while away are not resolved
5. **No hero income** - Heroes don't contribute to tavern economy
6. **Incomplete mood management** - No way to improve hero mood

## Proposed Solution

### Phase 2.1: Hero Data Model Expansion

Add rarity tiers, leveling, and income mechanics to the hero system.

#### Database Schema Changes

**Migration: `migrations/007_hero_progression.sql`**

```sql
-- Add progression fields to heroes table
ALTER TABLE heroes 
ADD COLUMN rarity VARCHAR(20) DEFAULT 'common' 
  CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
ADD COLUMN level INTEGER DEFAULT 1 
  CHECK (level >= 1 AND level <= 50),
ADD COLUMN experience INTEGER DEFAULT 0 
  CHECK (experience >= 0),
ADD COLUMN income_per_second INTEGER DEFAULT 0 
  CHECK (income_per_second >= 0);

-- Migrate existing heroes: assign common rarity, level 1, zero experience/income
UPDATE heroes 
SET rarity = 'common', 
    level = 1, 
    experience = 0, 
    income_per_second = 1 
WHERE rarity IS NULL;

-- Note: No separate rarity_stats table - use constants (see below)
-- Note: No indexes needed for <50 heroes per user
```

#### TypeScript Type Updates

**File: `frontend/src/types/game.ts`**

```typescript
export type HeroRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Hero {
  id: HeroId;
  name: string;
  class: 'warrior' | 'mage' | 'rogue' | 'guest';
  rarity: HeroRarity;
  level: number;
  experience: number;
  incomePerSecond: number;
  partyId: string | null;
  demands: Demand[];
  state: HeroState;
  mood: number;
  nextArrivalAt: number | null;
  adventureEndsAt: number | null;
  deadUntilAt: number | null;
  boycottEndsAt: number | null;
  history: HeroEvent[];
}

// API response types
export interface UpgradeHeroResponse {
  hero: Hero;
  goldSpent: number;
  previousLevel: number;
  newLevel: number;
}

export interface StartAdventureResponse {
  success: boolean;
  heroId: HeroId;
  adventureEndsAt: number;
  estimatedDuration: number;
}

export interface OfflineResolution {
  heroId: HeroId;
  outcome: 'success' | 'partial' | 'failure' | 'death';
  rewards: { gold: number; supplies: number };
  experienceGained: number;
  newState: HeroState;
}
```

**File: `frontend/src/config/heroConfig.ts`** (New)

```typescript
import { HeroRarity } from '@/types/game';

// Rarity configuration - constants instead of database table
export const HERO_RARITY: Record<HeroRarity, {
  baseIncome: number;
  incomeMultiplier: number;
  maxLevel: number;
  baseCost: number;
}> = {
  common:    { baseIncome: 1, incomeMultiplier: 1.0, maxLevel: 10,  baseCost: 100 },
  rare:      { baseIncome: 2, incomeMultiplier: 1.5, maxLevel: 20,  baseCost: 200 },
  epic:      { baseIncome: 3, incomeMultiplier: 2.5, maxLevel: 30,  baseCost: 500 },
  legendary: { baseIncome: 5, incomeMultiplier: 5.0, maxLevel: 50,  baseCost: 1000 },
};

// Simple linear formulas for MVP
export const calculateUpgradeCost = (baseCost: number, level: number): number => 
  baseCost + (level * 50);

export const calculateXpRequired = (level: number): number => 
  level * 50;

export const calculateHeroIncome = (
  rarity: HeroRarity, 
  level: number
): number => {
  const config = HERO_RARITY[rarity];
  return Math.floor(config.baseIncome * config.incomeMultiplier * level * 0.5);
};

// Flat XP for all adventure completions (simplified)
export const ADVENTURE_XP = 50;
```

#### Experience Gain Mechanics

Heroes gain **50 XP** for completing any adventure (simplified from 4 different values). 

Experience is awarded when adventures resolve (immediately if user is online, on next app init if offline). Heroes can accumulate experience beyond the amount needed for next level, making upgrades feel rewarding rather than wasteful.

**Why flat XP:** Simpler to understand, easier to balance, and the adventure outcome already provides meaningful variety (gold/supplies rewards differ).

### Phase 2.2: Hero Leveling and Upgrade Logic

#### Backend Service (Simplified)

**File: `backend/src/services/heroService.js`**

```javascript
import { pool } from '../utils/db.js';

// Rarity config - matches frontend/src/config/heroConfig.ts
const HERO_RARITY = {
  common:    { baseIncome: 1, incomeMultiplier: 1.0, maxLevel: 10,  baseCost: 100 },
  rare:      { baseIncome: 2, incomeMultiplier: 1.5, maxLevel: 20,  baseCost: 200 },
  epic:      { baseIncome: 3, incomeMultiplier: 2.5, maxLevel: 30,  baseCost: 500 },
  legendary: { baseIncome: 5, incomeMultiplier: 5.0, maxLevel: 50,  baseCost: 1000 },
};

// Simple linear formulas
const calculateUpgradeCost = (baseCost, level) => baseCost + (level * 50);
const calculateXpRequired = (level) => level * 50;
const calculateIncome = (rarity, level) => {
  const config = HERO_RARITY[rarity];
  return Math.floor(config.baseIncome * config.incomeMultiplier * level * 0.5);
};

/**
 * @param {number} userId
 * @param {string} heroKey
 * @returns {Promise<{hero: object, goldSpent: number, previousLevel: number, newLevel: number}>}
 */
export async function upgradeHero(userId, heroKey) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get hero and user with locks
    const heroResult = await client.query(
      `SELECT * FROM heroes WHERE user_id = $1 AND hero_key = $2 FOR UPDATE`,
      [userId, heroKey]
    );
    
    if (heroResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Hero not found');
    }
    
    const hero = heroResult.rows[0];
    const config = HERO_RARITY[hero.rarity];
    
    if (!config) {
      await client.query('ROLLBACK');
      throw new Error(`Unknown rarity: ${hero.rarity}`);
    }
    
    if (hero.level >= config.maxLevel) {
      await client.query('ROLLBACK');
      throw new Error('Hero already at max level');
    }
    
    const goldCost = calculateUpgradeCost(config.baseCost, hero.level);
    const xpRequired = calculateXpRequired(hero.level);
    
    if (hero.experience < xpRequired) {
      await client.query('ROLLBACK');
      throw new Error(`Insufficient experience: need ${xpRequired}, have ${hero.experience}`);
    }
    
    const userResult = await client.query(
      'SELECT gold FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('User not found');
    }
    
    if (userResult.rows[0].gold < goldCost) {
      await client.query('ROLLBACK');
      throw new Error(`Insufficient gold: need ${goldCost}, have ${userResult.rows[0].gold}`);
    }
    
    const newIncome = calculateIncome(hero.rarity, hero.level + 1);
    
    const updateResult = await client.query(
      `UPDATE heroes 
       SET level = level + 1, 
           experience = experience - $3,
           income_per_second = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND hero_key = $2
       RETURNING *`,
      [userId, heroKey, xpRequired, newIncome]
    );
    
    await client.query(
      'UPDATE users SET gold = gold - $1 WHERE id = $2',
      [goldCost, userId]
    );
    
    await client.query('COMMIT');
    
    return {
      hero: updateResult.rows[0],
      goldSpent: goldCost,
      previousLevel: hero.level,
      newLevel: hero.level + 1,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

#### Frontend Store Action

**File: `frontend/src/store/gameStore.ts`**

```typescript
import type { HeroId, UpgradeHeroResponse } from '@/types/game';

interface UpgradeResult {
  success: boolean;
  error?: string;
}

// Add to GameStore interface
upgradeHero: (heroId: HeroId) => Promise<UpgradeResult>;

// Implementation
upgradeHero: async (heroId: HeroId): Promise<UpgradeResult> => {
  const state = get();
  
  if (!state.token) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const hero = state.heroes[heroId];
  if (!hero) {
    return { success: false, error: 'Hero not found' };
  }
  
  try {
    const response = await fetch(`${API_URL}/heroes/${heroId}/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json() as { error?: string };
      return { 
        success: false, 
        error: errorData.error || `Upgrade failed (${response.status})` 
      };
    }
    
    const data = await response.json() as UpgradeHeroResponse;
    
    if (!data.hero || typeof data.goldSpent !== 'number') {
      return { success: false, error: 'Invalid server response' };
    }
    
    set({
      heroes: { ...state.heroes, [heroId]: data.hero },
      gold: state.gold - data.goldSpent,
    });
    
    analytics.track({
      name: 'hero_upgraded',
      params: {
        hero_id: heroId,
        rarity: hero.rarity,
        previous_level: data.previousLevel,
        new_level: data.newLevel,
        gold_spent: data.goldSpent,
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Hero upgrade error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
},
```

### Phase 2.3: Adventure Trigger System

Heroes enter the **'preparing'** state automatically after returning from an adventure (state 'returning' → 'approaching' → 'inTavern' → 'preparing'). After resting in the tavern for 5 minutes, they become ready to adventure again.

**State Flow:**
```
onAdventure → returning → approaching → inTavern → [wait 5 min] → preparing
```

The 'preparing' state indicates a hero is rested and ready for the next adventure. This creates a natural rhythm: adventure → return → rest → prepare → adventure.

#### Adventure Start API

**File: `backend/src/routes/adventure.js`** (Add to existing)

```javascript
router.post('/start', async (req, res) => {
  const userId = req.user.id;
  const { heroId, partyId } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Validate hero belongs to user and is in correct state
    const heroResult = await client.query(
      `SELECT * FROM heroes 
       WHERE user_id = $1 AND hero_key = $2 AND state = 'preparing'
       FOR UPDATE`,
      [userId, heroId]
    );
    
    if (heroResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Hero not found or not in preparing state' 
      });
    }
    
    const hero = heroResult.rows[0];
    
    // Calculate adventure duration (15-45 minutes based on level/rarity)
    const baseDuration = 15 * 60 * 1000; // 15 minutes in ms
    const levelModifier = hero.level * 30 * 1000; // +30s per level
    const duration = baseDuration + levelModifier;
    const adventureEndsAt = new Date(Date.now() + duration);
    
    // Update hero state
    await client.query(
      `UPDATE heroes 
       SET state = 'onAdventure',
           adventure_ends_at = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND hero_key = $2`,
      [userId, heroId, adventureEndsAt]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      heroId,
      adventureEndsAt: adventureEndsAt.getTime(),
      estimatedDuration: duration
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start adventure error:', error);
    res.status(500).json({ error: 'Failed to start adventure' });
  } finally {
    client.release();
  }
});
```

#### Adventure Trigger UI

**File: `frontend/src/components/screens/HeroDetailsScreen.tsx`** (Add section)

```typescript
import { useGameStore } from '@/store/gameStore';
import type { Hero, HeroId } from '@/types/game';

interface AdventureSectionProps {
  heroId: HeroId;
}

const AdventureSection: React.FC<AdventureSectionProps> = ({ heroId }) => {
  const hero = useGameStore(state => state.heroes[heroId]);
  const startAdventure = useGameStore(state => state.startAdventure);
  
  // Early return if hero doesn't exist
  if (!hero) {
    return null;
  }
  
  if (hero.state === 'preparing') {
    const durationMinutes = 15 + hero.level * 0.5;
    
    const handleStartAdventure = async () => {
      const result = await startAdventure(hero.id);
      if (!result.success) {
        console.error('Failed to start adventure:', result.error);
        // TODO: Show error toast to user
      }
    };
    
    return (
      <div className="adventure-section">
        <h3>Ready for Adventure!</h3>
        <p>Duration: ~{durationMinutes.toFixed(1)} minutes</p>
        <button 
          onClick={handleStartAdventure}
          className="btn-primary"
          type="button"
        >
          Send on Adventure
        </button>
      </div>
    );
  }
  
  if (hero.state === 'onAdventure') {
    // Validate required data exists
    if (!hero.adventureEndsAt) {
      console.error('Hero on adventure but no end time');
      return null;
    }
    
    return (
      <div className="adventure-section">
        <h3>On Adventure</h3>
        <AdventureTimer endsAt={hero.adventureEndsAt} />
      </div>
    );
  }
  
  return null;
};
```

### Phase 2.4: Offline Adventure Resolution

#### Offline Resolution Service

**File: `backend/src/services/offlineResolver.js`**

```javascript
import { pool } from '../utils/db.js';
import { resolveAdventureServerSide } from './adventureResolver.js';

const ADVENTURE_XP = 50;

/**
 * @param {number} userId
 * @returns {Promise<Array<{heroId: string, outcome: string, rewards: object, experienceGained: number, newState: string}>>}
 */
export async function resolveOfflineAdventures(userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const completedAdventures = await client.query(
      `SELECT * FROM heroes 
       WHERE user_id = $1 
         AND state = 'onAdventure' 
         AND adventure_ends_at <= CURRENT_TIMESTAMP
       FOR UPDATE`,
      [userId]
    );
    
    const resolutions = [];
    
    for (const hero of completedAdventures.rows) {
      const outcome = await resolveAdventureServerSide(
        hero.hero_key,
        hero.mood,
        userId,
        process.env.SERVER_SECRET
      );
      
      const newState = outcome.outcome === 'death' ? 'dead' : 'returning';
      const deadUntilAt = outcome.outcome === 'death' 
        ? new Date(Date.now() + 2 * 60 * 60 * 1000)
        : null;
      
      await client.query(
        `UPDATE heroes 
         SET state = $3,
             mood = GREATEST(0, mood + $4),
             experience = experience + $5,
             dead_until_at = $6,
             adventure_ends_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND hero_key = $2`,
        [userId, hero.hero_key, newState, outcome.moodChange, ADVENTURE_XP, deadUntilAt]
      );
      
      if (outcome.goldReward > 0 || outcome.suppliesReward > 0) {
        await client.query(
          `UPDATE users 
           SET gold = gold + $1, supplies = supplies + $2
           WHERE id = $3`,
          [outcome.goldReward, outcome.suppliesReward, userId]
        );
      }
      
      resolutions.push({
        heroId: hero.hero_key,
        outcome: outcome.outcome,
        rewards: { gold: outcome.goldReward, supplies: outcome.suppliesReward },
        experienceGained: ADVENTURE_XP,
        newState,
      });
    }
    
    await client.query('COMMIT');
    return resolutions;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

#### Frontend Integration

**File: `frontend/src/store/gameStore.ts`** (Add to init)

```typescript
// Call when app initializes
resolveOfflineProgress: async () => {
  const state = get();
  if (!state.token) return;
  
  try {
    const response = await fetch(`${API_URL}/game/resolve-offline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.resolutions.length > 0) {
        // Show offline progress popup
        set({ 
          offlineResolutions: data.resolutions,
          showOfflinePopup: true 
        });
      }
      
      // Refresh full state
      await get().fetchGameState();
    }
  } catch (error) {
    console.error('Offline resolution error:', error);
  }
}
```

### Phase 2.5: Hero Income Integration

#### Server-Side Income Calculation

**Important:** Income must be calculated server-side to prevent client manipulation. The API returns the computed `totalIncomePerSecond` value.

**File: `backend/src/services/economyService.js`**

```javascript
// Server-side income calculation (returns value in API response)
export async function calculateUserIncome(userId) {
  const result = await pool.query(
    `SELECT 
       COALESCE(SUM(
         CASE WHEN state = 'inTavern' THEN 
           income_per_second * (0.5 + mood / 200.0)
         ELSE 0 END
       ), 0) as hero_income
     FROM heroes WHERE user_id = $1`,
    [userId]
  );
  
  const heroIncome = Math.floor(result.rows[0].hero_income);
  // Add base tavern income from upgrades...
  return { heroIncome, totalIncome: baseIncome + heroIncome };
}
```

#### Frontend Display (Read-Only)

**File: `frontend/src/components/screens/HeroesScreen.tsx`** (Enhancement)

```typescript
import { HERO_RARITY } from '@/config/heroConfig';
import type { Hero } from '@/types/game';

const RARITY_COLORS: Record<HeroRarity, string> = {
  common: '#9e9e9e',
  rare: '#4fc3f7',
  epic: '#ba68c8',
  legendary: '#ffd700',
};

interface HeroCardProps {
  hero: Hero;
}

const HeroCard: React.FC<HeroCardProps> = ({ hero }) => (
  <div className="hero-card">
    <div 
      className="rarity-badge"
      style={{ backgroundColor: RARITY_COLORS[hero.rarity] }}
    >
      {hero.rarity}
    </div>
    
    <div className="hero-info">
      <h3>{hero.name}</h3>
      <p>Level {hero.level} {hero.class}</p>
      {hero.state === 'inTavern' && (
        <p className="income">+{hero.incomePerSecond}/sec</p>
      )}
    </div>
    
    <MoodBar mood={hero.mood} />
    <StatusBadge state={hero.state} />
  </div>
);
```

### Phase 2.6: Mood Management

#### Simplified Mood Rules

Mood is managed through passive mechanics rather than explicit service calls:

1. **Adventure completion**: Mood changes based on outcome (existing `adventureResolver.js`)
2. **Demand satisfaction check**: Run when user upgrades tavern facilities, inline in upgrade handler
3. **No explicit mood recovery endpoint** - mood recovers naturally over time via frontend tick

**File: `backend/src/routes/upgrade.js`** (Add to existing upgrade handler)

```javascript
// After successful tavern upgrade, check if any heroes get mood boost
const heroesWithSatisfiedDemands = await client.query(
  `SELECT h.hero_key, h.mood, h.demands
   FROM heroes h
   WHERE h.user_id = $1 AND h.mood < 100`,
  [userId]
);

for (const hero of heroesWithSatisfiedDemands.rows) {
  const demands = hero.demands || [];
  const unsatisfied = demands.filter(d => 
    d.type === 'hard' && currentUpgrades[d.branch] < d.minLevel
  );
  
  if (unsatisfied.length === 0) {
    await client.query(
      `UPDATE heroes SET mood = LEAST(100, mood + 15) 
       WHERE user_id = $1 AND hero_key = $2`,
      [userId, hero.hero_key]
    );
  }
}
```

This inlines the mood check into the existing upgrade flow, avoiding a separate API call.

## Technical Considerations

### Architecture Impacts

1. **State Management**: Hero income must be recalculated every tick when heroes are in tavern
2. **Database Transactions**: All upgrade operations require row locking to prevent race conditions
3. **API Design**: Follow existing pattern - client sends IDs, server returns computed values
4. **Security**: Adventure resolution stays server-side; client cannot manipulate outcomes

### Performance Implications

1. **Income Calculation**: O(n) where n = heroes in tavern (acceptable for <50 heroes)
2. **Offline Resolution**: Batch resolve all completed adventures on app init
3. **No indexes needed**: With <50 heroes per user, sequential scans are faster than index overhead
4. **Constants over JOINs**: Rarity config in memory, no database lookup per query

### Security Considerations

1. **Gold Costs**: Server validates gold before deducting; never trust client
2. **Level Caps**: Server enforces max level based on rarity
3. **State Transitions**: Only allow valid transitions (e.g., 'preparing' → 'onAdventure')
4. **Offline Resolution**: Use HMAC signatures for adventure outcomes (existing pattern)

## Acceptance Criteria

### Data Model
- [x] `heroes` table has `rarity`, `level`, `experience`, `income_per_second` columns
- [x] Rarity config stored as TypeScript constants (no database table)
- [x] Existing heroes migrated: rarity='common', level=1, experience=0
- [x] TypeScript types updated with explicit return types

### Hero Leveling & Experience
- [x] Heroes can be upgraded when they have sufficient gold and experience
- [x] Upgrade increases level by 1 and income_per_second
- [x] Max level enforced per rarity tier (Common: 10, Rare: 20, Epic: 30, Legendary: 50)
- [x] Upgrade cost calculated: `baseCost + (level * 50)` (linear)
- [x] Experience required: `level * 50`
- [x] Flat 50 XP for any adventure completion
- [x] Upgrade button shows cost and requirements

### Rarity System
- [x] All heroes have a rarity: common, rare, epic, or legendary
- [x] Rarity displayed in HeroesScreen with color-coded badges
- [x] Higher rarity heroes have higher base income
- [x] Rarity affects max level cap

### Adventure Trigger
- [x] Heroes enter 'preparing' state after 5-minute rest following return
- [x] Heroes in 'preparing' state show "Send on Adventure" button
- [x] Clicking button triggers API call to start adventure
- [x] Adventure duration: 15 minutes + (level * 30 seconds)
- [x] UI shows countdown timer while on adventure
- [x] Null checks before accessing hero properties

### Offline Resolution
- [x] On app init, check for completed adventures
- [x] Auto-resolve adventures using server-side RNG
- [x] Apply rewards (gold, supplies) and flat 50 XP
- [x] Update hero state (returning or dead)
- [x] Show offline progress popup with results

### Hero Income
- [x] Income calculated server-side (security)
- [x] API returns `totalIncomePerSecond` computed value
- [x] Heroes in 'inTavern' state contribute to income
- [x] Mood affects income: 0 mood = 50%, 100 mood = 100%
- [x] Income displayed in hero card

### Mood Management
- [x] Satisfying all hard demands boosts mood by +15 (inline in upgrade handler)
- [x] Mood displayed as 0-100 progress bar in UI
- [x] Low mood (<30) shows warning indicator
- [x] No separate mood recovery endpoint

### UI Enhancements
- [x] HeroesScreen shows rarity badges with tier colors
- [x] HeroesScreen shows level and income for each hero
- [x] HeroDetailsScreen shows upgrade button with cost
- [x] HeroDetailsScreen shows adventure trigger when preparing
- [x] Offline popup shows list of resolved adventures

### Testing Requirements
- [ ] Unit tests for upgrade logic (cost calculation, max level)
- [ ] Unit tests for income calculation
- [ ] Integration tests for adventure start/complete flow
- [ ] Database migration tests
- [ ] UI component tests with proper null handling

## Success Metrics

1. **Hero Progression Depth**: Users can upgrade heroes at least 10 levels
2. **Engagement**: 70% of daily active users send heroes on adventures
3. **Retention**: Users with upgraded heroes have 20% higher day-7 retention
4. **Monetization**: Hero income contributes 30-50% of total tavern income at mid-game

## Dependencies & Risks

### Dependencies
- Existing `adventureResolver.js` for server-side RNG
- Existing `HeroDetailsScreen` and `HeroesScreen` components
- Zustand store pattern already established
- Database migration system in place

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Complex upgrade balancing | Medium | High | Start with simple linear costs, tune post-launch |
| UI clutter with new stats | Medium | Medium | Progressive disclosure - hide details in modal |
| Offline resolution edge cases | Low | High | Extensive testing with simulated offline periods |
| Migration performance | Low | Medium | Add indexes before running migration |

## References & Research

### Internal References

**Existing Hero Code:**
- `frontend/src/types/game.ts:1-100` - Hero type definitions
- `frontend/src/systems/heroStateMachine.ts:1-80` - State machine logic
- `frontend/src/components/screens/HeroesScreen.tsx` - Hero list UI
- `frontend/src/components/screens/HeroDetailsScreen.tsx` - Hero detail UI
- `backend/src/routes/adventure.js` - Adventure routes
- `backend/src/services/adventureResolver.js` - Server-side RNG

**Database:**
- `migrations/001_init.sql:59-85` - Heroes table schema
- `migrations/001_init.sql:87-95` - Hero demands table

**State Management:**
- `frontend/src/store/gameStore.ts` - Zustand store patterns
- `frontend/src/systems/stateBridge.ts` - State bridge pattern

### Documented Learnings

**From `docs/solutions/security/quest-system-validation-fixes.md`:**
- Server-authoritative design: Client sends IDs, server computes values
- Row locking with `FOR UPDATE` for race condition prevention
- HMAC signatures for outcome verification

**From `docs/plans/2026-02-14-tavern-tycoon-mvp-plan.md`:**
- State machine transitions must be explicit
- Side effects trigger timestamp updates
- YAGNI: boycott state removed from MVP

**From `docs/rfc/v1.1/RFC-0006_Hero_Model_and_Progression.md`:**
- Fixed-point currency pattern (gold * 1000)
- Partial upgrades allowed with rejection handling
- Demand checking simplified to inline level checks

### External References

- **Zustand Docs**: https://github.com/pmndrs/zustand - State management patterns
- **Phaser 3**: https://phaser.io - Game rendering (for future sprite integration)
- **PostgreSQL**: https://www.postgresql.org/docs/current/index.html - Row locking and transactions

## Implementation Phases

### Phase 1: Foundation (2-3 days)
- [x] Create database migration (add columns to heroes table)
- [x] Migrate existing heroes (rarity='common', level=1, experience=0)
- [x] Create `frontend/src/config/heroConfig.ts` with constants
- [x] Update TypeScript types with explicit return types

### Phase 2: Core Mechanics (3-4 days)
- [x] Implement simplified `heroService.js` upgrade function
- [x] Implement adventure trigger API
- [x] Implement offline resolution with flat XP
- [x] Add store actions with proper types and null checks

### Phase 3: UI Integration (3-4 days)
- [x] Update HeroesScreen with rarity badges
- [x] Update HeroDetailsScreen with upgrade button and adventure trigger
- [x] Add null checks in all components
- [ ] Create offline progress popup component

### Phase 4: Income & Polish (2-3 days)
- [x] Add server-side income calculation
- [ ] Inline mood satisfaction checks in upgrade handler
- [ ] Testing and bug fixes

## MVP Notes

For the initial MVP release:

1. **Rarity config as constants** - No database table, just TypeScript config
2. **Linear upgrade costs** - `baseCost + (level * 50)` instead of exponential
3. **Flat XP** - 50 XP for all adventure completions
4. **3 rarity tiers** - Common, Rare, Epic (add Legendary in Phase 4)
5. **Manual adventure trigger** - auto-trigger deferred
6. **5-minute rest period** - heroes enter 'preparing' after 5 min rest
7. **No history JSONB** - defer event history to post-MVP
8. **Inline mood checks** - no separate mood recovery endpoint
9. **No database indexes** - unnecessary with <50 heroes per user

## Complexity Reduction Summary

| Aspect | Before | After | Savings |
|--------|--------|-------|---------|
| Database tables | 2 (heroes + rarity_stats) | 1 (heroes) | -1 table |
| Database indexes | 2 | 0 | -2 indexes |
| XP values | 4 (100/50/25/10) | 1 (50) | Simpler |
| Cost formula | Exponential | Linear | Predictable |
| Mood endpoints | 2 functions | Inline | Fewer APIs |
| History JSONB | Per-adventure | Deferred | Less code |

## Future Considerations

### Post-MVP Enhancements
- Equipment system for hero customization
- Hero skills/abilities unlocked at levels
- Party system with synergy bonuses
- Rarity promotion (Common → Rare)
- Adventure history JSONB for storytelling

### If Scale Becomes an Issue
- Add database indexes if >100 heroes per user
- Cache upgrade costs in Redis
- Batch offline resolution for users with many heroes

## What Was Simplified (Technical Review)

Based on DHH, TypeScript, and Simplicity reviewer feedback:

| Original | Simplified | Reason |
|----------|------------|--------|
| `hero_rarity_stats` table | TypeScript constants | 4 rows don't need a table |
| Exponential costs `1.5^level` | Linear `base + level*50` | Predictable, easier to balance |
| 4 XP values per outcome | Flat 50 XP | Simpler, less cognitive load |
| 2 mood service functions | Inline in upgrade handler | Fewer APIs, less indirection |
| History JSONB per adventure | Deferred to post-MVP | Not needed for core loop |
| 2 database indexes | None | <50 heroes = no benefit |

## Documentation Plan

- [ ] Update API documentation with new endpoints
- [ ] Document rarity tier balancing formula
- [ ] Add hero progression guide for players
- [ ] Update database schema documentation
