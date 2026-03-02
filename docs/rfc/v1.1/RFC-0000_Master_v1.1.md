# RFC-0000 — Master Contract — v1.1

## Goals
- Deterministic simulation-heavy full cycle: heroes + adventures + traits/corruption + loot + event log
- Production stability: replayable, integrity-protected state, bounded performance

## Global Contracts (hard)
- Determinism: (S0, rootSeed, input tape, time updates) => identical outputs
- Numeric determinism: integer/fixed-point for authoritative values
- Ordering determinism: sorted iteration, stable tie-breakers
- State: versioned, serializable, integrity-checked, recoverable
- RNG: stream-partitioned; no Math.random in domain
- Events: major-only; causally traceable to tick + module

## Global Invariants (must hold)
1) tickIndex monotonic +1 per tickStep
2) gold never negative
3) entity ids unique/stable across save/load
4) RNG only via defined streams
5) events include tickIndex + eventId
6) placement constraints never violated after commands
7) offline progress uses integrity + clamp policy
8) corruption monotonic (no healing in v1 unless specified)
9) adventure outcomes deterministic from seed + specs
10) upgrades may be partially applied; result explicit + deterministic

## Failure modes (global)
- clock manipulation: clamp + SECURITY_OFFLINE_CLAMPED
- corrupted save: LKG or reset + STATE_CORRUPTED_RECOVERY
- replay mismatch: dev diff; prod diagnostic
- version mismatch: migrate or safe reset

## Index
RFC-0001..RFC-0018 + Roadmaps
