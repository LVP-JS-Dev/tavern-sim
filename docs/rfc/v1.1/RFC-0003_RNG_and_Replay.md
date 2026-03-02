# RFC-0003 — RNG & Replay

Root seed uint32 stored forever.
Streams (hard): WORLD/DIRECTOR/HERO/ADVENTURE/LOOT
seed = hash32(rootSeed, streamId, partitionKey)

Replay tape: initial snapshot/hash + ordered commands + time updates (+ optional RNG audit).
Replay verification: checkpoint snapshot-hash compare; report first mismatch.
