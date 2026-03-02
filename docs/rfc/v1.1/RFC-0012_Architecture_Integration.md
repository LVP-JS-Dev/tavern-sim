# RFC-0012 — Architecture Integration

Domain is single source of truth.
UI -> commands -> domain; domain -> snapshots/events -> UI.
Phaser receives render hints only; no state writes.
