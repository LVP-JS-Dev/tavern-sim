# RFC-0005 — World & Placement

Hard placement rules:
1) no corridor overlap 2) no object overlap 3) no reserved points overlap
Deterministic validation priority:
OUT_OF_BOUNDS -> OVERLAPS_CORRIDOR -> OVERLAPS_OBJECT -> OVERLAPS_RESERVED_POINTS
