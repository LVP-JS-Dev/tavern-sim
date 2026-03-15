import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingUI();
    this.setupLoadEvents();
    // Assets will be added in Chunk 7
  }

  private createLoadingUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Progress bar background
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    // Progress bar fill
    this.progressBar = this.add.graphics();

    // Loading text
    this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
  }

  private setupLoadEvents(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xffd700, 1);
      this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.progressBox.destroy();
    });
  }

  create(): void {
    // Start main scenes in parallel
    this.scene.start('TavernScene');
    this.scene.start('HUDScene');

    // Stop boot scene
    this.scene.stop();
  }
}
