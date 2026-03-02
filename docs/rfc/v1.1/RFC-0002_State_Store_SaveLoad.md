# RFC-0002 — State Store & Save/Load

Canonical JSON with sorted keys for hashing.
Envelope includes schemaVersion, savedAtWallMs, state, integrity hash, optional last-known-good pointer.
Atomic write: tempKey -> mainKey swap.
On hash mismatch: load LKG or reset + emit recovery events.
