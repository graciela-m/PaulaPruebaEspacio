import Phaser from 'phaser';
import assetsManifest from '../data/assets.json';
import assetsUrl from '../data/assets.json?url&no-inline';
import gameConfig from '../data/game-config.json';
import equipmentUrl from '../data/equipment.json?url&no-inline';
import moonsUrl from '../data/moons.json?url&no-inline';
import planetsUrl from '../data/planets.json?url&no-inline';
import sunUrl from '../data/sun.json?url&no-inline';
import spacecraftUrl from '../data/spacecraft.json?url&no-inline';
import CelestialBody from '../objects/CelestialBody.js';
import SpaceEquipment from '../objects/SpaceEquipment.js';
import Spacecraft from '../objects/Spacecraft.js';
import createStarfield from '../utils/createStarfield.js';
import createActionButton from '../utils/createActionButton.js';
import { getSavedLanguage, localizedAssetCaption, localizedField, translate } from '../utils/localization.js';

export default class ExplorationScene extends Phaser.Scene {
  constructor() {
    super('ExplorationScene');
  }

  preload() {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
      console.error(`[ExplorationScene] No se pudo cargar ${file.key}: ${file.src}`);
    });

    this.load.json('explorationAssets', assetsUrl);
    this.load.json('spacecraftData', spacecraftUrl);
    this.load.json('planetsData', planetsUrl);
    this.load.json('moonsData', moonsUrl);
    this.load.json('equipmentData', equipmentUrl);
    this.load.json('sunData', sunUrl);

    assetsManifest.images.forEach((image) => {
      if (image.id && image.path) this.load.image(image.id, image.path);
    });
  }

  create() {
    this.cameras.main.setBackgroundColor(gameConfig.palette.background);
    this.assets = this.cache.json.get('explorationAssets');
    this.spacecraftData = this.cache.json.get('spacecraftData');
    this.planetsData = this.cache.json.get('planetsData');
    this.moonsData = this.cache.json.get('moonsData');
    this.equipmentData = this.cache.json.get('equipmentData');
    this.sunData = this.cache.json.get('sunData');
    this.language = getSavedLanguage();
    const requiredData = {
      explorationAssets: this.assets,
      spacecraftData: this.spacecraftData,
      planetsData: this.planetsData,
      moonsData: this.moonsData,
      equipmentData: this.equipmentData,
      sunData: this.sunData,
    };
    const missingData = Object.entries(requiredData)
      .filter(([, value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missingData.length > 0) {
      throw new Error(`[ExplorationScene] Faltan datos JSON: ${missingData.join(', ')}`);
    }

    this.worldBounds = {
      x: 0,
      y: 0,
      width: gameConfig.world.width,
      height: gameConfig.world.height,
    };
    this.worldObjects = [];
    this.celestialBodies = new Map();
    this.equipmentMarkers = [];
    this.discoveredIds = new Set();
    this.activeTarget = null;
    this.infoPopupTarget = null;
    this.infoPopupOpen = false;

    this.worldObjects.push(...createStarfield(this, gameConfig, {
      worldSize: { width: this.worldBounds.width, height: this.worldBounds.height },
    }));
    this.createCelestialBodies();
    this.createEquipmentMarkers();
    this.spacecraft = new Spacecraft(this, this.spacecraftData, gameConfig);
    this.worldObjects.push(this.spacecraft.container);
    this.targets = [
      ...this.celestialBodies.values(),
      ...this.equipmentMarkers,
    ];

    console.info('[ExplorationScene] Nave creada', {
      id: this.spacecraftData.id,
      position: { x: this.spacecraft.x, y: this.spacecraft.y },
      planets: this.planetsData.objects.length,
      moons: this.moonsData.objects.length,
      equipment: this.equipmentMarkers.length,
    });

    this.configureControls();
    this.createHUD();
    this.configureCameras();
    this.layoutHUD(this.scale.gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });

    this.cameras.main.fadeIn(gameConfig.animation.fadeMs, 0, 0, 0);
  }

  createCelestialBodies() {
    const scale = gameConfig.world.coordinateSystem;
    const planetScale = scale.planetDiameter;
    const moonScale = scale.moonDiameter;
    this.createSun();

    this.planetsData.objects.forEach((data) => {
      // Square-root compression maps mean solar distance to playable radial distance.
      const worldPosition = {
        ...this.getSolarMapPosition(data.distanceFromSunKm, data.visualAngleDegrees),
      };
      const radius = Phaser.Math.Clamp(
        planetScale.referenceVisualRadius
          * (data.diameterKm / planetScale.referenceDiameterKm) ** planetScale.diameterExponent
          * (data.visual.radiusScale ?? 1),
        planetScale.minimumVisualRadius,
        planetScale.maximumVisualRadius,
      );

      const body = new CelestialBody(this, {
        ...data,
        worldPosition,
        visual: { ...data.visual, radius },
      }, gameConfig, this.assets, this.language);

      this.celestialBodies.set(body.id, body);
      this.worldObjects.push(body.container);
    });

    const orbitScale = scale.moonOrbit;
    this.moonsData.objects.forEach((data) => {
      const parent = this.celestialBodies.get(data.parentId);
      if (!parent) {
        console.error(`[ExplorationScene] Planeta padre no encontrado para ${data.id}: ${data.parentId}`);
        return;
      }

      const radius = Phaser.Math.Clamp(
        moonScale.referenceVisualRadius
          * (data.diameterKm / moonScale.referenceDiameterKm) ** moonScale.diameterExponent
          * (data.visual.radiusScale ?? 1),
        moonScale.minimumVisualRadius,
        moonScale.maximumVisualRadius,
      );
      const orbitRadius = parent.radius + orbitScale.baseGap
        + Math.sqrt(data.distanceFromParentKm / orbitScale.maximumMeanDistanceKm)
          * orbitScale.compressedOrbitSpan;
      const angle = Phaser.Math.DegToRad(data.visualAngleDegrees);
      const worldPosition = {
        x: parent.x + Math.cos(angle) * orbitRadius,
        y: parent.y + Math.sin(angle) * orbitRadius,
      };
      const body = new CelestialBody(this, {
        ...data,
        worldPosition,
        visual: { ...data.visual, radius },
      }, gameConfig, this.assets, this.language);
      this.celestialBodies.set(body.id, body);
      this.worldObjects.push(body.container);
    });
  }

  getSolarMapPosition(distanceFromSunKm, visualAngleDegrees) {
    const distanceScale = gameConfig.world.coordinateSystem.planetDistance;
    const radius = Math.sqrt(distanceFromSunKm / 1000000) * distanceScale.unitsPerSqrtMillionKm;
    const angle = Phaser.Math.DegToRad(visualAngleDegrees);
    return {
      x: distanceScale.sunReferenceX + radius * Math.cos(angle),
      y: distanceScale.sunReferenceY + radius * Math.sin(angle),
    };
  }

  createSun() {
    const visualScale = gameConfig.world.coordinateSystem.sunDiameter;
    const radius = Phaser.Math.Clamp(
      visualScale.referenceVisualRadius
        * (this.sunData.diameterKm / visualScale.earthDiameterKm) ** visualScale.diameterExponent,
      visualScale.minimumVisualRadius,
      visualScale.maximumVisualRadius,
    );
    const distanceScale = gameConfig.world.coordinateSystem.planetDistance;
    const sun = new CelestialBody(this, {
      ...this.sunData,
      worldPosition: {
        x: distanceScale.sunReferenceX,
        y: distanceScale.sunReferenceY,
      },
      visual: { ...this.sunData.visual, radius },
    }, gameConfig, this.assets, this.language);
    this.celestialBodies.set(sun.id, sun);
    this.worldObjects.push(sun.container);
  }

  createEquipmentMarkers() {
    const records = this.equipmentData.records;
    records.forEach((data) => {
      const body = this.celestialBodies.get(data.celestialBodyId);
      if (!body) {
        console.error(`[ExplorationScene] Cuerpo asociado no encontrado para ${data.id}: ${data.celestialBodyId}`);
        return;
      }
      const marker = new SpaceEquipment(this, data, body, gameConfig, this.assets, this.language);
      this.equipmentMarkers.push(marker);
      this.worldObjects.push(marker.container);
    });
  }

  configureControls() {
    const keyboard = this.input.keyboard;
    const keyCodes = Phaser.Input.Keyboard.KeyCodes;
    keyboard.addCapture([keyCodes.UP, keyCodes.DOWN, keyCodes.LEFT, keyCodes.RIGHT]);
    this.keys = keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      arrowUp: keyCodes.UP,
      arrowDown: keyCodes.DOWN,
      arrowLeft: keyCodes.LEFT,
      arrowRight: keyCodes.RIGHT,
    });
    this.handleInteractionKey = (event) => {
      if (event.repeat) return;
      if (event.key === 'Escape') {
        if (this.infoPopupOpen) this.closeInfoPopup();
        return;
      }
      if (event.key.toLowerCase() !== 'e' || this.infoPopupOpen || !this.activeTarget) return;

      const surfaceDistance = this.getTargetDistance(this.activeTarget) - this.activeTarget.proximityRadius;
      if (surfaceDistance <= gameConfig.world.proximity.interactionRadius) {
        this.openInfoPopup(this.activeTarget);
      }
    };
    keyboard.on('keydown', this.handleInteractionKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', this.handleInteractionKey);
    });
  }

  createHUD() {
    this.hud = this.add.container(0, 0).setDepth(1000);
    this.hudTitle = this.add.text(22, 18, gameConfig.title.primary, {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.hudTitleFontSize}px`,
      fontStyle: 'bold',
      color: gameConfig.palette.text,
      letterSpacing: 2,
      stroke: gameConfig.palette.background,
      strokeThickness: 4,
    });
    this.hudSubtitle = this.add.text(23, 43, translate(this.language, 'exploration.subtitle'), {
      fontFamily: gameConfig.visual.bodyFontFamily,
      fontSize: `${gameConfig.visual.hudBodyFontSize}px`,
      color: gameConfig.palette.muted,
      stroke: gameConfig.palette.background,
      strokeThickness: 4,
    });
    this.movementHint = this.add.text(22, 0, translate(this.language, 'exploration.movementHint'), {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.hudBodyFontSize}px`,
      color: gameConfig.palette.muted,
      stroke: gameConfig.palette.background,
      strokeThickness: 4,
    }).setOrigin(0, 1);

    this.proximityPanel = this.add.container(0, 0).setVisible(false);
    this.proximityBackground = this.add
      .rectangle(0, 0, gameConfig.visual.proximityPanelWidth, gameConfig.visual.proximityPanelHeight,
        Number.parseInt(gameConfig.palette.buttonFill.slice(1), 16), 0.88)
      .setStrokeStyle(1, Number.parseInt(gameConfig.palette.electric.slice(1), 16), 0.58);
    this.proximityName = this.add.text(0, -12, '', {
      fontFamily: gameConfig.visual.bodyFontFamily,
      fontSize: `${gameConfig.visual.hudBodyFontSize}px`,
      fontStyle: 'bold',
      color: gameConfig.palette.text,
      stroke: gameConfig.palette.background,
      strokeThickness: 3,
      wordWrap: { width: gameConfig.visual.proximityPanelWidth - 28 },
    }).setOrigin(0, 0.5);
    this.proximityStatus = this.add.text(0, 14, '', {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.hudBodyFontSize - 1}px`,
      color: gameConfig.palette.electric,
      stroke: gameConfig.palette.background,
      strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.proximityPanel.add([this.proximityBackground, this.proximityName, this.proximityStatus]);
    this.hud.add([this.hudTitle, this.hudSubtitle, this.movementHint, this.proximityPanel]);

    this.finishButton = createActionButton(this, {
      width: 250,
      height: 42,
      text: translate(this.language, 'conclusion.finish'),
      palette: gameConfig.palette,
      visual: gameConfig.visual,
      onPress: () => {
        this.scene.launch('ConclusionScene');
        this.scene.pause();
      },
    });
    this.finishButton.label.setFontSize(12).setLetterSpacing(0);
    this.hud.add(this.finishButton.container);

    this.createInfoPopup();
  }

  createInfoPopup() {
    const width = gameConfig.visual.infoPopupWidth;
    const height = gameConfig.visual.infoPopupHeight;
    const padding = gameConfig.visual.infoPopupPadding;
    const contentWidth = width - padding * 2;
    const contentTop = -height / 2 + padding + 48;
    const contentHeight = height - padding * 2 - 68;
    const contentLeft = -width / 2 + padding;
    const fillColor = Number.parseInt(gameConfig.palette.buttonFill.slice(1), 16);
    const borderColor = Number.parseInt(gameConfig.palette.electric.slice(1), 16);

    this.infoPopup = this.add.container(0, 0).setDepth(1100).setVisible(false);
    this.infoPopupHeight = height;
    this.infoPopupBackground = this.add
      .rectangle(0, 0, width, height, fillColor, 0.97)
      .setStrokeStyle(1.5, borderColor, 0.95);
    this.infoPopupIcon = this.add
      .circle(-width / 2 + padding + 16, -height / 2 + padding + 16, 15,
        Number.parseInt(gameConfig.palette.proximity.slice(1), 16))
      .setStrokeStyle(2, Number.parseInt(gameConfig.palette.text.slice(1), 16), 0.9);
    this.infoPopupTitle = this.add.text(-width / 2 + padding + 42, -height / 2 + padding, '', {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.infoPopupTitleFontSize}px`,
      fontStyle: 'bold',
      color: gameConfig.palette.text,
      wordWrap: { width: width - padding * 2 - 100 },
    });
    this.infoPopupClose = this.add.text(width / 2 - padding, -height / 2 + padding, translate(this.language, 'buttons.close'), {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.infoPopupCloseFontSize}px`,
      color: gameConfig.palette.electric,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.infoPopupClose.on('pointerdown', () => this.closeInfoPopup());

    this.infoPopupBody = this.add.text(contentLeft, contentTop, '', {
      fontFamily: gameConfig.visual.bodyFontFamily,
      fontSize: `${gameConfig.visual.infoPopupBodyFontSize}px`,
      color: gameConfig.palette.text,
      lineSpacing: 2,
      wordWrap: { width: contentWidth },
    });
    this.infoPopupGallery = this.add.container(0, 0).setVisible(false);
    this.infoPopupContent = this.add.container(0, 0);
    this.infoPopupContent.add([this.infoPopupBody, this.infoPopupGallery]);

    this.infoPopupContentMaskSource = this.make.graphics({ x: 0, y: 0, add: false });
    this.infoPopupContentMaskSource.fillStyle(0xffffff, 1);
    this.infoPopupContentMaskSource.fillRect(contentLeft, contentTop, contentWidth, contentHeight);
    this.infoPopupContent.setMask(this.infoPopupContentMaskSource.createGeometryMask());

    this.infoPopup.add([
      this.infoPopupBackground,
      this.infoPopupIcon,
      this.infoPopupTitle,
      this.infoPopupClose,
      this.infoPopupContent,
    ]);
    this.hud.add(this.infoPopup);

    this.input.on('wheel', this.handleInfoPopupWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', this.handleInfoPopupWheel, this);
      this.infoPopupContentMaskSource.destroy();
      this.infoPopupImageMaskSource?.destroy();
    });
  }

  configureCameras() {
    const cameraConfig = gameConfig.world.camera;
    this.worldCamera = this.cameras.main;
    this.worldCamera.setBounds(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.worldCamera.setZoom(cameraConfig.zoom);
    this.worldCamera.centerOn(this.spacecraft.x, this.spacecraft.y);
    this.worldCamera.startFollow(
      this.spacecraft.container,
      true,
      cameraConfig.lerpX,
      cameraConfig.lerpY,
    );
    this.worldCamera.ignore(this.hud);

    const { width, height } = this.scale.gameSize;
    this.hudCamera = this.cameras.add(0, 0, width, height);
    this.hudCamera.setZoom(1);
    this.hudCamera.ignore(this.worldObjects);
    console.info('[ExplorationScene] Cámara centrada', {
      x: this.spacecraft.x,
      y: this.spacecraft.y,
      zoom: this.worldCamera.zoom,
    });
  }

  layoutHUD(gameSize) {
    this.hudSubtitle.setPosition(23, 43);
    this.movementHint.setPosition(22, gameSize.height - 18);
    const finishWidth = Math.min(250, Math.max(130, gameSize.width * 0.48));
    this.finishButton.setSize(finishWidth, 42);
    this.finishButton.container.input.hitArea.setTo(0, 0, finishWidth, 42);
    this.finishButton.label.setFontSize(finishWidth < 200 ? 9 : 12);
    this.finishButton.container.setPosition(gameSize.width - finishWidth / 2 - 16, 36);
    this.hudTitle.setFontSize(gameSize.width < 450 ? 13 : gameConfig.visual.hudTitleFontSize);

    const panelWidth = Math.min(gameConfig.visual.proximityPanelWidth, gameSize.width - 32);
    this.proximityBackground.setSize(panelWidth, gameConfig.visual.proximityPanelHeight);
    this.proximityName.setPosition(-panelWidth / 2 + 14, -12);
    this.proximityStatus.setPosition(-panelWidth / 2 + 14, 14);
    this.proximityName.setWordWrapWidth(panelWidth - 28);
    this.hudCamera?.setViewport(0, 0, gameSize.width, gameSize.height);
    if (this.activeTarget) this.positionProximityPanel();
    if (this.infoPopupOpen) this.positionInfoPopup();
  }

  handleResize(gameSize) {
    this.layoutHUD(gameSize);
  }

  update(_time, delta) {
    if (!this.spacecraft || !this.keys) return;
    this.spacecraft.update({
      up: { isDown: this.keys.up.isDown || this.keys.arrowUp.isDown },
      down: { isDown: this.keys.down.isDown || this.keys.arrowDown.isDown },
      left: { isDown: this.keys.left.isDown || this.keys.arrowLeft.isDown },
      right: { isDown: this.keys.right.isDown || this.keys.arrowRight.isDown },
    }, delta, this.worldBounds);
    this.updateProximity();

    if (this.infoPopupOpen) this.positionInfoPopup();
  }

  updateProximity() {
    const { radius, hysteresis } = gameConfig.world.proximity;
    const candidates = this.targets
      .map((target) => ({ target, distance: this.getTargetDistance(target) - target.proximityRadius }))
      .filter(({ distance }) => distance <= radius)
      .sort((first, second) => first.distance - second.distance);

    let nearest = candidates[0] ?? null;
    if (this.activeTarget) {
      const active = candidates.find(({ target }) => target.id === this.activeTarget.id);
      if (active && (!nearest || nearest.target.id === this.activeTarget.id
        || nearest.distance + hysteresis >= active.distance)) {
        nearest = active;
      }
    }

    if (!nearest) {
      if (this.activeTarget) this.activeTarget.setHighlighted(false);
      this.activeTarget = null;
      this.proximityPanel.setVisible(false);
      return;
    }

    if (nearest.target.id !== this.activeTarget?.id) {
      if (this.activeTarget) this.activeTarget.setHighlighted(false);
      this.activeTarget = nearest.target;
      this.activeTarget.setHighlighted(true);
      this.discoveredIds.add(this.activeTarget.id);
      this.proximityName.setText(this.activeTarget.name);
      this.proximityStatus.setText(translate(this.language, 'exploration.interactHint'));
      this.proximityPanel.setVisible(true);
    }

    this.positionProximityPanel();
  }

  positionProximityPanel() {
    const camera = this.worldCamera;
    const { width, height } = this.scale.gameSize;
    const panelWidth = Math.min(gameConfig.visual.proximityPanelWidth, width - 32);
    const panelHeight = gameConfig.visual.proximityPanelHeight;
    const screenX = camera.x + (this.activeTarget.x - camera.worldView.x) * camera.zoom;
    const objectTop = camera.y + (
      this.activeTarget.y - this.activeTarget.proximityRadius - camera.worldView.y
    ) * camera.zoom;
    const x = Phaser.Math.Clamp(screenX, panelWidth / 2 + 16, width - panelWidth / 2 - 16);
    const y = Phaser.Math.Clamp(
      objectTop - panelHeight / 2 - 12,
      panelHeight / 2 + 12,
      height - panelHeight / 2 - 64,
    );

    this.proximityPanel.setPosition(x, y);
  }

  getTargetDistance(target) {
    return Math.hypot(this.spacecraft.x - target.x, this.spacecraft.y - target.y);
  }

  openInfoPopup(target) {
    this.infoPopupTarget = target;
    this.infoPopupTitle.setText(localizedField(target.data, 'name', this.language) ?? target.name);
    this.infoPopupBody.setText(this.getInfoText(target));
    this.infoPopupScrollOffset = 0;
    this.infoPopupContent.setY(0);
    this.populateInfoGallery(target);

    const visual = target.data.visual;
    const colorKey = visual?.colorKey ?? visual?.accentColorKey;
    const iconColor = colorKey
      ? gameConfig.palette[colorKey]
      : gameConfig.palette.proximity;
    this.infoPopupIcon.setFillStyle(Number.parseInt(iconColor.slice(1), 16), 1);
    this.infoPopupOpen = true;
    this.infoPopup.setVisible(true);
    this.positionInfoPopup();
  }

  populateInfoGallery(target) {
    this.infoPopupGallery.removeAll(true);
    this.infoPopupGallery.setVisible(false);
    this.infoPopupImageMaskSource?.destroy();
    this.infoPopupImageMaskSource = null;
    this.infoPopupImageMask = null;
    this.infoPopupImage = null;
    this.infoPopupGalleryItems = (target.data.gallery ?? []).filter((item) => (
      item.assetId
      && this.assets.images.some((asset) => asset.id === item.assetId)
      && this.textures.exists(item.assetId)
    ));
    this.infoPopupScrollOffset = 0;
    this.infoPopupContent.setY(0);

    if (this.infoPopupGalleryItems.length === 0) {
      this.infoPopupContentHeight = this.infoPopupBody.height;
      this.resizeInfoPopupToContent();
      this.updateInfoPopupScrollBounds();
      return;
    }

    const width = gameConfig.visual.infoPopupWidth - gameConfig.visual.infoPopupPadding * 2;
    const imageHeight = gameConfig.visual.infoPopupGalleryImageHeight;
    const imageWidth = width;
    const frame = this.add.graphics();
    frame.fillStyle(Number.parseInt(gameConfig.palette.background.slice(1), 16), 0.92);
    frame.fillRoundedRect(-imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight, 8);
    frame.lineStyle(1, Number.parseInt(gameConfig.palette.electric.slice(1), 16), 0.62);
    frame.strokeRoundedRect(-imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight, 8);
    this.infoPopupGallery.add(frame);

    this.infoPopupImage = this.add.image(0, 0, this.infoPopupGalleryItems[0].assetId);
    this.fitInfoPopupImage();
    this.infoPopupImageMaskSource = this.make.graphics({ x: 0, y: 0, add: false });
    this.infoPopupImageMaskSource.fillStyle(0xffffff, 1);
    this.infoPopupImageMaskSource.fillRoundedRect(-imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight, 8);
    this.infoPopupImageMask = this.infoPopupImageMaskSource.createGeometryMask();
    this.infoPopupImage.setMask(this.infoPopupImageMask);
    this.infoPopupGallery.add(this.infoPopupImage);

    this.infoPopupCaption = this.add.text(0, imageHeight / 2 + 8, '', {
      fontFamily: gameConfig.visual.bodyFontFamily,
      fontSize: `${gameConfig.visual.infoPopupGalleryCaptionFontSize}px`,
      color: gameConfig.palette.text,
      align: 'center',
      wordWrap: { width: imageWidth - 24 },
    }).setOrigin(0.5, 0);
    this.infoPopupCredit = this.add.text(0, imageHeight / 2 + 29, '', {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.infoPopupGalleryCreditFontSize}px`,
      color: gameConfig.palette.muted,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.infoPopupGallery.add([this.infoPopupCaption, this.infoPopupCredit]);

    if (this.infoPopupGalleryItems.length > 1) this.createInfoGalleryControls(imageWidth, imageHeight);
    this.infoPopupGallery.setVisible(true);
    this.infoPopupGalleryY = this.infoPopupBody.y
      + this.infoPopupBody.height
      + gameConfig.visual.infoPopupGalleryGap
      + imageHeight / 2;
    this.infoPopupGallery.setPosition(0, this.infoPopupGalleryY);
    this.infoPopupContentHeight = this.infoPopupBody.height
      + gameConfig.visual.infoPopupGalleryGap
      + imageHeight
      + 54;
    this.infoPopupGalleryIndex = 0;
    this.updateInfoGallerySlide();
    this.resizeInfoPopupToContent();
    this.updateInfoPopupScrollBounds();
  }

  resizeInfoPopupToContent() {
    const width = gameConfig.visual.infoPopupWidth;
    const padding = gameConfig.visual.infoPopupPadding;
    const maxHeight = gameConfig.visual.infoPopupHeight;
    const minHeight = gameConfig.visual.infoPopupMinHeight;
    this.infoPopupHeight = Phaser.Math.Clamp(
      this.infoPopupContentHeight + padding * 2 + 68,
      minHeight,
      maxHeight,
    );

    const top = -this.infoPopupHeight / 2 + padding;
    this.infoPopupBackground.setSize(width, this.infoPopupHeight);
    this.infoPopupIcon.setPosition(-width / 2 + padding + 16, top + 16);
    this.infoPopupTitle.setPosition(-width / 2 + padding + 42, top);
    this.infoPopupClose.setPosition(width / 2 - padding, top);
    this.infoPopupBody.setPosition(-width / 2 + padding, top + 48);

    if (this.infoPopupGalleryItems?.length) {
      this.infoPopupGalleryY = this.infoPopupBody.y
        + this.infoPopupBody.height
        + gameConfig.visual.infoPopupGalleryGap
        + gameConfig.visual.infoPopupGalleryImageHeight / 2;
      this.infoPopupGallery.setPosition(0, this.infoPopupGalleryY);
    }

    const contentHeight = this.infoPopupHeight - padding * 2 - 68;
    this.infoPopupContentMaskSource.clear();
    this.infoPopupContentMaskSource.fillStyle(0xffffff, 1);
    this.infoPopupContentMaskSource.fillRect(
      -width / 2 + padding,
      top + 48,
      width - padding * 2,
      contentHeight,
    );
  }

  createInfoGalleryControls(width, imageHeight) {
    const controlY = imageHeight / 2 + 48;
    const color = gameConfig.palette.electric;
    const createControl = (x, label, onPress) => {
      const control = this.add.text(x, controlY, label, {
        fontFamily: gameConfig.visual.monoFontFamily,
        fontSize: `${gameConfig.visual.infoPopupGalleryControlFontSize}px`,
        color,
        backgroundColor: gameConfig.palette.buttonFill,
        padding: { left: 8, right: 8, top: 3, bottom: 3 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      control.on('pointerdown', onPress);
      this.infoPopupGallery.add(control);
    };

    createControl(-width / 2 + 22, '<', () => this.changeInfoGallerySlide(-1));
    createControl(width / 2 - 22, '>', () => this.changeInfoGallerySlide(1));
    this.infoPopupGalleryCounter = this.add.text(0, controlY, '', {
      fontFamily: gameConfig.visual.monoFontFamily,
      fontSize: `${gameConfig.visual.infoPopupGalleryCreditFontSize}px`,
      color: gameConfig.palette.muted,
      align: 'center',
    }).setOrigin(0.5);
    this.infoPopupGallery.add(this.infoPopupGalleryCounter);
  }

  updateInfoGallerySlide() {
    const item = this.infoPopupGalleryItems[this.infoPopupGalleryIndex];
    if (!item || !this.infoPopupImage) return;
    const asset = this.assets.images.find((entry) => entry.id === item.assetId);
    this.infoPopupImage.setTexture(item.assetId);
    this.fitInfoPopupImage();
    this.infoPopupCaption.setText(item.caption ?? (asset ? localizedAssetCaption(asset, this.language) : ''));
    const credit = item.credit ?? asset?.credit;
    this.infoPopupCredit.setText(credit ? `© ${credit}` : '');
    if (this.infoPopupGalleryCounter) {
      this.infoPopupGalleryCounter.setText(`${this.infoPopupGalleryIndex + 1} / ${this.infoPopupGalleryItems.length}`);
    }
  }

  fitInfoPopupImage() {
    const imageWidth = gameConfig.visual.infoPopupWidth - gameConfig.visual.infoPopupPadding * 2;
    const imageHeight = gameConfig.visual.infoPopupGalleryImageHeight;
    const scale = Math.min(imageWidth / this.infoPopupImage.width, imageHeight / this.infoPopupImage.height);
    this.infoPopupImage.setScale(scale);
  }

  changeInfoGallerySlide(direction) {
    const count = this.infoPopupGalleryItems?.length ?? 0;
    if (count < 2) return;
    this.infoPopupGalleryIndex = (this.infoPopupGalleryIndex + direction + count) % count;
    this.updateInfoGallerySlide();
  }

  updateInfoPopupScrollBounds() {
    const padding = gameConfig.visual.infoPopupPadding;
    const viewportHeight = this.infoPopupHeight - padding * 2 - 68;
    this.infoPopupScrollMax = Math.max(0, this.infoPopupContentHeight - viewportHeight);
    this.infoPopupContent.setY(-this.infoPopupScrollOffset);
  }

  handleInfoPopupWheel(pointer, _objects, _deltaX, deltaY) {
    if (!this.infoPopupOpen || !this.infoPopupScrollMax) return;
    const width = gameConfig.visual.infoPopupWidth * this.infoPopup.scaleX;
    const height = this.infoPopupHeight * this.infoPopup.scaleY;
    const withinPopup = Math.abs(pointer.x - this.infoPopup.x) <= width / 2
      && Math.abs(pointer.y - this.infoPopup.y) <= height / 2;
    if (!withinPopup) return;

    this.infoPopupScrollOffset = Phaser.Math.Clamp(
      this.infoPopupScrollOffset + deltaY,
      0,
      this.infoPopupScrollMax,
    );
    this.infoPopupContent.setY(-this.infoPopupScrollOffset);
    this.updateInfoPopupMasks();
  }

  getInfoText(target) {
    const data = target.data;
    const labels = translate(this.language, 'exploration.infoLabels');
    const lines = [];
    const addLine = (labelKey, value) => {
      if (value === undefined || value === null || value === '') return;
      lines.push(`${labels[labelKey]}: ${value}`);
    };
    const formatKilometers = (value) => `${Number(value).toLocaleString(this.language === 'en' ? 'en-US' : 'es-ES')} km`;

    if (data.equipmentType) {
      const realLocation = {
        ...data.realLocation,
        ...localizedField(data, 'realLocation', this.language),
      };
      const location = realLocation
        ? [realLocation.description, realLocation.coordinates].filter(Boolean).join(' · ')
        : undefined;
      addLine('description', localizedField(data, 'description', this.language)
        ?? localizedField(data, 'scientificDescription', this.language));
      addLine('mission', localizedField(data, 'mission', this.language));
      addLine('launchYear', data.launchYear);
      addLine('destination', localizedField(data, 'destination', this.language));
      addLine('objective', localizedField(data, 'objective', this.language));
      addLine('discoveries', localizedField(data, 'discoveries', this.language));
      addLine('status', localizedField(data, 'operationalStatus', this.language));
      addLine('location', location);
      addLine('whyRemains', localizedField(data, 'whyRemains', this.language));
      addLine('legacy', localizedField(data, 'scientificLegacy', this.language));
      addLine('source', data.source);
    } else if (data.type === 'moon') {
      const parent = this.celestialBodies.get(data.parentId);
      addLine('description', localizedField(data, 'description', this.language));
      addLine('parent', parent?.name);
      addLine('diameter', formatKilometers(data.diameterKm));
      addLine('distanceFromParent', formatKilometers(data.distanceFromParentKm));
      addLine('discovery', localizedField(data, 'discoveryHistory', this.language));
      addLine('importance', localizedField(data, 'scientificImportance', this.language));
      addLine('source', data.source);
    } else if (data.type === 'star') {
      addLine('description', localizedField(data, 'description', this.language));
      addLine('diameter', formatKilometers(data.diameterKm));
      addLine('distanceFromEarth', formatKilometers(data.distanceFromEarthKm));
      addLine('characteristics', localizedField(data, 'characteristics', this.language)?.join(' '));
      addLine('history', localizedField(data, 'observationHistory', this.language));
      addLine('interestingFact', localizedField(data, 'interestingFact', this.language));
      addLine('source', data.source);
    } else {
      addLine('description', localizedField(data, 'description', this.language));
      addLine('diameter', formatKilometers(data.diameterKm));
      addLine('distanceFromSun', formatKilometers(data.distanceFromSunKm));
      addLine('characteristics', localizedField(data, 'characteristics', this.language)?.join(' '));
      addLine('history', localizedField(data, 'observationHistory', this.language));
      addLine('interestingFact', localizedField(data, 'interestingFact', this.language));
      addLine('source', data.source);
    }

    return lines.join('\n');
  }

  closeInfoPopup() {
    this.infoPopupOpen = false;
    this.infoPopupTarget = null;
    this.infoPopup.setVisible(false);
  }

  positionInfoPopup() {
    const target = this.infoPopupTarget;
    if (!target) return;

    const camera = this.worldCamera;
    const viewport = this.scale.gameSize;
    const baseWidth = gameConfig.visual.infoPopupWidth;
    const baseHeight = this.infoPopupHeight;
    const scale = Math.min(1, (viewport.width - 24) / baseWidth, (viewport.height - 24) / baseHeight);
    const width = baseWidth * scale;
    const height = baseHeight * scale;
    const targetX = camera.x + (target.x - camera.worldView.x) * camera.zoom;
    const targetY = camera.y + (target.y - camera.worldView.y) * camera.zoom;
    const targetRadius = target.proximityRadius * camera.zoom;
    const gap = 18 * scale;
    const margin = 12;
    const minCenterY = height / 2 + margin;
    const maxCenterY = viewport.height - height / 2 - margin;
    const aboveY = targetY - targetRadius - gap - height / 2;
    const belowY = targetY + targetRadius + gap + height / 2;
    let panelX = targetX;
    let panelY;

    if (aboveY >= minCenterY) {
      panelY = aboveY;
    } else if (belowY <= maxCenterY) {
      panelY = belowY;
    } else {
      const leftSpace = targetX - targetRadius - gap - margin;
      const rightSpace = viewport.width - targetX - targetRadius - gap - margin;
      const canPlaceLeft = leftSpace >= width;
      const canPlaceRight = rightSpace >= width;

      if (canPlaceLeft || canPlaceRight) {
        const placeRight = canPlaceRight && (!canPlaceLeft || rightSpace >= leftSpace);
        panelX = placeRight
          ? targetX + targetRadius + gap + width / 2
          : targetX - targetRadius - gap - width / 2;
        panelY = Phaser.Math.Clamp(targetY, minCenterY, maxCenterY);
      } else {
        panelY = Phaser.Math.Clamp(targetY, minCenterY, maxCenterY);
      }
    }

    panelX = Phaser.Math.Clamp(panelX, width / 2 + margin, viewport.width - width / 2 - margin);
    panelY = Phaser.Math.Clamp(panelY, minCenterY, maxCenterY);
    this.infoPopup.setScale(scale).setPosition(panelX, panelY);
    this.updateInfoPopupMasks();
  }

  updateInfoPopupMasks() {
    if (!this.infoPopup) return;
    const scale = this.infoPopup.scaleX;
    this.infoPopupContentMaskSource.setPosition(this.infoPopup.x, this.infoPopup.y).setScale(scale);

    if (this.infoPopupImageMaskSource && this.infoPopupGallery?.visible) {
      const galleryX = this.infoPopup.x + this.infoPopupGallery.x * scale;
      const galleryY = this.infoPopup.y
        + (this.infoPopupContent.y + this.infoPopupGallery.y) * scale;
      this.infoPopupImageMaskSource.setPosition(galleryX, galleryY).setScale(scale);
    }
  }
}