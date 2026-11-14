import Phaser from 'phaser';
import { localizedField } from '../utils/localization.js';
import createHoverLabel from '../utils/createHoverLabel.js';

const colorValue = (hex) => Number.parseInt((hex ?? '#ffffff').slice(1), 16);

export default class SpaceEquipment {
  constructor(scene, data, body, gameConfig, assets, language) {
    this.scene = scene;
    this.id = data.id;
    this.name = localizedField(data, 'name', language) ?? data.name;
    this.bodyId = data.celestialBodyId;
    this.data = data;
    this.markerRadius = 8;
    this.proximityRadius = this.markerRadius + 3;
    this.timelineVisible = true;
    this.orbitalViewVisible = false;

    const hasWorldPosition = data.missionCategory === 'deep-space' && data.worldPosition;
    this.container = scene.add.container(
      hasWorldPosition ? data.worldPosition.x : body.worldPosition.x,
      hasWorldPosition ? data.worldPosition.y : body.worldPosition.y,
    );
    this.container.setDepth(4);

    const angle = hasWorldPosition
      ? 0
      : Phaser.Math.DegToRad(data.surfaceOffset.angleDegrees);
    const markerDistance = hasWorldPosition ? 0 : body.radius * data.surfaceOffset.radiusFactor;
    this.localX = hasWorldPosition ? 0 : Math.cos(angle) * markerDistance;
    this.localY = hasWorldPosition ? 0 : Math.sin(angle) * markerDistance;

    const glow = scene.add.circle(
      this.localX,
      this.localY,
      this.markerRadius + 0.5,
      colorValue(gameConfig.palette.electric),
      0.1,
    ).setBlendMode(Phaser.BlendModes.ADD);
    this.glow = glow;

    const highlight = scene.add
      .circle(this.localX, this.localY, this.markerRadius + 2)
      .setStrokeStyle(gameConfig.visual.proximityRingWidth ?? 2, colorValue(gameConfig.palette.proximity), 0.95)
      .setVisible(false);
    this.highlight = highlight;
    this.container.add([glow, highlight]);

    const beacon = scene.add.graphics();
    beacon.lineStyle(1, colorValue(gameConfig.palette.proximity), 0.7);
    beacon.strokeCircle(this.localX, this.localY, 5);
    beacon.fillStyle(colorValue(gameConfig.palette.electric), 0.85);
    beacon.fillCircle(this.localX, this.localY, 1.8);
    this.container.add(beacon);
    this.orbitIndicator = beacon;

    this.deepSpacePulses = [];
    if (data.missionCategory === 'deep-space') {
      [0, 1, 2].forEach((index) => {
        const pulse = scene.add.circle(
          this.localX,
          this.localY,
          18,
        ).setStrokeStyle(
          index === 0 ? 1.6 : 1.1,
          colorValue(index === 1 ? gameConfig.palette.electric : gameConfig.palette.proximity),
          0.9,
        ).setAlpha(0).setScale(0.35);
        this.deepSpacePulses.push(pulse);
        this.container.add(pulse);
        scene.tweens.add({
          targets: pulse,
          alpha: { from: 0.8, to: 0 },
          scale: { from: 0.35, to: 1.8 },
          duration: 2100,
          delay: index * 700,
          repeat: -1,
          ease: 'Sine.Out',
        });
      });

      this.deepSpaceBeacon = scene.add.circle(
        this.localX + (this.id === 'voyager-1' ? 39 : -39),
        this.localY - 21,
        2.8,
        colorValue(gameConfig.palette.sunFlare),
        1,
      ).setBlendMode(Phaser.BlendModes.ADD);
      this.container.add(this.deepSpaceBeacon);
      scene.tweens.add({
        targets: this.deepSpaceBeacon,
        alpha: { from: 1, to: 0.3 },
        scale: { from: 1, to: 1.5 },
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    this.machineSilhouette = scene.add.graphics().setAlpha(0).setVisible(false);
    this.drawMachineSilhouette(this.machineSilhouette, gameConfig);
    if (data.missionCategory === 'deep-space') {
      this.machineSilhouette.setAlpha(1).setVisible(true);
      this.orbitIndicator.setAlpha(0.18);
    }
    this.container.add(this.machineSilhouette);

    this.timelinePulse = scene.add.circle(this.localX, this.localY, this.markerRadius + 2)
      .setStrokeStyle(1.2, colorValue(gameConfig.palette.proximity), 0.9)
      .setAlpha(0)
      .setScale(0.55)
      .setVisible(false);
    this.container.add(this.timelinePulse);

    // Etiquetas flotantes al pasar el cursor (hover)
    createHoverLabel(
      scene,
      this.container,
      this.name,
      gameConfig,
      { x: this.localX, y: this.localY - this.markerRadius - 16 },
      {
        x: this.localX,
        y: this.localY,
        radius: this.markerRadius * 2.6,
      },
    );
  }

  drawMachineSilhouette(graphics, gameConfig) {
    const x = this.localX;
    const y = this.localY;
    const palette = gameConfig.palette;
    const lineColor = colorValue(palette.text);
    const detailColor = colorValue(palette.electric);
    const metalColor = colorValue(palette.metal);
    const goldColor = colorValue(palette.sunFlare);
    const shadowColor = colorValue(palette.background);

    const stroke = (points, color = lineColor, width = 2, alpha = 0.95) => {
      graphics.lineStyle(width, color, alpha);
      graphics.beginPath();
      graphics.moveTo(x + points[0][0], y + points[0][1]);
      points.slice(1).forEach(([pointX, pointY]) => {
        graphics.lineTo(x + pointX, y + pointY);
      });
      graphics.strokePath();
    };

    const fillPolygon = (points, fillColor = detailColor, alpha = 0.96) => {
      graphics.fillStyle(fillColor, alpha);
      graphics.beginPath();
      graphics.moveTo(x + points[0][0], y + points[0][1]);
      points.slice(1).forEach(([pointX, pointY]) => {
        graphics.lineTo(x + pointX, y + pointY);
      });
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(1.5, lineColor, 0.95);
      graphics.strokePath();
    };

    const wheel = (wheelX, wheelY, radius = 5) => {
      graphics.fillStyle(shadowColor, 1);
      graphics.fillCircle(x + wheelX, y + wheelY, radius);
      graphics.lineStyle(1.5, lineColor, 1);
      graphics.strokeCircle(x + wheelX, y + wheelY, radius);
      graphics.lineStyle(1, metalColor, 1);
      graphics.strokeCircle(x + wheelX, y + wheelY, radius * 0.66);
      graphics.lineStyle(1, detailColor, 0.95);
      for (let spoke = 0; spoke < 4; spoke += 1) {
        const angle = spoke * Math.PI / 2;
        graphics.beginPath();
        graphics.moveTo(
          x + wheelX + Math.cos(angle) * radius * 0.22,
          y + wheelY + Math.sin(angle) * radius * 0.22,
        );
        graphics.lineTo(
          x + wheelX + Math.cos(angle) * radius * 0.62,
          y + wheelY + Math.sin(angle) * radius * 0.62,
        );
        graphics.strokePath();
      }
      graphics.fillStyle(goldColor, 0.95);
      graphics.fillCircle(x + wheelX, y + wheelY, radius * 0.18);
    };

    const panel = (panelX, panelY, width, height, columns = 5, rows = 3) => {
      graphics.fillStyle(shadowColor, 0.98);
      graphics.fillRect(x + panelX - width / 2, y + panelY - height / 2, width, height);
      graphics.lineStyle(1.5, lineColor, 0.96);
      graphics.strokeRect(x + panelX - width / 2, y + panelY - height / 2, width, height);
      graphics.lineStyle(0.8, detailColor, 0.92);
      for (let column = 1; column < columns; column += 1) {
        const cellX = panelX - width / 2 + width * column / columns;
        graphics.beginPath();
        graphics.moveTo(x + cellX, y + panelY - height / 2 + 1);
        graphics.lineTo(x + cellX, y + panelY + height / 2 - 1);
        graphics.strokePath();
      }
      for (let row = 1; row < rows; row += 1) {
        const cellY = panelY - height / 2 + height * row / rows;
        graphics.beginPath();
        graphics.moveTo(x + panelX - width / 2 + 1, y + cellY);
        graphics.lineTo(x + panelX + width / 2 - 1, y + cellY);
        graphics.strokePath();
      }
    };

    const roverChassis = ({ width, wheels, wheelRadius }) => {
      fillPolygon([[-width / 2, -7], [width / 2, -7], [width / 2 - 6, 5], [-width / 2 + 6, 5]], metalColor);
      stroke([[-width / 2 + 4, 2], [width / 2 - 4, 2]], lineColor, 1.8);
      const halfWheels = wheels / 2;
      for (let i = 0; i < halfWheels; i++) {
        const wx = -width / 2 + 8 + i * ((width - 16) / (halfWheels - 1 || 1));
        wheel(wx, 12, wheelRadius);
        wheel(wx, -12, wheelRadius);
      }
    };

    const cameraMast = (mastY = -27) => {
      stroke([[0, -6], [0, mastY]], metalColor, 2.4);
      stroke([[-4, mastY], [4, mastY]], lineColor, 2.4);
      graphics.fillStyle(detailColor, 1);
      graphics.fillCircle(x - 4, y + mastY, 2.1);
      graphics.fillStyle(goldColor, 1);
      graphics.fillCircle(x + 4, y + mastY, 2.1);
    };

    if (this.id === 'apollo-11-descent-stage') {
      fillPolygon([[-14, -8], [-9, -18], [9, -18], [14, -8], [11, 3], [0, 10], [-11, 3]], goldColor);
      fillPolygon([[-8, -14], [8, -14], [10, -5], [0, 2], [-10, -5]], metalColor);
      fillPolygon([[-5, -13], [5, -13], [4, -7], [-4, -7]], detailColor);
      stroke([[-10, -4], [-27, 8], [-34, 20]], lineColor, 2.4);
      stroke([[10, -4], [27, 8], [34, 20]], lineColor, 2.4);
      stroke([[-9, 2], [-25, 16], [-33, 22]], metalColor, 2);
      stroke([[9, 2], [25, 16], [33, 22]], metalColor, 2);
      stroke([[-36, 22], [-28, 22]], lineColor, 2.5);
      stroke([[28, 22], [36, 22]], lineColor, 2.5);
      stroke([[-14, -8], [-21, -2], [-25, -2]], goldColor, 1.5);
      stroke([[14, -8], [21, -2], [25, -2]], goldColor, 1.5);
      stroke([[0, -17], [0, -31], [8, -35]], lineColor, 2);
      graphics.fillStyle(detailColor, 1);
      graphics.fillCircle(x + 8, y - 35, 3.2);
      graphics.fillStyle(goldColor, 1);
      graphics.fillCircle(x - 7, y - 2, 2);
      graphics.fillCircle(x + 7, y - 2, 2);
      return;
    }

    if (this.id === 'insight') {
      panel(-26, -5, 23, 31, 4, 5);
      panel(26, -5, 23, 31, 4, 5);
      stroke([[-14, -5], [-8, -5]], lineColor, 2);
      stroke([[14, -5], [8, -5]], lineColor, 2);
      fillPolygon([[-12, -9], [12, -9], [15, 5], [7, 11], [-7, 11], [-15, 5]], metalColor);
      fillPolygon([[-6, -7], [6, -7], [8, 0], [-8, 0]], goldColor);
      stroke([[5, 7], [18, 19], [27, 21]], lineColor, 2.2);
      stroke([[18, 19], [22, 24]], detailColor, 2);
      stroke([[-8, 8], [-18, 17]], lineColor, 2);
      stroke([[8, 8], [18, 17]], lineColor, 2);
      wheel(-19, 20, 3.2);
      wheel(19, 20, 3.2);
      cameraMast(-22);
      graphics.fillStyle(detailColor, 0.95);
      graphics.fillCircle(x + 4, y + 3, 2);
      return;
    }

    if (this.id === 'voyager-1' || this.id === 'voyager-2') {
      const direction = this.id === 'voyager-1' ? -1 : 1;
      const dishColor = colorValue(palette.sphereHighlight);
      graphics.fillStyle(shadowColor, 0.98);
      graphics.fillCircle(x, y, 14);
      graphics.lineStyle(2.2, lineColor, 1);
      graphics.strokeCircle(x, y, 14);
      graphics.lineStyle(1.2, detailColor, 0.95);
      graphics.beginPath();
      graphics.moveTo(x - 10, y - 10);
      graphics.lineTo(x + 10, y + 10);
      graphics.strokePath();
      graphics.fillStyle(metalColor, 1);
      graphics.fillRect(x - 8, y - 5, 16, 10);
      graphics.lineStyle(1.5, lineColor, 1);
      graphics.strokeRect(x - 8, y - 5, 16, 10);
      graphics.fillStyle(goldColor, 1);
      graphics.fillCircle(x, y, 3.2);
      stroke([[direction * 8, 0], [direction * 25, -9], [direction * 34, -9]], lineColor, 2);
      stroke([[direction * 8, 3], [direction * 21, 12], [direction * 28, 12]], metalColor, 2);
      stroke([[-4, -5], [-12, -16], [-19, -20]], detailColor, 2);
      graphics.fillStyle(dishColor, 0.95);
      graphics.fillCircle(x + direction * 34, y - 9, 3);
      graphics.fillStyle(goldColor, 0.95);
      graphics.fillCircle(x + direction * 28, y + 12, 2.4);
      graphics.lineStyle(1.6, lineColor, 0.95);
      graphics.beginPath();
      graphics.moveTo(x - 19, y - 20);
      graphics.lineTo(x - 30, y - 31);
      graphics.lineTo(x - 36, y - 27);
      graphics.strokePath();
      graphics.lineStyle(1, detailColor, 0.95);
      graphics.strokeCircle(x - 30, y - 29, 6);
      graphics.lineStyle(1.5, lineColor, 0.9);
      graphics.beginPath();
      graphics.moveTo(x - 30, y - 35);
      graphics.lineTo(x - 30, y - 23);
      graphics.moveTo(x - 36, y - 29);
      graphics.lineTo(x - 24, y - 29);
      graphics.strokePath();
      return;
    }

    if (this.id === 'apollo-15-lrv') {
      stroke([[-34, 7], [34, 7]], metalColor, 2.5);
      stroke([[-25, 2], [-17, -8], [17, -8], [26, 2]], lineColor, 1.8);
      fillPolygon([[-14, -8], [-8, -17], [8, -17], [14, -8]], goldColor);
      stroke([[-10, -7], [-12, -15]], detailColor, 1.4);
      stroke([[10, -7], [12, -15]], detailColor, 1.4);
      [-24, -8, 8, 24].forEach((wheelX) => {
        stroke([[wheelX, 4], [wheelX, 14]], lineColor, 1.8);
        wheel(wheelX, 17, 5);
      });
      stroke([[-29, 0], [-35, -5]], detailColor, 1.2);
      stroke([[29, 0], [35, -5]], detailColor, 1.2);
      cameraMast(-27);
      return;
    }

    if (this.id === 'sojourner') {
      panel(-26, -3, 18, 18, 3, 3);
      roverChassis({ width: 43, wheels: 6, wheelRadius: 3.5 });
      stroke([[-4, -7], [-5, -22], [2, -25]], lineColor, 2);
      graphics.fillStyle(goldColor, 1);
      graphics.fillCircle(x + 2, y - 25, 2.4);
      stroke([[16, 0], [22, -9], [28, -11]], detailColor, 1.5);
      return;
    }

    panel(0, -5, 35, 22, 5, 3);
    roverChassis({ width: 59, wheels: 6, wheelRadius: 4.6 });
    cameraMast(-31);
    stroke([[-20, 3], [-25, 9]], detailColor, 1.4);
    stroke([[20, 3], [25, 9]], detailColor, 1.4);
    fillPolygon([[-6, -13], [6, -13], [4, -9], [-4, -9]], goldColor);
    graphics.fillStyle(detailColor, 1);
    graphics.fillCircle(x - 4, y - 31, 2.4);
    graphics.fillStyle(goldColor, 1);
    graphics.fillCircle(x + 4, y - 31, 2.4);
  }

  setOrbitalView(value, zoom = 1) {
    if (this.data.missionCategory === 'deep-space') return;

    const iconScale = value ? Phaser.Math.Clamp(1 / zoom, 0.06, 1) : 1;
    if (this.orbitalViewVisible === value && this.orbitalIconScale === iconScale) return;
    this.orbitalViewVisible = value;
    this.orbitalIconScale = iconScale;
    this.scene.tweens.killTweensOf(this.machineSilhouette);
    this.scene.tweens.killTweensOf(this.orbitIndicator);

    if (value) {
      const startScale = iconScale * 0.65;
      this.glow.setScale(iconScale);
      this.highlight.setScale(iconScale);
      this.orbitIndicator
        .setPosition(this.localX * (1 - iconScale), this.localY * (1 - iconScale))
        .setScale(iconScale);
      this.timelinePulse.setScale(iconScale);
      this.machineSilhouette
        .setPosition(this.localX * (1 - startScale), this.localY * (1 - startScale))
        .setVisible(true)
        .setAlpha(0)
        .setScale(startScale);
      this.scene.tweens.add({
        targets: this.machineSilhouette,
        alpha: 1,
        scaleX: iconScale,
        scaleY: iconScale,
        x: this.localX * (1 - iconScale),
        y: this.localY * (1 - iconScale),
        duration: 420,
        ease: 'Back.Out',
      });
      this.scene.tweens.add({
        targets: this.orbitIndicator,
        alpha: 0.22,
        duration: 260,
        ease: 'Sine.Out',
      });
      return;
    }

    this.scene.tweens.add({
      targets: this.machineSilhouette,
      alpha: 0,
      scaleX: iconScale * 0.72,
      scaleY: iconScale * 0.72,
      duration: 240,
      ease: 'Sine.In',
      onComplete: () => {
        this.machineSilhouette.setVisible(false).setPosition(0, 0).setScale(1);
        this.glow.setScale(1);
        this.highlight.setScale(1);
        this.orbitIndicator.setPosition(0, 0).setScale(1);
        this.timelinePulse.setScale(0.55);
      },
    });
    this.scene.tweens.add({
      targets: this.orbitIndicator,
      alpha: 1,
      duration: 300,
      ease: 'Sine.Out',
    });
  }

  setTimelineVisible(value, animate = true) {
    if (this.timelineVisible === value) return;
    this.timelineVisible = value;
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this.timelinePulse);

    if (!value) {
      if (!animate) {
        this.container.setVisible(false).setAlpha(1).setScale(1);
        return;
      }

      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        scale: 0.78,
        duration: 180,
        ease: 'Sine.In',
        onComplete: () => this.container.setVisible(false).setAlpha(1).setScale(1),
      });
      return;
    }

    this.container.setVisible(true).setAlpha(0).setScale(0.78);
    if (!animate) {
      this.container.setAlpha(1).setScale(1);
      return;
    }

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 380,
      ease: 'Back.Out',
    });
    this.timelinePulse.setVisible(true).setAlpha(0.85).setScale(0.55);
    this.scene.tweens.add({
      targets: this.timelinePulse,
      alpha: 0,
      scale: 2.2,
      duration: 720,
      ease: 'Sine.Out',
      onComplete: () => this.timelinePulse.setVisible(false).setScale(0.55),
    });
  }

  setHighlighted(value) {
    this.highlight.setVisible(value);
  }
}