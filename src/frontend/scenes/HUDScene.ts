import Phaser from 'phaser';

/**
 * HUDScene - Heads-Up Display overlay
 *
 * This scene runs in parallel with TavernScene and displays gold, time, and other UI elements.
 * Will be fully implemented in Chunk 6.
 */
export class HUDScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    const width = this.cameras.main.width;

    // Placeholder HUD bar at top
    this.add.rectangle(width / 2, 30, width, 60, 0x1a1a1a, 0.9);

    // Placeholder text
    this.add.text(width / 2, 30, 'HUD Scene (Placeholder)', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffd700',
    }).setOrigin(0.5, 0.5);

    console.log('[HUDScene] Initialized (placeholder)');
  }
}
