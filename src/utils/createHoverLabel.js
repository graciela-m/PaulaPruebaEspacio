import Phaser from 'phaser';

const colorValue = (hex) => Number.parseInt(hex.slice(1), 16);

export default function createHoverLabel(scene, target, name, gameConfig, position, hitArea) {
  const paddingX = 9;
  const paddingY = 5;
  const label = scene.add.text(0, 0, name, {
    fontFamily: gameConfig.visual.monoFontFamily,
    fontSize: `${gameConfig.visual.equipmentLabelFontSize}px`,
    color: gameConfig.palette.text,
    align: 'center',
    wordWrap: { width: 260 },
  }).setOrigin(0.5);
  const background = scene.add.rectangle(
    0,
    0,
    label.width + paddingX * 2,
    label.height + paddingY * 2,
    colorValue(gameConfig.palette.buttonFill),
    0.94,
  ).setStrokeStyle(1, colorValue(gameConfig.palette.electric), 0.65);
  const tooltip = scene.add.container(position.x, position.y, [background, label]).setVisible(false);

  target.add(tooltip);
  target.setInteractive({
    hitArea: new Phaser.Geom.Circle(hitArea.x, hitArea.y, hitArea.radius),
    hitAreaCallback: Phaser.Geom.Circle.Contains,
    useHandCursor: true,
  });
  target.on('pointerover', () => tooltip.setVisible(true));
  target.on('pointerout', () => tooltip.setVisible(false));

  return tooltip;
}
