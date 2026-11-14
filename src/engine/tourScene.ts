import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ApartmentSpec,
  ApartmentType,
  ARCH,
  EXTERIOR_CAMERA_PRESETS,
  ExteriorPresetSpec,
  FanSpeed,
  FloorNumber,
  getApartmentSpec,
  LightingMode,
  ROOFTOP_CAMERA_PRESETS,
  RooftopPresetSpec,
  TourLevel,
  ViewMode,
} from '../architecture/buildingData';
import {
  buildApartmentArchitecture,
  buildBuildingExteriorAndCore,
  BuildingShellHandles,
  BuiltArchitectureResult,
} from './architectureBuilder';
import {
  buildWallColliders,
  ColliderBox,
  findRoomAtPosition,
  resolvePlayerMovement,
} from './collision';
import {
  buildApartmentFurniture,
  BuiltFurnitureResult,
} from './furnitureBuilder';
import {
  createInterpolatedLightingState,
  createSkyDome,
  InterpolatedLightingState,
  lerpLightingState,
  LIGHTING_PRESETS,
  LightingPreset,
  SkyDomeHandle,
} from './lighting';
import { createMaterialLibrary, MaterialLibrary } from './materials';
import { createTextureBundle, TextureBundle } from './textures';

export interface TourInteractiveState {
  doors: Record<string, boolean>;
  curtains: Record<string, boolean>;
  drawers: Record<string, boolean>;
  hinged: Record<string, boolean>;
  wardrobeOpen: boolean;
  lockerOpen: boolean;
  roomLights: Record<string, boolean>;
  lamps: Record<string, boolean>;
  underCabinetLight: boolean;
  fanSpeeds: Record<string, FanSpeed>;
}

export interface ProjectedRoomLabel {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface TourCallbacks {
  onRoomChange?: (roomId: string, roomName: string) => void;
  onPlayerMove?: (x: number, z: number, yaw: number) => void;
  onInteract?: (actionType: string, actionId: string, label: string) => void;
  onSelectFloor?: (floor: FloorNumber) => void;
  onSelectRoomFromLayout?: (roomId: string) => void;
  onZoomOutToLayout?: () => void;
  onTourLevelStepBack?: (nextLevel: TourLevel, restoredViewMode: ViewMode) => void;
  onTransitionFade?: () => void;
  onRoomLabelsChange?: (labels: ProjectedRoomLabel[]) => void;
  onHoverChange?: (label: string | null) => void;
  onContextLost?: (lost: boolean) => void;
  onPerfSample?: (fps: number, isSoftwareGl: boolean) => void;
}

export function createInitialInteractiveState(): TourInteractiveState {
  return {
    doors: {
      'entrance-door': true,
      'balcony-door': false,
      'bed1-door': true,
      'bed2-door': true,
      'bed3-door': true,
      'primary-bath-door': true,
      'common-bath-door': true,
      'attached-bath-2-door': true,
      'bed1-balcony-door': false,
      'utility-door': false,
    },
    curtains: {
      'living-curtains': true,
      'bed1-curtains': false,
      'bed2-curtains': false,
    },
    drawers: {
      'kitchen-drawer': false,
    },
    hinged: {
      'sink-cabinet': false,
      'upper-cabinet': false,
    },
    wardrobeOpen: false,
    lockerOpen: false,
    roomLights: {
      foyer: true,
      living: true,
      dining: true,
      kitchen: true,
      puja: true,
      'family-lounge': true,
      'primary-bed': true,
      'secondary-bed': true,
      'third-bed': true,
      'primary-bath': true,
      'common-bath': true,
      'attached-bath-2': true,
      balcony: true,
    },
    lamps: {
      'living-floor-lamp': true,
      'dining-pendant': true,
      'bed-lamp-l': true,
      'bed-lamp-r': true,
      'puja-diya': true,
      'family-lounge-lamp': true,
    },
    underCabinetLight: true,
    fanSpeeds: {
      living: 1,
      'primary-bed': 0,
      'secondary-bed': 0,
      'third-bed': 0,
    },
  };
}

// Module-scope reusable math helpers (zero GC inside animation loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class NirmanaTourEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera;
  private activeCamera: THREE.Camera;
  private controls: OrbitControls;
  private orthoControls: OrbitControls;
  private textures: TextureBundle;
  private mats: MaterialLibrary;
  private buildingShell: BuildingShellHandles;
  private isSoftwareGl: boolean;
  private reducedMotion: boolean;

  // Lighting & Sky Atmosphere
  private sunLight: THREE.DirectionalLight;
  private fillHemi: THREE.HemisphereLight;
  private bounceLight: THREE.DirectionalLight;
  private porticoLight: THREE.PointLight;
  private walkwayLight: THREE.PointLight;
  private skyDome: SkyDomeHandle;
  private roomPointLights = new Map<string, THREE.PointLight>();
  private lightingMode: LightingMode = 'morning';
  private lightingFrom: LightingPreset = LIGHTING_PRESETS.morning;
  private lightingTo: LightingPreset = LIGHTING_PRESETS.morning;
  private lightingState: InterpolatedLightingState = createInterpolatedLightingState(
    LIGHTING_PRESETS.morning,
  );
  private lightingStartTime = 0;
  private lightingSettled = true;
  private readonly lightingDurationMs = 2000;

  // Active Apartment Context & Per-Unit Isolated State
  private activeApt: ApartmentSpec;
  private activeArch: BuiltArchitectureResult | null = null;
  private activeFurn: BuiltFurnitureResult | null = null;
  private colliders: ColliderBox[] = [];
  private apartmentStates = new Map<string, TourInteractiveState>();
  private state: TourInteractiveState = createInitialInteractiveState();
  private tourLevel: TourLevel = 'building';
  private viewMode: ViewMode = 'exterior';
  private lastApartmentLayoutMode: 'dollhouse' | 'floorplan' = 'dollhouse';
  private userCeilingVisible = false;
  private userRoofVisible = false;
  private exteriorRoofVisible = true;
  private lastProjectedKey = '';
  private wheelZoomOutAccum = 0;
  private pinchStartDist: number | null = null;
  private savedFrames = new Map<
    'building' | 'floor' | 'apartment',
    {
      pos: [number, number, number];
      target: [number, number, number];
      fov: number;
      orthoZoom: number;
      viewMode: ViewMode;
    }
  >();

  // Walkthrough Camera Pose
  private walkPos = new THREE.Vector3();
  private walkYaw = 0;
  private walkPitch = 0;
  private keysPressed = new Set<string>();
  private touchMove = { x: 0, z: 0 };
  private isPointerDown = false;
  private pointerDownPos = { x: 0, y: 0 };
  private pointerLastPos = { x: 0, y: 0 };
  private didDrag = false;

  // Smooth Camera Transition State
  private transition: {
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
    targetFov: number;
  } = {
    active: false,
    targetPos: new THREE.Vector3(),
    targetLook: new THREE.Vector3(),
    targetFov: 56,
  };

  // Animation progress values (0..1)
  private doorProgress = new Map<string, number>();
  private curtainProgress = new Map<string, number>();
  private drawerProgress = new Map<string, number>();
  private hingedProgress = new Map<string, number>();
  private wardrobeProgress = 0;
  private lockerProgress = 0;
  private fanAngles = new Map<string, number>();

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private lastHoverCheck = 0;

  // Render Loop / On-demand Pacing
  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private renderSeq = 0;
  private hasRenderedFirstFrame = false;
  private disposed = false;
  private lastTickTime = performance.now();
  private lastHudEmit = 0;
  private callbacks: TourCallbacks;
  private currentRoomId = '';

