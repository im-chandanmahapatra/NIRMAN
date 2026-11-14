import * as THREE from 'three';
import { TextureBundle } from './textures';

export interface MaterialLibrary {
  plasterWall: THREE.MeshStandardMaterial;
  exteriorPlaster: THREE.MeshStandardMaterial;
  facadeTrimPlaster: THREE.MeshStandardMaterial;
  recessedTaupe: THREE.MeshStandardMaterial;
  basePlinthStone: THREE.MeshStandardMaterial;
  ceilingPlaster: THREE.MeshStandardMaterial;
  limestoneFloor: THREE.MeshStandardMaterial;
  corridorStone: THREE.MeshStandardMaterial;
  oakH: THREE.MeshStandardMaterial;
  oakV: THREE.MeshStandardMaterial;
  walnutH: THREE.MeshStandardMaterial;
  walnutV: THREE.MeshStandardMaterial;
  teakExterior: THREE.MeshStandardMaterial;
  travertine: THREE.MeshStandardMaterial;
  quartziteCounter: THREE.MeshStandardMaterial;
  cabinetGreige: THREE.MeshStandardMaterial;
  boucleOatmeal: THREE.MeshPhysicalMaterial;
  linenOlive: THREE.MeshPhysicalMaterial;
  linenTaupe: THREE.MeshPhysicalMaterial;
  clayAccent: THREE.MeshPhysicalMaterial;
  beddingIvory: THREE.MeshPhysicalMaterial;
  sheerCurtain: THREE.MeshPhysicalMaterial;
  drapeCurtain: THREE.MeshPhysicalMaterial;
  dhurrieRug: THREE.MeshStandardMaterial;
  champagneBrass: THREE.MeshStandardMaterial;
  darkBronze: THREE.MeshStandardMaterial;
  matteBlackMetal: THREE.MeshStandardMaterial;
  rubberGasket: THREE.MeshStandardMaterial;
  stainlessSteel: THREE.MeshStandardMaterial;
  sinkBasinSteel: THREE.MeshStandardMaterial;
  applianceEnamel: THREE.MeshStandardMaterial;
  mirrorGlass: THREE.MeshPhysicalMaterial;
  windowGlass: THREE.MeshPhysicalMaterial;
  showerGlass: THREE.MeshPhysicalMaterial;
  ceramicWhite: THREE.MeshPhysicalMaterial;
  bathTile: THREE.MeshStandardMaterial;
  poolTile: THREE.MeshStandardMaterial;
  poolWater: THREE.MeshPhysicalMaterial;
  balconyPaver: THREE.MeshStandardMaterial;
  terracottaPot: THREE.MeshStandardMaterial;
  soil: THREE.MeshStandardMaterial;
  foliageA: THREE.MeshStandardMaterial;
  foliageB: THREE.MeshStandardMaterial;
  foliageC: THREE.MeshStandardMaterial;
  lawn: THREE.MeshStandardMaterial;
  drivewayStone: THREE.MeshStandardMaterial;
  asphaltRoad: THREE.MeshStandardMaterial;
  roadMarking: THREE.MeshStandardMaterial;
  compoundWall: THREE.MeshStandardMaterial;
  neighborFacade: THREE.MeshStandardMaterial;
  distantSkyline: THREE.MeshStandardMaterial;
  gatePlaque: THREE.MeshStandardMaterial;
  carPaintSilver: THREE.MeshPhysicalMaterial;
  carPaintBronze: THREE.MeshPhysicalMaterial;
  carCabinGlass: THREE.MeshPhysicalMaterial;
  water: THREE.MeshPhysicalMaterial;
  oledScreen: THREE.MeshStandardMaterial;
  inductionGlass: THREE.MeshPhysicalMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  artLiving: THREE.MeshStandardMaterial;
  artBedroom: THREE.MeshStandardMaterial;
  clockFace: THREE.MeshStandardMaterial;
  floorHighlight: THREE.MeshStandardMaterial;
  roomFootprintMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createMaterialLibrary(
  textures: TextureBundle,
  isSoftwareGl: boolean,
): MaterialLibrary {
  const mats: THREE.Material[] = [];
  const reg = <T extends THREE.Material>(m: T): T => {
    mats.push(m);
    return m;
  };

  // Primary matte lime plaster walls (#E7E2D8 via texture)
  const plasterWall = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.plasterColor,
      bumpMap: textures.plasterBump,
      bumpScale: 0.007,
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.25,
    }),
  );

  // Exterior NIRMAN architectural warm off-white limestone plaster (#E8E3DA)
  const exteriorPlaster = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.exteriorLimestoneColor,
      bumpMap: textures.plasterBump,
      bumpScale: 0.008,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.24,
    }),
  );

  // Secondary mineral greige stone for slab edges, spandrel reveals & balcony fascia (#BCB5A9)
  const facadeTrimPlaster = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.stoneGreigeColor,
      bumpMap: textures.stoneGreigeBump,
      bumpScale: 0.008,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.26,
    }),
  );

  // Muted architectural taupe for deep window pockets, louver screens & recessed panels (#8D8375)
  const recessedTaupe = reg(
    new THREE.MeshStandardMaterial({
      color: 0x8d8375,
      bumpMap: textures.plasterBump,
      bumpScale: 0.006,
      roughness: 0.82,
      metalness: 0.04,
      envMapIntensity: 0.24,
    }),
  );

  // Ground-level honed mineral stone plinth cladding (#9A9286)
  const basePlinthStone = reg(
    new THREE.MeshStandardMaterial({
      color: 0x9a9286,
      bumpMap: textures.stoneGreigeBump,
      bumpScale: 0.009,
      roughness: 0.72,
      metalness: 0.03,
      envMapIntensity: 0.28,
    }),
  );

  // Clean soft ceiling plaster subtly lighter than walls
  const ceilingPlaster = reg(
    new THREE.MeshStandardMaterial({
      color: 0xf0ece3,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.22,
    }),
  );

  // Honed mineral limestone floors (#C7C1B5 family)
  const limestoneFloor = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.limestoneColor,
      bumpMap: textures.limestoneBump,
      bumpScale: 0.006,
      roughnessMap: textures.limestoneRoughness,
      roughness: 0.56,
      metalness: 0.02,
      envMapIntensity: 0.32,
    }),
  );

  const corridorStone = reg(
    new THREE.MeshStandardMaterial({
      color: 0xc4beb2,
      bumpMap: textures.limestoneBump,
      bumpScale: 0.006,
      roughness: 0.64,
      metalness: 0.02,
      envMapIntensity: 0.3,
    }),
  );

  const oakH = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.oakColorH,
      bumpMap: textures.oakBumpH,
      bumpScale: 0.006,
      roughness: 0.48,
      metalness: 0.02,
      envMapIntensity: 0.36,
    }),
  );

  const oakV = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.oakColorV,
      bumpMap: textures.oakBumpV,
      bumpScale: 0.006,
      roughness: 0.48,
      metalness: 0.02,
      envMapIntensity: 0.36,
    }),
  );

  // Natural Walnut (#6F503C)
  const walnutH = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.walnutColorH,
      bumpMap: textures.walnutBumpH,
      bumpScale: 0.007,
      roughness: 0.42,
      metalness: 0.02,
      envMapIntensity: 0.4,
    }),
  );

  const walnutV = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.walnutColorV,
      bumpMap: textures.walnutBumpV,
      bumpScale: 0.007,
      roughness: 0.42,
      metalness: 0.02,
      envMapIntensity: 0.4,
    }),
  );

  const teakExterior = reg(
    new THREE.MeshStandardMaterial({
      color: 0xb68a60,
      map: textures.oakColorH,
      bumpMap: textures.oakBumpH,
      bumpScale: 0.008,
      roughness: 0.58,
      metalness: 0.02,
      envMapIntensity: 0.34,
    }),
  );

  const travertine = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.travertineColor,
      bumpMap: textures.travertineBump,
      bumpScale: 0.007,
      roughnessMap: textures.travertineRoughness,
      roughness: 0.48,
      metalness: 0.02,
      envMapIntensity: 0.36,
    }),
  );

  const quartziteCounter = reg(
    new THREE.MeshStandardMaterial({
      color: 0xebe6db,
      map: textures.travertineColor,
      bumpMap: textures.travertineBump,
      bumpScale: 0.003,
      roughnessMap: textures.travertineRoughness,
      roughness: 0.28,
      metalness: 0.04,
      envMapIntensity: 0.52,
    }),
  );

  // Mineral greige satin cabinetry (#C7C1B5)
  const cabinetGreige = reg(
    new THREE.MeshStandardMaterial({
      color: 0xc7c1b5,
      bumpMap: textures.plasterBump,
      bumpScale: 0.0015,
      roughness: 0.42,
      metalness: 0.03,
      envMapIntensity: 0.38,
    }),
  );

  const boucleOatmeal = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.boucleColor,
      bumpMap: textures.boucleBump,
      bumpScale: 0.011,
      roughness: 0.93,
      metalness: 0.0,
      sheen: 0.48,
      sheenRoughness: 0.78,
      sheenColor: new THREE.Color(0xefe9dd),
      envMapIntensity: 0.24,
    }),
  );

  // Muted Olive Textile (#7C8067)
  const linenOlive = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x7c8067,
      bumpMap: textures.boucleBump,
      bumpScale: 0.008,
      roughness: 0.89,
      sheen: 0.48,
      sheenRoughness: 0.74,
      sheenColor: new THREE.Color(0xa2a68d),
      envMapIntensity: 0.26,
    }),
  );

  const linenTaupe = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x8d8173,
      bumpMap: textures.boucleBump,
      bumpScale: 0.008,
      roughness: 0.89,
      sheen: 0.46,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0xb6aa9a),
      envMapIntensity: 0.26,
    }),
  );

  // Restrained Clay Accent (#B78A72)
  const clayAccent = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xb78a72,
      bumpMap: textures.boucleBump,
      bumpScale: 0.007,
      roughness: 0.86,
      sheen: 0.4,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0xd1ab96),
      envMapIntensity: 0.26,
    }),
  );

  const beddingIvory = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xe7e1d5,
      bumpMap: textures.boucleBump,
      bumpScale: 0.005,
      roughness: 0.88,
      sheen: 0.42,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(0xf6f2ea),
      envMapIntensity: 0.24,
    }),
  );

  const sheerCurtain = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xf1ece1,
      bumpMap: textures.boucleBump,
      bumpScale: 0.004,
      roughness: 0.86,
      metalness: 0.0,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.16,
    }),
  );

  const drapeCurtain = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x8f8476,
      map: textures.boucleColor,
      bumpMap: textures.boucleBump,
      bumpScale: 0.009,
      roughness: 0.91,
      metalness: 0.0,
      sheen: 0.45,
      sheenRoughness: 0.78,
      sheenColor: new THREE.Color(0xb6aa9a),
      side: THREE.DoubleSide,
      envMapIntensity: 0.22,
    }),
  );

  const dhurrieRug = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.rugColor,
      bumpMap: textures.rugBump,
      bumpScale: 0.013,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.18,
    }),
  );

  const champagneBrass = reg(
    new THREE.MeshStandardMaterial({
      color: 0xc8af80,
      roughnessMap: textures.brushedMetalRoughness,
      roughness: 0.28,
      metalness: 0.88,
      envMapIntensity: 1.05,
    }),
  );

  // Dark Bronze Architectural Framing (#423D35 with subtle satin metallic sheen)
  const darkBronze = reg(
    new THREE.MeshStandardMaterial({
      color: 0x423d35,
      roughnessMap: textures.brushedMetalRoughness,
      roughness: 0.36,
      metalness: 0.62,
      envMapIntensity: 0.86,
    }),
  );

  const matteBlackMetal = reg(
    new THREE.MeshStandardMaterial({
      color: 0x2d2925,
      roughness: 0.48,
      metalness: 0.48,
      envMapIntensity: 0.45,
    }),
  );

  const rubberGasket = reg(
    new THREE.MeshStandardMaterial({
      color: 0x211e1b,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.15,
    }),
  );

  const stainlessSteel = reg(
    new THREE.MeshStandardMaterial({
      color: 0xc9ccce,
      roughnessMap: textures.brushedMetalRoughness,
      roughness: 0.28,
      metalness: 0.88,
      envMapIntensity: 0.95,
    }),
  );

  const sinkBasinSteel = reg(
    new THREE.MeshStandardMaterial({
      color: 0x868a8d,
      roughnessMap: textures.brushedMetalRoughness,
      roughness: 0.34,
      metalness: 0.85,
      envMapIntensity: 0.68,
    }),
  );

  const applianceEnamel = reg(
    new THREE.MeshStandardMaterial({
      color: 0xe3dfd6,
      roughness: 0.34,
      metalness: 0.1,
      envMapIntensity: 0.48,
    }),
  );

  const mirrorGlass = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xd9e0e3,
      roughness: 0.06,
      metalness: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.1,
    }),
  );

  // Low envMapIntensity prevents white RoomEnvironment reflection blobs across interior glazing
  const windowGlass = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xc6d4d8,
      roughness: 0.12,
      metalness: 0.04,
      transparent: true,
      opacity: isSoftwareGl ? 0.26 : 0.3,
      ior: 1.5,
      reflectivity: 0.38,
      envMapIntensity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const showerGlass = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xd4e2e0,
      roughness: 0.1,
      metalness: 0.02,
      transparent: true,
      opacity: isSoftwareGl ? 0.3 : 0.34,
      ior: 1.52,
      envMapIntensity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const ceramicWhite = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xf4f1ea,
      roughness: 0.18,
      metalness: 0.02,
      clearcoat: 0.6,
      clearcoatRoughness: 0.14,
      envMapIntensity: 0.45,
    }),
  );

  const bathTile = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.bathTileColor,
      bumpMap: textures.bathTileBump,
      bumpScale: 0.006,
      roughness: 0.34,
      metalness: 0.02,
      envMapIntensity: 0.38,
    }),
  );

  const poolTile = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.poolTileColor,
      roughness: 0.24,
      metalness: 0.04,
      envMapIntensity: 0.45,
    }),
  );

  const poolWater = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x5cc4d8,
      roughness: 0.06,
      metalness: 0.04,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.85,
      depthWrite: false,
    }),
  );

  const balconyPaver = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.balconyPaverColor,
      bumpMap: textures.balconyPaverBump,
      bumpScale: 0.009,
      roughness: 0.78,
      metalness: 0.02,
      envMapIntensity: 0.22,
    }),
  );

  // Warm Restrained Clay Terracotta (#B78A72)
  const terracottaPot = reg(
    new THREE.MeshStandardMaterial({
      color: 0xb78a72,
      bumpMap: textures.plasterBump,
      bumpScale: 0.005,
      roughness: 0.84,
      metalness: 0.0,
      envMapIntensity: 0.2,
    }),
  );

  const soil = reg(
    new THREE.MeshStandardMaterial({
      color: 0x3a2f27,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.12,
    }),
  );

  const foliageA = reg(
    new THREE.MeshStandardMaterial({
      color: 0x556845,
      roughness: 0.72,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.18,
    }),
  );

  const foliageB = reg(
    new THREE.MeshStandardMaterial({
      color: 0x697c52,
      roughness: 0.68,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.18,
    }),
  );

  const foliageC = reg(
    new THREE.MeshStandardMaterial({
      color: 0x7c8067,
      roughness: 0.7,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.18,
    }),
  );

  const lawn = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.lawnColor,
      bumpMap: textures.lawnBump,
      bumpScale: 0.015,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.12,
    }),
  );

  const drivewayStone = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.drivewayColor,
      bumpMap: textures.drivewayBump,
      bumpScale: 0.014,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.2,
    }),
  );

  const asphaltRoad = reg(
    new THREE.MeshStandardMaterial({
      color: 0x3b3d40,
      bumpMap: textures.lawnBump,
      bumpScale: 0.008,
      roughness: 0.9,
      metalness: 0.02,
      envMapIntensity: 0.15,
    }),
  );

  const roadMarking = reg(
    new THREE.MeshStandardMaterial({
      color: 0xdad4c8,
      roughness: 0.85,
      metalness: 0.0,
    }),
  );

  const compoundWall = reg(
    new THREE.MeshStandardMaterial({
      color: 0xd7d0c4,
      map: textures.plasterColor,
      bumpMap: textures.plasterBump,
      bumpScale: 0.009,
      roughness: 0.9,
      envMapIntensity: 0.2,
    }),
  );

  const neighborFacade = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.neighborFacadeColor,
      roughness: 0.72,
      metalness: 0.06,
      envMapIntensity: 0.28,
    }),
  );

  const distantSkyline = reg(
    new THREE.MeshStandardMaterial({
      color: 0xa4a199,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.14,
    }),
  );

  const gatePlaque = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.gatePlaqueTex,
      roughnessMap: textures.brushedMetalRoughness,
      roughness: 0.32,
      metalness: 0.78,
      envMapIntensity: 0.85,
    }),
  );

  const carPaintSilver = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0xbec0bc,
      roughness: 0.22,
      metalness: 0.72,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.9,
    }),
  );

  const carPaintBronze = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x5c5347,
      roughness: 0.24,
      metalness: 0.65,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      envMapIntensity: 0.85,
    }),
  );

  const carCabinGlass = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x242c33,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 0.95,
      envMapIntensity: 0.9,
    }),
  );

  const water = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x4b6a70,
      roughness: 0.07,
      metalness: 0.12,
      clearcoat: 1.0,
      envMapIntensity: 0.85,
    }),
  );

  const oledScreen = reg(
    new THREE.MeshStandardMaterial({
      color: 0x16171a,
      roughness: 0.2,
      metalness: 0.22,
      envMapIntensity: 0.55,
    }),
  );

  const inductionGlass = reg(
    new THREE.MeshPhysicalMaterial({
      color: 0x1a1a1d,
      roughness: 0.12,
      metalness: 0.15,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
    }),
  );

  const contactShadow = reg(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.58,
    }),
  );

  const artLiving = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.artworkLiving,
      roughness: 0.86,
      metalness: 0.0,
    }),
  );

  const artBedroom = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.artworkBedroom,
      roughness: 0.86,
      metalness: 0.0,
    }),
  );

  const clockFace = reg(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.clockFace,
      roughness: 0.68,
      metalness: 0.0,
    }),
  );

  const floorHighlight = reg(
    new THREE.MeshStandardMaterial({
      color: 0xc29f61,
      emissive: new THREE.Color(0xb08a47),
      emissiveIntensity: 0.34,
      roughness: 0.38,
      metalness: 0.45,
      transparent: true,
      opacity: 0.9,
    }),
  );

  const roomFootprintMat = reg(
    new THREE.MeshBasicMaterial({
      color: 0xd9b370,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );

  return {
    plasterWall,
    exteriorPlaster,
    facadeTrimPlaster,
    recessedTaupe,
    basePlinthStone,
    ceilingPlaster,
    limestoneFloor,
    corridorStone,
    oakH,
    oakV,
    walnutH,
    walnutV,
    teakExterior,
    travertine,
    quartziteCounter,
    cabinetGreige,
    boucleOatmeal,
    linenOlive,
    linenTaupe,
    clayAccent,
    beddingIvory,
    sheerCurtain,
    drapeCurtain,
    dhurrieRug,
    champagneBrass,
    darkBronze,
    matteBlackMetal,
    rubberGasket,
    stainlessSteel,
    sinkBasinSteel,
    applianceEnamel,
    mirrorGlass,
    windowGlass,
    showerGlass,
    ceramicWhite,
    bathTile,
    poolTile,
    poolWater,
    balconyPaver,
    terracottaPot,
    soil,
    foliageA,
    foliageB,
    foliageC,
    lawn,
    drivewayStone,
    asphaltRoad,
    roadMarking,
    compoundWall,
    neighborFacade,
    distantSkyline,
    gatePlaque,
    carPaintSilver,
    carPaintBronze,
    carCabinGlass,
    water,
    oledScreen,
    inductionGlass,
    contactShadow,
    artLiving,
    artBedroom,
    clockFace,
    floorHighlight,
    roomFootprintMat,
    dispose: () => {
      for (const m of mats) m.dispose();
    },
  };
}
