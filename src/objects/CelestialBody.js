import Phaser from 'phaser';
import { localizedField } from '../utils/localization.js';
import createHoverLabel from '../utils/createHoverLabel.js';

const colorValue = (hex) => Number.parseInt(hex.slice(1), 16);

export default class CelestialBody {
  constructor(scene, data, gameConfig, assets, language) {
    this.id = data.id;
    this.name = localizedField(data, 'name', language) ?? data.name;
    this.type = data.type;
    this.radius = data.visual.radius;
    this.worldPosition = data.worldPosition;
    this.proximityRadius = this.radius;
    this.data = data;
    this.palette = gameConfig.palette;
    this.scene = scene;
    this.container = scene.add.container(data.worldPosition.x, data.worldPosition.y);
    this.container.setDepth(this.type === 'star' ? 0 : 1);

    if (data.visual.stellar) {
      this.addStellarVisual(scene);
    } else {
      const glowColor = colorValue(this.palette.electric);
      const halo = scene.add.circle(0, 0, this.radius + 11, glowColor, 0.035);
      this.container.add(halo);

      if (data.visual.rings) this.addRings(scene, data.visual.rings);

      const imageAvailable = data.visual.imageId
        && assets.images.some((image) => image.id === data.visual.imageId)
        && scene.textures.exists(data.visual.imageId);

      if (imageAvailable) {
        const image = scene.add.image(0, 0, data.visual.imageId);
        image.setDisplaySize(this.radius * 2, this.radius * 2);
        this.container.add(image);
      } else {
        this.addPlaceholder(scene, data);
      }

      if (data.visual.rings) this.addFrontRing(scene, data.visual.rings);
    }

    const glowColor = colorValue(this.palette.electric);
    const ring = scene.add
      .circle(0, 0, this.radius + 8)
      .setStrokeStyle(gameConfig.visual.proximityRingWidth, glowColor, 0.85)
      .setVisible(false);
    this.highlight = ring;
    this.container.add(ring);

    createHoverLabel(
      scene,
      this.container,
      this.name,
      gameConfig,
      { x: 0, y: -this.radius - 20 },
      { x: 0, y: 0, radius: Math.max(this.radius, 14) },
    );
  }

