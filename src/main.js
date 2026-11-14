import Phaser from 'phaser';
import gameConfig from './data/game-config.json';
import ExplorationScene from './scenes/ExplorationScene.js';
import SpaceScene from './scenes/SpaceScene.js';
import ConclusionScene from './scenes/ConclusionScene.js';
import './style.css';

document.documentElement.style.setProperty('--space-background', gameConfig.palette.background);

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: gameConfig.palette.background,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: gameConfig.resolution.width,
    height: gameConfig.resolution.height,
  },
  scene: [SpaceScene, ExplorationScene, ConclusionScene],
};

new Phaser.Game(config);