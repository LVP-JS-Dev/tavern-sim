# RFC-0006 — Heroes & Progression

Fixed-point: gold_u = gold*1000.
Income per tick: floor(sumIncomePerSecond_u * TICK_MS / 1000).

Upgrade policy (hard): partial upgrades allowed.
Emit HERO_UPGRADE_APPLIED {requestedLevels, appliedLevels, spentGold_u}
If appliedLevels=0 emit HERO_UPGRADE_REJECTED {reason: INSUFFICIENT_FUNDS}
