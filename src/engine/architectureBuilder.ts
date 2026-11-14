import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ALL_APARTMENTS,
  ALL_FLOORS,
  ApartmentSpec,
  ARCH,
  BalconySpec,
  FloorNumber,
  WallOpening,
  WallSegmentSpec,
} from '../architecture/buildingData';
import {
  buildAcCondenserUnit,
  buildExteriorTree,
  buildNirman3DSignage,
  buildPlanter,
  buildPoolLounger,
  buildSiteBench,
  buildSiteVehicle,
  createBevelledSlabGeometry,
  createPleatedCurtainGeometry,
  TreeArchetype,
} from './geometryHelpers';
import { MaterialLibrary } from './materials';

export interface InteractiveDoorHandle {
  id: string;
  label: string;
  pivot: THREE.Object3D;
  kind: 'hinged' | 'sliding';
  openRotation?: number;
  slideVector?: THREE.Vector3;
  closedPos?: THREE.Vector3;
}

export interface InteractiveCurtainHandle {
  id: string;
  label: string;
  leftSheer: THREE.Object3D;
  rightSheer: THREE.Object3D;
  leftDrape: THREE.Object3D;
  rightDrape: THREE.Object3D;
  centerOffset: number;
  spanWidth: number;
  roomId: string;
}

export interface RoomLightFixture {
  roomId: string;
  emissiveMeshes: THREE.Mesh[];
  pointLight?: THREE.PointLight;
}

export interface CeilingFanHandle {
  id: string;
  roomId: string;
  rotor: THREE.Object3D;
}

export interface BuiltArchitectureResult {
  group: THREE.Group;
  ceilingGroup: THREE.Group;
  cutawayWallGroup: THREE.Group;
  roomOverlayGroup: THREE.Group;
  doors: InteractiveDoorHandle[];
  curtains: InteractiveCurtainHandle[];
  lightFixtures: RoomLightFixture[];
  fans: CeilingFanHandle[];
  roomPickTargets: Array<{ mesh: THREE.Object3D; roomId: string; label: string }>;
  clickTargets: Array<{
    mesh: THREE.Object3D;
    actionType: string;
    actionId: string;
    label: string;
  }>;
}

export interface BuildingShellHandles {
  root: THREE.Group;
  floorShells: Map<FloorNumber, THREE.Group>;
  floorHighlightBars: Map<FloorNumber, THREE.Group>;
  floorPickTargets: Array<{ mesh: THREE.Object3D; floor: FloorNumber }>;
  roofGroup: THREE.Group;
  apartmentOverviewShells: Map<string, THREE.Group>;
  exteriorEmissives: THREE.Mesh[];
  exteriorWinEmissives: THREE.Mesh[];
  lobbyEmissives: THREE.Mesh[];
  vehicleEmissives: THREE.Mesh[];
}

/**
 * Lightweight BoxGeometry cache for shared structural shell meshes across 10 floors
 * so repeated slabs/mullions/balustrades keep WebGL draw buffer overhead minimal.
 */
function createBoxCache() {
  const map = new Map<string, THREE.BoxGeometry>();
  return (w: number, h: number, d: number): THREE.BoxGeometry => {
    const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
    let geo = map.get(key);
    if (!geo) {
      geo = new THREE.BoxGeometry(w, h, d);
      map.set(key, geo);
    }
    return geo;
  };
}

/**
 * Merges static non-excluded meshes inside a group by (material, castShadow, receiveShadow)
 * so the 10-storey exterior renders with ~140 draw calls instead of 4,500+.
 */
