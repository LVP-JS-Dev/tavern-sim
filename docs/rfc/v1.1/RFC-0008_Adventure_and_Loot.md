# RFC-0008 — Adventure & Loot

Adventure types: ADVENTURE_TRIP, PERSONAL_TRIP.
Tick-based runs with endsAtTick; completion determines outcome once.
Loot tiers: COMMON/RARE/LEGENDARY via STREAM_LOOT partitionKey=adventureId.
Completion emits ADVENTURE_COMPLETED + (LOOT_SOLD or LOOT_PENDING).
