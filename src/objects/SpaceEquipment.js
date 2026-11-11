import Phaser from 'phaser';
import { localizedField } from '../utils/localization.js';

const colorValue = (hex) => Number.parseInt(hex.slice(1), 16);

export default class SpaceEquipment {
  constructor(scene, data, body, gameConfig, assets, language) {
    this.id = data.id;
    this.name = localizedField(data, 'name', language) ?? data.name;
    this.bodyId = data.celestialBodyId;
    this.data = data;
    this.proximityRadius = gameConfig.visual.markerRadius + 4;
    this.markerRadius = gameConfig.visual.markerRadius;
    this.container = scene.add.container(body.worldPosition.x, body.worldPosition.y);
    this.container.setDepth(4);

    const angle = Phaser.Math.DegToRad(data.surfaceOffset.angleDegrees);
    const markerDistance = body.radius * data.surfaceOffset.radiusFactor;
    this.localX = Math.cos(angle) * markerDistance;
    this.localY = Math.sin(angle) * markerDistance;

    const connector = scene.add.graphics();
    connector.lineStyle(1, colorValue(gameConfig.palette.muted), 0.52);
    connector.beginPath();
    connector.moveTo(Math.cos(angle) * body.radius * 0.62, Math.sin(angle) * body.radius * 0.62);
    connector.lineTo(this.localX, this.localY);
    connector.strokePath();
    this.container.add(connector);

    const glow = scene.add.circle(0, 0, this.markerRadius + 5, colorValue(gameConfig.palette.electric), 0.13);
    const highlight = scene.add
      .circle(0, 0, this.markerRadius + 8)
      .setStrokeStyle(gameConfig.visual.proximityRingWidth, colorValue(gameConfig.palette.proximity), 0.95)
      .setVisible(false);
    this.highlight = highlight;
    this.container.add([glow, highlight]);

    const imageAvailable = data.imageId
      && assets.images.some((image) => image.id === data.imageId)
      && scene.textures.exists(data.imageId);
    if (imageAvailable) {
      const image = scene.add.image(this.localX, this.localY, data.imageId);
      image.setDisplaySize(this.markerRadius * 2.5, this.markerRadius * 2.5);
      this.container.add(image);
    } else {
      const marker = scene.add
        .circle(this.localX, this.localY, this.markerRadius, colorValue(gameConfig.palette.proximity))
        .setStrokeStyle(1.4, colorValue(gameConfig.palette.background), 0.95);
      this.container.add(marker);
      const core = scene.add.circle(
        this.localX,
        this.localY,
        this.markerRadius * 0.34,
        colorValue(gameConfig.palette.background),
        0.9,
      );
      this.container.add(core);
    }

    const labelX = this.localX + data.labelOffset.x;
    const labelY = this.localY + data.labelOffset.y;
    const label = scene.add.text(labelX, labelY, this.name, {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.equipmentLabelFontSize}px`,
      color: gameConfig.palette.text,
      align: data.labelOffset.x < 0 ? 'right' : 'left',
      stroke: gameConfig.palette.background,
      strokeThickness: 4,
    }).setOrigin(data.labelOffset.x < 0 ? 1 : 0, 0.5);
    this.container.add(label);
  }

  get x() {
    return this.container.x + this.localX;
  }

  get y() {
    return this.container.y + this.localY;
  }

  setHighlighted(value) {
    this.highlight.setVisible(value);
  }
}