  constructor(
    container: HTMLElement,
    initialFloor: FloorNumber,
    initialTypeOrId: ApartmentType | string,
    initialLevel: TourLevel = 'building',
    initialLighting: LightingMode = 'morning',
    initialRoomId: string | null = null,
    callbacks: TourCallbacks = {},
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.tourLevel = initialLevel;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(320, container.clientWidth || window.innerWidth);
    const height = Math.max(240, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(LIGHTING_PRESETS.morning.skyHorizonHex);
    this.scene.fog = new THREE.Fog(
      LIGHTING_PRESETS.morning.fogHex,
      LIGHTING_PRESETS.morning.fogNear,
      LIGHTING_PRESETS.morning.fogFar,
    );

    // Studio & Daylight Environment Reflection (RoomEnvironment retained for metallic/glass PBR highlights)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.35, 320);
    this.camera.rotation.order = 'YXZ';

    const aspect = width / height;
    const orthoHalfH = 8.5;
    this.orthoCamera = new THREE.OrthographicCamera(
      -orthoHalfH * aspect,
      orthoHalfH * aspect,
      orthoHalfH,
      -orthoHalfH,
      0.2,
      90,
    );
    this.activeCamera = this.camera;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener('change', () => this.requestRender());
    this.controls.addEventListener('start', () => {
      this.transition.active = false;
    });

    this.orthoControls = new OrbitControls(this.orthoCamera, this.renderer.domElement);
    this.orthoControls.enableRotate = false;
    this.orthoControls.enableDamping = !this.isSoftwareGl;
    this.orthoControls.dampingFactor = 0.08;
    this.orthoControls.minZoom = 0.55;
    this.orthoControls.maxZoom = 2.6;
    this.orthoControls.enabled = false;
    this.orthoControls.addEventListener('change', () => this.requestRender());

    // Sky Dome Gradient Shader (Zenith / Horizon / Ground + Solar Halo)
    this.skyDome = createSkyDome(this.lightingState);
    this.scene.add(this.skyDome.mesh);

    // Three-Point Architectural Lighting Rig + Localized Exterior Pools
    this.sunLight = new THREE.DirectionalLight(0xffe8c6, 1.72);
    this.sunLight.position.copy(this.lightingState.sunPosition);
    this.sunLight.target.position.set(0, 14, 0);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 4;
    this.sunLight.shadow.camera.far = 135;
    this.sunLight.shadow.camera.left = -32;
    this.sunLight.shadow.camera.right = 32;
    this.sunLight.shadow.camera.top = 34;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillHemi = new THREE.HemisphereLight(0xd4e4f2, 0x8e7d67, 0.56);
    this.scene.add(this.fillHemi);

    this.bounceLight = new THREE.DirectionalLight(0xf4e8d5, 0.28);
    this.bounceLight.position.set(-18, 20, -24);
    this.scene.add(this.bounceLight);

    this.porticoLight = new THREE.PointLight(0xffcb82, 0, 12.0, 1.55);
    this.porticoLight.position.set(0, 2.75, -7.8);
    this.scene.add(this.porticoLight);

    this.walkwayLight = new THREE.PointLight(0xffc97d, 0, 15.5, 1.5);
    this.walkwayLight.position.set(-1.0, 2.35, -18.5);
    this.scene.add(this.walkwayLight);

    // Procedural Textures & PBR Materials
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createTextureBundle(maxAniso);
    this.mats = createMaterialLibrary(this.textures, this.isSoftwareGl);

    // 10-Storey Building Shell + Shared Core + 3-Depth Site Context
    this.buildingShell = buildBuildingExteriorAndCore(this.mats);
    this.scene.add(this.buildingShell.root);

    // Load Initial Apartment, Tour Level & Lighting
    this.activeApt = getApartmentSpec(initialFloor, initialTypeOrId);
    this.loadApartment(initialFloor, initialTypeOrId, true);
    this.setLightingMode(initialLighting, true);
    this.setTourLevel(initialLevel, true, initialRoomId);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.container.setAttribute('data-lighting-settled', 'true');
    this.callbacks.onPerfSample?.(60, this.isSoftwareGl);
    this.requestRender();
  }

  public getIsSoftwareGl(): boolean {
    return this.isSoftwareGl;
  }

  public getActiveApartment(): ApartmentSpec {
    return this.activeApt;
  }

  public getState(): TourInteractiveState {
    return this.state;
  }

  public getEnclosureVisibility(): { ceiling: boolean; roof: boolean } {
    if (this.viewMode === 'walkthrough') {
      return { ceiling: true, roof: true };
    }
    if (this.viewMode === 'exterior') {
      return { ceiling: true, roof: this.exteriorRoofVisible };
    }
    return { ceiling: this.userCeilingVisible, roof: this.userRoofVisible };
  }

  public setCeilingVisible(visible: boolean) {
    this.userCeilingVisible = visible;
    this.updateLayerVisibility();
    this.requestRender();
  }

  public setRoofVisible(visible: boolean) {
    if (this.viewMode === 'exterior') {
      this.exteriorRoofVisible = visible;
    } else {
      this.userRoofVisible = visible;
    }
    this.updateLayerVisibility();
    this.requestRender();
  }

  public loadApartment(
    floor: FloorNumber,
    typeOrId: ApartmentType | string,
    resetCamera = true,
  ) {
    // Save outgoing apartment's interactive state & restore its overview shell
    if (this.activeApt) {
      this.apartmentStates.set(this.activeApt.id, this.state);
      const prevShell = this.buildingShell.apartmentOverviewShells.get(
        this.activeApt.id,
      );
      if (prevShell) prevShell.visible = true;
    }

    // Dispose previous detailed interior
    if (this.activeArch) {
      this.scene.remove(this.activeArch.group);
      disposeObjectGroup(this.activeArch.group);
      this.activeArch = null;
    }
    if (this.activeFurn) {
      this.scene.remove(this.activeFurn.group);
      disposeObjectGroup(this.activeFurn.group);
      this.activeFurn = null;
    }
    this.roomPointLights.forEach((pt) => this.scene.remove(pt));
    this.roomPointLights.clear();

    this.activeApt = getApartmentSpec(floor, typeOrId);
    this.state =
      this.apartmentStates.get(this.activeApt.id) ?? createInitialInteractiveState();
    const activeShell = this.buildingShell.apartmentOverviewShells.get(
      this.activeApt.id,
    );
    if (activeShell) activeShell.visible = false;

    this.activeArch = buildApartmentArchitecture(this.activeApt, this.mats);
    this.activeFurn = buildApartmentFurniture(
      this.activeApt,
      this.mats,
      this.isSoftwareGl,
    );
    this.scene.add(this.activeArch.group);
    this.scene.add(this.activeFurn.group);

    // Build interior room PointLights across all key residential rooms
    const floorY = (this.activeApt.floor - 1) * ARCH.FLOOR_HEIGHT;
    const keyRooms = [
      'foyer',
      'living',
      'dining',
      'kitchen',
      'puja',
      'family-lounge',
      'gallery',
      'primary-bed',
      'secondary-bed',
      'third-bed',
      'primary-bath',
      'common-bath',
      'attached-bath-2',
    ];
    for (const rId of keyRooms) {
      const room = this.activeApt.rooms.find((r) => r.id === rId);
      if (!room) continue;
      const pt = new THREE.PointLight(0xffcb80, 0, 8.6, 1.65);
      pt.position.set(
        (room.bounds.xMin + room.bounds.xMax) * 0.5,
        floorY + ARCH.CEILING_CLEAR_HEIGHT - 0.35,
        (room.bounds.zMin + room.bounds.zMax) * 0.5,
      );
      this.scene.add(pt);
      this.roomPointLights.set(rId, pt);
    }

    // Rebuild collision volume
    this.colliders = [
      ...buildWallColliders(this.activeApt),
      ...this.activeFurn.colliders,
    ];

    // Sync animation baselines to restored apartment's interactive state
    this.doorProgress.clear();
    this.curtainProgress.clear();
    this.drawerProgress.clear();
    this.hingedProgress.clear();
    this.lastProjectedKey = '';
    this.syncInteractiveVisuals(true);
    this.updateLayerVisibility();
    this.applyCurrentLighting();

    if (resetCamera) {
      this.placeAtEntry(true);
      if (this.viewMode !== 'walkthrough') {
        this.setViewMode(this.viewMode, true);
      }
    }

    this.emitProjectedRoomLabels();
    this.requestRender();
  }

  private saveCurrentFrame(level: 'building' | 'floor' | 'apartment') {
    this.savedFrames.set(level, {
      pos: [
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      ],
      target: [
        this.controls.target.x,
        this.controls.target.y,
        this.controls.target.z,
      ],
      fov: this.camera.fov,
      orthoZoom: this.orthoCamera.zoom,
      viewMode: this.viewMode,
    });
  }

  private updateClipPlanes(mode: ViewMode) {
    if (mode === 'walkthrough') {
      this.camera.near = 0.12;
      this.camera.far = 115;
    } else if (mode === 'dollhouse' || mode === 'floorplan') {
      this.camera.near = 0.2;
      this.camera.far = 140;
    } else {
      this.camera.near = 0.4;
      this.camera.far = 320;
    }
    this.camera.updateProjectionMatrix();
  }

  private getActiveAptCombinedBounds() {
    const apt = this.activeApt;
    let xMin = apt.bounds.xMin;
    let xMax = apt.bounds.xMax;
    let zMin = apt.bounds.zMin;
    let zMax = apt.bounds.zMax;
    for (const bal of apt.balconies) {
      xMin = Math.min(xMin, bal.bounds.xMin);
      xMax = Math.max(xMax, bal.bounds.xMax);
      zMin = Math.min(zMin, bal.bounds.zMin);
      zMax = Math.max(zMax, bal.bounds.zMax);
    }
    return {
      xMin,
      xMax,
      zMin,
      zMax,
      width: Math.max(4, xMax - xMin),
      depth: Math.max(4, zMax - zMin),
      cx: (xMin + xMax) * 0.5,
      cz: (zMin + zMax) * 0.5,
    };
  }

  private fitOrthoCameraToActiveApt(zoomOverride?: number) {
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(240, this.container.clientHeight || window.innerHeight);
    const aspect = w / h;
    const b = this.getActiveAptCombinedBounds();
    const padX = b.width * 0.32 + 3.0;
    const padZ = b.depth * 0.54 + 5.8; // keeps entire apartment including South Verandah clear above dock
    const halfH = Math.max((b.depth + padZ) * 0.5, ((b.width + padX) * 0.5) / Math.max(0.55, aspect));

    this.orthoCamera.left = -halfH * aspect;
    this.orthoCamera.right = halfH * aspect;
    this.orthoCamera.top = halfH;
    this.orthoCamera.bottom = -halfH;
    this.orthoCamera.zoom = zoomOverride ?? 1.0;
    this.orthoCamera.updateProjectionMatrix();

    const floorY = (this.activeApt.floor - 1) * ARCH.FLOOR_HEIGHT;
    this.orthoCamera.position.set(b.cx, floorY + 26, b.cz - 2.39);
    this.orthoControls.target.set(b.cx, floorY + 0.4, b.cz - 2.4);
    this.orthoCamera.lookAt(this.orthoControls.target);
    this.orthoControls.update();
  }

  private computeAspectFittedExteriorPose(
    basePos: [number, number, number],
    baseTarget: [number, number, number],
    baseFov: number,
    spanWidthM: number,
    spanHeightM: number,
  ): [number, number, number] {
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(240, this.container.clientHeight || window.innerHeight);
    const aspect = w / h;
    const vFovRad = THREE.MathUtils.degToRad(baseFov);
    const tanHalfV = Math.tan(vFovRad * 0.5);
    const tanHalfH = tanHalfV * aspect;

    const reqDistH = (spanWidthM * 0.54) / Math.max(0.22, tanHalfH);
    const reqDistV = (spanHeightM * 0.56) / Math.max(0.22, tanHalfV);
    const baseDist = Math.hypot(
      basePos[0] - baseTarget[0],
      basePos[1] - baseTarget[1],
      basePos[2] - baseTarget[2],
    );
    const neededDist = Math.max(baseDist, reqDistH, reqDistV);
    const scale = neededDist / Math.max(1, baseDist);
    return [
      baseTarget[0] + (basePos[0] - baseTarget[0]) * scale,
      baseTarget[1] + (basePos[1] - baseTarget[1]) * scale,
      baseTarget[2] + (basePos[2] - baseTarget[2]) * scale,
    ];
  }

  public stepBackLevel(): TourLevel | null {
    this.wheelZoomOutAccum = 0;
    if (this.tourLevel === 'room') {
      const targetLayout = this.lastApartmentLayoutMode;
      this.tourLevel = 'apartment';
      this.userCeilingVisible = false;
      this.userRoofVisible = false;
      this.setViewMode(targetLayout, false, true);
      this.callbacks.onTourLevelStepBack?.('apartment', targetLayout);
      return 'apartment';
    }
    if (this.tourLevel === 'apartment') {
      this.tourLevel = 'floor';
      this.focusFloor(this.activeApt.floor, false, true);
      this.callbacks.onTourLevelStepBack?.('floor', 'exterior');
      return 'floor';
    }
    if (this.tourLevel === 'floor' || this.tourLevel === 'rooftop') {
      this.tourLevel = 'building';
      this.goToExteriorPreset('tower-34', false, true);
      this.callbacks.onTourLevelStepBack?.('building', 'exterior');
      return 'building';
    }
    return null;
  }

  public setTourLevel(
    level: TourLevel,
    instant = false,
    targetRoomId?: string | null,
  ) {
    if (this.tourLevel === 'building' && level !== 'building') {
      this.saveCurrentFrame('building');
    } else if (this.tourLevel === 'floor' && level !== 'floor') {
      this.saveCurrentFrame('floor');
    } else if (this.tourLevel === 'apartment' && level === 'room') {
      this.saveCurrentFrame('apartment');
    }

    this.tourLevel = level;
    this.wheelZoomOutAccum = 0;

    if (level === 'building') {
      this.goToExteriorPreset('tower-34', instant);
    } else if (level === 'floor') {
      this.focusFloor(this.activeApt.floor, instant);
    } else if (level === 'apartment') {
      this.userCeilingVisible = false;
      this.userRoofVisible = false;
      const layoutMode =
        this.viewMode === 'floorplan' ? 'floorplan' : this.lastApartmentLayoutMode;
      this.setViewMode(layoutMode, instant);
    } else if (level === 'room') {
      if (targetRoomId) {
        this.enterRoom(targetRoomId, instant);
      } else {
        this.setViewMode('walkthrough', instant);
      }
    } else if (level === 'rooftop') {
      this.goToRooftopPreset('pool-overview', instant);
    }
  }

  public setViewMode(mode: ViewMode, instant = false, restoreSaved = false) {
    const prevMode = this.viewMode;
    if (prevMode === 'dollhouse' || prevMode === 'floorplan') {
      this.saveCurrentFrame('apartment');
    } else if (prevMode === 'exterior' && this.tourLevel === 'building') {
      this.saveCurrentFrame('building');
    } else if (prevMode === 'exterior' && this.tourLevel === 'floor') {
      this.saveCurrentFrame('floor');
    }

    this.viewMode = mode;
    this.wheelZoomOutAccum = 0;

    if (mode === 'dollhouse' || mode === 'floorplan') {
      this.tourLevel = 'apartment';
      this.lastApartmentLayoutMode = mode;
    } else if (mode === 'walkthrough') {
      this.tourLevel = 'room';
    } else if (
      mode === 'exterior' &&
      this.tourLevel !== 'floor' &&
      this.tourLevel !== 'rooftop'
    ) {
      this.tourLevel = 'building';
    }

    const crossingShellBoundary =
      (prevMode === 'exterior' && mode !== 'exterior') ||
      (prevMode !== 'exterior' && mode === 'exterior');
    if (crossingShellBoundary && !instant && !this.reducedMotion) {
      this.callbacks.onTransitionFade?.();
    }

    this.updateLayerVisibility();
    this.updateClipPlanes(mode);

    const shouldSnap =
      instant ||
      this.isSoftwareGl ||
      crossingShellBoundary ||
      mode === 'walkthrough' ||
      prevMode === 'walkthrough';

    const apt = this.activeApt;
    const floorY = (apt.floor - 1) * ARCH.FLOOR_HEIGHT;
    const b = this.getActiveAptCombinedBounds();

    if (mode === 'floorplan') {
      this.activeCamera = this.orthoCamera;
      this.controls.enabled = false;
      this.orthoControls.enabled = true;
      this.transition.active = false;
      const saved = restoreSaved ? this.savedFrames.get('apartment') : undefined;
      this.fitOrthoCameraToActiveApt(saved?.viewMode === 'floorplan' ? saved.orthoZoom : 1.0);
    } else if (mode === 'exterior') {
      this.activeCamera = this.camera;
      this.orthoControls.enabled = false;
      this.controls.enabled = true;
      this.controls.maxPolarAngle = Math.PI * 0.49;
      this.controls.minDistance = 8;
      this.controls.maxDistance = 125;
      const defExt = EXTERIOR_CAMERA_PRESETS[0];
      const fitted = this.computeAspectFittedExteriorPose(
        defExt.position,
        defExt.target,
        defExt.fov,
        45.0,
        53.0,
      );
      this.moveCameraTo(fitted, defExt.target, defExt.fov, shouldSnap);
    } else if (mode === 'dollhouse') {
      this.activeCamera = this.camera;
      this.orthoControls.enabled = false;
      this.controls.enabled = true;
      this.controls.maxPolarAngle = Math.PI * 0.45;
      this.controls.minDistance = 4;
      this.controls.maxDistance = 38;
      const saved = restoreSaved ? this.savedFrames.get('apartment') : undefined;
      if (saved && saved.viewMode === 'dollhouse') {
        this.moveCameraTo(saved.pos, saved.target, saved.fov, shouldSnap);
      } else {
        const span = Math.max(b.width, b.depth);
        const baseTarget: [number, number, number] = [b.cx, floorY + 0.6, b.cz + 0.6];
        const basePos: [number, number, number] = [
          b.cx + span * 0.46,
          floorY + span * 0.92 + 2.4,
          b.cz + span * 0.96,
        ];
        const fittedPos = this.computeAspectFittedExteriorPose(
          basePos,
          baseTarget,
          44,
          b.width * 1.18,
          b.depth * 1.18,
        );
        this.moveCameraTo(fittedPos, baseTarget, 44, shouldSnap);
      }
    } else {
      this.activeCamera = this.camera;
      this.orthoControls.enabled = false;
      this.controls.enabled = false;
      this.placeAtEntry(shouldSnap);
    }

    this.applyCurrentLighting();
    this.emitProjectedRoomLabels();
    this.requestRender();
  }

  public focusFloor(floor: FloorNumber, instant = false, restoreSaved = false) {
    if (this.viewMode !== 'exterior') {
      this.saveCurrentFrame('apartment');
    }
    this.tourLevel = 'floor';
    this.viewMode = 'exterior';
    this.activeCamera = this.camera;
    this.orthoControls.enabled = false;
    this.updateClipPlanes('exterior');

    const floorY = (floor - 1) * ARCH.FLOOR_HEIGHT + 1.45;
    this.controls.enabled = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 72;
    this.updateLayerVisibility();
    this.applyCurrentLighting();
    this.emitProjectedRoomLabels();

    const saved = restoreSaved ? this.savedFrames.get('floor') : undefined;
    if (saved) {
      this.moveCameraTo(saved.pos, saved.target, saved.fov, instant || this.isSoftwareGl);
      return;
    }

    const baseTarget: [number, number, number] = [0, floorY, 0.5];
    const basePos: [number, number, number] = [20.5, floorY + 3.6, -28.0];
    const fitted = this.computeAspectFittedExteriorPose(
      basePos,
      baseTarget,
      44,
      36.0,
      10.0,
    );
    this.moveCameraTo(
      fitted,
      baseTarget,
      44,
      instant || this.isSoftwareGl,
    );
  }

  public goToExteriorPreset(
    presetId: ExteriorPresetSpec['id'],
    instant = false,
    restoreSaved = false,
  ) {
    const preset =
      EXTERIOR_CAMERA_PRESETS.find((p) => p.id === presetId) ??
      EXTERIOR_CAMERA_PRESETS[0];
    const crossing = this.viewMode !== 'exterior';
    if (crossing && !instant && !this.reducedMotion) {
      this.callbacks.onTransitionFade?.();
    }
    this.tourLevel = 'building';
    this.viewMode = 'exterior';
    this.activeCamera = this.camera;
    this.orthoControls.enabled = false;
    this.exteriorRoofVisible = true;
    this.controls.enabled = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 125;
    this.updateClipPlanes('exterior');
    this.updateLayerVisibility();
    this.applyCurrentLighting();
    this.emitProjectedRoomLabels();

    const saved =
      restoreSaved && presetId === 'tower-34'
        ? this.savedFrames.get('building')
        : undefined;
    if (saved) {
      this.moveCameraTo(
        saved.pos,
        saved.target,
        saved.fov,
        instant || this.isSoftwareGl || crossing,
      );
      return;
    }

    const pos =
      presetId === 'tower-34'
        ? this.computeAspectFittedExteriorPose(
            preset.position,
            preset.target,
            preset.fov,
            45.0,
            53.0,
          )
        : preset.position;
    this.moveCameraTo(
      pos,
      preset.target,
      preset.fov,
      instant || this.isSoftwareGl || crossing,
    );
  }

  public goToRooftopPreset(
    presetId: RooftopPresetSpec['id'],
    instant = false,
  ) {
    const preset =
      ROOFTOP_CAMERA_PRESETS.find((p) => p.id === presetId) ??
      ROOFTOP_CAMERA_PRESETS[0];
    const crossing = this.viewMode !== 'exterior';
    if (crossing && !instant && !this.reducedMotion) {
      this.callbacks.onTransitionFade?.();
    }
    this.tourLevel = 'rooftop';
    this.viewMode = 'exterior';
    this.activeCamera = this.camera;
    this.orthoControls.enabled = false;
    this.exteriorRoofVisible = true;
    this.controls.enabled = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 58;
    this.updateClipPlanes('exterior');
    this.updateLayerVisibility();
    this.applyCurrentLighting();
    this.emitProjectedRoomLabels();
    this.moveCameraTo(
      preset.position,
      preset.target,
      preset.fov,
      instant || this.isSoftwareGl || crossing,
    );
  }

  public placeAtEntry(instant = false) {
    const [ex, ey, ez] = this.activeApt.entryPoint;
    const [lx, ly, lz] = this.activeApt.entryLookAt;
    this.moveWalkthroughCamera(ex, ey, ez, lx, ly, lz, 56, instant);
  }

  public goToPreset(presetId: string, instant = false) {
    const preset = this.activeApt.cameraPresets.find((p) => p.id === presetId);
    if (!preset) return;
    if (this.viewMode === 'dollhouse' || this.viewMode === 'floorplan') {
      this.saveCurrentFrame('apartment');
    }
    this.tourLevel = 'room';
    if (this.viewMode !== 'walkthrough') {
      this.viewMode = 'walkthrough';
      this.activeCamera = this.camera;
      this.orthoControls.enabled = false;
      this.controls.enabled = false;
      this.updateClipPlanes('walkthrough');
      this.updateLayerVisibility();
      this.emitProjectedRoomLabels();
    }
    const [px, py, pz] = preset.position;
    const [tx, ty, tz] = preset.target;
    const dist = Math.hypot(px - this.walkPos.x, pz - this.walkPos.z);
    // Cut cleanly with subtle crossfade when jumping across walls/rooms
    const crossingWalls = dist > 1.8 || preset.roomId !== this.currentRoomId;
    if (crossingWalls && !instant && !this.reducedMotion) {
      this.callbacks.onTransitionFade?.();
    }
    const shouldSnap = instant || this.isSoftwareGl || crossingWalls;
    this.moveWalkthroughCamera(px, py, pz, tx, ty, tz, preset.fov ?? 56, shouldSnap);
  }

  public enterRoom(roomId: string, instant = false) {
    const preset =
      this.activeApt.cameraPresets.find((p) => p.roomId === roomId) ??
      this.activeApt.cameraPresets.find((p) => p.id === roomId);
    if (preset) {
      this.goToPreset(preset.id, instant);
      return;
    }

    const room =
      this.activeApt.rooms.find((r) => r.id === roomId) ??
      this.activeApt.balconies.find((b) => b.id === roomId);
    if (!room) {
      this.setTourLevel('room', instant);
      return;
    }

    if (this.viewMode === 'dollhouse' || this.viewMode === 'floorplan') {
      this.saveCurrentFrame('apartment');
    }
    this.tourLevel = 'room';
    if (this.viewMode !== 'walkthrough') {
      this.viewMode = 'walkthrough';
      this.activeCamera = this.camera;
      this.orthoControls.enabled = false;
      this.controls.enabled = false;
      this.updateClipPlanes('walkthrough');
      this.updateLayerVisibility();
      this.emitProjectedRoomLabels();
    }

    const floorY = (this.activeApt.floor - 1) * ARCH.FLOOR_HEIGHT;
    const rx = (room.bounds.xMin + room.bounds.xMax) * 0.5;
    const rz = (room.bounds.zMin + room.bounds.zMax) * 0.5;
    const aptCx = (this.activeApt.bounds.xMin + this.activeApt.bounds.xMax) * 0.5;
    const aptCz = (this.activeApt.bounds.zMin + this.activeApt.bounds.zMax) * 0.5;
    if (!instant && !this.reducedMotion) {
      this.callbacks.onTransitionFade?.();
    }
    this.moveWalkthroughCamera(
      rx,
      floorY + ARCH.EYE_HEIGHT,
      rz,
      aptCx,
      floorY + 1.25,
      aptCz,
      58,
      true,
    );
  }

  private moveCameraTo(
    pos: [number, number, number],
    target: [number, number, number],
    fov: number,
    instant: boolean,
  ) {
    if (instant || this.reducedMotion) {
      this.transition.active = false;
      this.camera.position.set(...pos);
      this.controls.target.set(...target);
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    } else {
      this.transition.active = true;
      this.transition.targetPos.set(...pos);
      this.transition.targetLook.set(...target);
      this.transition.targetFov = fov;
    }
    this.requestRender();
  }

  private moveWalkthroughCamera(
    px: number,
    py: number,
    pz: number,
    tx: number,
    ty: number,
    tz: number,
    fov: number,
    instant: boolean,
  ) {
    // Ensure walkthrough anchor never intersects wall/furniture colliders
    const validated = resolvePlayerMovement(
      px,
      pz,
      px,
      pz,
      0.22,
      this.colliders,
      this.state.doors,
    );
    this.walkPos.set(validated.x, py, validated.z);
    const dx = tx - validated.x;
    const dy = ty - py;
    const dz = tz - validated.z;
    const horiz = Math.hypot(dx, dz);
    this.walkYaw = Math.atan2(-dx, -dz);
    this.walkPitch = THREE.MathUtils.clamp(Math.atan2(dy, horiz), -1.1, 1.1);

    if (instant || this.reducedMotion) {
      this.transition.active = false;
      this.camera.position.copy(this.walkPos);
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.applyWalkOrientation();
    } else {
      this.transition.active = true;
      this.transition.targetPos.copy(this.walkPos);
      this.transition.targetLook.set(tx, ty, tz);
      this.transition.targetFov = fov;
    }

    const room = findRoomAtPosition(px, pz, this.activeApt);
    this.currentRoomId = room.id;
    this.callbacks.onRoomChange?.(room.id, room.name);
    this.callbacks.onPlayerMove?.(px, pz, this.walkYaw);
    this.requestRender();
  }

  private applyWalkOrientation() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.walkYaw;
    this.camera.rotation.x = this.walkPitch;
    this.camera.rotation.z = 0;
  }

