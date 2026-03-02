# RFC-0007 — Personality / Traits / Corruption

Traits (0..100): generosity, temper, courage, greed, charisma, addiction.
Corruption points (0..1000) stages:
NONE<200, TAINTED 200-499, UNSTABLE 500-799, GONE>=800.
Monotonic transitions (no healing in v1 unless specified).
Traits mutate deterministically on adventure completion + specified events.
