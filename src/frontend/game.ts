import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { TavernScene } from './scenes/TavernScene';
import { HUDScene } from './scenes/HUDScene';

export function createGame(parent: string | HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#2d1b1b',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, TavernScene, HUDScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
    },
  };

  return new Phaser.Game(config);
}
