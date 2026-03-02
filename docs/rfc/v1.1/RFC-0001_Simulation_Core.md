# RFC-0001 — Simulation Core

## Hard constants
- TICK_HZ=25, TICK_MS=40

## Tick pipeline (hard order)
1) timers 2) commands 3) director 4) heroes 5) adventures 6) world 7) flush events 8) tickIndex++

## Command ordering (hard)
effectiveTick -> kind priority -> id lexicographic

## Offline progress (hard)
deltaMs=clamp(now-lastSaved,0,MAX_OFFLINE_MS)
offlineTicks=floor(deltaMs/TICK_MS)
run tickStep offlineTicks times
emit OFFLINE_PROGRESS_APPLIED (+ SECURITY_OFFLINE_CLAMPED when clamped)

Diagrams included in source chat (module/sequence/lifecycle).
