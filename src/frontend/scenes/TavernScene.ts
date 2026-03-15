import Phaser from 'phaser';
import { getBridge } from '../index';
import { TICK_MS } from '../config';
import { TavernRenderer } from '../renderer/TavernRenderer';
import type { StateBridge } from '../bridge';

export class TavernScene extends Phaser.Scene {
  private bridge!: StateBridge;
  private unsubscribe?: () => void;
  private tavernRenderer!: TavernRenderer;
  private lastTickTime = 0;

  constructor() {
    super({ key: 'TavernScene' });
  }

  create(): void {
    this.bridge = getBridge();

    // Initialize renderer
    this.tavernRenderer = new TavernRenderer(this);
    this.tavernRenderer.render();

    // Subscribe to state changes
    this.unsubscribe = this.bridge.subscribe((state) => {
      this.syncState(state);
    });

    // Initialize with current state
    this.syncState(this.bridge.getState());
  }

  private syncState(_state: unknown): void {
    // Will sync visitors and heroes in Chunk 5
  }

  override update(time: number, delta: number): void {
    // Run simulation tick every TICK_MS
    if (time - this.lastTickTime >= TICK_MS) {
      this.bridge.tick();
      this.lastTickTime = time;
    }

    // Update renderer
    this.tavernRenderer.update(time, delta);
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.tavernRenderer.destroy();
  }
}