  addStellarVisual(scene) {
    const corona = scene.add.circle(
      0,
      0,
      this.radius + 54,
      colorValue(this.palette.sunGlow),
      0.07,
    ).setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(corona);

    const rays = scene.add.graphics();
    const rayCount = 44;
    for (let index = 0; index < rayCount; index += 1) {
      const angle = index * Math.PI * 2 / rayCount;
      const innerRadius = this.radius * 0.98;
      const outerRadius = this.radius + (index % 2 === 0 ? 30 : 17);
      const halfWidth = index % 2 === 0 ? 0.025 : 0.018;
      const points = [
        new Phaser.Geom.Point(
          Math.cos(angle - halfWidth) * innerRadius,
          Math.sin(angle - halfWidth) * innerRadius,
        ),
        new Phaser.Geom.Point(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius),
        new Phaser.Geom.Point(
          Math.cos(angle + halfWidth) * innerRadius,
          Math.sin(angle + halfWidth) * innerRadius,
        ),
      ];
      rays.fillStyle(colorValue(this.palette.sunLight), index % 2 === 0 ? 0.24 : 0.14);
      rays.fillPoints(points, true);
    }
    rays.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(rays);

    const outerDisk = scene.add.circle(
      0,
      0,
      this.radius,
      colorValue(this.palette.sun),
      1,
    );
    const middleDisk = scene.add.circle(
      -this.radius * 0.04,
      -this.radius * 0.05,
      this.radius * 0.83,
      colorValue(this.palette.sunGlow),
      0.96,
    );
    const innerDisk = scene.add.circle(
      -this.radius * 0.09,
      -this.radius * 0.11,
      this.radius * 0.62,
      colorValue(this.palette.sunLight),
      0.9,
    );
    const core = scene.add.circle(
      -this.radius * 0.12,
      -this.radius * 0.14,
      this.radius * 0.34,
      colorValue(this.palette.sphereHighlight),
      0.28,
    );
    this.container.add([outerDisk, middleDisk, innerDisk, core]);

    const surface = scene.add.graphics();
    surface.lineStyle(2, colorValue(this.palette.sunLight), 0.18);
    surface.strokeCircle(0, 0, this.radius * 0.9);
    surface.lineStyle(1, colorValue(this.palette.sphereHighlight), 0.12);
    surface.strokeCircle(0, 0, this.radius * 0.75);
    this.container.add(surface);

    scene.tweens.add({
      targets: corona,
      alpha: { from: 0.06, to: 0.12 },
      scale: { from: 1, to: 1.035 },
      duration: 2600,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
  }

  addRings(scene, ringData) {
    const ring = scene.add.graphics();
    const outerRadiusX = this.radius * (1 + ringData.widthFactor);
    const outerRadiusY = this.radius * ringData.heightFactor;
    ring.lineStyle(Math.max(4, this.radius * 0.16), colorValue(this.palette[ringData.colorKey]), 0.78);
    ring.strokeEllipse(0, 0, outerRadiusX * 2, outerRadiusY * 2);
    ring.lineStyle(Math.max(2, this.radius * 0.06), colorValue(this.palette.text), 0.38);
    ring.strokeEllipse(0, 0, outerRadiusX * 1.68, outerRadiusY * 1.68);
    ring.setAngle(ringData.angleDegrees ?? 0);
    this.container.addAt(ring, 1);
  }

  addFrontRing(scene, ringData) {
    const radiusX = this.radius * (1 + ringData.widthFactor);
    const radiusY = this.radius * ringData.heightFactor;
    const points = [];

    for (let index = 0; index <= 36; index += 1) {
      const angle = Math.PI * index / 36;
      points.push(new Phaser.Geom.Point(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY));
    }

    const frontRing = scene.add.graphics();
    frontRing.lineStyle(Math.max(4, this.radius * 0.16), colorValue(this.palette[ringData.colorKey]), 0.9);
    frontRing.strokePoints(points, false);
    frontRing.lineStyle(Math.max(2, this.radius * 0.06), colorValue(this.palette.sphereHighlight), 0.56);
    frontRing.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x * 0.84, point.y * 0.84)), false);
    frontRing.setAngle(ringData.angleDegrees ?? 0);
    this.container.add(frontRing);
  }

  addPlaceholder(scene, data) {
    const visual = data.visual;
    const baseColor = colorValue(this.palette[visual.colorKey]);
    const body = visual.surfaceShape
      ? this.createIrregularBody(scene, visual.surfaceShape, baseColor)
      : scene.add.circle(0, 0, this.radius, baseColor);
    if (!visual.surfaceShape) {
      body.setStrokeStyle(Math.max(1, this.radius * 0.025), colorValue(this.palette.sphereHighlight), 0.28);
    }
    this.container.add(body);

    (visual.bands ?? []).forEach((band) => this.addBand(scene, band));
    (visual.surfaceFeatures ?? []).forEach((feature) => this.addSurfaceFeature(scene, feature, visual));
    this.addSphereLighting(scene);
  }

  createIrregularBody(scene, shape, fillColor) {
    const graphics = scene.add.graphics();
    const points = shape.map(([x, y]) => new Phaser.Geom.Point(x * this.radius, y * this.radius));
    graphics.fillStyle(fillColor, 1);
    graphics.fillPoints(points, true);
    graphics.lineStyle(Math.max(1, this.radius * 0.025), colorValue(this.palette.sphereHighlight), 0.3);
    graphics.strokePoints(points, true);
    return graphics;
  }

  addBand(scene, band) {
    const graphics = scene.add.graphics();
    const color = colorValue(this.palette[band.colorKey]);
    const halfThickness = band.thickness / 2;
    const extent = Math.min(0.96, Math.abs(band.y) + halfThickness + (band.wave ?? 0));
    const halfWidth = Math.sqrt(Math.max(0, 1 - extent * extent)) * this.radius;
    const upper = [];
    const lower = [];
    const segments = 36;

    for (let index = 0; index <= segments; index += 1) {
      const progress = index / segments;
      const x = Phaser.Math.Linear(-halfWidth, halfWidth, progress);
      const wave = Math.sin(progress * Math.PI * 3 + (band.phase ?? 0)) * (band.wave ?? 0);
      upper.push(new Phaser.Geom.Point(x, (band.y + wave - halfThickness) * this.radius));
      lower.unshift(new Phaser.Geom.Point(x, (band.y + wave + halfThickness) * this.radius));
    }

    graphics.fillStyle(color, band.alpha ?? 0.5);
    graphics.beginPath();
    graphics.moveTo(upper[0].x, upper[0].y);
    [...upper.slice(1), ...lower].forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.closePath();
    graphics.fillPath();
    this.container.add(graphics);
  }

  addSurfaceFeature(scene, feature, visual) {
    const featureColorKey = feature.colorKey ?? visual.surfaceFeaturesColorKey ?? visual.accentColorKey;
    const featureColor = featureColorKey ? colorValue(this.palette[featureColorKey]) : colorValue(this.palette.sphereHighlight);
    const alpha = feature.alpha ?? 0.48;
    const x = (feature.x ?? 0) * this.radius;
    const y = (feature.y ?? 0) * this.radius;

    if (feature.type === 'crater') {
      const craterRadius = feature.radius * this.radius;
      const rimColor = colorValue(this.palette[visual.surfaceRimColorKey ?? 'sphereHighlight']);
      const rim = scene.add.circle(x, y, craterRadius, rimColor, 0.48);
      const basin = scene.add.ellipse(
        x + craterRadius * 0.12,
        y + craterRadius * 0.18,
        craterRadius * 1.45,
        craterRadius * 1.32,
        featureColor,
        0.62,
      );
      const inner = scene.add.circle(x, y, craterRadius * 0.58, colorValue(this.palette.sphereShadow), 0.2);
      this.container.add([rim, basin, inner]);
      return;
    }

    if (feature.type === 'crack') {
      const crack = scene.add.graphics();
      const points = feature.points.map(([pointX, pointY]) => new Phaser.Geom.Point(
        pointX * this.radius,
        pointY * this.radius,
      ));
      crack.lineStyle(Math.max(1, (feature.width ?? 0.025) * this.radius), featureColor, alpha);
      crack.strokePoints(points, false);
      this.container.add(crack);
      return;
    }

    const width = (feature.width ?? feature.height ?? feature.radius * 2) * this.radius;
    const height = (feature.height ?? feature.width ?? feature.radius * 2) * this.radius;
    const detail = scene.add.ellipse(x, y, width, height, featureColor, alpha);
    detail.setRotation(Phaser.Math.DegToRad(feature.rotation ?? 0));
    this.container.add(detail);

    if (feature.type === 'cloud' || feature.type === 'storm') {
      const highlight = scene.add.ellipse(
        x - width * 0.08,
        y - height * 0.12,
        width * 0.72,
        Math.max(1, height * 0.28),
        colorValue(this.palette.sphereHighlight),
        alpha * 0.55,
      );
      highlight.setRotation(detail.rotation);
      this.container.add(highlight);
    }
  }

  addSphereLighting(scene) {
    const highlight = scene.add.ellipse(
      -this.radius * 0.24,
      -this.radius * 0.34,
      this.radius * 0.9,
      this.radius * 0.34,
      colorValue(this.palette.sphereHighlight),
      0.13,
    );
    const shadow = scene.add.ellipse(
      this.radius * 0.34,
      this.radius * 0.12,
      this.radius * 0.56,
      this.radius * 1.46,
      colorValue(this.palette.sphereShadow),
      0.28,
    );
    const edgeLight = scene.add
      .circle(0, 0, this.radius - Math.max(1, this.radius * 0.035))
      .setStrokeStyle(Math.max(1, this.radius * 0.025), colorValue(this.palette.sphereHighlight), 0.25);
    this.container.add([highlight, shadow, edgeLight]);
  }

  setHighlighted(value) {
    this.highlight.setVisible(value);
  }

  get x() {
    return this.container.x;
  }

  get y() {
    return this.container.y;
  }
}