  private updateLayerVisibility() {
    const activeFloor = this.activeApt.floor;

    if (this.viewMode === 'walkthrough') {
      this.buildingShell.roofGroup.visible = true;
    } else if (this.viewMode === 'exterior') {
      this.buildingShell.roofGroup.visible =
        this.tourLevel === 'rooftop' ? true : this.exteriorRoofVisible;
    } else {
      this.buildingShell.roofGroup.visible = this.userRoofVisible;
    }

    this.buildingShell.floorShells.forEach((group, floorNum) => {
      if (this.viewMode === 'exterior') {
        group.visible = true;
      } else if (this.viewMode === 'walkthrough') {
        // Keep floor below, active floor, and floor above visible for window outlook & speed
        group.visible = Math.abs(floorNum - activeFloor) <= 1;
      } else {
        group.visible = floorNum <= activeFloor;
      }
    });

    this.buildingShell.floorHighlightBars.forEach((bar, floorNum) => {
      bar.visible =
        this.viewMode === 'exterior' &&
        this.tourLevel !== 'rooftop' &&
        floorNum === activeFloor;
    });

    const showInterior = this.viewMode !== 'exterior';
    if (this.activeApt) {
      const activeShell = this.buildingShell.apartmentOverviewShells.get(
        this.activeApt.id,
      );
      if (activeShell) {
        activeShell.visible = !showInterior;
      }
    }
    if (this.activeFurn) {
      this.activeFurn.group.visible = showInterior;
    }

    if (this.activeArch) {
      this.activeArch.group.visible = showInterior;
      this.activeArch.ceilingGroup.visible =
        this.viewMode === 'walkthrough' ||
        this.viewMode === 'exterior' ||
        this.userCeilingVisible;
      this.activeArch.cutawayWallGroup.visible =
        this.viewMode === 'walkthrough' || this.viewMode === 'exterior';
      this.activeArch.roomOverlayGroup.visible =
        this.viewMode === 'dollhouse' || this.viewMode === 'floorplan';
    }
  }