function mergeStaticGroupMeshes(
  group: THREE.Group,
  excludeObjects?: Set<THREE.Object3D>,
): void {
  group.updateMatrixWorld(true);
  const invRoot = group.matrixWorld.clone().invert();

  interface Bucket {
    material: THREE.Material;
    castShadow: boolean;
    receiveShadow: boolean;
    geos: THREE.BufferGeometry[];
  }
  const buckets = new Map<string, Bucket>();
  const matIds = new Map<THREE.Material, number>();
  let nextMatId = 1;
  const toRemove: THREE.Mesh[] = [];

  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj instanceof THREE.InstancedMesh) return;
    if (excludeObjects?.has(obj)) return;
    const mat = Array.isArray(obj.material) ? null : obj.material;
    if (!mat) return;

    let mid = matIds.get(mat);
    if (!mid) {
      mid = nextMatId++;
      matIds.set(mat, mid);
    }
    const key = `${mid}|${obj.castShadow ? 1 : 0}|${obj.receiveShadow ? 1 : 0}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        material: mat,
        castShadow: obj.castShadow,
        receiveShadow: obj.receiveShadow,
        geos: [],
      };
      buckets.set(key, bucket);
    }

    const src = obj.geometry;
    const nonIdx = src.index ? src.toNonIndexed() : src.clone();
    // Ensure consistent attributes (position, normal, uv) for mergeGeometries
    if (!nonIdx.getAttribute('normal')) {
      nonIdx.computeVertexNormals();
    }
    if (!nonIdx.getAttribute('uv')) {
      const count = nonIdx.getAttribute('position').count;
      nonIdx.setAttribute(
        'uv',
        new THREE.BufferAttribute(new Float32Array(count * 2), 2),
      );
    }
    // Drop any extra attributes (e.g. tangent/uv1) so all geos share identical attributes
    for (const attrName of Object.keys(nonIdx.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
        nonIdx.deleteAttribute(attrName);
      }
    }

    const relMatrix = invRoot.clone().multiply(obj.matrixWorld);
    nonIdx.applyMatrix4(relMatrix);
    bucket.geos.push(nonIdx);
    toRemove.push(obj);
  });

  for (const m of toRemove) {
    m.parent?.remove(m);
  }

  for (const b of buckets.values()) {
    if (b.geos.length === 0) continue;
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.castShadow;
    mesh.receiveShadow = b.receiveShadow;
    group.add(mesh);
  }
}

function buildWallWithOpenings(
  wall: WallSegmentSpec,
  floorY: number,
  mats: MaterialLibrary,
  doors: InteractiveDoorHandle[],
  curtains: InteractiveCurtainHandle[],
  clickTargets: BuiltArchitectureResult['clickTargets'],
  isApartmentShell: boolean,
  getBox: (w: number, h: number, d: number) => THREE.BoxGeometry,
): THREE.Group {
  const wallGroup = new THREE.Group();
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.02) return wallGroup;

  const angle = Math.atan2(dz, dx);
  const local = new THREE.Group();
  local.position.set(wall.x1, floorY, wall.z1);
  local.rotation.y = -angle;
  wallGroup.add(local);

  const h = wall.height ?? ARCH.CEILING_CLEAR_HEIGHT;
  const t = wall.thickness;
  const sorted = [...wall.openings].sort((a, b) => a.offset - b.offset);

  const addSolidWallBlock = (start: number, end: number, y0: number, y1: number) => {
    const w = end - start;
    const bh = y1 - y0;
    if (w < 0.02 || bh < 0.02) return;
    let geo: THREE.BoxGeometry;
    if (isApartmentShell) {
      geo = new THREE.BoxGeometry(w, bh, t);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(
          i,
          uv.getX(i) * Math.max(1, w * 0.4),
          uv.getY(i) * Math.max(1, bh * 0.4),
        );
      }
    } else {
      geo = getBox(w, bh, t);
    }
    const mesh = new THREE.Mesh(
      geo,
      isApartmentShell ? mats.plasterWall : mats.exteriorPlaster,
    );
    mesh.position.set(start + w * 0.5, y0 + bh * 0.5, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    local.add(mesh);

    if (isApartmentShell && y0 < 0.05) {
      const skirtH = 0.085;
      const skirt = new THREE.Mesh(
        getBox(w, skirtH, t + 0.012),
        mats.walnutH,
      );
      skirt.position.set(start + w * 0.5, skirtH * 0.5, 0);
      skirt.receiveShadow = true;
      local.add(skirt);
    }
  };

  let cursor = 0;
  for (const op of sorted) {
    const opStart = Math.max(0, op.offset - op.width * 0.5);
    const opEnd = Math.min(len, op.offset + op.width * 0.5);

    if (opStart - cursor > 0.02) {
      addSolidWallBlock(cursor, opStart, 0, h);
    }
    if (op.sillHeight > 0.02) {
      addSolidWallBlock(opStart, opEnd, 0, op.sillHeight);
    }
    if (h - op.headHeight > 0.02) {
      addSolidWallBlock(opStart, opEnd, op.headHeight, h);
    }

    if (isApartmentShell) {
      buildOpeningHardware(
        wall,
        op,
        opStart,
        opEnd,
        t,
        local,
        mats,
        doors,
        curtains,
        clickTargets,
        getBox,
      );
    } else if (op.kind === 'window' || op.kind === 'slidingDoor') {
      const ow = opEnd - opStart;
      const oh = op.headHeight - op.sillHeight;
      const cx = opStart + ow * 0.5;
      const fT = 0.048;

      if (op.sillHeight > 0.05) {
        const sill = new THREE.Mesh(
          getBox(ow + 0.08, 0.04, t + 0.075),
          mats.travertine,
        );
        sill.position.set(cx, op.sillHeight + 0.014, 0);
        local.add(sill);
        const headHood = new THREE.Mesh(
          getBox(ow + 0.08, 0.032, 0.065),
          mats.darkBronze,
        );
        headHood.position.set(cx, op.headHeight + 0.01, -t * 0.5 - 0.02);
        local.add(headHood);
      }

      const botBar = new THREE.Mesh(getBox(ow, fT, 0.08), mats.darkBronze);
      botBar.position.set(cx, op.sillHeight + fT * 0.5 + 0.02, 0);
      const topBar = new THREE.Mesh(getBox(ow, fT, 0.08), mats.darkBronze);
      topBar.position.set(cx, op.headHeight - fT * 0.5, 0);
      const leftBar = new THREE.Mesh(getBox(fT, oh, 0.08), mats.darkBronze);
      leftBar.position.set(opStart + fT * 0.5, op.sillHeight + oh * 0.5, 0);
      const rightBar = new THREE.Mesh(getBox(fT, oh, 0.08), mats.darkBronze);
      rightBar.position.set(opEnd - fT * 0.5, op.sillHeight + oh * 0.5, 0);
      local.add(botBar, topBar, leftBar, rightBar);

      const bays = ow > 2.4 ? 3 : 2;
      for (let b = 1; b < bays; b++) {
        const mx = opStart + (ow * b) / bays;
        const mullion = new THREE.Mesh(
          getBox(0.038, oh - fT, 0.07),
          mats.darkBronze,
        );
        mullion.position.set(mx, op.sillHeight + oh * 0.5, 0);
        local.add(mullion);
      }

      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(ow - fT * 2, oh - fT * 2),
        mats.windowGlass,
      );
      glass.position.set(cx, op.sillHeight + oh * 0.5, 0);
      local.add(glass);
    }

    cursor = Math.max(cursor, opEnd);
  }

  if (len - cursor > 0.02) {
    addSolidWallBlock(cursor, len, 0, h);
  }

  return wallGroup;
}

function buildOpeningHardware(
  wall: WallSegmentSpec,
  op: WallOpening,
  opStart: number,
  opEnd: number,
  wallThick: number,
  parentLocal: THREE.Group,
  mats: MaterialLibrary,
  doors: InteractiveDoorHandle[],
  curtains: InteractiveCurtainHandle[],
  clickTargets: BuiltArchitectureResult['clickTargets'],
  getBox: (w: number, h: number, d: number) => THREE.BoxGeometry,
) {
  const ow = opEnd - opStart;
  const oh = op.headHeight - op.sillHeight;
  const cx = opStart + ow * 0.5;
  const frameThick = 0.045;
  const frameDepth = wallThick + 0.022;

  if (op.kind === 'archway') {
    const jambMat = mats.oakV;
    const leftJ = new THREE.Mesh(getBox(0.032, oh, frameDepth), jambMat);
    leftJ.position.set(opStart + 0.016, oh * 0.5, 0);
    const rightJ = new THREE.Mesh(getBox(0.032, oh, frameDepth), jambMat);
    rightJ.position.set(opEnd - 0.016, oh * 0.5, 0);
    const headJ = new THREE.Mesh(getBox(ow, 0.035, frameDepth), jambMat);
    headJ.position.set(cx, op.headHeight - 0.017, 0);
    // Flush floor threshold transition bar
    const threshold = new THREE.Mesh(
      getBox(ow, 0.008, wallThick + 0.014),
      mats.travertine,
    );
    threshold.position.set(cx, 0.004, 0);
    parentLocal.add(leftJ, rightJ, headJ, threshold);
    return;
  }

  if (op.kind === 'window') {
    // Multi-part deeply recessed dark-bronze window: taupe masonry shadow reveal (exterior),
    // travertine sill + side reveals, outer frame, rubber gasket, mullions, sash, glazing
    const frameGroup = new THREE.Group();
    const sill = new THREE.Mesh(
      createBevelledSlabGeometry(ow + 0.1, 0.042, wallThick + 0.075, 0.008, 0.004),
      mats.travertine,
    );
    sill.position.set(cx, op.sillHeight, 0);
    sill.castShadow = true;
    sill.receiveShadow = true;
    frameGroup.add(sill);

    if (wall.isExterior) {
      const topReveal = new THREE.Mesh(
        getBox(ow + 0.06, 0.048, wallThick + 0.036),
        mats.recessedTaupe,
      );
      topReveal.position.set(cx, op.headHeight + 0.018, 0);
      const sideRevealL = new THREE.Mesh(
        getBox(0.042, oh + 0.04, wallThick + 0.032),
        mats.recessedTaupe,
      );
      sideRevealL.position.set(opStart - 0.015, op.sillHeight + oh * 0.5, 0);
      const sideRevealR = new THREE.Mesh(
        getBox(0.042, oh + 0.04, wallThick + 0.032),
        mats.recessedTaupe,
      );
      sideRevealR.position.set(opEnd + 0.015, op.sillHeight + oh * 0.5, 0);
      frameGroup.add(topReveal, sideRevealL, sideRevealR);
    }

    // Inner stone reveal jamb liners
    const revealL = new THREE.Mesh(
      getBox(0.018, oh - 0.03, wallThick + 0.012),
      mats.travertine,
    );
    revealL.position.set(opStart + 0.009, op.sillHeight + oh * 0.5, 0);
    const revealR = new THREE.Mesh(
      getBox(0.018, oh - 0.03, wallThick + 0.012),
      mats.travertine,
    );
    revealR.position.set(opEnd - 0.009, op.sillHeight + oh * 0.5, 0);
    frameGroup.add(revealL, revealR);

    // Outer bronze perimeter frame recessed inside masonry opening
    const botBar = new THREE.Mesh(getBox(ow, frameThick, 0.072), mats.darkBronze);
    botBar.position.set(cx, op.sillHeight + frameThick * 0.5 + 0.025, 0);
    const topBar = new THREE.Mesh(getBox(ow, frameThick, 0.072), mats.darkBronze);
    topBar.position.set(cx, op.headHeight - frameThick * 0.5, 0);
    const leftBar = new THREE.Mesh(getBox(frameThick, oh, 0.072), mats.darkBronze);
    leftBar.position.set(opStart + frameThick * 0.5, op.sillHeight + oh * 0.5, 0);
    const rightBar = new THREE.Mesh(getBox(frameThick, oh, 0.072), mats.darkBronze);
    rightBar.position.set(opEnd - frameThick * 0.5, op.sillHeight + oh * 0.5, 0);
    frameGroup.add(botBar, topBar, leftBar, rightBar);

    // Recessed EPDM black rubber weather-seal gasket bead inside frame
    const gasketL = new THREE.Mesh(getBox(0.012, oh - frameThick * 2, 0.045), mats.rubberGasket);
    gasketL.position.set(opStart + frameThick + 0.006, op.sillHeight + oh * 0.5, 0);
    const gasketR = new THREE.Mesh(getBox(0.012, oh - frameThick * 2, 0.045), mats.rubberGasket);
    gasketR.position.set(opEnd - frameThick - 0.006, op.sillHeight + oh * 0.5, 0);
    frameGroup.add(gasketL, gasketR);

    // Vertical dark bronze mullions (2 or 3 bays: fixed + operable casement/slider sash)
    const bays = ow > 1.6 ? 3 : 2;
    for (let b = 1; b < bays; b++) {
      const mx = opStart + (ow * b) / bays;
      const mullion = new THREE.Mesh(getBox(0.038, oh - frameThick, 0.07), mats.darkBronze);
      mullion.position.set(mx, op.sillHeight + oh * 0.5, 0);
      frameGroup.add(mullion);
    }

    // Operable sash sub-frame & brushed champagne locking handle on right bay
    const sashW = ow / bays - 0.035;
    const sashCx = opEnd - frameThick - sashW * 0.5;
    const sashTop = new THREE.Mesh(getBox(sashW, 0.028, 0.05), mats.darkBronze);
    sashTop.position.set(sashCx, op.headHeight - frameThick - 0.02, 0.008);
    const sashBot = new THREE.Mesh(getBox(sashW, 0.028, 0.05), mats.darkBronze);
    sashBot.position.set(sashCx, op.sillHeight + frameThick + 0.04, 0.008);
    const latchHandle = new THREE.Mesh(getBox(0.018, 0.11, 0.038), mats.champagneBrass);
    latchHandle.position.set(sashCx - sashW * 0.42, op.sillHeight + oh * 0.44, -0.028);
    frameGroup.add(sashTop, sashBot, latchHandle);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(ow - frameThick * 2, oh - frameThick * 2),
      mats.windowGlass,
    );
    glass.position.set(cx, op.sillHeight + oh * 0.5, 0);
    frameGroup.add(glass);

    parentLocal.add(frameGroup);
  }

  if (op.kind === 'door') {
    const jambMat = op.doorId === 'entrance-door' ? mats.walnutV : mats.oakV;
    const leftJ = new THREE.Mesh(getBox(frameThick, oh, frameDepth), jambMat);
    leftJ.position.set(opStart + frameThick * 0.5, oh * 0.5, 0);
    const rightJ = new THREE.Mesh(getBox(frameThick, oh, frameDepth), jambMat);
    rightJ.position.set(opEnd - frameThick * 0.5, oh * 0.5, 0);
    const headJ = new THREE.Mesh(getBox(ow, frameThick, frameDepth), jambMat);
    headJ.position.set(cx, op.headHeight - frameThick * 0.5, 0);
    const threshold = new THREE.Mesh(
      getBox(ow, 0.014, wallThick + 0.026),
      op.doorId === 'entrance-door' ? mats.travertine : mats.darkBronze,
    );
    threshold.position.set(cx, 0.007, 0);
    parentLocal.add(leftJ, rightJ, headJ, threshold);

    const leafW = ow - frameThick * 2 - 0.006;
    const leafH = oh - frameThick - 0.012;
    const hingeX = op.hingeAtEnd ? opEnd - frameThick : opStart + frameThick;
    const dir = op.hingeAtEnd ? -1 : 1;

    // 3 Champagne Brass Hinge Knuckles along jamb side
    for (const hy of [0.28, leafH * 0.5, leafH - 0.25]) {
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.085, 10),
        mats.champagneBrass,
      );
      hinge.position.set(hingeX, hy, 0.024 * (op.swingSign ?? 1));
      parentLocal.add(hinge);
    }

    const pivot = new THREE.Group();
    pivot.position.set(hingeX, 0.012, 0);

    const leafMat = op.doorId === 'entrance-door' ? mats.walnutV : mats.oakV;
    const leafMesh = new THREE.Mesh(
      new THREE.BoxGeometry(leafW, leafH, 0.044),
      leafMat,
    );
    leafMesh.position.set(dir * leafW * 0.5, leafH * 0.5, 0);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    pivot.add(leafMesh);

    if (op.doorId === 'entrance-door') {
      const inlay = new THREE.Mesh(
        getBox(0.014, leafH - 0.16, 0.048),
        mats.champagneBrass,
      );
      inlay.position.set(dir * leafW * 0.78, leafH * 0.5, 0);
      pivot.add(inlay);
    }

    // Lever handles on both faces
    const handleX = dir * (leafW - 0.08);
    for (const side of [-1, 1]) {
      const rosette = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.01, 16),
        mats.champagneBrass,
      );
      rosette.rotation.x = Math.PI / 2;
      rosette.position.set(handleX, 1.02, side * 0.026);
      const lever = new THREE.Mesh(
        getBox(0.12, 0.016, 0.018),
        mats.champagneBrass,
      );
      lever.position.set(handleX - dir * 0.045, 1.02, side * 0.05);
      pivot.add(rosette, lever);
    }

    // Floor-mounted bronze door stopper behind open leaf arc
    const stopper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.024, 0.036, 12),
      mats.darkBronze,
    );
    stopper.position.set(
      hingeX + dir * (leafW * 0.25),
      0.018,
      (op.swingSign ?? 1) * (leafW * 0.78),
    );
    parentLocal.add(stopper);

    parentLocal.add(pivot);
    const doorId = op.doorId ?? op.id;
    doors.push({
      id: doorId,
      label: formatDoorLabel(doorId),
      pivot,
      kind: 'hinged',
      openRotation: (op.swingSign ?? 1) * 1.42,
    });
    clickTargets.push({
      mesh: leafMesh,
      actionType: 'door',
      actionId: doorId,
      label: formatDoorLabel(doorId),
    });
  }

  if (op.kind === 'slidingDoor') {
    const outerTop = new THREE.Mesh(
      getBox(ow, 0.055, frameDepth),
      mats.darkBronze,
    );
    outerTop.position.set(cx, op.headHeight - 0.027, 0);
    const track = new THREE.Mesh(
      getBox(ow, 0.026, wallThick + 0.034),
      mats.darkBronze,
    );
    track.position.set(cx, 0.013, 0);
    // Twin floor track rails + stone threshold
    const railChannel = new THREE.Mesh(
      getBox(ow - 0.06, 0.008, 0.068),
      mats.stainlessSteel,
    );
    railChannel.position.set(cx, 0.028, 0);
    const leftPost = new THREE.Mesh(getBox(0.05, oh, frameDepth), mats.darkBronze);
    leftPost.position.set(opStart + 0.025, oh * 0.5, 0);
    const rightPost = new THREE.Mesh(getBox(0.05, oh, frameDepth), mats.darkBronze);
    rightPost.position.set(opEnd - 0.025, oh * 0.5, 0);
    parentLocal.add(outerTop, track, railChannel, leftPost, rightPost);

    const panelW = (ow - 0.08) * 0.5;
    const panelH = oh - 0.075;
    const buildGlassPanel = (px: number, pz: number) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(px, 0.026, pz);
      const stileL = new THREE.Mesh(getBox(0.046, panelH, 0.04), mats.darkBronze);
      stileL.position.set(-panelW * 0.5 + 0.023, panelH * 0.5, 0);
      const stileR = new THREE.Mesh(getBox(0.046, panelH, 0.04), mats.darkBronze);
      stileR.position.set(panelW * 0.5 - 0.023, panelH * 0.5, 0);
      const railT = new THREE.Mesh(getBox(panelW, 0.05, 0.04), mats.darkBronze);
      railT.position.set(0, panelH - 0.025, 0);
      const railB = new THREE.Mesh(getBox(panelW, 0.05, 0.04), mats.darkBronze);
      railB.position.set(0, 0.025, 0);
      // Black rubber weather gasket around glass edge
      const sealL = new THREE.Mesh(getBox(0.012, panelH - 0.1, 0.03), mats.rubberGasket);
      sealL.position.set(-panelW * 0.5 + 0.05, panelH * 0.5, 0);
      const sealR = new THREE.Mesh(getBox(0.012, panelH - 0.1, 0.03), mats.rubberGasket);
      sealR.position.set(panelW * 0.5 - 0.05, panelH * 0.5, 0);
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW - 0.1, panelH - 0.1),
        mats.windowGlass,
      );
      pane.position.set(0, panelH * 0.5, 0);
      const handle = new THREE.Mesh(getBox(0.024, 0.28, 0.072), mats.champagneBrass);
      handle.position.set(panelW * 0.5 - 0.065, 1.05, 0);
      pGroup.add(stileL, stileR, railT, railB, sealL, sealR, pane, handle);
      return pGroup;
    };

    const fixed = buildGlassPanel(opStart + 0.04 + panelW * 0.5, -0.025);
    parentLocal.add(fixed);

    const slider = buildGlassPanel(opEnd - 0.04 - panelW * 0.5, 0.025);
    parentLocal.add(slider);

    const doorId = op.doorId ?? op.id;
    doors.push({
      id: doorId,
      label: formatDoorLabel(doorId),
      pivot: slider,
      kind: 'sliding',
      slideVector: new THREE.Vector3(-panelW * 0.86, 0, 0),
      closedPos: slider.position.clone(),
    });
    clickTargets.push({
      mesh: slider,
      actionType: 'door',
      actionId: doorId,
      label: formatDoorLabel(doorId),
    });
  }

  // Two-Layer Architectural Curtains: Sheer Inner Filter + Woven Stone Outer Drapes on Twin Ceiling Tracks
  if (op.hasCurtain) {
    const curtainW = ow + 0.44;
    const wingW = curtainW * 0.52;
    const curtainH = ARCH.CEILING_CLEAR_HEIGHT - 0.06;
    const isNorthWall = wall.z1 < 0 && Math.abs(wall.z2 - wall.z1) < 0.1;
    const interiorSign = isNorthWall ? 1 : -1;
    const sheerZ = interiorSign * (wallThick * 0.5 + 0.075);
    const drapeZ = interiorSign * (wallThick * 0.5 + 0.145);

    const sheerTrack = new THREE.Mesh(
      getBox(curtainW, 0.02, 0.024),
      mats.darkBronze,
    );
    sheerTrack.position.set(cx, ARCH.CEILING_CLEAR_HEIGHT - 0.018, sheerZ);
    const drapeTrack = new THREE.Mesh(
      getBox(curtainW, 0.024, 0.028),
      mats.darkBronze,
    );
    drapeTrack.position.set(cx, ARCH.CEILING_CLEAR_HEIGHT - 0.018, drapeZ);
    parentLocal.add(sheerTrack, drapeTrack);

    const sheerGeo = createPleatedCurtainGeometry(wingW, curtainH, 9, 0.032);
    const leftSheer = new THREE.Mesh(sheerGeo, mats.sheerCurtain);
    leftSheer.position.set(cx - wingW, 0.03, sheerZ);
    const rightSheer = new THREE.Mesh(sheerGeo, mats.sheerCurtain);
    rightSheer.position.set(cx, 0.03, sheerZ);

    const drapeGeo = createPleatedCurtainGeometry(wingW, curtainH, 10, 0.048);
    const leftDrape = new THREE.Mesh(drapeGeo, mats.drapeCurtain);
    leftDrape.position.set(cx - wingW, 0.03, drapeZ);
    leftDrape.castShadow = true;
    const rightDrape = new THREE.Mesh(drapeGeo, mats.drapeCurtain);
    rightDrape.position.set(cx, 0.03, drapeZ);
    rightDrape.castShadow = true;

    parentLocal.add(leftSheer, rightSheer, leftDrape, rightDrape);

    const curtainId = op.curtainId ?? `curtain-${op.id}`;
    const roomId = curtainId.includes('living')
      ? 'living'
      : curtainId.includes('bed2')
        ? 'secondary-bed'
        : 'primary-bed';
    const label = curtainId.includes('living')
      ? 'Living Curtains & Sheers'
      : curtainId.includes('bed2')
        ? 'Bedroom 2 Curtains'
        : 'Master Curtains & Sheers';

    curtains.push({
      id: curtainId,
      label,
      leftSheer,
      rightSheer,
      leftDrape,
      rightDrape,
      centerOffset: cx - wingW,
      spanWidth: wingW,
      roomId,
    });
    for (const m of [leftSheer, rightSheer, leftDrape, rightDrape]) {
      clickTargets.push({
        mesh: m,
        actionType: 'curtain',
        actionId: curtainId,
        label: `Toggle ${label}`,
      });
    }
  }
}

function formatDoorLabel(id: string): string {
  switch (id) {
    case 'entrance-door':
      return 'Entrance Door';
    case 'balcony-door':
      return 'Balcony Sliding Door';
    case 'bed1-balcony-door':
      return 'Bedroom Terrace Door';
    case 'bed1-door':
      return 'Primary Bedroom Door';
    case 'bed2-door':
      return 'Bedroom 2 Door';
    case 'bed3-door':
      return 'Bedroom 3 Door';
    case 'primary-bath-door':
      return 'Primary Bath Door';
    case 'attached-bath-2-door':
      return 'Attached Bath 2 Door';
    case 'common-bath-door':
      return 'Guest Bath Door';
    case 'utility-door':
      return 'Utility Balcony Door';
    default:
      return 'Door';
  }
}

function buildBalcony(
  bal: BalconySpec,
  floorY: number,
  mats: MaterialLibrary,
  lightFixtures: RoomLightFixture[],
  getBox: (w: number, h: number, d: number) => THREE.BoxGeometry,
): THREE.Group {
  const g = new THREE.Group();
  const { xMin, xMax, zMin, zMax } = bal.bounds;
  const w = xMax - xMin;
  const d = zMax - zMin;
  const cx = (xMin + xMax) * 0.5;
  const cz = (zMin + zMax) * 0.5;

  const deck = new THREE.Mesh(getBox(w, 0.22, d), mats.balconyPaver);
  deck.position.set(cx, floorY - 0.135, cz);
  deck.receiveShadow = true;
  deck.castShadow = true;
  g.add(deck);

  // Finished architectural fascia edge band around balcony slab
  const slabFascia = new THREE.Mesh(getBox(w + 0.04, 0.14, d + 0.04), mats.facadeTrimPlaster);
  slabFascia.position.set(cx, floorY - 0.175, cz);
  slabFascia.castShadow = true;
  slabFascia.receiveShadow = true;
  g.add(slabFascia);

  const soffit = new THREE.Mesh(
    getBox(Math.max(0.2, w - 0.04), 0.025, Math.max(0.2, d - 0.04)),
    mats.teakExterior,
  );
  soffit.position.set(cx, floorY - 0.255, cz);
  g.add(soffit);

  const drain = new THREE.Mesh(getBox(0.42, 0.008, 0.08), mats.stainlessSteel);
  drain.position.set(
    xMax - 0.45,
    floorY - 0.022,
    bal.openEdge === 'north' ? zMin + 0.22 : zMax - 0.22,
  );
  g.add(drain);

  const curbH = 0.18;
  const railH = ARCH.BALCONY_PARAPET;

  const addRailSide = (sx1: number, sz1: number, sx2: number, sz2: number) => {
    const sLen = Math.hypot(sx2 - sx1, sz2 - sz1);
    const angle = Math.atan2(sz2 - sz1, sx2 - sx1);
    const rG = new THREE.Group();
    rG.position.set(sx1, floorY - 0.025, sz1);
    rG.rotation.y = -angle;

    const curb = new THREE.Mesh(getBox(sLen, curbH, 0.15), mats.facadeTrimPlaster);
    curb.position.set(sLen * 0.5, curbH * 0.5, 0);
    curb.castShadow = true;
    curb.receiveShadow = true;
    rG.add(curb);

    const glassH = railH - curbH - 0.04;
    const glass = new THREE.Mesh(
      getBox(Math.max(0.1, sLen - 0.08), glassH, 0.016),
      mats.windowGlass,
    );
    glass.position.set(sLen * 0.5, curbH + glassH * 0.5, 0);
    rG.add(glass);

    const topRail = new THREE.Mesh(
      getBox(sLen + 0.04, 0.042, 0.06),
      mats.darkBronze,
    );
    topRail.position.set(sLen * 0.5, railH, 0);
    rG.add(topRail);

    const posts = Math.max(2, Math.round(sLen / 1.35) + 1);
    for (let i = 0; i < posts; i++) {
      const px = (i / (posts - 1)) * (sLen - 0.06) + 0.03;
      const post = new THREE.Mesh(
        getBox(0.036, railH - curbH, 0.044),
        mats.darkBronze,
      );
      post.position.set(px, curbH + (railH - curbH) * 0.5, 0);
      rG.add(post);
    }

    g.add(rG);
  };

  if (bal.openEdge === 'south') {
    addRailSide(xMin, zMin, xMin, zMax);
    addRailSide(xMin, zMax, xMax, zMax);
    addRailSide(xMax, zMax, xMax, zMin);
  } else if (bal.openEdge === 'north') {
    addRailSide(xMin, zMax, xMin, zMin);
    addRailSide(xMin, zMin, xMax, zMin);
    addRailSide(xMax, zMin, xMax, zMax);
  } else if (bal.openEdge === 'east') {
    addRailSide(xMin, zMin, xMax, zMin);
    addRailSide(xMax, zMin, xMax, zMax);
    addRailSide(xMax, zMax, xMin, zMax);
  } else {
    addRailSide(xMax, zMin, xMin, zMin);
    addRailSide(xMin, zMin, xMin, zMax);
    addRailSide(xMin, zMax, xMax, zMax);
  }

  // Outdoor wall sconce
  const sconce = new THREE.Group();
  const sconceX =
    bal.openEdge === 'west'
      ? xMax - 0.06
      : bal.openEdge === 'east'
        ? xMin + 0.06
        : xMin + 0.35;
  const sconceZ =
    bal.openEdge === 'south'
      ? zMin + 0.06
      : bal.openEdge === 'north'
        ? zMax - 0.06
        : cz;
  sconce.position.set(sconceX, floorY + 1.85, sconceZ);
  const housing = new THREE.Mesh(getBox(0.11, 0.22, 0.09), mats.darkBronze);
  const diffuserMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: new THREE.Color(0xffca7a),
    emissiveIntensity: 0.15,
    roughness: 0.3,
  });
  const diffuser = new THREE.Mesh(getBox(0.08, 0.16, 0.02), diffuserMat);
  diffuser.position.z = bal.openEdge === 'north' ? -0.04 : 0.04;
  sconce.add(housing, diffuser);
  g.add(sconce);

  lightFixtures.push({
    roomId: 'balcony',
    emissiveMeshes: [diffuser],
  });

  return g;
}

export function buildApartmentArchitecture(
  apt: ApartmentSpec,
  mats: MaterialLibrary,
): BuiltArchitectureResult {
  const group = new THREE.Group();
  const ceilingGroup = new THREE.Group();
  const cutawayWallGroup = new THREE.Group();
  const roomOverlayGroup = new THREE.Group();
  const doors: InteractiveDoorHandle[] = [];
  const curtains: InteractiveCurtainHandle[] = [];
  const lightFixtures: RoomLightFixture[] = [];
  const fans: CeilingFanHandle[] = [];
  const roomPickTargets: BuiltArchitectureResult['roomPickTargets'] = [];
  const clickTargets: BuiltArchitectureResult['clickTargets'] = [];
  const getBox = createBoxCache();

  const floorY = (apt.floor - 1) * ARCH.FLOOR_HEIGHT;

  // 1. Room Floors & Ceilings
  for (const room of apt.rooms) {
    const rw = room.bounds.xMax - room.bounds.xMin;
    const rd = room.bounds.zMax - room.bounds.zMin;
    const cx = (room.bounds.xMin + room.bounds.xMax) * 0.5;
    const cz = (room.bounds.zMin + room.bounds.zMax) * 0.5;

    let floorMat = mats.limestoneFloor;
    if (room.floorFinish === 'oak') floorMat = mats.oakH;
    else if (room.floorFinish === 'bathroomTile') floorMat = mats.bathTile;

    const floorGeo = new THREE.BoxGeometry(rw, 0.04, rd);
    const uv = floorGeo.attributes.uv;
    const tileScale = room.floorFinish === 'oak' ? 0.55 : 0.42;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * rw * tileScale, uv.getY(i) * rd * tileScale);
    }
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(cx, floorY - 0.02, cz);
    floorMesh.receiveShadow = true;
    group.add(floorMesh);

    if (room.category === 'bathroom') {
      const tileH = ARCH.CEILING_CLEAR_HEIGHT;
      const linerOffset = 0.068;
      const addWallTile = (x: number, z: number, tw: number, td: number) => {
        const tg = new THREE.BoxGeometry(tw, tileH, td);
        const tuv = tg.attributes.uv;
        const span = Math.max(tw, td);
        for (let i = 0; i < tuv.count; i++) {
          tuv.setXY(i, tuv.getX(i) * span * 0.75, tuv.getY(i) * tileH * 0.5);
        }
        const m = new THREE.Mesh(tg, mats.bathTile);
        m.position.set(x, floorY + tileH * 0.5, z);
        m.receiveShadow = true;
        group.add(m);
      };
      addWallTile(cx, room.bounds.zMin + linerOffset, rw - 0.14, 0.014);
      addWallTile(room.bounds.xMax - linerOffset, cz, 0.014, rd - 0.14);

      // Ceiling-mounted Bath Exhaust Grille + Vent Collar
      const exhaustHousing = new THREE.Mesh(
        getBox(0.24, 0.022, 0.24),
        mats.applianceEnamel,
      );
      exhaustHousing.position.set(
        room.bounds.xMin + rw * 0.3,
        floorY + ARCH.CEILING_CLEAR_HEIGHT - 0.011,
        room.bounds.zMax - 0.35,
      );
      ceilingGroup.add(exhaustHousing);
      for (const sOffset of [-0.06, -0.02, 0.02, 0.06]) {
        const louver = new THREE.Mesh(
          getBox(0.18, 0.008, 0.014),
          mats.darkBronze,
        );
        louver.position.set(
          room.bounds.xMin + rw * 0.3,
          floorY + ARCH.CEILING_CLEAR_HEIGHT - 0.024,
          room.bounds.zMax - 0.35 + sOffset,
        );
        ceilingGroup.add(louver);
      }
    }

    // Ceiling Slab
    const ceilMesh = new THREE.Mesh(
      new THREE.BoxGeometry(rw, 0.08, rd),
      mats.ceilingPlaster,
    );
    ceilMesh.position.set(cx, floorY + ARCH.CEILING_CLEAR_HEIGHT + 0.04, cz);
    ceilMesh.receiveShadow = true;
    ceilingGroup.add(ceilMesh);

    if (room.hasCeilingDrop && rw > 2.4 && rd > 2.4) {
      const dropH = 0.11;
      const dropW = 0.28;
      const makeDrop = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(w, dropH, d),
          mats.ceilingPlaster,
        );
        m.position.set(x, floorY + ARCH.CEILING_CLEAR_HEIGHT - dropH * 0.5, z);
        ceilingGroup.add(m);
      };
      makeDrop(rw - 0.12, dropW, cx, room.bounds.zMin + dropW * 0.5 + 0.06);
      makeDrop(rw - 0.12, dropW, cx, room.bounds.zMax - dropW * 0.5 - 0.06);
      makeDrop(dropW, rd - 0.12, room.bounds.xMin + dropW * 0.5 + 0.06, cz);
      makeDrop(dropW, rd - 0.12, room.bounds.xMax - dropW * 0.5 - 0.06, cz);

      const coveMat = new THREE.MeshStandardMaterial({
        color: 0xfff1d6,
        emissive: new THREE.Color(0xffc978),
        emissiveIntensity: 0.08,
        roughness: 0.4,
      });
      const coveRim = new THREE.Mesh(
        new THREE.BoxGeometry(rw - 0.72, 0.016, 0.02),
        coveMat,
      );
      coveRim.position.set(
        cx,
        floorY + ARCH.CEILING_CLEAR_HEIGHT - 0.02,
        room.bounds.zMin + 0.36,
      );
      ceilingGroup.add(coveRim);
      lightFixtures.push({ roomId: room.id, emissiveMeshes: [coveRim] });
    }

    // Recessed architectural downlights
    const dlCols = rw > 4.5 ? 2 : 1;
    const dlRows = rd > 4.0 ? 2 : 1;
    const roomEmissives: THREE.Mesh[] = [];
    for (let ix = 0; ix < dlCols; ix++) {
      for (let iz = 0; iz < dlRows; iz++) {
        const lx =
          dlCols === 1 ? cx : room.bounds.xMin + rw * (0.28 + ix * 0.44);
        const lz =
          dlRows === 1 ? cz : room.bounds.zMin + rd * (0.28 + iz * 0.44);

        const trim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.014, 16),
          mats.matteBlackMetal,
        );
        trim.position.set(lx, floorY + ARCH.CEILING_CLEAR_HEIGHT - 0.005, lz);
        const lensMat = new THREE.MeshStandardMaterial({
          color: 0xfff3dc,
          emissive: new THREE.Color(0xffcf87),
          emissiveIntensity: 0.12,
          roughness: 0.25,
        });
        const lens = new THREE.Mesh(
          new THREE.CylinderGeometry(0.038, 0.038, 0.016, 16),
          lensMat,
        );
        lens.position.set(lx, floorY + ARCH.CEILING_CLEAR_HEIGHT - 0.008, lz);
        ceilingGroup.add(trim, lens);
        roomEmissives.push(lens);
      }
    }

    if (room.category === 'living' || room.category === 'bedroom') {
      const acW = Math.min(1.35, rw * 0.34);
      const acG = new THREE.Group();
      acG.position.set(
        cx,
        floorY + ARCH.CEILING_CLEAR_HEIGHT - 0.105,
        room.bounds.zMin + 0.22,
      );
      const acHousing = new THREE.Mesh(
        getBox(acW, 0.022, 0.12),
        mats.darkBronze,
      );
      const acPlenum = new THREE.Mesh(
        getBox(acW - 0.04, 0.016, 0.085),
        mats.matteBlackMetal,
      );
      acPlenum.position.y = -0.005;
      acG.add(acHousing, acPlenum);
      for (const lz of [-0.024, 0, 0.024]) {
        const fin = new THREE.Mesh(
          getBox(acW - 0.05, 0.004, 0.008),
          mats.darkBronze,
        );
        fin.position.set(0, -0.012, lz);
        acG.add(fin);
      }
      ceilingGroup.add(acG);
    }

    lightFixtures.push({ roomId: room.id, emissiveMeshes: roomEmissives });

    // Sculpted Walnut & Brass Ceiling Fan
    if (room.hasFan && room.fanCenter) {
      const [fx, fz] = room.fanCenter;
      const fanGroup = new THREE.Group();
      fanGroup.position.set(fx, floorY + ARCH.CEILING_CLEAR_HEIGHT, fz);

      const canopy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.085, 0.05, 16),
        mats.darkBronze,
      );
      canopy.position.y = -0.025;
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.28, 12),
        mats.champagneBrass,
      );
      rod.position.y = -0.17;

      const rotor = new THREE.Group();
      rotor.position.y = -0.31;
      const motor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.08, 20),
        mats.champagneBrass,
      );
      const motorCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.11, 0.03, 20),
        mats.darkBronze,
      );
      motorCap.position.y = -0.055;
      rotor.add(motor, motorCap);

      const bladeGeo = createBevelledSlabGeometry(0.62, 0.014, 0.13, 0.04, 0.004);
      for (let b = 0; b < 3; b++) {
        const bGroup = new THREE.Group();
        bGroup.rotation.y = (b * Math.PI * 2) / 3;
        const arm = new THREE.Mesh(
          getBox(0.12, 0.018, 0.036),
          mats.darkBronze,
        );
        arm.position.set(0.12, 0.0, 0);
        const blade = new THREE.Mesh(bladeGeo, mats.walnutH);
        blade.position.set(0.45, -0.005, 0);
        blade.rotation.x = 0.14;
        blade.castShadow = true;
        bGroup.add(arm, blade);
        rotor.add(bGroup);
      }

      fanGroup.add(canopy, rod, rotor);
      ceilingGroup.add(fanGroup);

      fans.push({ id: `fan-${room.id}`, roomId: room.id, rotor });
      clickTargets.push({
        mesh: rotor,
        actionType: 'fan',
        actionId: room.id,
        label: `${room.name} Ceiling Fan`,
      });
    }
  }

  // 2. Pierced Walls with Openings
  for (const wall of apt.walls) {
    const builtWall = buildWallWithOpenings(
      wall,
      floorY,
      mats,
      doors,
      curtains,
      clickTargets,
      true,
      getBox,
    );
    const isSouthCutaway =
      wall.isExterior &&
      Math.abs(wall.z1 - apt.bounds.zMax) < 0.2 &&
      Math.abs(wall.z2 - apt.bounds.zMax) < 0.2;
    if (isSouthCutaway) cutawayWallGroup.add(builtWall);
    else group.add(builtWall);
  }

  // 3. Balconies & Utility Terraces
  for (const bal of apt.balconies) {
    group.add(buildBalcony(bal, floorY, mats, lightFixtures, getBox));
    const bw = bal.bounds.xMax - bal.bounds.xMin;
    const bd = bal.bounds.zMax - bal.bounds.zMin;
    const pickOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.2, bw - 0.14), Math.max(0.2, bd - 0.14)),
      mats.roomFootprintMat,
    );
    pickOverlay.rotation.x = -Math.PI / 2;
    pickOverlay.position.set(
      (bal.bounds.xMin + bal.bounds.xMax) * 0.5,
      floorY + 0.015,
      (bal.bounds.zMin + bal.bounds.zMax) * 0.5,
    );
    pickOverlay.userData.roomId = bal.id;
    roomOverlayGroup.add(pickOverlay);
    roomPickTargets.push({ mesh: pickOverlay, roomId: bal.id, label: bal.name });
  }

  // 4. Clickable 3D Room Footprint Overlays for Layout View
  for (const room of apt.rooms) {
    const rw = room.bounds.xMax - room.bounds.xMin;
    const rd = room.bounds.zMax - room.bounds.zMin;
    const pickOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.2, rw - 0.16), Math.max(0.2, rd - 0.16)),
      mats.roomFootprintMat,
    );
    pickOverlay.rotation.x = -Math.PI / 2;
    pickOverlay.position.set(
      (room.bounds.xMin + room.bounds.xMax) * 0.5,
      floorY + 0.014,
      (room.bounds.zMin + room.bounds.zMax) * 0.5,
    );
    pickOverlay.userData.roomId = room.id;
    roomOverlayGroup.add(pickOverlay);
    roomPickTargets.push({ mesh: pickOverlay, roomId: room.id, label: room.name });
  }

  group.add(ceilingGroup);
  group.add(cutawayWallGroup);
  group.add(roomOverlayGroup);

  return {
    group,
    ceilingGroup,
    cutawayWallGroup,
    roomOverlayGroup,
    doors,
    curtains,
    lightFixtures,
    fans,
    roomPickTargets,
    clickTargets,
  };
}

/**
 * Build the complete 10-storey building envelope (Floors 1–10, 30 residences),
 * entrance gate, pedestrian promenade, shared core (lobby, dog-leg staircase with railings,
 * lift shaft & indicators across all 10 floors, shared corridor apartment entrances),
 * complete rooftop with drainage & screened services, and neighborhood horizon context.
 */
export function buildBuildingExteriorAndCore(
  mats: MaterialLibrary,
): BuildingShellHandles {
  const root = new THREE.Group();
  const floorShells = new Map<FloorNumber, THREE.Group>();
  const floorHighlightBars = new Map<FloorNumber, THREE.Group>();
  const floorPickTargets: Array<{ mesh: THREE.Object3D; floor: FloorNumber }> = [];
  const apartmentOverviewShells = new Map<string, THREE.Group>();
  const exteriorEmissives: THREE.Mesh[] = [];
  const exteriorWinEmissives: THREE.Mesh[] = [];
  const lobbyEmissives: THREE.Mesh[] = [];
  const vehicleEmissives: THREE.Mesh[] = [];
  const getBox = createBoxCache();

  // --------------------------------------------------------------------------
  // 1. THREE-DEPTH LANDSCAPED SITE, ENTRANCE GATE, NEIGHBORHOOD & SKYLINE
  // --------------------------------------------------------------------------
  const groundGroup = new THREE.Group();
  // Ground terrain slab extending cleanly into horizon fog across all 360 degrees
  const terrain = new THREE.Mesh(getBox(360, 0.4, 360), mats.lawn);
  terrain.position.set(0, -0.42, 0);
  terrain.receiveShadow = true;
  groundGroup.add(terrain);

  // Neighborhood Urban Street, Sidewalks, Curb Borders, Lane Stripes & Crosswalk (Z = -27..-41)
  const streetAsphalt = new THREE.Mesh(getBox(220, 0.05, 11.2), mats.asphaltRoad);
  streetAsphalt.position.set(0, -0.225, -33.2);
  streetAsphalt.receiveShadow = true;
  groundGroup.add(streetAsphalt);

  const southSidewalk = new THREE.Mesh(getBox(220, 0.08, 3.2), mats.drivewayStone);
  southSidewalk.position.set(0, -0.2, -26.0);
  southSidewalk.receiveShadow = true;
  const southKerb = new THREE.Mesh(getBox(220, 0.12, 0.24), mats.travertine);
  southKerb.position.set(0, -0.18, -27.55);
  const northSidewalk = new THREE.Mesh(getBox(220, 0.08, 3.2), mats.drivewayStone);
  northSidewalk.position.set(0, -0.2, -40.4);
  northSidewalk.receiveShadow = true;
  const northKerb = new THREE.Mesh(getBox(220, 0.12, 0.24), mats.travertine);
  northKerb.position.set(0, -0.18, -38.85);
  groundGroup.add(southSidewalk, southKerb, northSidewalk, northKerb);

  // Dashed street centerline + entry gate pedestrian crosswalk
  for (let rx = -76; rx <= 76; rx += 7.5) {
    if (Math.abs(rx + 1.0) < 5.5) continue;
    const dash = new THREE.Mesh(getBox(3.4, 0.01, 0.16), mats.roadMarking);
    dash.position.set(rx, -0.194, -33.2);
    groundGroup.add(dash);
  }
  for (let cz = -37.2; cz <= -29.2; cz += 1.05) {
    const stripe = new THREE.Mesh(getBox(2.6, 0.01, 0.48), mats.roadMarking);
    stripe.position.set(-1.0, -0.194, cz);
    groundGroup.add(stripe);
  }

  // Roadside Urban Streetlamps with Warm Lantern Heads
  for (const sx of [-42, -22, 16, 36]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 5.2, 8),
      mats.darkBronze,
    );
    pole.position.set(sx, 2.4, -26.4);
    pole.castShadow = true;
    const arm = new THREE.Mesh(getBox(0.08, 0.08, 1.3), mats.darkBronze);
    arm.position.set(sx, 4.92, -27.0);
    const head = new THREE.Mesh(getBox(0.32, 0.08, 0.48), mats.darkBronze);
    head.position.set(sx, 4.88, -27.55);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff0d4,
      emissive: new THREE.Color(0xffc97a),
      emissiveIntensity: 0.1,
    });
    const bulb = new THREE.Mesh(getBox(0.24, 0.03, 0.36), bulbMat);
    bulb.position.set(sx, 4.83, -27.55);
    groundGroup.add(pole, arm, head, bulb);
    exteriorEmissives.push(bulb);
  }

  // Articulated Mid-Field Neighboring Residential Buildings (clear of front-east camera cone)
  const neighborTowers: Array<[number, number, number, number, number, boolean]> = [
    [-46, -14, 16, 22, 13, true],
    [-48, 22, 17, 16, 14, false],
    [45, -6, 15, 19, 13, true],
    [45, 25, 17, 25, 14, true],
    [-20, 48, 20, 17, 13, false],
    [22, 48, 18, 20, 13, true],
    [-38, -50, 18, 19, 13, false],
    [52, -40, 16, 15, 13, true],
  ];
  for (const [nx, nz, nw, nh, nd, hasWarmWins] of neighborTowers) {
    const facade = new THREE.Mesh(getBox(nw, nh, nd), mats.neighborFacade);
    facade.position.set(nx, nh * 0.5 - 0.24, nz);
    facade.castShadow = true;
    facade.receiveShadow = true;
    const coping = new THREE.Mesh(getBox(nw + 0.4, 0.42, nd + 0.4), mats.travertine);
    coping.position.set(nx, nh - 0.1, nz);
    const roofBulk = new THREE.Mesh(getBox(nw * 0.34, 1.8, nd * 0.34), mats.corridorStone);
    roofBulk.position.set(nx - nw * 0.15, nh + 0.9, nz);
    groundGroup.add(facade, coping, roofBulk);

    // Architectural Balcony Projections every 2 floors (stone curb + glass + slender bronze top rail)
    const bays = Math.floor(nh / 3.4);
    for (let b = 1; b < bays; b++) {
      const fy = b * 3.4 - 0.1;
      const slabEdge = new THREE.Mesh(getBox(nw + 0.24, 0.16, nd + 0.24), mats.corridorStone);
      slabEdge.position.set(nx, fy, nz);
      groundGroup.add(slabEdge);
      if (b % 2 === 1) {
        const balDeck = new THREE.Mesh(
          getBox(nw * 0.38, 0.14, 1.25),
          mats.travertine,
        );
        const dirZ = nz > 0 ? -1 : 1;
        const railZ = nz + dirZ * (nd * 0.5 + 1.18);
        balDeck.position.set(nx + nw * 0.22, fy, nz + dirZ * (nd * 0.5 + 0.6));
        const balCurb = new THREE.Mesh(
          getBox(nw * 0.38, 0.14, 0.12),
          mats.corridorStone,
        );
        balCurb.position.set(nx + nw * 0.22, fy + 0.14, railZ);
        const balGlass = new THREE.Mesh(
          getBox(nw * 0.37, 0.68, 0.02),
          mats.windowGlass,
        );
        balGlass.position.set(nx + nw * 0.22, fy + 0.55, railZ);
        const balTopRail = new THREE.Mesh(
          getBox(nw * 0.38, 0.045, 0.06),
          mats.darkBronze,
        );
        balTopRail.position.set(nx + nw * 0.22, fy + 0.91, railZ);
        groundGroup.add(balDeck, balCurb, balGlass, balTopRail);
      }
    }

    // Aligned Glass Bay Pockets (seamless blue-slate in Morning, warm apartment glow in Evening/Night!)
    if (hasWarmWins) {
      const nWinMat = new THREE.MeshStandardMaterial({
        color: 0x4a5760,
        emissive: new THREE.Color(0xffb45c),
        emissiveIntensity: 0.0,
        roughness: 0.32,
      });
      const dirZ = nz > 0 ? -1 : 1;
      const winZ = nz + dirZ * (nd * 0.5 + 0.02);
      const cellW = nw / 5;
      const cellH = nh / 10;
      const winW = cellW * 0.66;
      const winH = cellH * 0.56;
      const wPocket = new THREE.Mesh(getBox(winW, winH, 0.04), nWinMat);
      wPocket.position.set(nx - cellW * 1.0, nh - 0.24 - cellH * 2.58, winZ);
      const wPocket2 = new THREE.Mesh(getBox(winW, winH, 0.04), nWinMat);
      wPocket2.position.set(nx - cellW * 1.0, nh - 0.24 - cellH * 5.58, winZ);
      groundGroup.add(wPocket, wPocket2);
      exteriorWinEmissives.push(wPocket, wPocket2);
    }
  }

  // Distant Skyline Silhouettes (Stepped tower crowns + architectural setback bands fading into fog)
  const skyShaft = new THREE.BoxGeometry(1, 0.88, 1);
  skyShaft.translate(0, -0.06, 0);
  const skyBand = new THREE.BoxGeometry(1.03, 0.06, 1.03);
  skyBand.translate(0, 0.34, 0);
  const skyCrown = new THREE.BoxGeometry(0.68, 0.14, 0.68);
  skyCrown.translate(0.06, 0.44, -0.05);
  const skylineGeo =
    mergeGeometries([skyShaft, skyBand, skyCrown], false) ??
    new THREE.BoxGeometry(1, 1, 1);
  skyShaft.dispose();
  skyBand.dispose();
  skyCrown.dispose();
  const skylineCount = 38;
  const skylineInst = new THREE.InstancedMesh(skylineGeo, mats.distantSkyline, skylineCount);
  const dummy = new THREE.Object3D();
  const skyTint = new THREE.Color();
  for (let i = 0; i < skylineCount; i++) {
    const ang = (i / skylineCount) * Math.PI * 2 + (i % 3) * 0.04;
    const rad = 96 + ((i * 19) % 28);
    const w = 10 + ((i * 7) % 10);
    const d = 10 + ((i * 5) % 8);
    const h = 15 + ((i * 13) % 24);
    dummy.position.set(Math.cos(ang) * rad, h * 0.5 - 0.5, Math.sin(ang) * rad);
    dummy.rotation.y = ang + 0.4;
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    skylineInst.setMatrixAt(i, dummy.matrix);
    const shade = 0.86 + ((i * 17) % 19) * 0.01;
    skyTint.setRGB(shade, shade * 0.99, shade * 0.97);
    skylineInst.setColorAt(i, skyTint);

    // Subtle rooftop beacon / evening horizon accent on taller skyline towers
    if (i % 3 === 0) {
      const bMat = new THREE.MeshStandardMaterial({
        color: 0xffe4b8,
        emissive: new THREE.Color(0xffb866),
        emissiveIntensity: 0.0,
      });
      const winBand = new THREE.Mesh(getBox(w * 0.65, 0.55, d * 0.65), bMat);
      winBand.position.set(
        Math.cos(ang) * rad,
        h * 0.78,
        Math.sin(ang) * rad,
      );
      winBand.rotation.y = ang + 0.4;
      groundGroup.add(winBand);
      exteriorWinEmissives.push(winBand);
    }
  }
  skylineInst.instanceMatrix.needsUpdate = true;
  if (skylineInst.instanceColor) skylineInst.instanceColor.needsUpdate = true;
  groundGroup.add(skylineInst);

  // Near-Field Plinth, Steps, Accessible Ramp & Drainage Trench
  const plinth = new THREE.Mesh(getBox(38.0, 0.24, 21.0), mats.corridorStone);
  plinth.position.set(-1.2, -0.13, 1.2);
  plinth.receiveShadow = true;
  groundGroup.add(plinth);

  // Granite Entry Steps leading from Forecourt (-9.8) up to Lobby Portico (-9.0)
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(getBox(5.6, 0.07, 0.34), mats.travertine);
    step.position.set(0.0, -0.18 + s * 0.068, -9.85 + s * 0.32);
    step.receiveShadow = true;
    groundGroup.add(step);
  }

  // Gentle Accessible Side Ramp with Dark Bronze Handrail
  const rampSlope = new THREE.Mesh(getBox(1.5, 0.16, 2.8), mats.travertine);
  rampSlope.position.set(3.85, -0.1, -9.6);
  rampSlope.rotation.x = 0.08;
  rampSlope.receiveShadow = true;
  const rampRail = new THREE.Mesh(getBox(0.045, 0.045, 2.8), mats.darkBronze);
  rampRail.position.set(4.52, 0.78, -9.6);
  rampRail.rotation.x = 0.08;
  groundGroup.add(rampSlope, rampRail);
  for (const rz of [-10.8, -9.6, -8.4]) {
    const post = new THREE.Mesh(getBox(0.04, 0.9, 0.04), mats.darkBronze);
    post.position.set(4.52, 0.33, rz);
    groundGroup.add(post);
  }

  // Stone Arrival Driveway & Raised Kerbs from Compound Gate (Z = -24.5) to Portico (Z = -9.5)
  const driveway = new THREE.Mesh(getBox(14.5, 0.04, 17.2), mats.drivewayStone);
  driveway.position.set(0, -0.2, -16.8);
  driveway.receiveShadow = true;
  groundGroup.add(driveway);

  // Entry Drainage Grating Trench across Gate Threshold & Forecourt
  for (const dz of [-23.4, -10.35]) {
    const trench = new THREE.Mesh(getBox(10.8, 0.015, 0.24), mats.darkBronze);
    trench.position.set(-1.0, -0.178, dz);
    const grate = new THREE.Mesh(getBox(10.6, 0.018, 0.16), mats.stainlessSteel);
    grate.position.set(-1.0, -0.175, dz);
    groundGroup.add(trench, grate);
  }

  // Travertine Kerb Borders along Driveway + Pedestrian Promenade + Stepped Pavers
  const walkway = new THREE.Mesh(getBox(2.9, 0.055, 16.5), mats.travertine);
  walkway.position.set(-3.45, -0.185, -16.2);
  walkway.receiveShadow = true;
  const kerbL = new THREE.Mesh(getBox(0.22, 0.14, 16.6), mats.corridorStone);
  kerbL.position.set(-5.0, -0.15, -16.2);
  const kerbR = new THREE.Mesh(getBox(0.22, 0.14, 15.0), mats.corridorStone);
  kerbR.position.set(7.25, -0.15, -16.8);
  groundGroup.add(walkway, kerbL, kerbR);

  // Marked Visitor Parking Bays on East Forecourt Apron (X = 2.5..6.8, Z = -20..-12)
  for (const pz of [-19.4, -16.6, -13.8]) {
    const bayLine = new THREE.Mesh(getBox(3.4, 0.01, 0.07), mats.roadMarking);
    bayLine.position.set(5.2, -0.176, pz);
    groundGroup.add(bayLine);
  }

  // Ground-Level Composite Modern Sedans (Visitor Forecourt + Street Curbside)
  const carA = buildSiteVehicle(mats, mats.carPaintSilver, vehicleEmissives);
  carA.position.set(5.1, -0.18, -18.0);
  carA.rotation.y = -Math.PI / 2;
  const carB = buildSiteVehicle(mats, mats.carPaintBronze, vehicleEmissives);
  carB.position.set(5.1, -0.18, -15.2);
  carB.rotation.y = -Math.PI / 2;
  const carStreet = buildSiteVehicle(mats, mats.carPaintSilver, vehicleEmissives);
  carStreet.position.set(-14.5, -0.2, -30.5);
  carStreet.rotation.y = Math.PI / 2;
  groundGroup.add(carA, carB, carStreet);

  // Compound Boundary Wall with Masonry Plinth, Dark Bronze Railings & Travertine Coping
  const addCompoundSegment = (cx: number, cz: number, w: number, d: number, h = 1.42) => {
    const isEW = w > d;
    const baseH = 0.85;
    const wall = new THREE.Mesh(getBox(w, baseH, d), mats.compoundWall);
    wall.position.set(cx, baseH * 0.5 - 0.22, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    const cap = new THREE.Mesh(getBox(w + 0.06, 0.07, d + 0.06), mats.travertine);
    cap.position.set(cx, baseH - 0.18, cz);
    const railTop = new THREE.Mesh(
      getBox(isEW ? w : 0.045, 0.045, isEW ? 0.045 : d),
      mats.darkBronze,
    );
    railTop.position.set(cx, h - 0.22, cz);
    groundGroup.add(wall, cap, railTop);

    // Picket verticals along top of compound wall
    const span = isEW ? w : d;
    const count = Math.min(28, Math.max(4, Math.floor(span / 0.95)));
    for (let i = 1; i < count; i++) {
      const off = -span * 0.5 + (i / count) * span;
      const picket = new THREE.Mesh(getBox(0.032, h - baseH, 0.032), mats.darkBronze);
      picket.position.set(
        isEW ? cx + off : cx,
        baseH + (h - baseH) * 0.5 - 0.22,
        isEW ? cz : cz + off,
      );
      groundGroup.add(picket);
    }
  };
  addCompoundSegment(-16.2, -24.2, 18.0, 0.28);
  addCompoundSegment(14.6, -24.2, 19.0, 0.28);
  addCompoundSegment(-25.2, -2.5, 0.28, 43.4);
  addCompoundSegment(24.2, -2.5, 0.28, 43.4);
  addCompoundSegment(-0.5, 19.2, 49.4, 0.28);

  // Entrance Gate Piers, Recessed NIRMANA Engraved Brass Plaque, Security Pavilion & Open Picket Gate Leaves
  for (const gx of [-7.0, 5.0]) {
    const pier = new THREE.Mesh(getBox(0.78, 2.55, 0.78), mats.travertine);
    pier.position.set(gx, 1.05, -24.2);
    pier.castShadow = true;
    const pierCap = new THREE.Mesh(getBox(0.88, 0.1, 0.88), mats.darkBronze);
    pierCap.position.set(gx, 2.36, -24.2);
    const pierLightMat = new THREE.MeshStandardMaterial({
      color: 0xfff0d4,
      emissive: new THREE.Color(0xffc97a),
      emissiveIntensity: 0.15,
    });
    const pierLamp = new THREE.Mesh(getBox(0.32, 0.08, 0.32), pierLightMat);
    pierLamp.position.set(gx, 2.45, -24.2);
    groundGroup.add(pier, pierCap, pierLamp);
    exteriorEmissives.push(pierLamp);
  }

  // Engraved "NIRMANA PRIVATE RESIDENCES" Brushed Brass Sign Wall Beside Gate
  const signPedestal = new THREE.Mesh(getBox(1.85, 1.45, 0.36), mats.compoundWall);
  signPedestal.position.set(-8.65, 0.5, -24.2);
  signPedestal.castShadow = true;
  const gatePlaque = new THREE.Mesh(getBox(1.36, 0.5, 0.05), mats.gatePlaque);
  gatePlaque.position.set(-8.65, 0.86, -24.42);
  gatePlaque.rotation.y = Math.PI; // readable facing arrival street!
  const gatePlaqueFront = new THREE.Mesh(getBox(1.36, 0.5, 0.05), mats.gatePlaque);
  gatePlaqueFront.position.set(-8.65, 0.86, -23.98);
  groundGroup.add(signPedestal, gatePlaque, gatePlaqueFront);

  // Guard / Gatehouse Pavilion beside East Pier
  const guardHouse = new THREE.Mesh(getBox(2.2, 2.35, 2.1), mats.exteriorPlaster);
  guardHouse.position.set(6.75, 0.96, -23.1);
  guardHouse.castShadow = true;
  const guardRoof = new THREE.Mesh(getBox(2.8, 0.14, 2.7), mats.darkBronze);
  guardRoof.position.set(6.75, 2.2, -23.1);
  guardRoof.castShadow = true;
  const guardSoffit = new THREE.Mesh(getBox(2.6, 0.04, 2.5), mats.teakExterior);
  guardSoffit.position.set(6.75, 2.11, -23.1);
  const guardWin = new THREE.Mesh(getBox(1.15, 0.95, 0.06), mats.windowGlass);
  guardWin.position.set(6.75, 1.4, -24.16);
  const guardGlowMat = new THREE.MeshStandardMaterial({
    color: 0xf4e4c8,
    emissive: new THREE.Color(0xffc97a),
    emissiveIntensity: 0.15,
  });
  const guardInside = new THREE.Mesh(getBox(1.05, 0.85, 0.06), guardGlowMat);
  guardInside.position.set(6.75, 1.4, -23.9);
  groundGroup.add(guardHouse, guardRoof, guardSoffit, guardWin, guardInside);
  exteriorEmissives.push(guardInside);

  // Articulated Open Picket Entrance Gate Wings (top/bottom rails + 10 vertical pickets per leaf)
  for (const [gx, angle, sign] of [
    [-6.55, 1.28, 1],
    [4.55, -1.28, -1],
  ] as Array<[number, number, number]>) {
    const gateLeaf = new THREE.Group();
    gateLeaf.position.set(gx, 0.02, -24.2);
    gateLeaf.rotation.y = angle;
    const leafW = 2.45;
    const railB = new THREE.Mesh(getBox(leafW, 0.06, 0.06), mats.darkBronze);
    railB.position.set(sign * leafW * 0.5, 0.14, 0);
    const railT = new THREE.Mesh(getBox(leafW, 0.06, 0.06), mats.darkBronze);
    railT.position.set(sign * leafW * 0.5, 1.68, 0);
    const stileHinge = new THREE.Mesh(getBox(0.07, 1.65, 0.07), mats.darkBronze);
    stileHinge.position.set(sign * 0.035, 0.9, 0);
    const stileLock = new THREE.Mesh(getBox(0.07, 1.65, 0.07), mats.darkBronze);
    stileLock.position.set(sign * (leafW - 0.035), 0.9, 0);
    gateLeaf.add(railB, railT, stileHinge, stileLock);
    for (let p = 1; p < 10; p++) {
      const picket = new THREE.Mesh(getBox(0.032, 1.54, 0.032), mats.darkBronze);
      picket.position.set(sign * ((p / 10) * leafW), 0.9, 0);
      gateLeaf.add(picket);
    }
    groundGroup.add(gateLeaf);
  }

  // Landscaped Soil/Mulch Planter Borders + Court Bench + Reflecting Water Basin
  const addMulchBed = (mx: number, mz: number, mw: number, md: number) => {
    const border = new THREE.Mesh(getBox(mw + 0.18, 0.14, md + 0.18), mats.travertine);
    border.position.set(mx, -0.15, mz);
    border.receiveShadow = true;
    const mulch = new THREE.Mesh(getBox(mw, 0.16, md), mats.soil);
    mulch.position.set(mx, -0.135, mz);
    mulch.receiveShadow = true;
    groundGroup.add(border, mulch);
  };
  addMulchBed(-6.8, -16.8, 2.2, 12.6);
  addMulchBed(-15.0, -21.8, 12.2, 2.4);
  addMulchBed(14.5, -21.8, 13.0, 2.4);
  addMulchBed(-6.0, -10.2, 5.8, 1.3);

  const benchA = buildSiteBench(mats);
  benchA.position.set(-5.8, -0.18, -14.8);
  benchA.rotation.y = Math.PI / 2;
  const benchB = buildSiteBench(mats);
  benchB.position.set(-5.8, -0.18, -19.2);
  benchB.rotation.y = Math.PI / 2;
  groundGroup.add(benchA, benchB);

  // Entry Reflection Water Basin with Limestone Rim
  const basin = new THREE.Mesh(getBox(5.9, 0.18, 2.3), mats.darkBronze);
  basin.position.set(-6.0, -0.15, -7.9);
  const waterSurf = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.9), mats.water);
  waterSurf.rotation.x = -Math.PI / 2;
  waterSurf.position.set(-6.0, -0.055, -7.9);
  groundGroup.add(basin, waterSurf);

  // Exterior Pathway Bollard Lights (hooded cap + warm lens)
  for (const bz of [-22.2, -18.5, -14.8, -11.0]) {
    for (const bx of [-4.95, 2.3]) {
      const post = new THREE.Mesh(getBox(0.11, 0.7, 0.11), mats.darkBronze);
      post.position.set(bx, 0.13, bz);
      post.castShadow = true;
      const hood = new THREE.Mesh(getBox(0.14, 0.04, 0.14), mats.darkBronze);
      hood.position.set(bx, 0.5, bz);
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0xfff0d4,
        emissive: new THREE.Color(0xffc97a),
        emissiveIntensity: 0.15,
      });
      const lens = new THREE.Mesh(getBox(0.09, 0.11, 0.09), lensMat);
      lens.position.set(bx, 0.43, bz);
      groundGroup.add(post, hood, lens);
      exteriorEmissives.push(lens);
    }
  }

  // Instanced Multi-Cluster Organic Shrubs across landscaped planter beds (3 draw calls total!)
  const makeShrubCluster = (rad: number, ox: number, oy: number, oz: number, seed: number) => {
    const g = new THREE.IcosahedronGeometry(rad, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i);
      const vy = p.getY(i);
      const vz = p.getZ(i);
      const ruff =
        1 +
        0.22 * Math.sin(vx * 7.2 + seed) * Math.cos(vz * 6.8 - seed) +
        0.14 * Math.cos(vy * 8.1 + seed * 1.4);
      p.setXYZ(i, vx * ruff + ox, vy * ruff * 0.78 + oy, vz * ruff + oz);
    }
    g.computeVertexNormals();
    return g;
  };
  const sgParts = [
    makeShrubCluster(0.32, 0.0, 0.06, 0.0, 1.2),
    makeShrubCluster(0.24, -0.22, -0.02, 0.12, 2.7),
    makeShrubCluster(0.23, 0.21, -0.01, -0.1, 4.1),
  ];
  const shrubGeo = mergeGeometries(sgParts, false) ?? sgParts[0];
  sgParts.forEach((g) => {
    if (g !== shrubGeo) g.dispose();
  });
  const shrubPts: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 15; i++) {
    shrubPts.push([-6.8 + ((i % 3) - 1) * 0.42, -0.05, -22.4 + i * 0.82, 0.72 + (i % 4) * 0.16]);
  }
  for (let i = 0; i < 12; i++) {
    shrubPts.push([-20.2 + i * 0.96, -0.05, -21.8 + ((i % 2) - 0.5) * 0.45, 0.75 + (i % 3) * 0.18]);
    shrubPts.push([9.2 + i * 0.98, -0.05, -21.8 + ((i % 2) - 0.5) * 0.45, 0.75 + (i % 3) * 0.18]);
  }
  for (let i = 0; i < 8; i++) {
    shrubPts.push([-8.2 + i * 0.68, -0.05, -10.2 + (i % 2) * 0.25, 0.65 + (i % 3) * 0.15]);
  }
  const shrubMats = [mats.foliageA, mats.foliageB, mats.foliageC];
  shrubMats.forEach((sMat, bucketIdx) => {
    const subset = shrubPts.filter((_, idx) => idx % 3 === bucketIdx);
    const inst = new THREE.InstancedMesh(shrubGeo, sMat, subset.length);
    subset.forEach(([sx, sy, sz, sc], idx) => {
      dummy.position.set(sx, sy + sc * 0.24, sz);
      dummy.rotation.set(0, idx * 1.3, 0);
      dummy.scale.set(sc * 1.15, sc * 0.76, sc);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    groundGroup.add(inst);
  });

  // South Courtyard Garden Walk, Border Planter Kerb & Seating (viewed from living room balconies!)
  const southWalk = new THREE.Mesh(getBox(26.0, 0.04, 2.2), mats.drivewayStone);
  southWalk.position.set(-1.0, -0.19, 13.8);
  southWalk.receiveShadow = true;
  const southBorderKerb = new THREE.Mesh(getBox(26.2, 0.14, 0.24), mats.travertine);
  southBorderKerb.position.set(-1.0, -0.15, 12.6);
  const southLawnBed = new THREE.Mesh(getBox(22.0, 0.1, 3.4), mats.soil);
  southLawnBed.position.set(-1.0, -0.17, 17.0);
  const southBench = buildSiteBench(mats);
  southBench.position.set(-1.5, -0.16, 13.9);
  southBench.rotation.y = Math.PI;
  groundGroup.add(southWalk, southBorderKerb, southLawnBed, southBench);

  // Adjacent East Colony Park (jogging loop, park benches, pergola pavilion & shade trees)
  const parkApron = new THREE.Mesh(getBox(14.5, 0.045, 31.0), mats.lawn);
  parkApron.position.set(32.0, -0.2, -3.5);
  parkApron.receiveShadow = true;
  groundGroup.add(parkApron);
  for (const [px, pz, pw, pd] of [
    [26.2, -3.5, 1.35, 25.0],
    [37.4, -3.5, 1.35, 25.0],
    [31.8, -15.3, 12.6, 1.35],
    [31.8, 8.3, 12.6, 1.35],
  ] as Array<[number, number, number, number]>) {
    const trackSeg = new THREE.Mesh(getBox(pw, 0.055, pd), mats.drivewayStone);
    trackSeg.position.set(px, -0.195, pz);
    trackSeg.receiveShadow = true;
    groundGroup.add(trackSeg);
  }
  const parkGazeboFloor = new THREE.Mesh(getBox(4.2, 0.12, 4.2), mats.travertine);
  parkGazeboFloor.position.set(31.8, -0.15, -3.5);
  parkGazeboFloor.receiveShadow = true;
  groundGroup.add(parkGazeboFloor);
  for (const [gx, gz] of [
    [30.0, -5.3],
    [33.6, -5.3],
    [30.0, -1.7],
    [33.6, -1.7],
  ]) {
    const gPost = new THREE.Mesh(getBox(0.14, 2.7, 0.14), mats.darkBronze);
    gPost.position.set(gx, 1.2, gz);
    gPost.castShadow = true;
    groundGroup.add(gPost);
  }
  const gazeboRoof = new THREE.Mesh(getBox(4.5, 0.16, 4.5), mats.teakExterior);
  gazeboRoof.position.set(31.8, 2.6, -3.5);
  gazeboRoof.castShadow = true;
  groundGroup.add(gazeboRoof);
  const parkBenchA = buildSiteBench(mats);
  parkBenchA.position.set(27.6, -0.18, -6.5);
  parkBenchA.rotation.y = Math.PI / 2;
  const parkBenchB = buildSiteBench(mats);
  parkBenchB.position.set(27.6, -0.18, 0.5);
  parkBenchB.rotation.y = Math.PI / 2;
  const parkBenchC = buildSiteBench(mats);
  parkBenchC.position.set(36.0, -0.18, -3.5);
  parkBenchC.rotation.y = -Math.PI / 2;
  groundGroup.add(parkBenchA, parkBenchB, parkBenchC);

  // Diverse Multi-Silhouette Organic Site Trees with varied height & restrained greens
  const treeSpecs: Array<[number, number, number, TreeArchetype]> = [
    [-21.8, -19.2, 7.6, 'spreading'],
    [-22.8, -6.8, 5.2, 'columnar'],
    [-21.6, 5.6, 6.9, 'multistem'],
    [-20.4, 14.8, 5.6, 'spreading'],
    [-11.2, 16.8, 4.9, 'courtyard'],
    [10.2, 16.4, 5.3, 'multistem'],
    [20.6, 12.6, 7.2, 'spreading'],
    [21.4, 0.2, 4.8, 'columnar'],
    [20.4, -12.6, 6.7, 'spreading'],
    [18.6, -19.6, 4.6, 'multistem'],
    [11.4, -17.6, 4.3, 'courtyard'],
    [-11.0, -17.6, 4.5, 'courtyard'],
    [-15.2, -26.2, 6.9, 'spreading'],
    [14.6, -26.0, 5.4, 'columnar'],
    [-29.8, -26.2, 7.3, 'multistem'],
    [29.8, -25.8, 7.5, 'spreading'],
    [-32.5, -39.5, 6.2, 'columnar'],
    [23.5, -39.5, 6.8, 'spreading'],
    [29.4, -11.8, 5.2, 'multistem'],
    [35.4, -11.0, 7.0, 'spreading'],
    [35.2, 4.8, 5.4, 'columnar'],
    [29.4, 5.2, 4.7, 'courtyard'],
  ];
  treeSpecs.forEach(([tx, tz, th, archetype], idx) => {
    const tree = buildExteriorTree(mats, th, idx + 1, archetype);
    tree.position.set(tx, -0.22, tz);
    tree.rotation.y = (idx * 1.17) % (Math.PI * 2);
    groundGroup.add(tree);
  });

  // Entrance forecourt planting beds & lobby planters guiding pedestrian arrival
  for (const bx of [-4.1, 4.1]) {
    const bed = new THREE.Mesh(getBox(1.5, 0.28, 3.8), mats.basePlinthStone);
    bed.position.set(bx, -0.06, -11.4);
    const soil = new THREE.Mesh(getBox(1.3, 0.04, 3.6), mats.soil);
    soil.position.set(bx, 0.09, -11.4);
    groundGroup.add(bed, soil);
    [-12.6, -11.4, -10.2].forEach((sz, sIdx) => {
      const shrub = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.42, 1),
        sIdx % 2 === 0 ? mats.foliageA : mats.foliageB,
      );
      shrub.scale.set(1.1, 0.72, 1.1);
      shrub.position.set(bx, 0.34, sz);
      shrub.castShadow = true;
      groundGroup.add(shrub);
    });
  }
  for (const px of [-2.35, 2.35]) {
    const planter = buildPlanter(mats, {
      potRadius: 0.27,
      potHeight: 0.44,
      leafCount: 14,
    });
    planter.position.set(px, -0.02, -7.15);
    groundGroup.add(planter);
  }

  // Merge static ground/landscape meshes cleanly (InstancedMesh & emissives auto-excluded!)
  const groundExcludes = new Set<THREE.Object3D>([
    ...exteriorEmissives,
    ...exteriorWinEmissives,
    ...vehicleEmissives,
  ]);
  mergeStaticGroupMeshes(groundGroup, groundExcludes);
  root.add(groundGroup);

  // --------------------------------------------------------------------------
  // 2. ALL 10 RESIDENTIAL STOREYS (Floors 1–10 · 30 Units)
  // --------------------------------------------------------------------------
  const dummyDoors: InteractiveDoorHandle[] = [];
  const dummyCurtains: InteractiveCurtainHandle[] = [];
  const dummyClicks: BuiltArchitectureResult['clickTargets'] = [];
  const dummyLights: RoomLightFixture[] = [];

  for (const floor of ALL_FLOORS) {
    const floorGroup = new THREE.Group();
    floorGroup.userData.floorNumber = floor;
    const y = (floor - 1) * ARCH.FLOOR_HEIGHT;

    // Shared Core Floor Slab (Lobby / Corridor) + Off-white Facade Trim / Ground Mineral Grey Plinth
    const coreSlab = new THREE.Mesh(
      getBox(8.6, ARCH.SLAB_THICKNESS, 7.2),
      floor === 1 ? mats.basePlinthStone : mats.facadeTrimPlaster,
    );
    coreSlab.position.set(0, y - ARCH.SLAB_THICKNESS * 0.5, -2.9);
    coreSlab.receiveShadow = true;
    coreSlab.castShadow = true;
    floorGroup.add(coreSlab);

    // Core Front Facade Wall (Z = -6.5) with Entrance Portal (Floor 1) / Full-Height Stairwell Glass
    const coreFrontWall: WallSegmentSpec = {
      id: `core-n-${floor}`,
      x1: -4.2,
      z1: -6.5,
      x2: 4.2,
      z2: -6.5,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      height: ARCH.FLOOR_HEIGHT,
      openings: [
        {
          id: `core-portal-${floor}`,
          kind: floor === 1 ? 'slidingDoor' : 'window',
          offset: 4.2,
          width: 3.4,
          sillHeight: floor === 1 ? 0 : 0.3,
          headHeight: 2.65,
        },
      ],
    };
    floorGroup.add(
      buildWallWithOpenings(
        coreFrontWall,
        y,
        mats,
        dummyDoors,
        dummyCurtains,
        dummyClicks,
        false,
        getBox,
      ),
    );

    // Enclose left & right core side walls along lobby bay (X = ±4.2, Z: -6.5..-1.5)
    for (const sideX of [-4.2, 4.2]) {
      const sideWall = new THREE.Mesh(
        getBox(ARCH.EXT_WALL, ARCH.FLOOR_HEIGHT - ARCH.SLAB_THICKNESS, 5.0),
        floor === 1 ? mats.basePlinthStone : mats.exteriorPlaster,
      );
      sideWall.position.set(
        sideX,
        y + (ARCH.FLOOR_HEIGHT - ARCH.SLAB_THICKNESS) * 0.5,
        -4.0,
      );
      sideWall.receiveShadow = true;
      sideWall.castShadow = true;
      floorGroup.add(sideWall);
    }

    // Ground Floor Mineral-Grey Plinth & Substantial Clad Structural Transfer Piers supporting Floor 4 walls
    if (floor <= 3) {
      for (const [cx, cz] of [
        [-17.1, -4.2],
        [-17.1, 6.2],
        [14.1, -4.2],
        [14.1, 6.2],
      ]) {
        const col = new THREE.Mesh(
          getBox(0.62, ARCH.FLOOR_HEIGHT, 0.62),
          floor === 1 ? mats.basePlinthStone : mats.facadeTrimPlaster,
        );
        col.position.set(cx, y + ARCH.FLOOR_HEIGHT * 0.5, cz);
        col.castShadow = true;
        col.receiveShadow = true;
        floorGroup.add(col);
      }
      if (floor === 3) {
        // Deep architectural stone transfer beams at Floor 4 soffit carrying West & East overhangs
        const westBeamN = new THREE.Mesh(getBox(5.6, 0.42, 0.48), mats.facadeTrimPlaster);
        westBeamN.position.set(-14.6, y + ARCH.FLOOR_HEIGHT - 0.21, -4.2);
        const westBeamS = new THREE.Mesh(getBox(5.6, 0.42, 0.48), mats.facadeTrimPlaster);
        westBeamS.position.set(-14.6, y + ARCH.FLOOR_HEIGHT - 0.21, 6.2);
        const westBeamOuter = new THREE.Mesh(getBox(0.48, 0.42, 11.0), mats.facadeTrimPlaster);
        westBeamOuter.position.set(-17.1, y + ARCH.FLOOR_HEIGHT - 0.21, 1.0);
        const eastBeamN = new THREE.Mesh(getBox(2.6, 0.42, 0.48), mats.facadeTrimPlaster);
        eastBeamN.position.set(13.1, y + ARCH.FLOOR_HEIGHT - 0.21, -4.2);
        const eastBeamS = new THREE.Mesh(getBox(2.6, 0.42, 0.48), mats.facadeTrimPlaster);
        eastBeamS.position.set(13.1, y + ARCH.FLOOR_HEIGHT - 0.21, 6.2);
        const eastBeamOuter = new THREE.Mesh(getBox(0.48, 0.42, 11.0), mats.facadeTrimPlaster);
        eastBeamOuter.position.set(14.1, y + ARCH.FLOOR_HEIGHT - 0.21, 1.0);
        floorGroup.add(
          westBeamN,
          westBeamS,
          westBeamOuter,
          eastBeamN,
          eastBeamS,
          eastBeamOuter,
        );

        // Cap Floor 3 Center 1BHK-C Roof (X: -4.2..4.2, Z: 0.5..7.7) as a Finished Landscaped Courtyard Terrace
        const f3TopY = y + ARCH.FLOOR_HEIGHT;
        const f3TerraceSlab = new THREE.Mesh(getBox(8.6, 0.24, 7.3), mats.balconyPaver);
        f3TerraceSlab.position.set(0, f3TopY - 0.12, 4.1);
        f3TerraceSlab.receiveShadow = true;
        f3TerraceSlab.castShadow = true;
        const f3TerraceCurb = new THREE.Mesh(getBox(8.4, 0.18, 0.15), mats.facadeTrimPlaster);
        f3TerraceCurb.position.set(0, f3TopY + 0.09, 7.65);
        const f3TerraceGlass = new THREE.Mesh(getBox(8.2, 0.84, 0.02), mats.windowGlass);
        f3TerraceGlass.position.set(0, f3TopY + 0.6, 7.65);
        const f3TerraceRail = new THREE.Mesh(getBox(8.4, 0.042, 0.06), mats.darkBronze);
        f3TerraceRail.position.set(0, f3TopY + 1.04, 7.65);
        floorGroup.add(f3TerraceSlab, f3TerraceCurb, f3TerraceGlass, f3TerraceRail);
        for (const px of [-2.4, 0, 2.4]) {
          const tp = buildPlanter(mats, { potRadius: 0.24, potHeight: 0.38, leafCount: 12 });
          tp.position.set(px, f3TopY, 6.75);
          floorGroup.add(tp);
        }
      }
      if (floor === 1) {
        const plinthWest = new THREE.Mesh(getBox(1.4, 0.26, 11.4), mats.basePlinthStone);
        plinthWest.position.set(-17.1, -0.1, 1.0);
        const plinthEast = new THREE.Mesh(getBox(1.4, 0.26, 11.4), mats.basePlinthStone);
        plinthEast.position.set(14.1, -0.1, 1.0);
        floorGroup.add(plinthWest, plinthEast);
      }
    }

    // Floors 4..10 Center South Court Wall (Z = 0.5) — clean open courtyard elevation with corridor daylight window
    if (floor >= 4) {
      const coreSouthWall: WallSegmentSpec = {
        id: `core-s-${floor}`,
        x1: -4.2,
        z1: 0.5,
        x2: 4.2,
        z2: 0.5,
        thickness: ARCH.EXT_WALL,
        isExterior: true,
        height: ARCH.FLOOR_HEIGHT - ARCH.SLAB_THICKNESS,
        openings: [
          {
            id: `core-s-win-${floor}`,
            kind: 'window',
            offset: 4.2,
            width: 2.2,
            sillHeight: ARCH.WINDOW_SILL,
            headHeight: ARCH.WINDOW_HEAD,
          },
        ],
      };
      floorGroup.add(
        buildWallWithOpenings(
          coreSouthWall,
          y,
          mats,
          dummyDoors,
          dummyCurtains,
          dummyClicks,
          false,
          getBox,
        ),
      );
    }

    // Core Corridor & Lobby Ceiling + Downlight
    const coreCeiling = new THREE.Mesh(
      getBox(8.4, 0.08, 7.0),
      mats.ceilingPlaster,
    );
    coreCeiling.position.set(0, y + ARCH.CEILING_CLEAR_HEIGHT + 0.04, -3.0);
    floorGroup.add(coreCeiling);

    const corrLightMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d8,
      emissive: new THREE.Color(0xffca7a),
      emissiveIntensity: 0.25,
    });
    const corrLight = new THREE.Mesh(
      getBox(0.22, 0.02, 0.22),
      corrLightMat,
    );
    corrLight.position.set(0, y + ARCH.CEILING_CLEAR_HEIGHT - 0.01, -0.5);
    floorGroup.add(corrLight);
    if (floor === 1) lobbyEmissives.push(corrLight);
    else exteriorEmissives.push(corrLight);

    // Subtle interior stairwell lighting visible through stairwell core glazing on alternating floors
    if (floor === 1 || floor % 2 === 1) {
      const stairWashMat = new THREE.MeshStandardMaterial({
        color: 0xf6ebd8,
        emissive: new THREE.Color(0xffc97c),
        emissiveIntensity: 0.15,
      });
      const stairWash = new THREE.Mesh(getBox(1.45, 0.12, 0.25), stairWashMat);
      stairWash.position.set(0, y + ARCH.CEILING_CLEAR_HEIGHT - 0.12, -5.95);
      stairWash.userData.maxEmissiveScale = floor === 1 ? 0.85 : 0.48;
      floorGroup.add(stairWash);
      if (floor === 1) lobbyEmissives.push(stairWash);
      else exteriorEmissives.push(stairWash);
    }

    // Ground Floor Portico Canopy, NIRMANA Brass Plaque, Reception Desk & Lobby Lounge
    if (floor === 1) {
      const canopy = new THREE.Mesh(getBox(6.4, 0.2, 2.75), mats.darkBronze);
      canopy.position.set(0, 2.98, -7.8);
      canopy.castShadow = true;
      const canopySoffit = new THREE.Mesh(
        getBox(6.05, 0.04, 2.45),
        mats.teakExterior,
      );
      canopySoffit.position.set(0, 2.86, -7.8);
      for (const px of [-2.85, 2.85]) {
        const pier = new THREE.Mesh(getBox(0.32, 2.98, 0.32), mats.travertine);
        pier.position.set(px, 1.49, -8.8);
        pier.castShadow = true;
        floorGroup.add(pier);
      }

      const canopyGlowMat = new THREE.MeshStandardMaterial({
        color: 0xfff2d8,
        emissive: new THREE.Color(0xffc97a),
        emissiveIntensity: 0.25,
      });
      for (const lx of [-1.5, 0, 1.5]) {
        const cLight = new THREE.Mesh(getBox(0.14, 0.02, 0.14), canopyGlowMat);
        cLight.position.set(lx, 2.83, -7.8);
        floorGroup.add(cLight);
        lobbyEmissives.push(cLight);
      }

      // Portico NIRMAN Engraved Plaque + Integrated 3D Portico Canopy Fascia Sign
      const plaque = new THREE.Mesh(getBox(0.86, 0.31, 0.045), mats.gatePlaque);
      plaque.position.set(-2.55, 1.56, -6.62);
      plaque.rotation.y = Math.PI;
      const portico3dSign = buildNirman3DSignage(mats, exteriorEmissives, 0.24);
      portico3dSign.position.set(0, 2.91, -9.19);
      portico3dSign.rotation.y = Math.PI;

      // Ground lobby concierge desk, stone backdrop & waiting bench
      const desk = new THREE.Mesh(
        createBevelledSlabGeometry(1.9, 0.92, 0.62, 0.03, 0.01),
        mats.walnutH,
      );
      desk.position.set(1.6, 0.0, -4.9);
      const lobbyBench = new THREE.Mesh(
        createBevelledSlabGeometry(1.4, 0.42, 0.5, 0.025, 0.01),
        mats.boucleOatmeal,
      );
      lobbyBench.position.set(-2.0, 0.0, -5.6);

      floorGroup.add(canopy, canopySoffit, plaque, portico3dSign, desk, lobbyBench);
    }

    // Elevator Shaft + Brushed Champagne Lift Doors + Digital Floor Indicator at EVERY level 1..10
    const liftBox = new THREE.Mesh(
      getBox(2.3, ARCH.FLOOR_HEIGHT, 2.3),
      mats.plasterWall,
    );
    liftBox.position.set(1.8, y + ARCH.FLOOR_HEIGHT * 0.5, -2.9);
    const liftFrame = new THREE.Mesh(getBox(1.24, 2.22, 0.07), mats.darkBronze);
    liftFrame.position.set(1.8, y + 1.11, -1.74);
    const liftDoor = new THREE.Mesh(getBox(1.1, 2.15, 0.05), mats.champagneBrass);
    liftDoor.position.set(1.8, y + 1.075, -1.73);
    const liftPanel = new THREE.Mesh(getBox(0.28, 0.08, 0.03), mats.matteBlackMetal);
    liftPanel.position.set(1.8, y + 2.34, -1.72);
    const liftLedMat = new THREE.MeshStandardMaterial({
      color: 0xffd796,
      emissive: new THREE.Color(0xffc060),
      emissiveIntensity: 0.75,
    });
    const liftLed = new THREE.Mesh(getBox(0.16, 0.032, 0.035), liftLedMat);
    liftLed.position.set(1.8, y + 2.34, -1.715);
    exteriorEmissives.push(liftLed);
    floorGroup.add(liftBox, liftFrame, liftDoor, liftPanel, liftLed);

    // Continuous 10-Floor Dog-leg Staircase with Landings & Handrails
    if (floor < ARCH.TOTAL_FLOORS) {
      const steps = 8;
      const halfRise = ARCH.FLOOR_HEIGHT * 0.5;
      for (let s = 0; s < steps; s++) {
        const treadA = new THREE.Mesh(
          getBox(1.05, 0.14, 0.3),
          mats.corridorStone,
        );
        treadA.position.set(-2.45, y + ((s + 0.5) / steps) * halfRise, -2.1 - s * 0.3);
        const treadB = new THREE.Mesh(
          getBox(1.05, 0.14, 0.3),
          mats.corridorStone,
        );
        treadB.position.set(
          -1.25,
          y + halfRise + ((s + 0.5) / steps) * halfRise,
          -4.3 + s * 0.3,
        );
        floorGroup.add(treadA, treadB);
      }
      const midLanding = new THREE.Mesh(
        getBox(2.4, 0.16, 1.0),
        mats.corridorStone,
      );
      midLanding.position.set(-1.85, y + halfRise, -4.85);
      floorGroup.add(midLanding);

      const railGeo = getBox(0.035, 0.045, 2.75);
      const railA = new THREE.Mesh(railGeo, mats.darkBronze);
      railA.position.set(-1.92, y + halfRise * 0.5 + 0.92, -3.15);
      railA.rotation.x = Math.atan2(halfRise, 2.4);
      const railB = new THREE.Mesh(railGeo, mats.darkBronze);
      railB.position.set(-1.78, y + halfRise * 1.5 + 0.92, -3.15);
      railB.rotation.x = -Math.atan2(halfRise, 2.4);
      floorGroup.add(railA, railB);
    }

    // Clean Architectural Stone Core Pilasters framing the stairwell/entrance bay (no thin exposed poles)
    for (const fx of [-4.12, 4.12]) {
      const pilaster = new THREE.Mesh(
        getBox(0.26, ARCH.FLOOR_HEIGHT, 0.24),
        floor === 1 ? mats.basePlinthStone : mats.facadeTrimPlaster,
      );
      pilaster.position.set(fx, y + ARCH.FLOOR_HEIGHT * 0.5, -6.54);
      pilaster.castShadow = true;
      pilaster.receiveShadow = true;
      floorGroup.add(pilaster);
    }

    // Corridor Apartment Entrance Doors & Overview Shells for all 30 residences
    const floorApts = ALL_APARTMENTS.filter((a) => a.floor === floor);
    for (const apt of floorApts) {
      const shell = new THREE.Group();
      const aw = apt.bounds.xMax - apt.bounds.xMin;
      const ad = apt.bounds.zMax - apt.bounds.zMin;
      const acx = (apt.bounds.xMin + apt.bounds.xMax) * 0.5;
      const acz = (apt.bounds.zMin + apt.bounds.zMax) * 0.5;

      // Flush recessed mineral-greige slab edge (#BCB5A9) so horizontal rhythm stays subtle
      const slab = new THREE.Mesh(
        getBox(aw + 0.04, ARCH.SLAB_THICKNESS, ad + 0.04),
        floor === 1 ? mats.basePlinthStone : mats.facadeTrimPlaster,
      );
      slab.position.set(acx, y - ARCH.SLAB_THICKNESS * 0.5, acz);
      slab.receiveShadow = true;
      slab.castShadow = true;
      shell.add(slab);

      // Subtle interior partition depth & ceiling plane so non-active apartments never look hollow!
      const ceilBacking = new THREE.Mesh(
        getBox(aw - 0.3, 0.06, ad - 0.3),
        mats.ceilingPlaster,
      );
      ceilBacking.position.set(acx, y + ARCH.CEILING_CLEAR_HEIGHT + 0.02, acz);
      const innerDepthWall = new THREE.Mesh(
        getBox(aw * 0.55, ARCH.CEILING_CLEAR_HEIGHT, 0.14),
        mats.plasterWall,
      );
      innerDepthWall.position.set(acx, y + ARCH.CEILING_CLEAR_HEIGHT * 0.5, acz);
      shell.add(ceilBacking, innerDepthWall);

      for (const wall of apt.walls) {
        if (!wall.isExterior && !wall.openings.some((o) => o.doorId === 'entrance-door')) {
          continue;
        }
        shell.add(
          buildWallWithOpenings(
            { ...wall, height: ARCH.FLOOR_HEIGHT - ARCH.SLAB_THICKNESS },
            y,
            mats,
            dummyDoors,
            dummyCurtains,
            dummyClicks,
            false,
            getBox,
          ),
        );
      }

      // Corridor-side Apartment Entrance Door Leaf derived dynamically from entrance-door opening
      const entryWall = apt.walls.find((w) =>
        w.openings.some((o) => o.doorId === 'entrance-door'),
      );
      const entryOpening = entryWall?.openings.find((o) => o.doorId === 'entrance-door');
      let doorX = 0;
      let doorZ = 0.5;
      let doorRotY = 0;
      if (entryWall && entryOpening) {
        const wdx = entryWall.x2 - entryWall.x1;
        const wdz = entryWall.z2 - entryWall.z1;
        const wLen = Math.hypot(wdx, wdz) || 1;
        const t = entryOpening.offset / wLen;
        doorX = entryWall.x1 + wdx * t;
        doorZ = entryWall.z1 + wdz * t;
        doorRotY = Math.atan2(wdz, wdx);
      }
      const entGroup = new THREE.Group();
      entGroup.position.set(doorX, y, doorZ);
      entGroup.rotation.y = doorRotY;
      const doorLeaf = new THREE.Mesh(getBox(0.96, 2.15, 0.05), mats.walnutV);
      doorLeaf.position.set(0, 1.075, 0);
      const unitPlaque = new THREE.Mesh(getBox(0.16, 0.08, 0.02), mats.champagneBrass);
      unitPlaque.position.set(0, 1.62, -0.04);
      const bellPlate = new THREE.Mesh(getBox(0.06, 0.09, 0.02), mats.darkBronze);
      bellPlate.position.set(0.62, 1.25, -0.04);
      entGroup.add(doorLeaf, unitPlaque, bellPlate);
      shell.add(entGroup);

      for (const bal of apt.balconies) {
        shell.add(buildBalcony(bal, y, mats, dummyLights, getBox));
        const bp = buildPlanter(mats, {
          potRadius: 0.18,
          potHeight: 0.3,
          leafCount: 10,
        });
        bp.position.set(
          bal.bounds.xMin + 0.45,
          y - 0.02,
          bal.openEdge === 'north' ? bal.bounds.zMin + 0.4 : bal.bounds.zMax - 0.4,
        );
        shell.add(bp);
      }

      // Exterior Split-AC Outdoor Condenser Unit inside Architectural Louvered Service Screen
      const acBay = new THREE.Group();
      const condenser = buildAcCondenserUnit(mats);
      acBay.add(condenser);
      const acLedge = new THREE.Mesh(getBox(1.06, 0.06, 0.44), mats.recessedTaupe);
      acLedge.position.set(0, -0.04, 0.02);
      acBay.add(acLedge);
      for (let ls = 0; ls < 4; ls++) {
        const louver = new THREE.Mesh(getBox(1.04, 0.03, 0.04), mats.darkBronze);
        louver.position.set(0, 0.14 + ls * 0.14, 0.22);
        louver.rotation.x = 0.26;
        acBay.add(louver);
      }
      if (apt.layoutVariant === '3bhk-west') {
        acBay.position.set(-17.7, y + 0.15, -3.55);
        acBay.rotation.y = -Math.PI / 2;
      } else if (apt.layoutVariant === '3bhk-east') {
        acBay.position.set(17.7, y + 0.15, -3.55);
        acBay.rotation.y = Math.PI / 2;
      } else if (apt.layoutVariant === '2bhk-east') {
        acBay.position.set(8.8, y + 0.15, -3.35);
        acBay.rotation.y = Math.PI;
      } else if (apt.layoutVariant === '1bhk-west') {
        acBay.position.set(-12.22, y + 0.15, -1.35);
        acBay.rotation.y = -Math.PI / 2;
      } else if (apt.layoutVariant === '1bhk-east') {
        acBay.position.set(12.22, y + 0.15, -1.35);
        acBay.rotation.y = Math.PI / 2;
      } else {
        acBay.position.set(-3.1, y + 0.15, 7.92);
      }
      shell.add(acBay);

      // Recessed Interior Warm Lighting Backing Planes aligned to actual North window apertures
      const glowBays: Array<[number, number, number]> = [];
      if (apt.type === '3BHK') {
        const signX = apt.layoutVariant === '3bhk-east' ? 1 : -1;
        if (floor === 4 || floor === 6 || floor === 8 || floor === 10) {
          glowBays.push([signX * 12.0, -4.34, 1.72]);
        }
        if (floor === 4 || floor === 7 || floor === 9) {
          glowBays.push([signX * 5.65, -4.34, 1.72]);
        }
        if (floor === 5 || floor === 7) {
          glowBays.push([signX * 15.6, -4.34, 1.62]);
        }
      } else if (apt.type === '2BHK') {
        if (floor === 4 || floor === 8) glowBays.push([8.7, -2.94, 1.65]);
        if (floor === 5 || floor === 8 || floor === 10) glowBays.push([12.2, -4.34, 1.72]);
      } else if (apt.type === '1BHK') {
        if (apt.layoutVariant === '1bhk-west' && (floor === 2 || floor === 3)) {
          glowBays.push([-8.0, -3.24, 1.42]);
        }
        if (apt.layoutVariant === '1bhk-east' && (floor === 1 || floor === 3)) {
          glowBays.push([8.0, -3.24, 1.42]);
        }
      }
      for (const [gx, gz, gw] of glowBays) {
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xffe8c2,
          emissive: new THREE.Color(0xffc56c),
          emissiveIntensity: 0.0,
          roughness: 0.55,
        });
        const winGlow = new THREE.Mesh(getBox(gw, 1.48, 0.06), glowMat);
        winGlow.position.set(gx, y + 1.65, gz);
        winGlow.userData.glowScale = 2.4;
        shell.add(winGlow);
        exteriorWinEmissives.push(winGlow);
      }

      mergeStaticGroupMeshes(
        shell,
        new Set([...exteriorEmissives, ...exteriorWinEmissives]),
      );
      apartmentOverviewShells.set(apt.id, shell);
      floorGroup.add(shell);
    }

    // Floor Slab Click Target Box + Floor-Specific Active Highlight Bars
    const floorMinX = Math.min(...floorApts.map((a) => a.bounds.xMin));
    const floorMaxX = Math.max(...floorApts.map((a) => a.bounds.xMax));
    const floorW = floorMaxX - floorMinX;
    const floorCx = (floorMinX + floorMaxX) * 0.5;
    const pickBar = new THREE.Mesh(
      getBox(floorW + 0.6, ARCH.FLOOR_HEIGHT, 14.4),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pickBar.position.set(floorCx, y + ARCH.FLOOR_HEIGHT * 0.5, 0.6);
    pickBar.userData.floorNumber = floor;
    floorGroup.add(pickBar);
    floorPickTargets.push({ mesh: pickBar, floor });

    const hiGroup = new THREE.Group();
    const trimSegments: Array<[number, number, number, number]> =
      floor <= 3
        ? [
            [0, -3.62, 24.4, 0.06],
            [-12.18, 0.7, 0.06, 8.6],
            [12.18, 0.7, 0.06, 8.6],
            [-8.1, 5.02, 8.2, 0.06],
            [0, 7.92, 8.6, 0.06],
            [8.1, 5.02, 8.2, 0.06],
          ]
        : floor === 6 || floor === 7 || floor === 9
          ? [
              [-10.8, -4.65, 13.4, 0.06],
              [10.8, -4.65, 13.4, 0.06],
              [-17.56, 1.0, 0.06, 11.4],
              [17.56, 1.0, 0.06, 11.4],
              [-10.8, 6.65, 13.4, 0.06],
              [0, 0.56, 8.4, 0.06],
              [10.8, 6.65, 13.4, 0.06],
            ]
          : [
              [-10.8, -4.65, 13.4, 0.06],
              [12.2, -4.65, 4.6, 0.06],
              [8.2, -3.25, 3.6, 0.06],
              [-17.56, 1.0, 0.06, 11.4],
              [14.56, 1.0, 0.06, 11.4],
              [-10.8, 6.65, 13.4, 0.06],
              [0, 0.56, 8.4, 0.06],
              [9.3, 6.65, 10.4, 0.06],
            ];
    for (const [tx, tz, tw, td] of trimSegments) {
      const seg = new THREE.Mesh(getBox(tw, 0.055, td), mats.floorHighlight);
      seg.position.set(tx, y - 0.125, tz);
      hiGroup.add(seg);
    }
    hiGroup.visible = false;
    floorGroup.add(hiGroup);
    floorHighlightBars.set(floor, hiGroup);

    // Merge static core corridor/stairs/lift meshes on this floor cleanly
    const floorExcludes = new Set<THREE.Object3D>([
      ...exteriorEmissives,
      ...exteriorWinEmissives,
      ...lobbyEmissives,
    ]);
    floorExcludes.add(pickBar);
    floorGroup.traverse((child) => {
      if (
        hiGroup === child ||
        hiGroup.children.includes(child) ||
        Array.from(apartmentOverviewShells.values()).some(
          (sh) => sh === child || sh.children.includes(child),
        )
      ) {
        floorExcludes.add(child);
      }
    });
    mergeStaticGroupMeshes(floorGroup, floorExcludes);

    floorShells.set(floor, floorGroup);
    root.add(floorGroup);
  }

  // --------------------------------------------------------------------------
  // 3. COMPLETE ROOFTOP AT Y = 32.0M (Matches Floor 10 Footprint + Pool + Pergola + Flush Parapet Sign)
  // --------------------------------------------------------------------------
  const roofGroup = new THREE.Group();
  const roofY = ARCH.TOTAL_FLOORS * ARCH.FLOOR_HEIGHT; // 32.0m

  const roofSlabs: Array<[number, number, number, number]> = [
    [-17.5, -4.1, -4.6, 6.6],
    [-4.3, 4.3, -6.6, 0.6],
    [4.1, 6.5, -1.8, 6.6],
    [6.3, 10.1, -3.2, 6.6],
    [9.9, 14.5, -4.6, 6.6],
  ];
  for (const [x1, x2, z1, z2] of roofSlabs) {
    const rw = x2 - x1;
    const rd = z2 - z1;
    const deck = new THREE.Mesh(
      getBox(rw, ARCH.SLAB_THICKNESS, rd),
      mats.facadeTrimPlaster,
    );
    deck.position.set(
      (x1 + x2) * 0.5,
      roofY - ARCH.SLAB_THICKNESS * 0.5,
      (z1 + z2) * 0.5,
    );
    deck.castShadow = true;
    deck.receiveShadow = true;
    roofGroup.add(deck);
  }

  const addParapet = (x1: number, z1: number, x2: number, z2: number) => {
    const pLen = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const pg = new THREE.Group();
    pg.position.set(x1, roofY, z1);
    pg.rotation.y = -angle;

    const wall = new THREE.Mesh(
      getBox(pLen, ARCH.ROOF_PARAPET, 0.22),
      mats.exteriorPlaster,
    );
    wall.position.set(pLen * 0.5, ARCH.ROOF_PARAPET * 0.5, 0);
    wall.castShadow = true;
    const coping = new THREE.Mesh(
      getBox(pLen + 0.06, 0.065, 0.32),
      mats.facadeTrimPlaster,
    );
    coping.position.set(pLen * 0.5, ARCH.ROOF_PARAPET + 0.03, 0);
    pg.add(wall, coping);
    roofGroup.add(pg);
  };

  addParapet(-17.4, -4.5, -4.2, -4.5);
  addParapet(-4.2, -4.5, -4.2, -6.5);
  addParapet(-4.2, -6.5, 4.2, -6.5);
  addParapet(4.2, -6.5, 4.2, -1.7);
  addParapet(4.2, -1.7, 6.4, -1.7);
  addParapet(6.4, -1.7, 6.4, -3.1);
  addParapet(6.4, -3.1, 10.0, -3.1);
  addParapet(10.0, -3.1, 10.0, -4.5);
  addParapet(10.0, -4.5, 14.4, -4.5);
  addParapet(14.4, -4.5, 14.4, 6.5);
  addParapet(14.4, 6.5, 4.2, 6.5);
  addParapet(4.2, 6.5, 4.2, 0.5);
  addParapet(4.2, 0.5, -4.2, 0.5);
  addParapet(-4.2, 0.5, -4.2, 6.5);
  addParapet(-4.2, 6.5, -17.4, 6.5);
  addParapet(-17.4, 6.5, -17.4, -4.5);

  // Refined Architectural "NIRMAN" Signage mounted flush inside the North parapet fascia
  const roofNirmanSign = buildNirman3DSignage(mats, exteriorEmissives, 0.78);
  roofNirmanSign.position.set(0, roofY + 0.34, -6.62);
  roofNirmanSign.rotation.y = Math.PI;
  roofGroup.add(roofNirmanSign);

  // Flush Rooftop Rainwater Drainage Scuppers (no ugly exposed exterior downpipe poles)
  for (const [dx, dz] of [
    [-4.32, -6.42],
    [4.32, -6.42],
    [-4.32, 0.42],
    [4.32, 0.42],
  ] as Array<[number, number]>) {
    const scupper = new THREE.Mesh(getBox(0.22, 0.16, 0.22), mats.darkBronze);
    scupper.position.set(dx, roofY + 0.14, dz);
    roofGroup.add(scupper);
  }

  // Staircase & Lift Machine Bulkhead + Roof Access Door
  const bulkhead = new THREE.Mesh(getBox(6.8, 2.65, 3.6), mats.exteriorPlaster);
  bulkhead.position.set(0.0, roofY + 1.325, -4.2);
  bulkhead.castShadow = true;
  const bulkheadRoof = new THREE.Mesh(getBox(7.2, 0.18, 4.0), mats.recessedTaupe);
  bulkheadRoof.position.set(0.0, roofY + 2.74, -4.2);
  const accessDoor = new THREE.Mesh(getBox(0.95, 2.1, 0.08), mats.darkBronze);
  accessDoor.position.set(-1.5, roofY + 1.05, -2.38);
  roofGroup.add(bulkhead, bulkheadRoof, accessDoor);

  // --------------------------------------------------------------------------
  // ROOFTOP SWIMMING POOL PODIUM (West Roof Wing: -17.4..-4.2, -4.5..6.5)
  // --------------------------------------------------------------------------
  const poolCx = -11.4;
  const poolCz = 1.6;
  const poolInnerW = 7.4;
  const poolInnerD = 4.2;
  const podiumH = 0.48;
  const copingW = 0.68;

  const copingN = new THREE.Mesh(
    getBox(poolInnerW + copingW * 2, podiumH, copingW),
    mats.travertine,
  );
  copingN.position.set(poolCx, roofY + podiumH * 0.5, poolCz - poolInnerD * 0.5 - copingW * 0.5);
  const copingS = new THREE.Mesh(
    getBox(poolInnerW + copingW * 2, podiumH, copingW),
    mats.travertine,
  );
  copingS.position.set(poolCx, roofY + podiumH * 0.5, poolCz + poolInnerD * 0.5 + copingW * 0.5);
  const copingW_wall = new THREE.Mesh(
    getBox(copingW, podiumH, poolInnerD),
    mats.travertine,
  );
  copingW_wall.position.set(poolCx - poolInnerW * 0.5 - copingW * 0.5, roofY + podiumH * 0.5, poolCz);
  const copingE_wall = new THREE.Mesh(
    getBox(copingW, podiumH, poolInnerD),
    mats.travertine,
  );
  copingE_wall.position.set(poolCx + poolInnerW * 0.5 + copingW * 0.5, roofY + podiumH * 0.5, poolCz);
  [copingN, copingS, copingW_wall, copingE_wall].forEach((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  roofGroup.add(copingN, copingS, copingW_wall, copingE_wall);

  // Pool entry stairs along East end of podium
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(getBox(0.32, podiumH * ((s + 1) / 3), 2.2), mats.travertine);
    step.position.set(
      poolCx + poolInnerW * 0.5 + copingW + 0.96 - s * 0.32,
      roofY + podiumH * ((s + 1) / 6),
      poolCz,
    );
    roofGroup.add(step);
  }

  const poolFloor = new THREE.Mesh(getBox(poolInnerW, 0.04, poolInnerD), mats.poolTile);
  poolFloor.position.set(poolCx, roofY + 0.03, poolCz);
  poolFloor.receiveShadow = true;
  const tileWallN = new THREE.Mesh(getBox(poolInnerW, podiumH - 0.04, 0.03), mats.poolTile);
  tileWallN.position.set(poolCx, roofY + podiumH * 0.5, poolCz - poolInnerD * 0.5 + 0.015);
  const tileWallS = new THREE.Mesh(getBox(poolInnerW, podiumH - 0.04, 0.03), mats.poolTile);
  tileWallS.position.set(poolCx, roofY + podiumH * 0.5, poolCz + poolInnerD * 0.5 - 0.015);
  const tileWallW = new THREE.Mesh(getBox(0.03, podiumH - 0.04, poolInnerD), mats.poolTile);
  tileWallW.position.set(poolCx - poolInnerW * 0.5 + 0.015, roofY + podiumH * 0.5, poolCz);
  const tileWallE = new THREE.Mesh(getBox(0.03, podiumH - 0.04, poolInnerD), mats.poolTile);
  tileWallE.position.set(poolCx + poolInnerW * 0.5 - 0.015, roofY + podiumH * 0.5, poolCz);
  roofGroup.add(poolFloor, tileWallN, tileWallS, tileWallW, tileWallE);

  const poolWaterPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(poolInnerW - 0.06, poolInnerD - 0.06),
    mats.poolWater,
  );
  poolWaterPlane.rotation.x = -Math.PI / 2;
  poolWaterPlane.position.set(poolCx, roofY + podiumH - 0.07, poolCz);
  roofGroup.add(poolWaterPlane);

  const poolLedMat = new THREE.MeshStandardMaterial({
    color: 0x9cf0ff,
    emissive: new THREE.Color(0x52d8f0),
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  for (const lz of [poolCz - poolInnerD * 0.5 + 0.04, poolCz + poolInnerD * 0.5 - 0.04]) {
    const strip = new THREE.Mesh(getBox(poolInnerW - 0.5, 0.05, 0.03), poolLedMat);
    strip.position.set(poolCx, roofY + 0.25, lz);
    roofGroup.add(strip);
    exteriorEmissives.push(strip);
  }

  for (const rz of [poolCz - 0.28, poolCz + 0.28]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.95, 10),
      mats.stainlessSteel,
    );
    rail.position.set(poolCx + poolInnerW * 0.5 - 0.08, roofY + podiumH + 0.24, rz);
    const grab = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.42, 10),
      mats.stainlessSteel,
    );
    grab.rotation.z = Math.PI / 2;
    grab.position.set(poolCx + poolInnerW * 0.5 + 0.12, roofY + podiumH + 0.7, rz);
    roofGroup.add(rail, grab);
  }

  // Teak Sun Loungers along North Pool Terrace
  for (const lx of [-14.2, -11.4, -8.6]) {
    const lounger = buildPoolLounger(mats);
    lounger.position.set(lx, roofY, -2.75);
    roofGroup.add(lounger);
  }

  // Louver-Screened Rooftop HVAC / Water-Tank Service Enclosure (East-North Roof: 10.1..13.5, -3.7..-1.1)
  const svcCenterX = 11.8;
  const svcCenterZ = -2.4;
  const screenMat = mats.darkBronze;
  for (let i = 0; i < 8; i++) {
    const slatF = new THREE.Mesh(getBox(3.4, 0.08, 0.04), screenMat);
    slatF.position.set(svcCenterX, roofY + 0.25 + i * 0.22, svcCenterZ + 1.3);
    const slatB = new THREE.Mesh(getBox(3.4, 0.08, 0.04), screenMat);
    slatB.position.set(svcCenterX, roofY + 0.25 + i * 0.22, svcCenterZ - 1.3);
    const slatL = new THREE.Mesh(getBox(0.04, 0.08, 2.6), screenMat);
    slatL.position.set(svcCenterX - 1.7, roofY + 0.25 + i * 0.22, svcCenterZ);
    const slatR = new THREE.Mesh(getBox(0.04, 0.08, 2.6), screenMat);
    slatR.position.set(svcCenterX + 1.7, roofY + 0.25 + i * 0.22, svcCenterZ);
    roofGroup.add(slatF, slatB, slatL, slatR);
  }
  for (const ax of [11.1, 12.5]) {
    const chiller = new THREE.Mesh(getBox(1.05, 1.35, 1.0), mats.applianceEnamel);
    chiller.position.set(ax, roofY + 0.675, svcCenterZ);
    const grille = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16),
      mats.darkBronze,
    );
    grille.position.set(ax, roofY + 1.37, svcCenterZ);
    roofGroup.add(chiller, grille);
  }

  // Architectural Poolside Pergola Lounge & Wood Deck on East Roof Wing (X: 7.0..11.8, Z: 1.0..4.6)
  const deckWood = new THREE.Mesh(getBox(4.8, 0.05, 3.6), mats.teakExterior);
  deckWood.position.set(9.4, roofY + 0.025, 2.8);
  deckWood.receiveShadow = true;
  roofGroup.add(deckWood);

  for (const [px, pz] of [
    [7.1, 1.1],
    [11.7, 1.1],
    [7.1, 4.5],
    [11.7, 4.5],
  ]) {
    const pCol = new THREE.Mesh(getBox(0.14, 2.55, 0.14), mats.darkBronze);
    pCol.position.set(px, roofY + 1.275, pz);
    pCol.castShadow = true;
    roofGroup.add(pCol);
  }
  for (let i = 0; i < 8; i++) {
    const fin = new THREE.Mesh(getBox(0.1, 0.22, 3.7), mats.teakExterior);
    fin.position.set(7.25 + i * 0.61, roofY + 2.66, 2.8);
    fin.castShadow = true;
    roofGroup.add(fin);
  }
  const pergolaBeamN = new THREE.Mesh(getBox(5.0, 0.2, 0.16), mats.darkBronze);
  pergolaBeamN.position.set(9.4, roofY + 2.52, 1.1);
  const pergolaBeamS = new THREE.Mesh(getBox(5.0, 0.2, 0.16), mats.darkBronze);
  pergolaBeamS.position.set(9.4, roofY + 2.52, 4.5);
  const pergolaGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff0d4,
    emissive: new THREE.Color(0xffc570),
    emissiveIntensity: 0.2,
  });
  const pergolaLightStrip = new THREE.Mesh(getBox(4.4, 0.03, 0.04), pergolaGlowMat);
  pergolaLightStrip.position.set(9.4, roofY + 2.41, 1.1);
  roofGroup.add(pergolaBeamN, pergolaBeamS, pergolaLightStrip);
  exteriorEmissives.push(pergolaLightStrip);

  // Rooftop Planters & Evening/Night Parapet Sconces along West & East South Parapets
  for (const px of [-14.8, -11.4, -7.8, 6.8, 11.4]) {
    const rp = buildPlanter(mats, {
      potRadius: 0.24,
      potHeight: 0.4,
      leafCount: 12,
    });
    rp.position.set(px, roofY, 5.55);
    roofGroup.add(rp);

    const rLampMat = new THREE.MeshStandardMaterial({
      color: 0xfff0d4,
      emissive: new THREE.Color(0xffc97a),
      emissiveIntensity: 0.15,
    });
    const rLamp = new THREE.Mesh(getBox(0.14, 0.18, 0.08), rLampMat);
    rLamp.position.set(px, roofY + 0.65, 6.36);
    roofGroup.add(rLamp);
    exteriorEmissives.push(rLamp);
  }

  mergeStaticGroupMeshes(roofGroup, new Set([...exteriorEmissives, poolWaterPlane]));
  root.add(roofGroup);

  return {
    root,
    floorShells,
    floorHighlightBars,
    floorPickTargets,
    roofGroup,
    apartmentOverviewShells,
    exteriorEmissives,
    exteriorWinEmissives,
    lobbyEmissives,
    vehicleEmissives,
  };
}
