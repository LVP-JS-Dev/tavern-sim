import Phaser from 'phaser';

/**
 * TavernScene - Main gameplay scene
 *
 * This scene displays the tavern interior with heroes, visitors, and tables.
 * Will be fully implemented in Chunk 4.
 */
export class TavernScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TavernScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Placeholder background
    this.add.rectangle(width / 2, height / 2, width, height, 0x4a3728);

    // Placeholder text
    this.add.text(width / 2, height / 2, 'Tavern Scene\n(Placeholder)', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    console.log('[TavernScene] Initialized (placeholder)');
  }
}
