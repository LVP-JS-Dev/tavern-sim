import Phaser from 'phaser';
import { getBridge } from '../index';
import { TICK_MS, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { TavernRenderer } from '../renderer/TavernRenderer';
import { Table } from '../entities/Table';
import { Visitor } from '../entities/Visitor';
import { Hero } from '../entities/Hero';
import type { StateBridge } from '../bridge';
import type { GameState } from '../../types';

export class TavernScene extends Phaser.Scene {
  private bridge!: StateBridge;
  private unsubscribe?: () => void;
  private tavernRenderer!: TavernRenderer;
  private lastTickTime = 0;

  // Entities
  private tables: Table[] = [];
  private visitors: Map<string, Visitor> = new Map();
  private heroes: Map<string, Hero> = new Map();

  constructor() {
    super({ key: 'TavernScene' });
  }

  create(): void {
    this.bridge = getBridge();

    // Initialize renderer
    this.tavernRenderer = new TavernRenderer(this);
    this.tavernRenderer.render();

    // Create static tables
    this.createTables();

    // Subscribe to state changes
    this.unsubscribe = this.bridge.subscribe((state) => {
      this.syncState(state);
    });

    // Initialize with current state
    this.syncState(this.bridge.getState());
  }

  private createTables(): void {
    // Create 4 tables in a 2x2 grid
    const tablePositions = [
      { x: CANVAS_WIDTH * 0.25, y: CANVAS_HEIGHT * 0.35 },
      { x: CANVAS_WIDTH * 0.75, y: CANVAS_HEIGHT * 0.35 },
      { x: CANVAS_WIDTH * 0.25, y: CANVAS_HEIGHT * 0.55 },
      { x: CANVAS_WIDTH * 0.75, y: CANVAS_HEIGHT * 0.55 },
    ];

    tablePositions.forEach((pos, index) => {
      const table = new Table(this, pos.x, pos.y, index);
      this.tables.push(table);
    });
  }

  private syncState(state: GameState): void {
    this.syncVisitors(state);
    this.syncHeroes(state);
  }

  private syncVisitors(state: GameState): void {
    const directorVisitors = state.director.visitors;
    const currentVisitorIds = new Set(this.visitors.keys());

    // Create or update visitors
    for (const visitor of directorVisitors) {
      const existingVisitor = this.visitors.get(visitor.id);

      if (!existingVisitor) {
        // Create new visitor - assign to a random table
        const tableIndex = this.visitors.size % this.tables.length;
        const table = this.tables[tableIndex];
        if (table) {
          const newVisitor = new Visitor(this, visitor.id, table, visitor.type);
          this.visitors.set(visitor.id, newVisitor);
        }
      }

      currentVisitorIds.delete(visitor.id);
    }

    // Remove visitors that are no longer in state
    for (const visitorId of currentVisitorIds) {
      const visitor = this.visitors.get(visitorId);
      if (visitor) {
        visitor.destroy();
        this.visitors.delete(visitorId);
      }
    }
  }

  private syncHeroes(state: GameState): void {
    const order = state.heroes.order;
    const currentHeroIds = new Set(this.heroes.keys());

    // Create heroes that don't exist yet
    for (const heroId of order) {
      if (!this.heroes.has(heroId)) {
        const index = this.heroes.size;
        const x = 50 + (index % 4) * 80;
        const y = CANVAS_HEIGHT - 100;

        const hero = new Hero(this, x, y, heroId);
        this.heroes.set(heroId, hero);
      }
      currentHeroIds.delete(heroId);
    }

    // Remove heroes that are no longer in roster
    for (const heroId of currentHeroIds) {
      const hero = this.heroes.get(heroId);
      if (hero) {
        hero.destroy();
        this.heroes.delete(heroId);
      }
    }
  }

  override update(time: number, delta: number): void {
    // Run simulation tick every TICK_MS
    if (time - this.lastTickTime >= TICK_MS) {
      this.bridge.tick();
      this.lastTickTime = time;
    }

    // Update renderer
    this.tavernRenderer.update(time, delta);

    // Update visitors (for bobbing animation)
    for (const visitor of this.visitors.values()) {
      visitor.update(time, delta);
    }
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.tavernRenderer.destroy();

    // Clean up entities
    for (const visitor of this.visitors.values()) {
      visitor.destroy();
    }
    this.visitors.clear();

    for (const hero of this.heroes.values()) {
      hero.destroy();
    }
    this.heroes.clear();

    this.tables = [];
  }
}
