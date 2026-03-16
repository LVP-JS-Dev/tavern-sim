/** Canvas dimensions (mobile-first) */
export const CANVAS_WIDTH = 375;
export const CANVAS_HEIGHT = 667;

/** Game tick interval in ms (matches simulation TICK_MS) */
export const TICK_MS = 40;

/** Tile size in pixels */
export const TILE_SIZE = 32;

/** Z-index layers for depth sorting */
export const LAYERS = {
  FLOOR: 0,
  TABLES: 10,
  VISITORS: 20,
  HEROES: 30,
  HUD: 100,
} as const;

/** HUD bar height */
export const HUD_HEIGHT = 60;

/** Action bar height */
export const ACTION_BAR_HEIGHT = 60;

/** Tavern play area */
export const TAVERN_AREA = {
  x: 0,
  y: HUD_HEIGHT,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT - HUD_HEIGHT - ACTION_BAR_HEIGHT,
} as const;

/** Asset paths */
export const ASSETS = {
  SPRITES: 'assets/sprites',
} as const;