  public setLightingMode(mode: LightingMode, instant = false) {
    const targetPreset = LIGHTING_PRESETS[mode];
    const snapSource = this.snapshotCurrentLighting(this.lightingMode);
    this.lightingMode = mode;

    if (instant || this.reducedMotion) {
      this.lightingFrom = targetPreset;
      this.lightingTo = targetPreset;
      this.lightingSettled = true;
      lerpLightingState(targetPreset, targetPreset, 1, this.lightingState);
      this.applyCurrentLighting();
      this.container.setAttribute('data-lighting-settled', 'true');
    } else {
      this.lightingFrom = snapSource;
      this.lightingTo = targetPreset;
      this.lightingStartTime = performance.now();
      this.lightingSettled = false;
      this.container.setAttribute('data-lighting-settled', 'false');
    }
    this.requestRender();
  }

  private snapshotCurrentLighting(mode: LightingMode): LightingPreset {
    const s = this.lightingState;
    const base = LIGHTING_PRESETS[mode];
    const horizontalLen = Math.hypot(s.sunPosition.x, s.sunPosition.z);
    const elevationDeg = THREE.MathUtils.radToDeg(
      Math.atan2(s.sunPosition.y, Math.max(0.01, horizontalLen)),
    );
    const azimuthDeg = THREE.MathUtils.radToDeg(
      Math.atan2(s.sunPosition.x, -s.sunPosition.z),
    );
    return {
      ...base,
      skyZenithHex: s.skyZenith.getHex(),
      skyHorizonHex: s.skyHorizon.getHex(),
      skyGroundHex: s.skyGround.getHex(),
      sunGlowHex: s.sunGlow.getHex(),
      fogHex: s.fog.getHex(),
      fogNear: s.fogNear,
      fogFar: s.fogFar,
      sunHex: s.sun.getHex(),
      sunIntensity: s.sunIntensity,
      sunElevationDeg: elevationDeg,
      sunAzimuthDeg: azimuthDeg,
      hemiSkyHex: s.hemiSky.getHex(),
      hemiGroundHex: s.hemiGround.getHex(),
      hemiIntensity: s.hemiIntensity,
      bounceHex: s.bounce.getHex(),
      bounceIntensity: s.bounceIntensity,
      envIntensity: s.envIntensity,
      exposure: s.exposure,
      roomPointIntensity: s.roomPointIntensity,
      lampPointIntensity: s.lampPointIntensity,
      roomEmissive: s.roomEmissive,
      lampEmissive: s.lampEmissive,
      underCabinetEmissive: s.underCabinetEmissive,
      exteriorLightIntensity: s.exteriorLightIntensity,
      exteriorFixtureEmissive: s.exteriorFixtureEmissive,
      winGlowEmissive: s.winGlowEmissive,
      lobbyEmissive: s.lobbyEmissive,
      glassTintHex: s.glassTint.getHex(),
      glassOpacity: s.glassOpacity,
      glassReflectivity: s.glassReflectivity,
      glassEnvIntensity: s.glassEnvIntensity,
    };
  }

