import Phaser from 'phaser';

const colorValue = (hex) => Number.parseInt(hex.slice(1), 16);

export default function createStarfield(scene, config, options = {}) {
  const layers = config.world.starfield.layers;
  const { width, height } = options.worldSize ?? scene.scale.gameSize;
  const densityScale = options.densityScale ?? 1;
  const expandedWidth = options.worldSize ? width * 2 : width;
  const expandedHeight = options.worldSize ? height * 2 : height;
  const originX = options.worldSize ? -width / 2 : 0;
  const originY = options.worldSize ? -height / 2 : 0;
  const objects = [];

  layers.forEach((layer, layerIndex) => {
    const graphics = scene.add.graphics();
    const starCount = Math.round(layer.count * densityScale);
    for (let index = 0; index < starCount; index += 1) {
      const radius = Phaser.Math.FloatBetween(layer.minRadius, layer.maxRadius);
      const alpha = Phaser.Math.FloatBetween(layer.minAlpha, layer.maxAlpha);
      graphics.fillStyle(colorValue(config.palette.star), alpha);
      graphics.fillCircle(
        Phaser.Math.Between(0, expandedWidth),
        Phaser.Math.Between(0, expandedHeight),
        radius,
      );
    }
    graphics
      .setPosition(originX, originY)
      .setDepth(-100 + layerIndex)
      .setScrollFactor(layer.scrollFactor);
    objects.push(graphics);
  });

  const twinkleCount = Math.round(config.world.starfield.twinkleCount * densityScale);
  for (let index = 0; index < twinkleCount; index += 1) {
    const star = scene.add
      .circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.7, 1.6),
        colorValue(config.palette.star),
      )
      .setAlpha(Phaser.Math.FloatBetween(
        config.world.starfield.twinkleMinAlpha,
        config.world.starfield.twinkleMaxAlpha,
      ))
      .setDepth(-96)
      .setScrollFactor(1);

    scene.tweens.add({
      targets: star,
      alpha: config.world.starfield.twinkleMinAlpha,
      duration: Phaser.Math.Between(config.animation.starTwinkleMs, config.animation.starTwinkleMs * 2),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      delay: Phaser.Math.Between(0, config.animation.starTwinkleMs),
    });
    objects.push(star);
  }

  return objects;
}