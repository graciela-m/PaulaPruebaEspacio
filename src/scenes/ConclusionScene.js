import Phaser from 'phaser';
import gameConfig from '../data/game-config.json';
import spacecraftData from '../data/spacecraft.json';
import createActionButton from '../utils/createActionButton.js';
import createStarfield from '../utils/createStarfield.js';
import Spacecraft from '../objects/Spacecraft.js';
import { getSavedLanguage, translate } from '../utils/localization.js';

export default class ConclusionScene extends Phaser.Scene {
  constructor() {
    super('ConclusionScene');
  }

  create() {
    this.language = getSavedLanguage();
    document.documentElement.lang = this.language;
    const { palette, visual, epilogue } = gameConfig;
    this.cameras.main.setBackgroundColor(palette.background);
    this.sequence = translate(this.language, 'conclusion.epilogue.scenes');
    this.sequenceIndex = 0;
    this.phraseIndex = 0;
    this.sequencePaused = false;
    this.sequenceFinished = false;
    this.sequenceTimer = null;
    this.sceneMotionTweens = [];
    this.stageTransitionTweens = [];

    this.worldRoot = this.add.container(0, 0).setDepth(-10);
    this.worldObjects = createStarfield(this, gameConfig);
    this.stageLayers = [0, 1, 2].map(() => this.add.container(0, 0).setAlpha(0));
    this.stageLayers.forEach((layer) => this.worldRoot.add(layer));
    this.createSilenceScene();
    this.createSurfaceScene();
    this.createLegacyScene();

    this.hud = this.add.container(0, 0).setDepth(1000);
    this.createNarrationHUD();
    this.createSequenceControls();
    this.createClosingControls();
    this.configureCameras();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.clearSequenceTimer();
      this.stopSceneMotion();
      this.tweens.killAll();
    });
    this.layout(this.scale.gameSize);
    this.cameras.main.fadeIn(gameConfig.animation.fadeMs, 0, 0, 0);
    this.showStage(0);
  }

  createSilenceScene() {
    const layer = this.stageLayers[0];
    this.drawDistantWorld(layer, 1000, 160, 92, 'uranus', 'uranusBand');
    const craftData = {
      ...spacecraftData,
      spawnPosition: { x: 630, y: 360 },
    };
    this.epilogueCraft = new Spacecraft(this, craftData, gameConfig);
    this.epilogueCraft.container.setRotation(-0.2);
    layer.add(this.epilogueCraft.container);

    layer.setScale(0.9).setPosition(64, 36);
    this.sceneMotionTweens.push(this.tweens.add({
      targets: layer,
      scale: 0.8,
      x: 128,
      y: 72,
      duration: gameConfig.epilogue.spacecraftDriftMs * 2,
      ease: 'Sine.InOut',
    }));
    this.sceneMotionTweens.push(this.tweens.add({
      targets: this.epilogueCraft.container,
      y: 338,
      rotation: 0.16,
      duration: gameConfig.epilogue.spacecraftDriftMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    }));
    this.sceneMotionTweens.push(this.tweens.add({
      targets: this.epilogueCraft.flame,
      alpha: 0.62,
      scaleY: 0.55,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    }));
  }

  createSurfaceScene() {
    const layer = this.stageLayers[1];
    const farTerrain = this.add.graphics();
    farTerrain.fillStyle(Number.parseInt(gameConfig.palette.marsDark.slice(1), 16), 0.48);
    farTerrain.fillPoints([
      new Phaser.Geom.Point(0, 470), new Phaser.Geom.Point(95, 422),
      new Phaser.Geom.Point(206, 452), new Phaser.Geom.Point(360, 378),
      new Phaser.Geom.Point(540, 442), new Phaser.Geom.Point(690, 390),
      new Phaser.Geom.Point(865, 438), new Phaser.Geom.Point(1040, 369),
      new Phaser.Geom.Point(1280, 432), new Phaser.Geom.Point(1280, 720),
      new Phaser.Geom.Point(0, 720),
    ], true);
    layer.add(farTerrain);

    const ridge = this.add.graphics();
    ridge.fillStyle(Number.parseInt(gameConfig.palette.mars.slice(1), 16), 0.48);
    ridge.fillPoints([
      new Phaser.Geom.Point(0, 516), new Phaser.Geom.Point(150, 484),
      new Phaser.Geom.Point(310, 505), new Phaser.Geom.Point(494, 450),
      new Phaser.Geom.Point(650, 492), new Phaser.Geom.Point(830, 450),
      new Phaser.Geom.Point(1006, 496), new Phaser.Geom.Point(1160, 456),
      new Phaser.Geom.Point(1280, 478), new Phaser.Geom.Point(1280, 720),
      new Phaser.Geom.Point(0, 720),
    ], true);
    layer.add(ridge);

    const ground = this.add.graphics();
    ground.fillStyle(Number.parseInt(gameConfig.palette.mars.slice(1), 16), 0.84);
    ground.fillPoints([
      new Phaser.Geom.Point(0, 560), new Phaser.Geom.Point(150, 528),
      new Phaser.Geom.Point(340, 548), new Phaser.Geom.Point(500, 520),
      new Phaser.Geom.Point(715, 546), new Phaser.Geom.Point(910, 514),
      new Phaser.Geom.Point(1100, 538), new Phaser.Geom.Point(1280, 514),
      new Phaser.Geom.Point(1280, 720), new Phaser.Geom.Point(0, 720),
    ], true);
    layer.add(ground);

    [
      { x: 220, y: 585, w: 105, h: 25 },
      { x: 980, y: 570, w: 148, h: 33 },
      { x: 1080, y: 655, w: 88, h: 20 },
    ].forEach((crater) => {
      const rim = this.add.ellipse(crater.x, crater.y, crater.w, crater.h, Number.parseInt(gameConfig.palette.marsRim.slice(1), 16), 0.34);
      const basin = this.add.ellipse(crater.x, crater.y - 2, crater.w * 0.72, crater.h * 0.5, Number.parseInt(gameConfig.palette.marsDark.slice(1), 16), 0.5);
      layer.add([rim, basin]);
    });

    this.drawRover(layer, 760, 502);
    this.sceneMotionTweens.push(this.tweens.add({
      targets: layer,
      x: -26,
      duration: gameConfig.epilogue.surfacePanMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    }));
  }

  drawRover(layer, x, y) {
    const rover = this.add.container(x, y);
    const dark = Number.parseInt(gameConfig.palette.sphereShadow.slice(1), 16);
    const metal = Number.parseInt(gameConfig.palette.metal.slice(1), 16);
    const hull = Number.parseInt(gameConfig.palette.spacecraftHull.slice(1), 16);
    const blue = Number.parseInt(gameConfig.palette.electric.slice(1), 16);

    [-34, 34].forEach((wheelX) => {
      const wheel = this.add.circle(wheelX, 15, 11, dark).setStrokeStyle(3, metal, 0.9);
      const hub = this.add.circle(wheelX, 15, 3.5, blue, 0.9);
      rover.add([wheel, hub]);
    });

    const frame = this.add.graphics();
    frame.lineStyle(4, metal, 1);
    frame.beginPath();
    frame.moveTo(-34, 15);
    frame.lineTo(-22, -3);
    frame.lineTo(22, -3);
    frame.lineTo(34, 15);
    frame.strokePath();
    frame.fillStyle(hull, 1);
    frame.fillPoints([
      new Phaser.Geom.Point(-22, -6), new Phaser.Geom.Point(-17, -23),
      new Phaser.Geom.Point(16, -23), new Phaser.Geom.Point(23, -6),
    ], true);
    frame.lineStyle(2, blue, 0.85);
    frame.strokeRect(-14, -21, 26, 13);
    frame.lineStyle(2, metal, 0.9);
    frame.beginPath();
    frame.moveTo(0, -23);
    frame.lineTo(8, -39);
    frame.lineTo(22, -43);
    frame.strokePath();
    frame.fillStyle(blue, 0.95);
    frame.fillCircle(23, -44, 3.4);
    rover.add(frame);
    layer.add(rover);
    this.sceneMotionTweens.push(this.tweens.add({
      targets: rover,
      y: y - 4,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    }));
  }

  createLegacyScene() {
    const layer = this.stageLayers[2];
    const glow = this.add.container(0, 0);
    [260, 210, 158, 118].forEach((radius, index) => {
      const color = index < 2 ? gameConfig.palette.sunCorona : gameConfig.palette.sunFlare;
      glow.add(this.add.circle(475, 390, radius, Number.parseInt(color.slice(1), 16), 0.1 - index * 0.012));
    });
    layer.add(glow);

    this.drawEarth(layer, 650, 510, 252);
    this.sunriseGlow = glow.setAlpha(0.2);
  }

  drawDistantWorld(layer, x, y, radius, baseKey, bandKey) {
    const planet = this.add.container(x, y);
    const base = Number.parseInt(gameConfig.palette[baseKey].slice(1), 16);
    const band = Number.parseInt(gameConfig.palette[bandKey].slice(1), 16);
    planet.add(this.add.circle(0, 0, radius + 10, Number.parseInt(gameConfig.palette.electric.slice(1), 16), 0.06));
    planet.add(this.add.circle(0, 0, radius, base).setStrokeStyle(2, Number.parseInt(gameConfig.palette.sphereHighlight.slice(1), 16), 0.22));
    planet.add(this.add.ellipse(-radius * 0.15, -radius * 0.28, radius * 1.48, radius * 0.34, band, 0.34));
    planet.add(this.add.ellipse(radius * 0.08, radius * 0.18, radius * 1.72, radius * 0.26, band, 0.2));
    planet.add(this.add.ellipse(radius * 0.35, radius * 0.12, radius * 0.62, radius * 1.55, Number.parseInt(gameConfig.palette.sphereShadow.slice(1), 16), 0.42));
    layer.add(planet);
    this.sceneMotionTweens.push(this.tweens.add({
      targets: planet,
      x: x - 36,
      y: y + 12,
      duration: 18000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    }));
  }

  drawEarth(layer, x, y, radius) {
    const earth = this.add.container(x, y);
    const ocean = Number.parseInt(gameConfig.palette.earth.slice(1), 16);
    const land = Number.parseInt(gameConfig.palette.earthLand.slice(1), 16);
    const clouds = Number.parseInt(gameConfig.palette.sphereHighlight.slice(1), 16);
    earth.add(this.add.circle(0, 0, radius + 16, Number.parseInt(gameConfig.palette.electric.slice(1), 16), 0.09));
    earth.add(this.add.circle(0, 0, radius, ocean).setStrokeStyle(3, clouds, 0.42));
    const continents = this.add.graphics();
    continents.fillStyle(land, 1);
    continents.fillPoints([
      new Phaser.Geom.Point(-166, -106), new Phaser.Geom.Point(-118, -158),
      new Phaser.Geom.Point(-61, -142), new Phaser.Geom.Point(-28, -91),
      new Phaser.Geom.Point(-66, -53), new Phaser.Geom.Point(-101, -32),
      new Phaser.Geom.Point(-131, -50), new Phaser.Geom.Point(-153, -24),
    ], true);
    continents.fillPoints([
      new Phaser.Geom.Point(-73, -12), new Phaser.Geom.Point(-29, 1),
      new Phaser.Geom.Point(-12, 49), new Phaser.Geom.Point(-31, 98),
      new Phaser.Geom.Point(-48, 147), new Phaser.Geom.Point(-74, 108),
      new Phaser.Geom.Point(-86, 57), new Phaser.Geom.Point(-105, 22),
    ], true);
    continents.fillPoints([
      new Phaser.Geom.Point(8, -133), new Phaser.Geom.Point(66, -156),
      new Phaser.Geom.Point(125, -137), new Phaser.Geom.Point(178, -103),
      new Phaser.Geom.Point(152, -61), new Phaser.Geom.Point(102, -58),
      new Phaser.Geom.Point(76, -21), new Phaser.Geom.Point(35, -44),
      new Phaser.Geom.Point(12, -82),
    ], true);
    continents.fillPoints([
      new Phaser.Geom.Point(89, 15), new Phaser.Geom.Point(126, -3),
      new Phaser.Geom.Point(153, 27), new Phaser.Geom.Point(140, 70),
      new Phaser.Geom.Point(117, 101), new Phaser.Geom.Point(92, 70),
    ], true);
    earth.add(continents);
    [
      [-72, -176, 175, 20, -0.3], [100, -102, 188, 19, 0.24],
      [-12, 16, 215, 22, -0.22], [83, 142, 175, 16, -0.18],
    ].forEach(([cx, cy, width, height, rotation]) => {
      const cloud = this.add.ellipse(cx, cy, width, height, clouds, 0.56);
      cloud.setRotation(rotation);
      earth.add(cloud);
    });
    earth.add(this.add.ellipse(radius * 0.37, radius * 0.11, radius * 0.72, radius * 1.72,
      Number.parseInt(gameConfig.palette.sphereShadow.slice(1), 16), 0.29));
    earth.add(this.add.circle(0, 0, radius - 3).setStrokeStyle(3, clouds, 0.2));
    layer.add(earth);
    this.sceneMotionTweens.push(this.tweens.add({
      targets: earth,
      rotation: 0.035,
      duration: 16000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    }));
  }

  createNarrationHUD() {
    const { palette, visual } = gameConfig;
    this.title = this.add.text(0, 0, translate(this.language, 'conclusion.title'), {
      fontFamily: visual.displayFontFamily, fontSize: `${visual.epilogueTitleFontSize}px`,
      fontStyle: 'bold', color: palette.text, align: 'center',
    }).setOrigin(0.5).setAlpha(0);
    this.narration = this.add.text(0, 0, '', {
      fontFamily: visual.bodyFontFamily, fontSize: `${visual.epiloguePhraseFontSize}px`,
      color: palette.text, align: 'center', lineSpacing: 8,
      stroke: palette.background, strokeThickness: 5, wordWrap: { width: 820 },
    }).setOrigin(0.5).setAlpha(0);
    this.brand = this.add.text(0, 0, `${gameConfig.title.primary}\n${gameConfig.title.secondary}`, {
      fontFamily: visual.monoFontFamily, fontSize: `${visual.epilogueSmallFontSize}px`,
      color: palette.text, align: 'center', lineSpacing: 5,
    }).setOrigin(0.5).setAlpha(0);
    this.thankYou = this.add.text(0, 0, translate(this.language, 'conclusion.thankYou'), {
      fontFamily: visual.bodyFontFamily, fontSize: `${visual.epilogueSmallFontSize}px`,
      color: palette.muted, align: 'center',
    }).setOrigin(0.5).setAlpha(0);
    this.hud.add([this.title, this.narration, this.brand, this.thankYou]);
  }

  createSequenceControls() {
    const make = (key, action) => createActionButton(this, {
      width: gameConfig.visual.epilogueButtonWidth,
      height: gameConfig.visual.epilogueButtonHeight,
      text: translate(this.language, key), palette: gameConfig.palette, visual: gameConfig.visual,
      onPress: action,
    });
    this.pauseButton = make('conclusion.epilogue.pause', () => this.toggleSequencePause());
    this.nextButton = make('conclusion.epilogue.nextScene', () => this.nextStage());
    this.skipButton = make('conclusion.epilogue.skipToEnd', () => this.finishSequence());
    [this.pauseButton, this.nextButton, this.skipButton].forEach((button) => {
      button.label.setFontSize(11).setLetterSpacing(0);
      this.hud.add(button.container);
    });
  }

  createClosingControls() {
    const make = (key, action) => createActionButton(this, {
      width: 260, height: 44, text: translate(this.language, key),
      palette: gameConfig.palette, visual: gameConfig.visual, onPress: action,
    });
    this.resumeButton = make('conclusion.resume', () => {
      this.scene.resume('ExplorationScene');
      this.scene.stop();
    });
    this.homeButton = make('conclusion.home', () => {
      this.scene.stop('ExplorationScene');
      this.scene.start('SpaceScene');
    });
    [this.resumeButton, this.homeButton].forEach((button) => {
      button.label.setFontSize(12).setLetterSpacing(0);
      button.container.setVisible(false);
      button.setEnabled(false);
      this.hud.add(button.container);
    });
  }

  configureCameras() {
    this.worldCamera = this.cameras.main;
    this.worldCamera.ignore(this.hud);
    this.hudCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.hudCamera.ignore([this.worldRoot, ...this.worldObjects]);
  }

  showStage(index) {
    if (this.sequenceFinished) return;
    this.clearSequenceTimer();
    this.tweens.killTweensOf([this.narration, this.title]);
    this.stageTransitionTweens.forEach((tween) => tween.stop());
    this.stageTransitionTweens = [];
    this.sequenceIndex = index;
    this.phraseIndex = 0;
    this.narration.setAlpha(0);
    this.title.setAlpha(0);
    const target = this.stageLayers[index];
    this.stageLayers.forEach((layer) => {
      if (layer !== target && layer.alpha > 0) {
        this.stageTransitionTweens.push(this.tweens.add({ targets: layer, alpha: 0, duration: gameConfig.epilogue.sceneTransitionMs }));
      } else if (layer !== target) {
        layer.setAlpha(0);
      }
    });
    target.setAlpha(0);
    this.stageTransitionTweens.push(this.tweens.add({ targets: target, alpha: 1, duration: gameConfig.epilogue.sceneTransitionMs }));
    if (index === 2) {
      this.tweens.add({ targets: this.title, alpha: 1, duration: gameConfig.epilogue.sceneTransitionMs });
      this.sunriseGlow.setAlpha(0.2);
      this.tweens.add({ targets: this.sunriseGlow, alpha: 1, duration: gameConfig.epilogue.earthDawnMs });
    }
    this.sequenceTimer = this.time.delayedCall(gameConfig.epilogue.sceneTransitionMs, () => this.showPhrase());
  }

  showPhrase() {
    if (this.sequenceFinished) return;
    const phrase = this.sequence[this.sequenceIndex].phrases[this.phraseIndex];
    this.narration.setText(phrase).setAlpha(0);
    this.tweens.add({
      targets: this.narration, alpha: 1, duration: gameConfig.epilogue.phraseFadeMs,
      hold: gameConfig.epilogue.phraseHoldMs, yoyo: true,
      onComplete: () => {
        this.sequenceTimer = this.time.delayedCall(gameConfig.epilogue.phraseGapMs, () => {
          this.phraseIndex += 1;
          if (this.phraseIndex < this.sequence[this.sequenceIndex].phrases.length) {
            this.showPhrase();
          } else if (this.sequenceIndex < this.sequence.length - 1) {
            this.showStage(this.sequenceIndex + 1);
          } else {
            this.finishSequence();
          }
        });
      },
    });
  }

  toggleSequencePause() {
    if (this.sequenceFinished) return;
    this.sequencePaused = !this.sequencePaused;
    this.time.paused = this.sequencePaused;
    if (this.sequencePaused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.pauseButton.label.setText(translate(this.language,
      this.sequencePaused ? 'conclusion.epilogue.resumeSequence' : 'conclusion.epilogue.pause'));
  }

  nextStage() {
    if (this.sequenceFinished) return;
    if (this.sequencePaused) this.toggleSequencePause();
    if (this.sequenceIndex < this.sequence.length - 1) this.showStage(this.sequenceIndex + 1);
    else this.finishSequence();
  }

  finishSequence() {
    if (this.sequenceFinished) return;
    if (this.sequencePaused) this.toggleSequencePause();
    this.clearSequenceTimer();
    this.tweens.killTweensOf([this.narration, this.title]);
    this.stageTransitionTweens.forEach((tween) => tween.stop());
    this.stageTransitionTweens = [];
    this.sequenceFinished = true;
    this.sequenceIndex = 2;
    this.narration.setAlpha(0);
    this.stageLayers.forEach((layer, index) => layer.setAlpha(index === 2 ? 1 : 0));
    this.title.setAlpha(1);
    [this.pauseButton, this.nextButton, this.skipButton].forEach((button) => {
      button.setEnabled(false);
      button.container.setVisible(false);
    });
    [this.resumeButton, this.homeButton].forEach((button) => {
      button.container.setVisible(true);
      button.setEnabled(true);
    });
    this.tweens.add({ targets: [this.brand, this.thankYou], alpha: 1, duration: gameConfig.epilogue.phraseFadeMs });
  }

  clearSequenceTimer() {
    this.sequenceTimer?.remove(false);
    this.sequenceTimer = null;
  }

  stopSceneMotion() {
    this.sceneMotionTweens.forEach((tween) => tween.stop());
    this.sceneMotionTweens = [];
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    const scale = Math.min(width / 1280, height / 720) * (width < 650 ? 1.7 : 1);
    this.worldRoot.setScale(scale).setPosition((width - 1280 * scale) / 2, (height - 720 * scale) / 2);
    this.hudCamera.setViewport(0, 0, width, height);
    this.title.setPosition(width / 2, height * 0.14).setFontSize(width < 600 ? 22 : gameConfig.visual.epilogueTitleFontSize);
    this.narration.setPosition(width / 2, height * 0.72)
      .setFontSize(width < 600 ? 18 : gameConfig.visual.epiloguePhraseFontSize)
      .setWordWrapWidth(Math.max(100, Math.min(820, width - 40)), true);
    this.brand.setPosition(width / 2, height * 0.32);
    this.thankYou.setPosition(width / 2, height * 0.41);
    const compact = width < 650;
    const controlWidth = Math.min(gameConfig.visual.epilogueButtonWidth, (width - 32) / 3 - 6);
    [this.pauseButton, this.nextButton, this.skipButton].forEach((button, index) => {
      button.setSize(controlWidth, 42);
      button.label.setFontSize(compact ? 9 : 11);
      button.container.setPosition(width / 2 + (index - 1) * (controlWidth + 6), height - 30);
    });
    const closingWidth = Math.min(260, compact ? width - 40 : (width - 60) / 2);
    [this.resumeButton, this.homeButton].forEach((button, index) => {
      button.setSize(closingWidth, 44);
      button.label.setFontSize(compact ? 10 : 12);
      button.container.setPosition(compact ? width / 2 : width / 2 + (index === 0 ? -1 : 1) * (closingWidth / 2 + 8),
        compact ? height - 92 + index * 52 : height - 44);
    });
  }
}