  private getCurtainDaylightFactor(): number {
    if (this.viewMode === 'exterior' || !this.activeArch?.curtains.length) {
      return 1.0;
    }
    let sum = 0;
    for (const c of this.activeArch.curtains) {
      sum += this.state.curtains[c.id] ? 1 : 0;
    }
    const openness = sum / this.activeArch.curtains.length;
    // Closed heavy drapes filter ~44% of interior daylight fill
    return THREE.MathUtils.lerp(0.56, 1.0, openness);
  }

  private applyCurrentLighting() {
    const s = this.lightingState;
    const curtainGain = this.getCurtainDaylightFactor();

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(s.skyHorizon);
    } else {
      this.scene.background = s.skyHorizon.clone();
    }
    this.renderer.setClearColor(s.skyHorizon, 1);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(s.fog);
      this.scene.fog.near = s.fogNear;
      this.scene.fog.far = s.fogFar;
    }

    this.skyDome.uniforms.uZenithColor.value.copy(s.skyZenith);
    this.skyDome.uniforms.uHorizonColor.value.copy(s.skyHorizon);
    this.skyDome.uniforms.uGroundColor.value.copy(s.skyGround);
    this.skyDome.uniforms.uSunGlowColor.value.copy(s.sunGlow);
    this.skyDome.uniforms.uSunDir.value.copy(s.sunPosition).normalize();
    this.skyDome.uniforms.uSunGlowStrength.value = THREE.MathUtils.clamp(
      s.sunIntensity / 1.72,
      0.14,
      0.72,
    );

    this.sunLight.color.copy(s.sun);
    this.sunLight.position.copy(s.sunPosition);
    this.sunLight.intensity = s.sunIntensity * curtainGain;
    this.fillHemi.color.copy(s.hemiSky);
    this.fillHemi.groundColor.copy(s.hemiGround);
    this.fillHemi.intensity = s.hemiIntensity * curtainGain;
    this.bounceLight.color.copy(s.bounce);
    this.bounceLight.intensity = s.bounceIntensity * curtainGain;
    this.scene.environmentIntensity = s.envIntensity;
    this.renderer.toneMappingExposure = s.exposure;

    // Dynamic windowGlass modulation across Morning, Evening, and Night
    this.mats.windowGlass.color.copy(s.glassTint);
    this.mats.windowGlass.opacity = this.isSoftwareGl
      ? Math.max(0.22, s.glassOpacity - 0.04)
      : s.glassOpacity;
    this.mats.windowGlass.reflectivity = s.glassReflectivity;
    this.mats.windowGlass.envMapIntensity = s.glassEnvIntensity;

    // Localized exterior portico & forecourt lighting pools
    this.porticoLight.intensity = s.exteriorLightIntensity;
    this.walkwayLight.intensity = s.exteriorLightIntensity * 1.15;

    this.syncLightingFixtures();
  }

  private syncLightingFixtures() {
    const s = this.lightingState;

    // Building Exterior Sconces, Bollards, Streetlamps, Rooftop & Subtle Signage Backlighting
    for (const m of this.buildingShell.exteriorEmissives) {
      const scaleCap =
        typeof m.userData.maxEmissiveScale === 'number'
          ? m.userData.maxEmissiveScale
          : 1;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity =
        s.exteriorFixtureEmissive * scaleCap;
    }

    // Ground Lobby & Portico Luminaires
    for (const m of this.buildingShell.lobbyEmissives) {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity =
        s.lobbyEmissive;
    }

    // Occupied Tower & Neighbor Window Warm Interior Glows (Evening / Night only)
    for (const m of this.buildingShell.exteriorWinEmissives) {
      const glowScale =
        typeof m.userData.glowScale === 'number' ? m.userData.glowScale : 1;
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity =
        s.winGlowEmissive * glowScale;
    }

    // Parked Sedan Headlights (subtle warm glow in Evening / Night)
    const carHeadGlow = THREE.MathUtils.clamp(s.exteriorLightIntensity / 2.2, 0, 1.25);
    for (const m of this.buildingShell.vehicleEmissives) {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = carHeadGlow;
    }

    // Active Apartment Ceiling Downlights & Cove Emissives
    if (this.activeArch) {
      for (const fix of this.activeArch.lightFixtures) {
        const on = this.state.roomLights[fix.roomId] ?? true;
        for (const m of fix.emissiveMeshes) {
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = on
            ? s.roomEmissive
            : 0.0;
        }
      }
    }

    // Active Apartment Localized Room PointLights
    this.roomPointLights.forEach((pt, roomId) => {
      const on = this.state.roomLights[roomId] ?? true;
      pt.intensity = on ? s.roomPointIntensity : 0;
    });

    // Lamps, Under-Cabinet Kitchen LED & Wardrobe Interior LED
    if (this.activeFurn) {
      for (const lamp of this.activeFurn.lamps) {
        const roomOn = this.state.roomLights[lamp.roomId] ?? true;
        const lampOn = (this.state.lamps[lamp.id] ?? true) && roomOn;
        (lamp.emissiveMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
          lampOn ? s.lampEmissive : 0.0;
        if (lamp.pointLight) {
          lamp.pointLight.intensity = lampOn ? s.lampPointIntensity : 0;
        }
      }

      const kitchenLightOn =
        (this.state.roomLights.kitchen ?? true) && this.state.underCabinetLight;
      for (const m of this.activeFurn.underCabinetEmissives) {
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity =
          kitchenLightOn ? s.underCabinetEmissive : 0.0;
      }

      const wOpen = this.state.wardrobeOpen;
      for (const m of this.activeFurn.wardrobeLightEmissives) {
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = wOpen
          ? 1.75
          : 0.0;
      }
      if (this.activeFurn.wardrobePointLight) {
        this.activeFurn.wardrobePointLight.intensity = wOpen ? 1.45 : 0.0;
      }
    }
  }

  public updateInteractiveState(
    updater: (prev: TourInteractiveState) => TourInteractiveState,
  ) {
    this.state = updater(this.state);
    this.apartmentStates.set(this.activeApt.id, this.state);
    this.applyCurrentLighting();
    if (this.reducedMotion || this.isSoftwareGl) {
      this.syncInteractiveVisuals(true);
    }
    this.requestRender();
  }

  public setTouchMove(x: number, z: number) {
    this.touchMove.x = x;
    this.touchMove.z = z;
    if (Math.abs(x) > 0.01 || Math.abs(z) > 0.01) {
      this.requestRender();
    }
  }

  private syncInteractiveVisuals(snap: boolean) {
    if (!this.activeArch || !this.activeFurn) return;

    for (const d of this.activeArch.doors) {
      const target = this.state.doors[d.id] ? 1 : 0;
      if (snap) this.doorProgress.set(d.id, target);
      const val = this.doorProgress.get(d.id) ?? target;
      if (d.kind === 'hinged') {
        d.pivot.rotation.y = (d.openRotation ?? 1.4) * val;
      } else if (d.slideVector && d.closedPos) {
        d.pivot.position
          .copy(d.closedPos)
          .addScaledVector(d.slideVector, val);
      }
    }

    for (const c of this.activeArch.curtains) {
      const target = this.state.curtains[c.id] ? 1 : 0;
      if (snap) this.curtainProgress.set(c.id, target);
      const val = this.curtainProgress.get(c.id) ?? target;

      // Retract both sheer inner panels & heavy woven stone outer drapes toward side stacks
      const sheerScaleX = THREE.MathUtils.lerp(1.0, 0.34, val);
      c.leftSheer.scale.x = sheerScaleX;
      c.rightSheer.scale.x = sheerScaleX;
      c.rightSheer.position.x =
        c.centerOffset + c.spanWidth * 2 - c.spanWidth * sheerScaleX;

      const drapeScaleX = THREE.MathUtils.lerp(1.0, 0.22, val);
      c.leftDrape.scale.x = drapeScaleX;
      c.rightDrape.scale.x = drapeScaleX;
      c.rightDrape.position.x =
        c.centerOffset + c.spanWidth * 2 - c.spanWidth * drapeScaleX;
    }

    for (const dr of this.activeFurn.drawers) {
      const target = this.state.drawers[dr.id] ? 1 : 0;
      if (snap) this.drawerProgress.set(dr.id, target);
      const val = this.drawerProgress.get(dr.id) ?? target;
      dr.mesh.position.copy(dr.closedPos).addScaledVector(dr.slideOffset, val);
    }

    for (const h of this.activeFurn.hingedParts) {
      const target = this.state.hinged[h.id] ? 1 : 0;
      if (snap) this.hingedProgress.set(h.id, target);
      const val = this.hingedProgress.get(h.id) ?? target;
      h.pivot.rotation.y = h.openAngle * val;
    }

    const wTarget = this.state.wardrobeOpen ? 1 : 0;
    if (snap) this.wardrobeProgress = wTarget;
    for (const wd of this.activeFurn.wardrobeDoors) {
      wd.pivot.rotation.y = wd.openAngle * this.wardrobeProgress;
    }

    const lTarget = this.state.lockerOpen ? 1 : 0;
    if (snap) this.lockerProgress = lTarget;
    if (this.activeFurn.lockerDoor) {
      this.activeFurn.lockerDoor.pivot.rotation.y =
        this.activeFurn.lockerDoor.openAngle * this.lockerProgress;
    }
  }

  private handleObjectAction(
    actionType: string,
    actionId: string,
    label: string,
  ) {
    if (actionType === 'floor') {
      const floorNum = Number(actionId) as FloorNumber;
      if (floorNum >= 1 && floorNum <= ARCH.TOTAL_FLOORS) {
        this.loadApartment(floorNum, this.activeApt.type, false);
        this.focusFloor(floorNum, false);
        this.callbacks.onSelectFloor?.(floorNum);
        this.callbacks.onInteract?.(actionType, actionId, label);
      }
      return;
    }

    if (actionType === 'room-footprint') {
      if (this.callbacks.onSelectRoomFromLayout) {
        this.callbacks.onSelectRoomFromLayout(actionId);
      } else {
        this.enterRoom(actionId, false);
      }
      this.callbacks.onInteract?.(actionType, actionId, label);
      return;
    }

    this.updateInteractiveState((prev) => {
      const next = { ...prev };
      if (actionType === 'door') {
        next.doors = { ...prev.doors, [actionId]: !prev.doors[actionId] };
      } else if (actionType === 'curtain') {
        next.curtains = {
          ...prev.curtains,
          [actionId]: !prev.curtains[actionId],
        };
      } else if (actionType === 'drawer') {
        next.drawers = { ...prev.drawers, [actionId]: !prev.drawers[actionId] };
      } else if (actionType === 'hinged') {
        next.hinged = { ...prev.hinged, [actionId]: !prev.hinged[actionId] };
      } else if (actionType === 'wardrobe') {
        next.wardrobeOpen = !prev.wardrobeOpen;
      } else if (actionType === 'locker') {
        next.lockerOpen = !prev.lockerOpen;
      } else if (actionType === 'lamp') {
        next.lamps = { ...prev.lamps, [actionId]: !prev.lamps[actionId] };
      } else if (actionType === 'fan') {
        const cur = prev.fanSpeeds[actionId] ?? 0;
        next.fanSpeeds = {
          ...prev.fanSpeeds,
          [actionId]: ((cur + 1) % 4) as FanSpeed,
        };
      }
      return next;
    });
    this.callbacks.onInteract?.(actionType, actionId, label);
  }

  private getClickables(): Array<{
    mesh: THREE.Object3D;
    actionType: string;
    actionId: string;
    label: string;
  }> {
    return [
      ...(this.activeArch?.clickTargets ?? []),
      ...(this.activeFurn?.clickTargets ?? []),
    ];
  }

  private onPointerDown = (e: PointerEvent) => {
    this.isPointerDown = true;
    this.didDrag = false;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.pointerLastPos = { x: e.clientX, y: e.clientY };
    this.transition.active = false;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isPointerDown) {
      const dx = e.clientX - this.pointerLastPos.x;
      const dy = e.clientY - this.pointerLastPos.y;
      if (
        Math.hypot(
          e.clientX - this.pointerDownPos.x,
          e.clientY - this.pointerDownPos.y,
        ) > 5
      ) {
        this.didDrag = true;
      }
      if (this.viewMode === 'walkthrough') {
        this.walkYaw -= dx * 0.0036;
        this.walkPitch = THREE.MathUtils.clamp(
          this.walkPitch - dy * 0.0028,
          -1.26,
          1.26,
        );
        this.applyWalkOrientation();
        this.callbacks.onPlayerMove?.(
          this.walkPos.x,
          this.walkPos.z,
          this.walkYaw,
        );
        this.requestRender();
      }
      this.pointerLastPos = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.target !== this.renderer.domElement) {
      this.callbacks.onHoverChange?.(null);
      return;
    }

    // Throttled hover raycast (<= 15Hz)
    const now = performance.now();
    if (now - this.lastHoverCheck < 75) return;
    this.lastHoverCheck = now;

    const hit = this.pickInteractive(e);
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    this.callbacks.onHoverChange?.(hit ? hit.label : null);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    if (!this.didDrag) {
      const hit = this.pickInteractive(e);
      if (hit) {
        this.handleObjectAction(hit.actionType, hit.actionId, hit.label);
      }
    }
  };

  private pickInteractive(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.activeCamera);

    // In Building or Floor exterior mode, allow clicking any floor 1..10 directly in 3D
    if (this.viewMode === 'exterior') {
      if (this.tourLevel === 'rooftop') return null;
      const floorMeshes = this.buildingShell.floorPickTargets.map((f) => f.mesh);
      const hits = this.raycaster.intersectObjects(floorMeshes, false);
      if (hits.length > 0) {
        const fl = hits[0].object.userData.floorNumber as FloorNumber | undefined;
        if (fl) {
          return {
            mesh: hits[0].object,
            actionType: 'floor',
            actionId: String(fl),
            label: `Floor ${fl} (+${((fl - 1) * ARCH.FLOOR_HEIGHT).toFixed(1)}m elevation)`,
          };
        }
      }
      return null;
    }

    // In Apartment Layout mode (dollhouse / floorplan), allow clicking any room footprint
    if (
      (this.viewMode === 'dollhouse' || this.viewMode === 'floorplan') &&
      this.activeArch &&
      this.activeArch.roomPickTargets.length > 0
    ) {
      const roomMeshes = this.activeArch.roomPickTargets.map((r) => r.mesh);
      const roomHits = this.raycaster.intersectObjects(roomMeshes, false);
      if (roomHits.length > 0) {
        const hitObj = roomHits[0].object;
        const match = this.activeArch.roomPickTargets.find(
          (r) => r.mesh === hitObj,
        );
        if (match) {
          return {
            mesh: hitObj,
            actionType: 'room-footprint',
            actionId: match.roomId,
            label: `Explore ${match.label}`,
          };
        }
      }
    }

    const targets = this.getClickables();
    const meshes = targets.map((t) => t.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;

    // Occlusion check: ensure solid architecture doesn't sit in front of the hit target
    const firstHit = hits[0];
    if (this.activeArch) {
      const wallHits = this.raycaster.intersectObject(this.activeArch.group, true);
      for (const wh of wallHits) {
        if (wh.distance + 0.04 < firstHit.distance) {
          let p: THREE.Object3D | null = wh.object;
          let sameTarget = false;
          while (p) {
            if (p === firstHit.object || targets.some((t) => t.mesh === p)) {
              sameTarget = true;
              break;
            }
            p = p.parent;
          }
          if (!sameTarget) return null;
        }
        break;
      }
    }

    let obj: THREE.Object3D | null = firstHit.object;
    while (obj) {
      const match = targets.find((t) => t.mesh === obj);
      if (match) return match;
      obj = obj.parent;
    }
    return null;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.code,
      )
    ) {
      this.keysPressed.add(e.code);
      this.requestRender();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code);
  };

  private onResize = () => {
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(240, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.viewMode === 'floorplan') {
      this.fitOrthoCameraToActiveApt(this.orthoCamera.zoom);
    } else {
      const aspect = w / h;
      const halfH = this.orthoCamera.top;
      this.orthoCamera.left = -halfH * aspect;
      this.orthoCamera.right = halfH * aspect;
      this.orthoCamera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.activeCamera);
    this.emitProjectedRoomLabels();
    this.requestRender();
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost?.(true);
  };

  private onContextRestored = () => {
    this.callbacks.onContextLost?.(false);
    this.requestRender();
  };

  private onWheel = (e: WheelEvent) => {
    if (e.deltaY <= 0) {
      this.wheelZoomOutAccum = 0;
      return;
    }

    if (this.viewMode === 'walkthrough') {
      this.wheelZoomOutAccum += e.deltaY;
      if (this.wheelZoomOutAccum >= 260) {
        this.wheelZoomOutAccum = 0;
        this.stepBackLevel();
      }
      return;
    }

    if (this.tourLevel === 'apartment') {
      const atMax =
        this.viewMode === 'floorplan'
          ? this.orthoCamera.zoom <= this.orthoControls.minZoom + 0.06
          : this.camera.position.distanceTo(this.controls.target) >=
            this.controls.maxDistance * 0.92;
      if (atMax) {
        this.wheelZoomOutAccum += e.deltaY;
        if (this.wheelZoomOutAccum >= 320) {
          this.wheelZoomOutAccum = 0;
          this.stepBackLevel();
        }
      } else {
        this.wheelZoomOutAccum = 0;
      }
      return;
    }

    if (this.tourLevel === 'floor') {
      const atMax =
        this.camera.position.distanceTo(this.controls.target) >=
        this.controls.maxDistance * 0.9;
      if (atMax) {
        this.wheelZoomOutAccum += e.deltaY;
        if (this.wheelZoomOutAccum >= 360) {
          this.wheelZoomOutAccum = 0;
          this.stepBackLevel();
        }
      } else {
        this.wheelZoomOutAccum = 0;
      }
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.pinchStartDist = Math.hypot(dx, dy);
    } else {
      this.pinchStartDist = null;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && this.pinchStartDist !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist - this.pinchStartDist;
      if (this.viewMode === 'walkthrough' && delta < -58) {
        this.pinchStartDist = null;
        this.stepBackLevel();
      }
    }
  };

  private onTouchEnd = () => {
    this.pinchStartDist = null;
  };

  private bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    dom.addEventListener('touchstart', this.onTouchStart, { passive: true });
    dom.addEventListener('touchmove', this.onTouchMove, { passive: true });
    dom.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private emitProjectedRoomLabels() {
    if (
      !this.callbacks.onRoomLabelsChange ||
      (this.viewMode !== 'dollhouse' && this.viewMode !== 'floorplan')
    ) {
      if (this.lastProjectedKey !== '') {
        this.lastProjectedKey = '';
        this.callbacks.onRoomLabelsChange?.([]);
      }
      return;
    }

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w < 100 || h < 100) return;

    this.activeCamera.updateMatrixWorld();
    const floorY = (this.activeApt.floor - 1) * ARCH.FLOOR_HEIGHT + 0.15;
    const labels: ProjectedRoomLabel[] = [];
    const seen = new Set<string>();

    const allSpaces = [
      ...this.activeApt.rooms
        .filter((r) => r.category !== 'hallway')
        .map((r) => ({ id: r.id, name: r.name, bounds: r.bounds })),
      ...this.activeApt.balconies.map((b) => ({ id: b.id, name: b.name, bounds: b.bounds })),
    ];

    for (const sp of allSpaces) {
      if (seen.has(sp.id)) continue;
      seen.add(sp.id);
      _vecB.set(
        (sp.bounds.xMin + sp.bounds.xMax) * 0.5,
        floorY,
        (sp.bounds.zMin + sp.bounds.zMax) * 0.5,
      );
      _vecB.project(this.activeCamera);
      if (_vecB.z < -1 || _vecB.z > 1) continue;
      const sx = Math.round((_vecB.x * 0.5 + 0.5) * w);
      let sy = Math.round((-_vecB.y * 0.5 + 0.5) * h);
      if (sx >= 24 && sx <= w - 24 && sy >= 56 && sy <= h - 104) {
        for (const prev of labels) {
          if (Math.abs(prev.x - sx) < 92 && Math.abs(prev.y - sy) < 26) {
            sy = prev.y <= sy ? prev.y + 28 : prev.y - 28;
          }
        }
        sy = Math.max(58, Math.min(h - 108, sy));
        labels.push({ id: sp.id, name: sp.name, x: sx, y: sy });
      }
    }

    const key = labels.map((l) => `${l.id}:${l.x},${l.y}`).join('|');
    if (key !== this.lastProjectedKey) {
      this.lastProjectedKey = key;
      this.callbacks.onRoomLabelsChange(labels);
    }
  }

  public requestRender() {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;
      const needsMoreFrames = this.stepSimulation();
      this.skyDome.mesh.position.copy(this.activeCamera.position);
      this.renderer.render(this.scene, this.activeCamera);
      this.renderSeq += 1;
      this.container.setAttribute('data-render-seq', String(this.renderSeq));
      if (!this.hasRenderedFirstFrame) {
        this.hasRenderedFirstFrame = true;
        this.container.setAttribute('data-engine-ready', 'true');
      }

      const done = () => {
        this.renderBusy = false;
        if ((this.renderDirty || needsMoreFrames) && !this.disposed) {
          this.requestRender();
        }
      };

      if (this.isSoftwareGl) {
        this.afterDraw(done);
      } else {
        done();
      }
    });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(): boolean {
    const now = performance.now();
    const rawElapsed = Math.max(0.001, (now - this.lastTickTime) / 1000);
    const dt = Math.min(0.05, rawElapsed);
    const animDt = this.isSoftwareGl ? Math.min(0.35, Math.max(0.16, rawElapsed)) : dt;
    this.lastTickTime = now;
    let activeMotion = false;

    // 0. Smooth Wall-Clock Lighting Transition (~2.0s)
    if (!this.lightingSettled) {
      const progress = Math.min(1, (now - this.lightingStartTime) / this.lightingDurationMs);
      lerpLightingState(this.lightingFrom, this.lightingTo, progress, this.lightingState);
      this.applyCurrentLighting();
      if (progress >= 1) {
        this.lightingSettled = true;
        this.container.setAttribute('data-lighting-settled', 'true');
      } else {
        activeMotion = true;
      }
    }

    // 1. Camera Preset / Mode Transitions
    if (this.transition.active) {
      const lambda = 7.5;
      const alpha = 1 - Math.exp(-lambda * dt);
      this.camera.position.lerp(this.transition.targetPos, alpha);
      this.camera.fov = THREE.MathUtils.lerp(
        this.camera.fov,
        this.transition.targetFov,
        alpha,
      );
      this.camera.updateProjectionMatrix();

      if (this.viewMode === 'walkthrough') {
        this.camera.rotation.order = 'YXZ';
        this.walkPos.copy(this.camera.position);
        this.camera.lookAt(this.transition.targetLook);
        this.walkYaw = this.camera.rotation.y;
        this.walkPitch = this.camera.rotation.x;
      } else {
        this.controls.target.lerp(this.transition.targetLook, alpha);
        this.controls.update();
      }

      if (this.camera.position.distanceTo(this.transition.targetPos) < 0.025) {
        this.camera.position.copy(this.transition.targetPos);
        if (this.viewMode === 'walkthrough') {
          this.walkPos.copy(this.transition.targetPos);
          this.camera.rotation.order = 'YXZ';
          this.camera.lookAt(this.transition.targetLook);
          this.walkYaw = this.camera.rotation.y;
          this.walkPitch = this.camera.rotation.x;
        } else {
          this.controls.target.copy(this.transition.targetLook);
          this.controls.update();
        }
        this.transition.active = false;
      } else {
        activeMotion = true;
      }
    } else if (this.viewMode === 'floorplan') {
      if (this.orthoControls.enableDamping) {
        this.orthoControls.update();
      }
    } else if (this.viewMode !== 'walkthrough') {
      if (this.controls.enableDamping) {
        this.controls.update();
      }
    }

    // 2. First-Person Walkthrough WASD / Arrow / Touch Movement with Collision
    if (this.viewMode === 'walkthrough' && !this.transition.active) {
      let fwd = 0;
      let strafe = 0;
      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) fwd += 1;
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) fwd -= 1;
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) strafe += 1;
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) strafe -= 1;
      fwd += this.touchMove.z;
      strafe += this.touchMove.x;

      if (Math.abs(fwd) > 0.01 || Math.abs(strafe) > 0.01) {
        const speed = 2.65;
        _forward.set(-Math.sin(this.walkYaw), 0, -Math.cos(this.walkYaw)).normalize();
        _right.crossVectors(_forward, _up).normalize();
        _vecA
          .set(0, 0, 0)
          .addScaledVector(_forward, fwd)
          .addScaledVector(_right, strafe);
        if (_vecA.lengthSq() > 1) _vecA.normalize();

        const targetX = this.walkPos.x + _vecA.x * speed * dt;
        const targetZ = this.walkPos.z + _vecA.z * speed * dt;
        const resolved = resolvePlayerMovement(
          this.walkPos.x,
          this.walkPos.z,
          targetX,
          targetZ,
          0.26,
          this.colliders,
          this.state.doors,
        );
        this.walkPos.x = resolved.x;
        this.walkPos.z = resolved.z;
        this.camera.position.copy(this.walkPos);
        this.applyWalkOrientation();
        activeMotion = true;

        if (now - this.lastHudEmit > 110) {
          this.lastHudEmit = now;
          this.callbacks.onPlayerMove?.(
            this.walkPos.x,
            this.walkPos.z,
            this.walkYaw,
          );
          const room = findRoomAtPosition(
            this.walkPos.x,
            this.walkPos.z,
            this.activeApt,
          );
          if (room.id !== this.currentRoomId) {
            this.currentRoomId = room.id;
            this.callbacks.onRoomChange?.(room.id, room.name);
          }
        }
      }
    }

    // 3. Smooth Door, Curtain, Drawer, Wardrobe, Locker, and Ceiling Fan Animations
    const dampStep = (curr: number, target: number) => {
      if (Math.abs(curr - target) < 0.006) return target;
      activeMotion = true;
      return THREE.MathUtils.damp(curr, target, 10, animDt);
    };

    if (this.activeArch) {
      for (const d of this.activeArch.doors) {
        const target = this.state.doors[d.id] ? 1 : 0;
        const nextVal = dampStep(this.doorProgress.get(d.id) ?? target, target);
        this.doorProgress.set(d.id, nextVal);
      }
      for (const c of this.activeArch.curtains) {
        const target = this.state.curtains[c.id] ? 1 : 0;
        const nextVal = dampStep(
          this.curtainProgress.get(c.id) ?? target,
          target,
        );
        this.curtainProgress.set(c.id, nextVal);
      }

      // Ceiling fans rotate around motor Y-axis
      for (const fan of this.activeArch.fans) {
        const spd = this.state.fanSpeeds[fan.roomId] ?? 0;
        if (spd > 0) {
          const radPerSec = spd === 1 ? 2.8 : spd === 2 ? 5.6 : 9.2;
          const nextAngle =
            ((this.fanAngles.get(fan.id) ?? 0) + radPerSec * dt) %
            (Math.PI * 2);
          this.fanAngles.set(fan.id, nextAngle);
          fan.rotor.rotation.y = nextAngle;
          // On software WebGL, advance fans smoothly when other interactions occur or keep moderate spin
          if (!this.isSoftwareGl) activeMotion = true;
        }
      }
    }

    if (this.activeFurn) {
      for (const dr of this.activeFurn.drawers) {
        const target = this.state.drawers[dr.id] ? 1 : 0;
        const nextVal = dampStep(
          this.drawerProgress.get(dr.id) ?? target,
          target,
        );
        this.drawerProgress.set(dr.id, nextVal);
      }
      for (const h of this.activeFurn.hingedParts) {
        const target = this.state.hinged[h.id] ? 1 : 0;
        const nextVal = dampStep(
          this.hingedProgress.get(h.id) ?? target,
          target,
        );
        this.hingedProgress.set(h.id, nextVal);
      }
      this.wardrobeProgress = dampStep(
        this.wardrobeProgress,
        this.state.wardrobeOpen ? 1 : 0,
      );
      this.lockerProgress = dampStep(
        this.lockerProgress,
        this.state.lockerOpen ? 1 : 0,
      );
    }

    this.syncInteractiveVisuals(false);
    this.emitProjectedRoomLabels();
    return activeMotion;
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('touchstart', this.onTouchStart);
    dom.removeEventListener('touchmove', this.onTouchMove);
    dom.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.controls.dispose();
    this.orthoControls.dispose();
    this.skyDome.dispose();
    if (this.activeArch) disposeObjectGroup(this.activeArch.group);
    if (this.activeFurn) disposeObjectGroup(this.activeFurn.group);
    disposeObjectGroup(this.buildingShell.root);
    this.mats.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}

function disposeObjectGroup(group: THREE.Object3D) {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      // Local per-fixture emissive materials (not shared MaterialLibrary)
      if (
        obj.material instanceof THREE.MeshStandardMaterial &&
        obj.material.emissiveIntensity !== undefined &&
        !obj.material.map &&
        obj.material.emissive.getHex() !== 0
      ) {
        obj.material.dispose();
      }
    }
  });
}
