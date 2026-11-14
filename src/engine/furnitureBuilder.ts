import * as THREE from 'three';
import { ApartmentSpec, ARCH, RoomSpec } from '../architecture/buildingData';
import { ColliderBox } from './collision';
import {
  addContactShadow,
  buildPlanter,
  createBevelledSlabGeometry,
  createCushionGeometry,
} from './geometryHelpers';
import { MaterialLibrary } from './materials';

export interface InteractiveDrawerHandle {
  id: string;
  label: string;
  mesh: THREE.Object3D;
  closedPos: THREE.Vector3;
  slideOffset: THREE.Vector3;
}

export interface InteractiveHingedHandle {
  id: string;
  label: string;
  pivot: THREE.Object3D;
  openAngle: number;
}

export interface LampLightHandle {
  id: string;
  roomId: string;
  label: string;
  emissiveMesh: THREE.Mesh;
  pointLight?: THREE.PointLight;
}

export interface BuiltFurnitureResult {
  group: THREE.Group;
  colliders: ColliderBox[];
  drawers: InteractiveDrawerHandle[];
  hingedParts: InteractiveHingedHandle[];
  wardrobeDoors: InteractiveHingedHandle[];
  lockerDoor?: InteractiveHingedHandle;
  wardrobeLightEmissives: THREE.Mesh[];
  wardrobePointLight?: THREE.PointLight;
  underCabinetEmissives: THREE.Mesh[];
  lamps: LampLightHandle[];
  clickTargets: Array<{
    mesh: THREE.Object3D;
    actionType: string;
    actionId: string;
    label: string;
  }>;
}

export function buildApartmentFurniture(
  apt: ApartmentSpec,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): BuiltFurnitureResult {
  const group = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const drawers: InteractiveDrawerHandle[] = [];
  const hingedParts: InteractiveHingedHandle[] = [];
  const wardrobeDoors: InteractiveHingedHandle[] = [];
  const wardrobeLightEmissives: THREE.Mesh[] = [];
  const underCabinetEmissives: THREE.Mesh[] = [];
  const lamps: LampLightHandle[] = [];
  const clickTargets: BuiltFurnitureResult['clickTargets'] = [];

  const y = (apt.floor - 1) * ARCH.FLOOR_HEIGHT;
  let wardrobePointLight: THREE.PointLight | undefined;
  let lockerDoor: InteractiveHingedHandle | undefined;

  const isMirroredEast =
    apt.layoutVariant === '1bhk-east' || apt.layoutVariant === '3bhk-east';
  const mx = (x: number) => (isMirroredEast ? -x : x);
  const mRotY = (ry: number) => (isMirroredEast ? -ry : ry);
  const addBoxCollider = (
    id: string,
    cx: number,
    cz: number,
    w: number,
    d: number,
  ) => {
    colliders.push({
      id,
      xMin: cx - w * 0.5,
      xMax: cx + w * 0.5,
      zMin: cz - d * 0.5,
      zMax: cz + d * 0.5,
    });
  };

  // Helper: Switchboard & Power Socket plate
  const addSwitchPlate = (px: number, py: number, pz: number, rotY = 0) => {
    const sg = new THREE.Group();
    sg.position.set(px, y + py, pz);
    sg.rotation.y = rotY;
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.08, 0.014),
      mats.darkBronze,
    );
    const rocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.042, 0.018),
      mats.champagneBrass,
    );
    rocker.position.x = -0.022;
    const rocker2 = rocker.clone();
    rocker2.position.x = 0.022;
    sg.add(plate, rocker, rocker2);
    group.add(sg);
  };

  // Helper: Minimalist Brass Architectural Wall Clock
  const addWallClock = (px: number, py: number, pz: number, rotY = 0) => {
    const cg = new THREE.Group();
    cg.position.set(px, y + py, pz);
    cg.rotation.y = rotY;
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.175, 0.026, 28),
      mats.champagneBrass,
    );
    bezel.rotation.x = Math.PI / 2;
    const dial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.162, 0.162, 0.029, 28),
      mats.clockFace,
    );
    dial.rotation.x = Math.PI / 2;
    cg.add(bezel, dial);
    group.add(cg);
  };

  // Helper: Framed Wall Artwork
  const addFramedArt = (
    px: number,
    py: number,
    pz: number,
    rotY: number,
    w: number,
    h: number,
    artMat: THREE.Material,
  ) => {
    const ag = new THREE.Group();
    ag.position.set(px, y + py, pz);
    ag.rotation.y = rotY;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.024), mats.walnutH);
    const canvas = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.05, h - 0.05),
      artMat,
    );
    canvas.position.z = 0.013;
    ag.add(frame, canvas);
    group.add(ag);
  };

  // ============================================================================
  // 1. FOYER COMPOSITION (Mirror + Shoe Cabinet + Umbrella Stand + Switches)
  // ============================================================================
  const foyer = apt.rooms.find((r) => r.id === 'foyer');
  if (foyer) {
    if (apt.layoutVariant === '2bhk-east') {
      buildFoyerConsole(group, 4.92, y, 0.36, 0, mats);
      addBoxCollider('foyer-console', 4.92, 0.36, 1.05, 0.38);
      addSwitchPlate(5.38, 1.22, 0.528, Math.PI);
      addSwitchPlate(4.36, 0.35, -1.55, 0);
      addFramedArt(5.2, 1.55, -1.55, 0, 0.72, 0.88, mats.artLiving);
    } else if (apt.layoutVariant === '1bhk-center') {
      buildFoyerConsole(group, 0.92, y, 1.55, -Math.PI / 2, mats);
      addBoxCollider('foyer-console', 0.92, 1.55, 0.38, 1.05);
      addSwitchPlate(-0.85, 1.22, 0.62, 0);
      addSwitchPlate(-0.85, 0.35, 0.62, 0);
    } else if (apt.layoutVariant === '1bhk-west' || apt.layoutVariant === '1bhk-east') {
      buildFoyerConsole(group, mx(-5.3), y, -1.16, mRotY(Math.PI), mats);
      addBoxCollider('foyer-console', mx(-5.3), -1.16, 1.05, 0.38);
      addSwitchPlate(mx(-4.32), 1.22, 0.15, mRotY(-Math.PI / 2));
      addFramedArt(mx(-5.3), 1.55, -1.26, 0, 0.65, 0.78, mats.artLiving);
    } else {
      // 3bhk-west / 3bhk-east
      buildFoyerConsole(group, mx(-5.3), y, -1.16, mRotY(Math.PI), mats);
      addBoxCollider('foyer-console', mx(-5.3), -1.16, 1.05, 0.38);
      addSwitchPlate(mx(-4.32), 1.22, 0.35, mRotY(-Math.PI / 2));
      addFramedArt(mx(-5.3), 1.55, -1.26, 0, 0.68, 0.82, mats.artLiving);
    }
  }

  // ============================================================================
  // 1b. PUJA MANDIR / SACRED ALCOVE (Every Residence)
  // ============================================================================
  const puja = apt.rooms.find((r) => r.id === 'puja');
  if (puja) {
    let px = 0;
    let pz = 0;
    let pRot = 0;
    if (apt.layoutVariant === '1bhk-center') {
      px = -0.02;
      pz = 3.05;
      pRot = -Math.PI / 2;
    } else if (apt.layoutVariant === '1bhk-west' || apt.layoutVariant === '1bhk-east') {
      px = mx(-7.75);
      pz = -0.15;
      pRot = mRotY(Math.PI / 2);
    } else if (apt.layoutVariant === '2bhk-east') {
      px = 4.51;
      pz = 1.55;
      pRot = Math.PI / 2;
    } else {
      // 3bhk-west / 3bhk-east
      px = mx(-4.51);
      pz = 1.65;
      pRot = mRotY(-Math.PI / 2);
    }
    const pujaRes = buildPujaMandir(mats);
    pujaRes.group.position.set(px, y, pz);
    pujaRes.group.rotation.y = pRot;
    group.add(pujaRes.group);
    addBoxCollider('puja-mandir', px, pz, 0.56, 0.86);
    lamps.push({
      id: 'puja-diya',
      roomId: 'puja',
      label: 'Puja Mandir Diya & Backlight',
      emissiveMesh: pujaRes.diyaFlame,
    });
    clickTargets.push({
      mesh: pujaRes.group,
      actionType: 'lamp',
      actionId: 'puja-diya',
      label: 'Toggle Puja Mandir Diya',
    });
  }

  // ============================================================================
  // 2. LIVING ROOM COMPOSITION + SPLIT AC
  // ============================================================================
  const living = apt.rooms.find((r) => r.id === 'living');
  if (living) {
    if (apt.layoutVariant === '2bhk-east') {
      const sofa = buildDetailedSofa(mats, 2.35, 0.96);
      sofa.position.set(5.85, y, 4.35);
      sofa.rotation.y = Math.PI / 2;
      group.add(sofa);
      addBoxCollider('living-sofa', 5.85, 4.35, 0.96, 2.35);

      const rug = buildWovenRug(mats, 2.85, 3.45);
      rug.position.set(7.35, y, 4.35);
      group.add(rug);

      const coffeeTable = buildCoffeeTable(mats, 1.15, 0.72);
      coffeeTable.position.set(7.28, y, 4.35);
      group.add(coffeeTable);
      addBoxCollider('living-table', 7.28, 4.35, 0.72, 1.15);

      const mediaWall = buildMediaWall(mats, 2.45);
      mediaWall.position.set(9.92, y, 4.35);
      mediaWall.rotation.y = -Math.PI / 2;
      group.add(mediaWall);
      addBoxCollider('living-media', 9.72, 4.35, 0.44, 2.45);

      const loungeChair = buildLoungeChair(mats);
      loungeChair.position.set(7.85, y, 2.95);
      loungeChair.rotation.y = -0.55;
      group.add(loungeChair);

      const sideTable = buildBrassSideTable(mats);
      sideTable.position.set(5.68, y, 2.88);
      group.add(sideTable);

      const floorLamp = buildFloorLamp(mats, isSoftwareGl);
      floorLamp.group.position.set(5.48, y, 5.82);
      group.add(floorLamp.group);
      lamps.push({
        id: 'living-floor-lamp',
        roomId: 'living',
        label: 'Living Floor Lamp',
        emissiveMesh: floorLamp.shadeMesh,
        pointLight: floorLamp.pointLight,
      });
      clickTargets.push({
        mesh: floorLamp.group,
        actionType: 'lamp',
        actionId: 'living-floor-lamp',
        label: 'Toggle Living Floor Lamp',
      });

      const plant = buildPlanter(mats, { potRadius: 0.21, potHeight: 0.36, leafCount: 16 });
      plant.position.set(9.42, y, 5.82);
      group.add(plant);
      addWallClock(9.92, 1.85, 2.75, -Math.PI / 2);
      addSwitchPlate(9.92, 0.38, 5.65, -Math.PI / 2);
      addSwitchPlate(4.32, 1.22, 3.2, Math.PI / 2);

      const splitAc = buildSplitAcUnit(mats);
      splitAc.position.set(9.86, y + 2.44, 4.35);
      splitAc.rotation.y = -Math.PI / 2;
      group.add(splitAc);
    } else if (apt.layoutVariant === '1bhk-center') {
      const rug = buildWovenRug(mats, 2.25, 2.75);
      rug.position.set(-2.0, y, 5.45);
      group.add(rug);

      const sofa = buildDetailedSofa(mats, 2.05, 0.92);
      sofa.position.set(-3.55, y, 5.45);
      sofa.rotation.y = Math.PI / 2;
      group.add(sofa);
      addBoxCollider('living-sofa', -3.55, 5.45, 0.92, 2.05);

      const coffeeTable = buildCoffeeTable(mats, 0.96, 0.64);
      coffeeTable.position.set(-2.2, y, 5.45);
      group.add(coffeeTable);
      addBoxCollider('living-table', -2.2, 5.45, 0.64, 0.96);

      const mediaWall = buildMediaWall(mats, 2.1);
      mediaWall.position.set(0.12, y, 5.45);
      mediaWall.rotation.y = -Math.PI / 2;
      group.add(mediaWall);
      addBoxCollider('living-media', -0.1, 5.45, 0.42, 2.1);

      const floorLamp = buildFloorLamp(mats, isSoftwareGl);
      floorLamp.group.position.set(-3.65, y, 6.95);
      group.add(floorLamp.group);
      lamps.push({
        id: 'living-floor-lamp',
        roomId: 'living',
        label: 'Living Floor Lamp',
        emissiveMesh: floorLamp.shadeMesh,
        pointLight: floorLamp.pointLight,
      });
      clickTargets.push({
        mesh: floorLamp.group,
        actionType: 'lamp',
        actionId: 'living-floor-lamp',
        label: 'Toggle Living Floor Lamp',
      });
      addWallClock(0.12, 1.85, 3.85, -Math.PI / 2);
      addSwitchPlate(-4.08, 1.22, 3.85, Math.PI / 2);

      const splitAc = buildSplitAcUnit(mats);
      splitAc.position.set(0.06, y + 2.44, 5.45);
      splitAc.rotation.y = -Math.PI / 2;
      group.add(splitAc);
    } else if (apt.layoutVariant === '1bhk-west' || apt.layoutVariant === '1bhk-east') {
      const rug = buildWovenRug(mats, 2.15, 2.55);
      rug.position.set(mx(-5.95), y, 3.15);
      group.add(rug);

      const sofa = buildDetailedSofa(mats, 2.0, 0.92);
      sofa.position.set(mx(-7.52), y, 3.15);
      sofa.rotation.y = mRotY(Math.PI / 2);
      group.add(sofa);
      addBoxCollider('living-sofa', mx(-7.52), 3.15, 0.92, 2.0);

      const coffeeTable = buildCoffeeTable(mats, 0.94, 0.6);
      coffeeTable.position.set(mx(-6.18), y, 3.15);
      group.add(coffeeTable);
      addBoxCollider('living-table', mx(-6.18), 3.15, 0.6, 0.94);

      const mediaWall = buildMediaWall(mats, 2.05);
      mediaWall.position.set(mx(-4.32), y, 3.15);
      mediaWall.rotation.y = mRotY(-Math.PI / 2);
      group.add(mediaWall);
      addBoxCollider('living-media', mx(-4.54), 3.15, 0.42, 2.05);

      const floorLamp = buildFloorLamp(mats, isSoftwareGl);
      floorLamp.group.position.set(mx(-7.58), y, 4.35);
      group.add(floorLamp.group);
      lamps.push({
        id: 'living-floor-lamp',
        roomId: 'living',
        label: 'Living Floor Lamp',
        emissiveMesh: floorLamp.shadeMesh,
        pointLight: floorLamp.pointLight,
      });
      clickTargets.push({
        mesh: floorLamp.group,
        actionType: 'lamp',
        actionId: 'living-floor-lamp',
        label: 'Toggle Living Floor Lamp',
      });
      addWallClock(mx(-4.32), 1.85, 1.75, mRotY(-Math.PI / 2));
      addSwitchPlate(mx(-4.32), 0.38, 4.35, mRotY(-Math.PI / 2));

      const splitAc = buildSplitAcUnit(mats);
      splitAc.position.set(mx(-4.38), y + 2.44, 3.15);
      splitAc.rotation.y = mRotY(-Math.PI / 2);
      group.add(splitAc);
    } else {
      // 3bhk-west / 3bhk-east
      const rug = buildWovenRug(mats, 3.2, 3.6);
      rug.position.set(mx(-7.8), y, 4.45);
      group.add(rug);

      const sofa = buildDetailedSofa(mats, 2.65, 0.98);
      sofa.position.set(mx(-9.75), y, 4.45);
      sofa.rotation.y = mRotY(Math.PI / 2);
      group.add(sofa);
      addBoxCollider('living-sofa', mx(-9.75), 4.45, 0.98, 2.65);

      const coffeeTable = buildCoffeeTable(mats, 1.24, 0.78);
      coffeeTable.position.set(mx(-8.0), y, 4.45);
      group.add(coffeeTable);
      addBoxCollider('living-table', mx(-8.0), 4.45, 0.78, 1.24);

      const mediaWall = buildMediaWall(mats, 2.8);
      mediaWall.position.set(mx(-4.32), y, 4.45);
      mediaWall.rotation.y = mRotY(-Math.PI / 2);
      group.add(mediaWall);
      addBoxCollider('living-media', mx(-4.55), 4.45, 0.45, 2.75);

      const loungeChair = buildLoungeChair(mats);
      loungeChair.position.set(mx(-7.6), y, 2.95);
      loungeChair.rotation.y = mRotY(-0.45);
      group.add(loungeChair);

      const floorLamp = buildFloorLamp(mats, isSoftwareGl);
      floorLamp.group.position.set(mx(-10.2), y, 5.95);
      group.add(floorLamp.group);
      lamps.push({
        id: 'living-floor-lamp',
        roomId: 'living',
        label: 'Living Floor Lamp',
        emissiveMesh: floorLamp.shadeMesh,
        pointLight: floorLamp.pointLight,
      });
      clickTargets.push({
        mesh: floorLamp.group,
        actionType: 'lamp',
        actionId: 'living-floor-lamp',
        label: 'Toggle Living Floor Lamp',
      });

      const plant = buildPlanter(mats, { potRadius: 0.22, potHeight: 0.38, leafCount: 16 });
      plant.position.set(mx(-5.05), y, 5.85);
      group.add(plant);
      addWallClock(mx(-4.32), 1.88, 2.55, mRotY(-Math.PI / 2));
      addSwitchPlate(mx(-4.32), 0.38, 5.65, mRotY(-Math.PI / 2));

      const splitAc = buildSplitAcUnit(mats);
      splitAc.position.set(mx(-4.38), y + 2.44, 4.45);
      splitAc.rotation.y = mRotY(-Math.PI / 2);
      group.add(splitAc);
    }
  }

  // ============================================================================
  // 2b. 3 BHK FAMILY LOUNGE (X: -11.4..-8.6 or +8.6..11.4, Z: 0.4..2.5)
  // ============================================================================
  const familyLounge = apt.rooms.find((r) => r.id === 'family-lounge');
  if (familyLounge) {
    const fl = buildFamilyLounge(mats, isSoftwareGl, isMirroredEast);
    fl.group.position.set(mx(-9.8), y, 1.55);
    group.add(fl.group);
    addBoxCollider('family-lounge-loveseat', mx(-10.92), 1.55, 0.88, 1.62);
    lamps.push({
      id: 'family-lounge-lamp',
      roomId: 'family-lounge',
      label: 'Family Lounge Lamp',
      emissiveMesh: fl.shadeMesh,
      pointLight: fl.pointLight,
    });
    clickTargets.push({
      mesh: fl.lampGroup,
      actionType: 'lamp',
      actionId: 'family-lounge-lamp',
      label: 'Toggle Family Lounge Lamp',
    });
  }

  // ============================================================================
  // 3. DINING SUITE (Table + Upholstered Chairs + Suspended Brass Pendant)
  // ============================================================================
  const dining = apt.rooms.find((r) => r.id === 'dining');
  if (dining) {
    const dcx =
      (dining.bounds.xMin + dining.bounds.xMax) * 0.5 +
      (apt.layoutVariant === '2bhk-east' ? -0.15 : 0);
    const dcz = (dining.bounds.zMin + dining.bounds.zMax) * 0.5;
    const seats = apt.type === '3BHK' ? 6 : 4;
    const diningSet = buildDiningSuite(mats, seats);
    diningSet.group.position.set(dcx, y, dcz);
    group.add(diningSet.group);
    addBoxCollider('dining-table', dcx, dcz, 1.85, 1.05);
    lamps.push({
      id: 'dining-pendant',
      roomId: 'dining',
      label: 'Dining Pendant',
      emissiveMesh: diningSet.pendantDiffuser,
    });
  } else if (apt.layoutVariant === '1bhk-center') {
    const diningSet = buildDiningSuite(mats, 4, true);
    diningSet.group.position.set(-1.35, y, 3.65);
    group.add(diningSet.group);
    addBoxCollider('dining-table', -1.35, 3.65, 1.25, 0.85);
    lamps.push({
      id: 'dining-pendant',
      roomId: 'living',
      label: 'Dining Pendant',
      emissiveMesh: diningSet.pendantDiffuser,
    });
  } else if (apt.layoutVariant === '1bhk-west' || apt.layoutVariant === '1bhk-east') {
    const diningSet = buildDiningSuite(mats, 4, true);
    diningSet.group.position.set(mx(-5.45), y, 1.52);
    group.add(diningSet.group);
    addBoxCollider('dining-table', mx(-5.45), 1.52, 1.25, 0.85);
    lamps.push({
      id: 'dining-pendant',
      roomId: 'living',
      label: 'Dining Pendant',
      emissiveMesh: diningSet.pendantDiffuser,
    });
  }

  // ============================================================================
  // 4. FITTED KITCHEN WITH RO PURIFIER, DISH RACK, DRAWER & CABINETS
  // ============================================================================
  const kitchen = apt.rooms.find((r) => r.id === 'kitchen');
  if (kitchen) {
    const kResult = buildFittedKitchen(kitchen, apt.layoutVariant, y, mats);
    group.add(kResult.group);
    drawers.push(...kResult.drawers);
    hingedParts.push(...kResult.hingedParts);
    underCabinetEmissives.push(...kResult.underCabinetEmissives);
    clickTargets.push(...kResult.clickTargets);
    kResult.colliders.forEach((c) => colliders.push(c));
    if (apt.layoutVariant === '2bhk-east') {
      addSwitchPlate(9.93, 1.22, -0.45, -Math.PI / 2);
    } else if (apt.layoutVariant === '1bhk-center') {
      addSwitchPlate(-1.65, 1.22, 0.62, 0);
    } else if (apt.layoutVariant === '1bhk-west' || apt.layoutVariant === '1bhk-east') {
      addSwitchPlate(mx(-6.52), 1.22, -1.75, mRotY(-Math.PI / 2));
    } else {
      addSwitchPlate(mx(-13.92), 1.22, -1.75, mRotY(-Math.PI / 2));
    }
  }

  // ============================================================================
  // 5. PRIMARY BEDROOM + CUSTOM WARDROBE + STEEL SAFE / LOCKER + SPLIT AC
  // ============================================================================
  const bed1 = apt.rooms.find((r) => r.id === 'primary-bed');
  if (bed1) {
    const b1 = buildPrimaryBedroom(bed1, apt.layoutVariant, y, mats, isSoftwareGl);
    group.add(b1.group);
    wardrobeDoors.push(...b1.wardrobeDoors);
    lockerDoor = b1.lockerDoor;
    wardrobeLightEmissives.push(...b1.wardrobeLightEmissives);
    wardrobePointLight = b1.wardrobePointLight;
    lamps.push(...b1.lamps);
    clickTargets.push(...b1.clickTargets);
    b1.colliders.forEach((c) => colliders.push(c));

    const ac1 = buildSplitAcUnit(mats);
    if (apt.layoutVariant === '2bhk-east') {
      ac1.position.set(10.18, y + 2.52, 2.45);
      ac1.rotation.y = Math.PI / 2;
    } else if (apt.layoutVariant === '1bhk-center') {
      ac1.position.set(4.08, y + 2.44, 5.15);
      ac1.rotation.y = -Math.PI / 2;
    } else if (apt.layoutVariant === '1bhk-west' || apt.layoutVariant === '1bhk-east') {
      ac1.position.set(mx(-8.34), y + 2.55, 3.15);
      ac1.rotation.y = mRotY(-Math.PI / 2);
    } else {
      ac1.position.set(mx(-17.28), y + 2.44, 3.85);
      ac1.rotation.y = mRotY(Math.PI / 2);
    }
    group.add(ac1);
  }

  // ============================================================================
  // 6. SECONDARY BEDROOM (Bed + Study Desk + Bookshelf + Wardrobe + Split AC)
  // ============================================================================
  const bed2 = apt.rooms.find((r) => r.id === 'secondary-bed');
  if (bed2) {
    const b2 = buildSecondaryBedroom(bed2, y, mats, false, isMirroredEast, apt.type === '3BHK');
    group.add(b2.group);
    lamps.push(...b2.lamps);
    b2.colliders.forEach((c) => colliders.push(c));

    const ac2 = buildSplitAcUnit(mats);
    ac2.position.set(
      (bed2.bounds.xMin + bed2.bounds.xMax) * 0.5,
      y + 2.44,
      bed2.bounds.zMin + 0.18,
    );
    group.add(ac2);
  }

  // ============================================================================
  // 7. THIRD BEDROOM (3 BHK) + SPLIT AC
  // ============================================================================
  const bed3 = apt.rooms.find((r) => r.id === 'third-bed');
  if (bed3) {
    const b3 = buildSecondaryBedroom(bed3, y, mats, true, isMirroredEast, true);
    group.add(b3.group);
    lamps.push(...b3.lamps);
    b3.colliders.forEach((c) => colliders.push(c));

    const ac3 = buildSplitAcUnit(mats);
    ac3.position.set(
      (bed3.bounds.xMin + bed3.bounds.xMax) * 0.5,
      y + 2.44,
      bed3.bounds.zMin + 0.18,
    );
    group.add(ac3);
  }

  // ============================================================================
  // 8. BATHROOMS (Shower, Vanity, WC, Geyser, Mirror, Towels)
  // ============================================================================
  for (const bath of apt.rooms.filter((r) => r.category === 'bathroom')) {
    const bg = buildDetailedBathroom(bath, y, mats, isMirroredEast);
    group.add(bg.group);
    lamps.push(...bg.lamps);
  }

  // ============================================================================
  // 9. BALCONY SEATING, PLANTING, WASHER, DRYING RACK & LANTERNS
  // ============================================================================
  for (const bal of apt.balconies) {
    const balW = bal.bounds.xMax - bal.bounds.xMin;
    const balD = bal.bounds.zMax - bal.bounds.zMin;
    const bcz = (bal.bounds.zMin + bal.bounds.zMax) * 0.5;

    if (bal.id === 'utility-balcony') {
      const util = buildUtilityLaundry(bal, y, mats);
      group.add(util.group);
      colliders.push(...util.colliders);
      continue;
    }

    if (balW > 2.4 && balD > 1.3) {
      const chairA = buildOutdoorChair(mats);
      chairA.position.set(bal.bounds.xMin + 0.95, y - 0.025, bcz + 0.1);
      chairA.rotation.y = 0.55;
      const chairB = buildOutdoorChair(mats);
      chairB.position.set(bal.bounds.xMin + 2.35, y - 0.025, bcz + 0.1);
      chairB.rotation.y = -0.55;
      const table = buildBrassSideTable(mats, mats.travertine);
      table.position.set(bal.bounds.xMin + 1.65, y - 0.025, bcz + 0.18);

      const lanternBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.16, 16),
        mats.darkBronze,
      );
      lanternBody.position.set(bal.bounds.xMin + 1.65, y + 0.52, bcz + 0.18);
      const lanternGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.11, 14),
        new THREE.MeshStandardMaterial({
          color: 0xfff0d4,
          emissive: new THREE.Color(0xffc97a),
          emissiveIntensity: 0.2,
        }),
      );
      lanternGlow.position.set(bal.bounds.xMin + 1.65, y + 0.52, bcz + 0.18);
      group.add(chairA, chairB, table, lanternBody, lanternGlow);
      lamps.push({
        id: `${bal.id}-lantern`,
        roomId: 'balcony',
        label: 'Balcony Lantern',
        emissiveMesh: lanternGlow,
      });
    }

    // In 1 BHK, include compact front-load utility washer + slim drying rack neatly tucked on main balcony
    if (apt.type === '1BHK' && bal.id === 'main-balcony') {
      const washerX = isMirroredEast ? bal.bounds.xMax - 0.42 : bal.bounds.xMin + 0.42;
      const washer = buildWashingMachine(mats);
      washer.position.set(washerX, y - 0.025, bal.bounds.zMin + 0.42);
      group.add(washer);
      addBoxCollider('1bhk-washer', washerX, bal.bounds.zMin + 0.42, 0.62, 0.62);

      const rack = buildDryingRack(mats);
      rack.position.set(
        isMirroredEast ? bal.bounds.xMin + 0.52 : bal.bounds.xMax - 0.52,
        y - 0.025,
        bal.bounds.zMin + 0.48,
      );
      group.add(rack);
    }

    const p1 = buildPlanter(mats, { potRadius: 0.22, potHeight: 0.36, leafCount: 15 });
    p1.position.set(bal.bounds.xMax - 0.45, y - 0.025, bal.bounds.zMax - 0.42);
    const p2 = buildPlanter(mats, { potRadius: 0.17, potHeight: 0.28, leafCount: 12 });
    p2.position.set(bal.bounds.xMin + 0.4, y - 0.025, bal.bounds.zMax - 0.38);
    group.add(p1, p2);
  }

  return {
    group,
    colliders,
    drawers,
    hingedParts,
    wardrobeDoors,
    lockerDoor,
    wardrobeLightEmissives,
    wardrobePointLight,
    underCabinetEmissives,
    lamps,
    clickTargets,
  };
}

// ----------------------------------------------------------------------------
// COMPONENT BUILDERS
// ----------------------------------------------------------------------------

function buildFoyerConsole(
  parent: THREE.Object3D,
  cx: number,
  y: number,
  cz: number,
  rotY: number,
  mats: MaterialLibrary,
) {
  const g = new THREE.Group();
  g.position.set(cx, y, cz);
  g.rotation.y = rotY;

  // Floating Walnut Shoe Cabinet (with shadow gap & two distinct cabinet doors)
  const body = new THREE.Mesh(
    createBevelledSlabGeometry(1.04, 0.48, 0.34, 0.014, 0.004),
    mats.walnutH,
  );
  body.position.y = 0.22;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  for (const dx of [-0.255, 0.255]) {
    const door = new THREE.Mesh(
      createBevelledSlabGeometry(0.495, 0.44, 0.022, 0.008, 0.003),
      mats.oakV,
    );
    door.position.set(dx, 0.24, -0.175);
    const pull = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.012, 0.018),
      mats.champagneBrass,
    );
    pull.position.set(dx + (dx < 0 ? 0.18 : -0.18), 0.58, -0.188);
    g.add(door, pull);
  }

  // Top travertine tray & brass catchall bowl
  const tray = new THREE.Mesh(
    createBevelledSlabGeometry(0.32, 0.022, 0.18, 0.02, 0.004),
    mats.travertine,
  );
  tray.position.set(-0.22, 0.7, 0);
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.045, 0.045, 20),
    mats.champagneBrass,
  );
  bowl.position.set(0.24, 0.722, 0);
  g.add(tray, bowl);

  // Rounded Brass-Framed Foyer Mirror above cabinet
  const mirrorFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.014, 12, 36),
    mats.champagneBrass,
  );
  mirrorFrame.position.set(0, 1.44, 0.14);
  const mirrorDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.012, 36),
    mats.mirrorGlass,
  );
  mirrorDisc.rotation.x = Math.PI / 2;
  mirrorDisc.position.set(0, 1.44, 0.142);
  g.add(mirrorFrame, mirrorDisc);

  // Architectural Brass-Rimmed Umbrella Stand & Compact Shoe Bench Cushion beside console
  const uStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.085, 0.46, 18),
    mats.darkBronze,
  );
  uStand.position.set(-0.66, 0.23, 0);
  const uRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.008, 10, 20),
    mats.champagneBrass,
  );
  uRim.rotation.x = Math.PI / 2;
  uRim.position.set(-0.66, 0.46, 0);
  const umbrellaShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.68, 10),
    mats.linenOlive,
  );
  umbrellaShaft.position.set(-0.66, 0.38, 0);
  umbrellaShaft.rotation.z = 0.12;
  g.add(uStand, uRim, umbrellaShaft);

  addContactShadow(g, 1.05, 0.38, mats, 0.005);
  parent.add(g);
}

function buildDetailedSofa(
  mats: MaterialLibrary,
  width: number,
  depth: number,
): THREE.Group {
  const g = new THREE.Group();

  // 4 Tapered Walnut Support Legs with Brass Ferrules
  const legGeo = new THREE.CylinderGeometry(0.024, 0.016, 0.12, 12);
  const ferruleGeo = new THREE.CylinderGeometry(0.017, 0.016, 0.032, 12);
  for (const lx of [-width * 0.44, width * 0.44]) {
    for (const lz of [-depth * 0.4, depth * 0.4]) {
      const leg = new THREE.Mesh(legGeo, mats.walnutV);
      leg.position.set(lx, 0.06, lz);
      leg.castShadow = true;
      const ferrule = new THREE.Mesh(ferruleGeo, mats.champagneBrass);
      ferrule.position.set(lx, 0.016, lz);
      g.add(leg, ferrule);
    }
  }

  // Recessed Walnut Timber Plinth Rail
  const plinth = new THREE.Mesh(
    createBevelledSlabGeometry(width - 0.04, 0.075, depth - 0.04, 0.03, 0.006),
    mats.walnutH,
  );
  plinth.position.y = 0.11;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  // Upholstered Seat Deck Base
  const seatDeck = new THREE.Mesh(
    createBevelledSlabGeometry(width, 0.11, depth, 0.04, 0.012),
    mats.boucleOatmeal,
  );
  seatDeck.position.y = 0.18;
  seatDeck.castShadow = true;
  seatDeck.receiveShadow = true;
  g.add(seatDeck);

  // 3 Separate Rounded Seat Cushions with slight gap & piped seam
  const innerW = width - 0.34;
  const cushW = (innerW - 0.03) / 3;
  const cushGeo = createCushionGeometry(cushW, 0.155, depth - 0.16, 0.05, 0.026);
  for (let i = 0; i < 3; i++) {
    const cx = -innerW * 0.5 + cushW * 0.5 + i * (cushW + 0.015);
    const cush = new THREE.Mesh(cushGeo, mats.boucleOatmeal);
    cush.position.set(cx, 0.28, 0.03);
    cush.castShadow = true;
    cush.receiveShadow = true;
    g.add(cush);
  }

  // Sculpted Armrests (left & right)
  const armGeo = createBevelledSlabGeometry(0.16, 0.42, depth - 0.02, 0.055, 0.022);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, mats.boucleOatmeal);
    arm.position.set(side * (width * 0.5 - 0.085), 0.24, 0);
    arm.castShadow = true;
    arm.receiveShadow = true;
    g.add(arm);
  }

  // Upholstered Backrest Frame + 3 Angled Back Cushions
  const backFrame = new THREE.Mesh(
    createBevelledSlabGeometry(width - 0.06, 0.48, 0.16, 0.045, 0.018),
    mats.boucleOatmeal,
  );
  backFrame.position.set(0, 0.28, -depth * 0.5 + 0.09);
  backFrame.castShadow = true;
  g.add(backFrame);

  const backCushGeo = createCushionGeometry(cushW - 0.01, 0.37, 0.16, 0.06, 0.026);
  for (let i = 0; i < 3; i++) {
    const cx = -innerW * 0.5 + cushW * 0.5 + i * (cushW + 0.015);
    const bc = new THREE.Mesh(backCushGeo, mats.boucleOatmeal);
    bc.position.set(cx, 0.42, -depth * 0.5 + 0.23);
    bc.rotation.x = -0.14;
    bc.castShadow = true;
    g.add(bc);
  }

  // 3 Accent Throw Pillows (Olive Linen, Warm Taupe, Oatmeal) positioned clear of armrests
  const pillowGeo = createCushionGeometry(0.4, 0.34, 0.12, 0.06, 0.028);
  const p1 = new THREE.Mesh(pillowGeo, mats.linenOlive);
  p1.position.set(-width * 0.29, 0.47, -depth * 0.16);
  p1.rotation.set(-0.2, 0.32, 0.06);
  p1.castShadow = true;

  const p2 = new THREE.Mesh(pillowGeo, mats.linenTaupe);
  p2.position.set(-width * 0.19, 0.46, -depth * 0.2);
  p2.rotation.set(-0.18, 0.14, -0.04);
  p2.castShadow = true;

  const p3 = new THREE.Mesh(pillowGeo, mats.linenOlive);
  p3.position.set(width * 0.28, 0.47, -depth * 0.15);
  p3.rotation.set(-0.22, -0.28, -0.06);
  p3.castShadow = true;
  g.add(p1, p2, p3);

  // Smooth Continuous Draped Throw Blanket over right seat cushion (custom rounded Extrude profile)
  const drapeShape = new THREE.Shape();
  const seatTopY = 0.448;
  const frontZ = depth * 0.5 - 0.055;
  drapeShape.moveTo(-0.18, seatTopY);
  drapeShape.lineTo(frontZ - 0.02, seatTopY);
  drapeShape.quadraticCurveTo(frontZ + 0.025, seatTopY, frontZ + 0.025, seatTopY - 0.05);
  drapeShape.lineTo(frontZ + 0.025, 0.22);
  drapeShape.lineTo(frontZ + 0.004, 0.22);
  drapeShape.lineTo(frontZ + 0.004, seatTopY - 0.045);
  drapeShape.quadraticCurveTo(frontZ + 0.004, seatTopY - 0.018, frontZ - 0.02, seatTopY - 0.018);
  drapeShape.lineTo(-0.18, seatTopY - 0.018);
  drapeShape.closePath();

  const throwGeo = new THREE.ExtrudeGeometry(drapeShape, {
    depth: 0.46,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  throwGeo.rotateY(Math.PI / 2);
  throwGeo.translate(-0.23, 0, 0);
  const throwMesh = new THREE.Mesh(throwGeo, mats.linenTaupe);
  throwMesh.position.set(width * 0.24, 0, 0);
  throwMesh.castShadow = true;
  g.add(throwMesh);

  addContactShadow(g, width, depth, mats, 0.005);
  return g;
}

function buildWovenRug(
  mats: MaterialLibrary,
  width: number,
  depth: number,
): THREE.Group {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(
    createBevelledSlabGeometry(width, 0.012, depth, 0.015, 0.004),
    mats.dhurrieRug,
  );
  slab.position.y = 0.002;
  slab.receiveShadow = true;
  g.add(slab);
  return g;
}

function buildCoffeeTable(
  mats: MaterialLibrary,
  width: number,
  depth: number,
): THREE.Group {
  const g = new THREE.Group();
  // Twin sculptural travertine monolith pedestals
  const pedGeo = createBevelledSlabGeometry(0.28, 0.33, depth * 0.62, 0.025, 0.006);
  const p1 = new THREE.Mesh(pedGeo, mats.travertine);
  p1.position.set(-width * 0.26, 0, 0);
  p1.castShadow = true;
  p1.receiveShadow = true;
  const p2 = p1.clone();
  p2.position.x = width * 0.26;
  g.add(p1, p2);

  // 40mm bevelled travertine tabletop
  const top = new THREE.Mesh(
    createBevelledSlabGeometry(width, 0.044, depth, 0.04, 0.01),
    mats.travertine,
  );
  top.position.y = 0.33;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // Coasters, architectural book, and small ceramic vessel
  const coasterGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.008, 18);
  const c1 = new THREE.Mesh(coasterGeo, mats.walnutH);
  c1.position.set(-0.28, 0.378, 0.14);
  const c2 = c1.clone();
  c2.position.set(-0.15, 0.378, 0.18);

  const book = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.028, 0.31),
    mats.linenOlive,
  );
  book.position.set(0.16, 0.388, 0.04);
  book.rotation.y = 0.12;
  book.castShadow = true;

  const bookTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.022, 0.27),
    mats.linenTaupe,
  );
  bookTop.position.set(0.16, 0.413, 0.04);
  bookTop.rotation.y = 0.04;
  bookTop.castShadow = true;
  g.add(bookTop);

  const vasePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.045, 0),
    new THREE.Vector2(0.068, 0.065),
    new THREE.Vector2(0.036, 0.135),
    new THREE.Vector2(0.042, 0.155),
    new THREE.Vector2(0.032, 0.155),
  ];
  const vase = new THREE.Mesh(new THREE.LatheGeometry(vasePts, 20), mats.terracottaPot);
  vase.position.set(0.18, 0.402, 0.02);
  vase.castShadow = true;

  g.add(c1, c2, book, vase);
  addContactShadow(g, width * 0.92, depth * 0.92, mats, 0.005);
  return g;
}

function buildMediaWall(mats: MaterialLibrary, width: number): THREE.Group {
  const g = new THREE.Group();

  // Honed travertine wall panel + subtle fluted teak wing
  const stonePanel = new THREE.Mesh(
    createBevelledSlabGeometry(width * 0.72, 2.25, 0.035, 0.01, 0.005),
    mats.travertine,
  );
  stonePanel.position.set(-width * 0.12, 0.18, -0.02);
  stonePanel.receiveShadow = true;
  g.add(stonePanel);

  // Restrained vertical fluted teak slats on right wing
  const slatGeo = new THREE.BoxGeometry(0.028, 2.25, 0.032);
  const slatCount = 10;
  for (let i = 0; i < slatCount; i++) {
    const slat = new THREE.Mesh(slatGeo, mats.walnutV);
    slat.position.set(width * 0.25 + i * 0.048, 1.305, -0.02);
    slat.castShadow = true;
    g.add(slat);
  }

  // Floating Walnut Console with 3 separate drawer/flap fronts & brass pulls
  const consoleCarcass = new THREE.Mesh(
    createBevelledSlabGeometry(width, 0.36, 0.42, 0.012, 0.004),
    mats.walnutH,
  );
  consoleCarcass.position.set(0, 0.24, 0.21);
  consoleCarcass.castShadow = true;
  consoleCarcass.receiveShadow = true;
  g.add(consoleCarcass);

  const doorW = (width - 0.04) / 3;
  for (let i = 0; i < 3; i++) {
    const dx = -width * 0.5 + doorW * 0.5 + 0.02 + i * doorW;
    const front = new THREE.Mesh(
      createBevelledSlabGeometry(doorW - 0.01, 0.32, 0.022, 0.006, 0.002),
      mats.oakH,
    );
    front.position.set(dx, 0.26, 0.425);
    const pull = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.012, 0.016),
      mats.champagneBrass,
    );
    pull.position.set(dx, 0.54, 0.44);
    g.add(front, pull);
  }

  // Ultra-slim matte OLED Television + recessed cable channel
  const tvBezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.84, 0.026),
    mats.darkBronze,
  );
  tvBezel.position.set(-0.18, 1.24, 0.035);
  tvBezel.castShadow = true;
  const tvScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.44, 0.8),
    mats.oledScreen,
  );
  tvScreen.position.set(-0.18, 1.24, 0.05);
  g.add(tvBezel, tvScreen);

  // Floating timber shelf + sculptural ceramics
  const shelf = new THREE.Mesh(
    createBevelledSlabGeometry(0.75, 0.032, 0.22, 0.008, 0.003),
    mats.walnutH,
  );
  shelf.position.set(width * 0.3, 1.62, 0.11);
  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.18, 16),
    mats.ceramicWhite,
  );
  vase.position.set(width * 0.3 - 0.14, 1.74, 0.11);
  const frameArt = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.4, 0.02),
    mats.oakV,
  );
  frameArt.position.set(-width * 0.36, 0.8, 0.14);
  frameArt.rotation.x = -0.1;
  const artFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.36),
    mats.artLiving,
  );
  artFace.position.set(-width * 0.36, 0.8, 0.152);
  artFace.rotation.x = -0.1;
  g.add(shelf, vase, frameArt, artFace);

  addContactShadow(g, width, 0.45, mats, 0.005);
  return g;
}

function buildLoungeChair(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const legGeo = new THREE.CylinderGeometry(0.018, 0.014, 0.38, 10);
  for (const lx of [-0.3, 0.3]) {
    for (const lz of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(legGeo, mats.walnutV);
      leg.position.set(lx, 0.19, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  const seat = new THREE.Mesh(
    createCushionGeometry(0.66, 0.13, 0.64, 0.05, 0.022),
    mats.linenTaupe,
  );
  seat.position.y = 0.32;
  seat.castShadow = true;
  const back = new THREE.Mesh(
    createCushionGeometry(0.64, 0.42, 0.13, 0.05, 0.022),
    mats.linenTaupe,
  );
  back.position.set(0, 0.56, -0.26);
  back.rotation.x = -0.2;
  back.castShadow = true;
  g.add(seat, back);
  addContactShadow(g, 0.72, 0.72, mats, 0.005);
  return g;
}

function buildBrassSideTable(
  mats: MaterialLibrary,
  matOverride?: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.19, 0.44, 24),
    matOverride ?? mats.champagneBrass,
  );
  base.position.y = 0.22;
  base.castShadow = true;
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.025, 24),
    mats.travertine,
  );
  top.position.y = 0.45;
  top.castShadow = true;
  g.add(base, top);
  addContactShadow(g, 0.46, 0.46, mats, 0.005);
  return g;
}

function buildFloorLamp(
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): {
  group: THREE.Group;
  shadeMesh: THREE.Mesh;
  pointLight?: THREE.PointLight;
} {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.15, 0.03, 20),
    mats.travertine,
  );
  base.position.y = 0.015;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 1.48, 12),
    mats.darkBronze,
  );
  stem.position.y = 0.76;
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xf7f0e3,
    emissive: new THREE.Color(0xffc978),
    emissiveIntensity: 0.1,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const shadeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.2, 0.24, 24, 1, false),
    shadeMat,
  );
  shadeMesh.position.y = 1.54;
  shadeMesh.castShadow = true;
  g.add(base, stem, shadeMesh);

  let pointLight: THREE.PointLight | undefined;
  if (!isSoftwareGl) {
    pointLight = new THREE.PointLight(0xffcb80, 0, 4.5, 2);
    pointLight.position.y = 1.48;
    g.add(pointLight);
  }
  addContactShadow(g, 0.34, 0.34, mats, 0.005);
  return { group: g, shadeMesh, pointLight };
}

function buildDiningSuite(
  mats: MaterialLibrary,
  seats: number,
  compact = false,
): { group: THREE.Group; pendantDiffuser: THREE.Mesh } {
  const g = new THREE.Group();
  const tw = compact ? 1.25 : seats >= 6 ? 1.95 : 1.72;
  const td = compact ? 0.85 : 0.96;

  // Sculptural Twin Walnut Trestle Legs
  for (const lx of [-tw * 0.32, tw * 0.32]) {
    const leg = new THREE.Mesh(
      createBevelledSlabGeometry(0.09, 0.72, td * 0.72, 0.015, 0.004),
      mats.walnutV,
    );
    leg.position.set(lx, 0, 0);
    leg.castShadow = true;
    leg.receiveShadow = true;
    g.add(leg);
  }
  const stretcher = new THREE.Mesh(
    new THREE.BoxGeometry(tw * 0.68, 0.055, 0.06),
    mats.walnutH,
  );
  stretcher.position.y = 0.26;
  g.add(stretcher);

  // 38mm Chamfered Walnut Tabletop
  const top = new THREE.Mesh(
    createBevelledSlabGeometry(tw, 0.038, td, 0.03, 0.008),
    mats.walnutH,
  );
  top.position.y = 0.72;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // Tableware: Linen Runner + Ceramic Centerpiece + Minimal Plates
  const runner = new THREE.Mesh(
    new THREE.BoxGeometry(tw * 0.78, 0.005, 0.26),
    mats.linenOlive,
  );
  runner.position.y = 0.761;
  const centerpiece = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.07, 0.09, 20),
    mats.travertine,
  );
  centerpiece.position.y = 0.805;
  g.add(runner, centerpiece);

  const chairCountSide = seats >= 6 ? 3 : 2;
  const span = tw * 0.68;
  for (let i = 0; i < chairCountSide; i++) {
    const cx = -span * 0.5 + (i / (chairCountSide - 1)) * span;
    for (const side of [-1, 1]) {
      const chair = buildDiningChair(mats);
      chair.position.set(cx, 0, side * (td * 0.5 + 0.26));
      chair.rotation.y = side > 0 ? Math.PI : 0;
      g.add(chair);

      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.1, 0.012, 20),
        mats.ceramicWhite,
      );
      plate.position.set(cx, 0.765, side * (td * 0.3));
      g.add(plate);
    }
  }

  // Suspended Champagne Brass & Opal Glass Pendant Light
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.03, 16),
    mats.darkBronze,
  );
  canopy.position.y = ARCH.CEILING_CLEAR_HEIGHT - 0.015;
  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 1.05, 8),
    mats.matteBlackMetal,
  );
  cable.position.y = ARCH.CEILING_CLEAR_HEIGHT - 0.54;
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 0.14, 28, 1, true),
    mats.champagneBrass,
  );
  shade.position.y = 1.72;
  const diffuserMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e0,
    emissive: new THREE.Color(0xffca7a),
    emissiveIntensity: 0.12,
    roughness: 0.28,
  });
  const pendantDiffuser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.03, 28),
    diffuserMat,
  );
  pendantDiffuser.position.y = 1.66;
  g.add(canopy, cable, shade, pendantDiffuser);

  addContactShadow(g, tw + 0.3, td + 0.5, mats, 0.005);
  return { group: g, pendantDiffuser };
}

function buildDiningChair(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const legGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.44, 8);
  for (const lx of [-0.19, 0.19]) {
    for (const lz of [-0.19, 0.19]) {
      const leg = new THREE.Mesh(legGeo, mats.walnutV);
      leg.position.set(lx, 0.22, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  const seat = new THREE.Mesh(
    createCushionGeometry(0.44, 0.065, 0.44, 0.04, 0.012),
    mats.linenTaupe,
  );
  seat.position.y = 0.43;
  seat.castShadow = true;
  const postL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.38, 8),
    mats.walnutV,
  );
  postL.position.set(-0.18, 0.62, -0.19);
  const postR = postL.clone();
  postR.position.x = 0.18;
  const backRail = new THREE.Mesh(
    createBevelledSlabGeometry(0.44, 0.16, 0.04, 0.02, 0.006),
    mats.walnutH,
  );
  backRail.position.set(0, 0.68, -0.19);
  backRail.castShadow = true;
  const backPad = new THREE.Mesh(
    createCushionGeometry(0.38, 0.13, 0.032, 0.02, 0.008),
    mats.boucleOatmeal,
  );
  backPad.position.set(0, 0.695, -0.165);
  g.add(seat, postL, postR, backRail, backPad);
  return g;
}

function buildFittedKitchen(
  kitchen: RoomSpec,
  layoutVariant: ApartmentSpec['layoutVariant'],
  y: number,
  mats: MaterialLibrary,
) {
  const g = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const drawers: InteractiveDrawerHandle[] = [];
  const hingedParts: InteractiveHingedHandle[] = [];
  const underCabinetEmissives: THREE.Mesh[] = [];
  const clickTargets: BuiltFurnitureResult['clickTargets'] = [];

  const isMirroredEast =
    layoutVariant === '1bhk-east' || layoutVariant === '3bhk-east';
  const runW =
    layoutVariant === '1bhk-center'
      ? 2.45
      : layoutVariant === '2bhk-east'
        ? 2.48
        : layoutVariant === '1bhk-west' || layoutVariant === '1bhk-east'
          ? 2.85
          : 3.45;
  const kGroup = new THREE.Group();

  if (layoutVariant === '2bhk-east') {
    // Positioned East of utility-door (X: 6.54..7.38) so utility balcony access stays 100% unobstructed
    kGroup.position.set(8.68, y, -2.98);
    colliders.push({
      id: 'kitchen-counter',
      xMin: 7.42,
      xMax: 9.94,
      zMin: -3.1,
      zMax: -2.3,
    });
  } else if (layoutVariant === '3bhk-west' || layoutVariant === '3bhk-east') {
    const kx = isMirroredEast ? 15.6 : -15.6;
    kGroup.position.set(kx, y, -4.38);
    colliders.push({
      id: 'kitchen-counter',
      xMin: kx - 1.75,
      xMax: kx + 1.75,
      zMin: -4.5,
      zMax: -3.65,
    });
  } else if (layoutVariant === '1bhk-west' || layoutVariant === '1bhk-east') {
    const kx = isMirroredEast ? 8.0 : -8.0;
    kGroup.position.set(kx, y, -3.28);
    colliders.push({
      id: 'kitchen-counter',
      xMin: kx - 1.44,
      xMax: kx + 1.44,
      zMin: -3.38,
      zMax: -2.55,
    });
  } else {
    // 1bhk-center against West wall X = -4.08
    kGroup.position.set(-4.08, y, 1.9);
    kGroup.rotation.y = Math.PI / 2;
    colliders.push({
      id: 'kitchen-counter',
      xMin: -4.2,
      xMax: -3.35,
      zMin: 0.65,
      zMax: 3.15,
    });
  }

  // 1. Toe-kick Recessed Plinth (100mm height)
  const toeKick = new THREE.Mesh(
    new THREE.BoxGeometry(runW - 0.04, 0.1, 0.52),
    mats.darkBronze,
  );
  toeKick.position.set(0, 0.05, 0.28);
  kGroup.add(toeKick);

  // 2. Base Cabinets (4 bays across counterW) + Interactive Cutlery Drawer + Under-Sink Door
  const bays = 4;
  const bayW = (runW - 0.72) / bays;
  const fridgeX = -runW * 0.5 + 0.36;

  // Integrated Double-Door French Refrigerator (left end, vertical split doors + dispenser)
  const fridgeBody = new THREE.Mesh(
    createBevelledSlabGeometry(0.68, 2.15, 0.62, 0.012, 0.004),
    mats.stainlessSteel,
  );
  fridgeBody.position.set(fridgeX, 0.1, 0.31);
  fridgeBody.castShadow = true;
  fridgeBody.receiveShadow = true;
  kGroup.add(fridgeBody);
  // Bottom pull-out freezer drawer
  const freezerFront = new THREE.Mesh(
    createBevelledSlabGeometry(0.66, 0.58, 0.025, 0.006, 0.002),
    mats.stainlessSteel,
  );
  freezerFront.position.set(fridgeX, 0.12, 0.622);
  const freezerHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.018, 0.024),
    mats.darkBronze,
  );
  freezerHandle.position.set(fridgeX, 0.64, 0.645);
  kGroup.add(freezerFront, freezerHandle);
  // Twin upper French doors
  for (const side of [-1, 1]) {
    const fDoor = new THREE.Mesh(
      createBevelledSlabGeometry(0.324, 1.5, 0.025, 0.006, 0.002),
      mats.stainlessSteel,
    );
    fDoor.position.set(fridgeX + side * 0.166, 0.73, 0.622);
    const fHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.52, 0.024),
      mats.darkBronze,
    );
    fHandle.position.set(fridgeX + side * 0.04, 1.48, 0.645);
    kGroup.add(fDoor, fHandle);
  }
  const dispenserRecess = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.22, 0.016),
    mats.matteBlackMetal,
  );
  dispenserRecess.position.set(fridgeX - 0.166, 1.34, 0.638);
  kGroup.add(dispenserRecess);

  const counterStartX = -runW * 0.5 + 0.72;
  const counterW = runW - 0.72;
  const counterCenterX = counterStartX + counterW * 0.5;

  // Base carcass split cleanly around the sink bay (b = 1) so the undermount steel basin is hollow!
  const carcassLeft = new THREE.Mesh(
    new THREE.BoxGeometry(bayW - 0.02, 0.77, 0.56),
    mats.oakH,
  );
  carcassLeft.position.set(counterStartX + bayW * 0.5, 0.485, 0.28);
  carcassLeft.receiveShadow = true;

  const sinkBayLowFloor = new THREE.Mesh(
    new THREE.BoxGeometry(bayW - 0.02, 0.08, 0.56),
    mats.oakH,
  );
  sinkBayLowFloor.position.set(counterStartX + bayW * 1.5, 0.14, 0.28);
  sinkBayLowFloor.receiveShadow = true;

  const rightBayCount = Math.max(1, bays - 2);
  const rightCarcassW = bayW * rightBayCount - 0.02;
  const carcassRight = new THREE.Mesh(
    new THREE.BoxGeometry(rightCarcassW, 0.77, 0.56),
    mats.oakH,
  );
  carcassRight.position.set(
    counterStartX + bayW * 2 + rightCarcassW * 0.5,
    0.485,
    0.28,
  );
  carcassRight.receiveShadow = true;
  kGroup.add(carcassLeft, sinkBayLowFloor, carcassRight);

  for (let b = 0; b < bays; b++) {
    const bx = counterStartX + bayW * 0.5 + b * bayW;
    if (b === 0) {
      // Bay 0: Interactive Cutlery Drawer (top) + Lower Pan Drawer
      const panDoor = new THREE.Mesh(
        createBevelledSlabGeometry(bayW - 0.008, 0.54, 0.024, 0.006, 0.002),
        mats.oakH,
      );
      panDoor.position.set(bx, 0.1, 0.585);
      kGroup.add(panDoor);

      const drawerGroup = new THREE.Group();
      drawerGroup.position.set(bx, 0.66, 0.585);
      const dFront = new THREE.Mesh(
        createBevelledSlabGeometry(bayW - 0.008, 0.2, 0.024, 0.006, 0.002),
        mats.oakH,
      );
      const dPull = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.012, 0.018),
        mats.darkBronze,
      );
      dPull.position.set(0, 0.16, 0.02);
      // Oak Drawer Box & Cutlery Compartments revealed when opened!
      const dTray = new THREE.Mesh(
        new THREE.BoxGeometry(bayW - 0.06, 0.05, 0.42),
        mats.walnutH,
      );
      dTray.position.set(0, 0.04, -0.22);
      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.04, 0.4),
        mats.oakV,
      );
      divider.position.set(-0.1, 0.07, -0.22);
      const divider2 = divider.clone();
      divider2.position.x = 0.1;
      // Brushed steel cutlery pieces inside tray
      const spoon = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.008, 0.2),
        mats.stainlessSteel,
      );
      spoon.position.set(-0.16, 0.075, -0.22);
      const knife = spoon.clone();
      knife.position.x = 0.0;
      const fork = spoon.clone();
      fork.position.x = 0.16;

      drawerGroup.add(dFront, dPull, dTray, divider, divider2, spoon, knife, fork);
      kGroup.add(drawerGroup);

      drawers.push({
        id: 'kitchen-drawer',
        label: 'Cutlery Drawer',
        mesh: drawerGroup,
        closedPos: drawerGroup.position.clone(),
        slideOffset: new THREE.Vector3(0, 0, 0.34),
      });
      clickTargets.push({
        mesh: drawerGroup,
        actionType: 'drawer',
        actionId: 'kitchen-drawer',
        label: 'Open/Close Cutlery Drawer',
      });
    } else if (b === 1) {
      // Bay 1: Under-sink Interactive Hinged Cabinet Door
      const sinkVoid = new THREE.Mesh(
        new THREE.BoxGeometry(bayW - 0.06, 0.72, 0.48),
        mats.matteBlackMetal,
      );
      sinkVoid.position.set(bx, 0.48, 0.3);
      const shelfInside = new THREE.Mesh(
        new THREE.BoxGeometry(bayW - 0.08, 0.024, 0.4),
        mats.oakH,
      );
      shelfInside.position.set(bx, 0.42, 0.32);
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.16, 12),
        mats.linenOlive,
      );
      bottle.position.set(bx - 0.12, 0.51, 0.36);
      kGroup.add(sinkVoid, shelfInside, bottle);

      const hingePivot = new THREE.Group();
      hingePivot.position.set(bx - bayW * 0.5 + 0.005, 0.1, 0.585);
      const sDoor = new THREE.Mesh(
        createBevelledSlabGeometry(bayW - 0.01, 0.75, 0.024, 0.006, 0.002),
        mats.oakH,
      );
      sDoor.position.set(bayW * 0.5 - 0.005, 0, 0);
      const sPull = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.12, 0.018),
        mats.darkBronze,
      );
      sPull.position.set(bayW - 0.06, 0.62, 0.02);
      hingePivot.add(sDoor, sPull);
      kGroup.add(hingePivot);

      hingedParts.push({
        id: 'sink-cabinet',
        label: 'Under-Sink Cabinet',
        pivot: hingePivot,
        openAngle: -1.38,
      });
      clickTargets.push({
        mesh: sDoor,
        actionType: 'hinged',
        actionId: 'sink-cabinet',
        label: 'Open/Close Under-Sink Cabinet',
      });
    } else {
      // Standard Base Doors
      const bDoor = new THREE.Mesh(
        createBevelledSlabGeometry(bayW - 0.008, 0.75, 0.024, 0.006, 0.002),
        mats.oakH,
      );
      bDoor.position.set(bx, 0.1, 0.585);
      const bPull = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.012, 0.018),
        mats.darkBronze,
      );
      bPull.position.set(bx, 0.78, 0.605);
      kGroup.add(bDoor, bPull);
    }
  }

  // 3. Cream Quartzite Countertop (30mm thick framed AROUND an inset undermount sink cutout!) + Backsplash
  const isCompactKitchen = counterW < 1.9;
  const sinkX = counterStartX + bayW * 1.5;
  const sinkCutW = isCompactKitchen ? 0.44 : 0.54;
  const sinkCutD = 0.40;
  const sinkZ = 0.33;
  const counterLeftEdge = counterStartX;
  const counterRightEdge = counterStartX + counterW;
  const leftSpan = (sinkX - sinkCutW * 0.5) - counterLeftEdge;
  const rightSpan = counterRightEdge - (sinkX + sinkCutW * 0.5);

  if (leftSpan > 0.02) {
    const cLeft = new THREE.Mesh(
      createBevelledSlabGeometry(leftSpan, 0.032, 0.62, 0.006, 0.003),
      mats.quartziteCounter,
    );
    cLeft.position.set(counterLeftEdge + leftSpan * 0.5, 0.87, 0.31);
    cLeft.castShadow = true;
    cLeft.receiveShadow = true;
    kGroup.add(cLeft);
  }
  if (rightSpan > 0.02) {
    const cRight = new THREE.Mesh(
      createBevelledSlabGeometry(rightSpan, 0.032, 0.62, 0.006, 0.003),
      mats.quartziteCounter,
    );
    cRight.position.set(sinkX + sinkCutW * 0.5 + rightSpan * 0.5, 0.87, 0.31);
    cRight.castShadow = true;
    cRight.receiveShadow = true;
    kGroup.add(cRight);
  }
  // Narrow back tap-deck & front apron rails completing the cutout perimeter flush at Y = 0.87..0.902
  const backDeckD = (sinkZ - sinkCutD * 0.5);
  if (backDeckD > 0.02) {
    const cBack = new THREE.Mesh(
      new THREE.BoxGeometry(sinkCutW + 0.01, 0.032, backDeckD),
      mats.quartziteCounter,
    );
    cBack.position.set(sinkX, 0.886, backDeckD * 0.5);
    cBack.receiveShadow = true;
    kGroup.add(cBack);
  }
  const frontApronD = 0.62 - (sinkZ + sinkCutD * 0.5);
  if (frontApronD > 0.02) {
    const cFront = new THREE.Mesh(
      new THREE.BoxGeometry(sinkCutW + 0.01, 0.032, frontApronD),
      mats.quartziteCounter,
    );
    cFront.position.set(sinkX, 0.886, 0.62 - frontApronD * 0.5);
    cFront.receiveShadow = true;
    kGroup.add(cFront);
  }

  const backsplash = new THREE.Mesh(
    new THREE.BoxGeometry(counterW, 0.56, 0.02),
    mats.travertine,
  );
  backsplash.position.set(counterCenterX, 1.18, 0.01);
  backsplash.receiveShadow = true;
  kGroup.add(backsplash);

  // 4. Open Inset Undermount Stainless Sink Basin (floor + 4 walls, dark rim & recessed drain)
  const basinH = 0.18;
  const basinFloor = new THREE.Mesh(
    new THREE.BoxGeometry(sinkCutW, 0.014, sinkCutD),
    mats.sinkBasinSteel,
  );
  basinFloor.position.set(sinkX, 0.87 - basinH + 0.007, sinkZ);
  basinFloor.receiveShadow = true;
  const basinWallN = new THREE.Mesh(
    new THREE.BoxGeometry(sinkCutW, basinH, 0.014),
    mats.sinkBasinSteel,
  );
  basinWallN.position.set(sinkX, 0.87 - basinH * 0.5, sinkZ - sinkCutD * 0.5 + 0.007);
  const basinWallS = basinWallN.clone();
  basinWallS.position.z = sinkZ + sinkCutD * 0.5 - 0.007;
  const basinWallW = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, basinH, sinkCutD - 0.028),
    mats.sinkBasinSteel,
  );
  basinWallW.position.set(sinkX - sinkCutW * 0.5 + 0.007, 0.87 - basinH * 0.5, sinkZ);
  const basinWallE = basinWallW.clone();
  basinWallE.position.x = sinkX + sinkCutW * 0.5 - 0.007;
  const sinkDrain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.01, 16),
    mats.darkBronze,
  );
  sinkDrain.position.set(sinkX, 0.87 - basinH + 0.017, sinkZ);
  kGroup.add(basinFloor, basinWallN, basinWallS, basinWallW, basinWallE, sinkDrain);

  const faucetBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.028, 0.14, 16),
    mats.champagneBrass,
  );
  faucetBase.position.set(sinkX, 0.97, 0.1);
  const faucetNeck = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.012, 10, 20, Math.PI),
    mats.champagneBrass,
  );
  faucetNeck.rotation.y = Math.PI / 2;
  faucetNeck.position.set(sinkX, 1.04, 0.19);
  const faucetLever = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.06, 0.016),
    mats.champagneBrass,
  );
  faucetLever.position.set(sinkX + 0.045, 0.98, 0.1);
  kGroup.add(sinkDrain, faucetBase, faucetNeck, faucetLever);

  // 5. Induction Hob (above Bay 2) + Extractor Hood + Lived-in Details
  const hobX = counterStartX + bayW * 2.5;
  const hobW = isCompactKitchen ? 0.46 : 0.58;
  const hob = new THREE.Mesh(
    createBevelledSlabGeometry(hobW, 0.012, 0.48, 0.01, 0.002),
    mats.inductionGlass,
  );
  hob.position.set(hobX, 0.903, 0.31);
  kGroup.add(hob);
  for (const [rx, rz] of [
    [-0.14, -0.1],
    [0.14, -0.1],
    [-0.14, 0.1],
    [0.14, 0.1],
  ]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.065, 0.072, 24),
      mats.champagneBrass,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hobX + rx, 0.916, 0.31 + rz);
    kGroup.add(ring);
  }

  // Upper Wall Cabinets + Interactive Opening Upper Door + Under-Cabinet LED Strip
  const upperY = 1.48;
  for (let b = 0; b < bays; b++) {
    const bx = counterStartX + bayW * 0.5 + b * bayW;
    if (b === 3) {
      // Open recessed cavity for Bay 3 so plates & glasses are visible when opened
      const cBot = new THREE.Mesh(
        new THREE.BoxGeometry(bayW - 0.02, 0.022, 0.34),
        mats.darkBronze,
      );
      cBot.position.set(bx, upperY + 0.011, 0.18);
      const cTop = cBot.clone();
      cTop.position.y = upperY + 0.77;
      const cLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.78, 0.34),
        mats.darkBronze,
      );
      cLeft.position.set(bx - bayW * 0.5 + 0.011, upperY + 0.39, 0.18);
      const cRight = cLeft.clone();
      cRight.position.x = bx + bayW * 0.5 - 0.011;
      kGroup.add(cBot, cTop, cLeft, cRight);
    } else {
      const bayBox = new THREE.Mesh(
        new THREE.BoxGeometry(bayW - 0.02, 0.78, 0.34),
        mats.darkBronze,
      );
      bayBox.position.set(bx, upperY + 0.39, 0.18);
      kGroup.add(bayBox);
    }
  }

  // Under-cabinet linear LED diffuser channel + Architectural Extractor Chimney Hood over Hob
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d8,
    emissive: new THREE.Color(0xffc97a),
    emissiveIntensity: 0.28,
    roughness: 0.3,
  });
  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(counterW - 0.16, 0.014, 0.024),
    ledMat,
  );
  ledStrip.position.set(counterCenterX, upperY - 0.008, 0.24);
  const hoodTrim = new THREE.Mesh(
    new THREE.BoxGeometry(bayW - 0.02, 0.045, 0.44),
    mats.darkBronze,
  );
  hoodTrim.position.set(hobX, upperY - 0.015, 0.24);
  const chimneyStack = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.6, 0.22),
    mats.darkBronze,
  );
  chimneyStack.position.set(hobX, upperY + 0.98, 0.14);
  kGroup.add(ledStrip, hoodTrim, chimneyStack);
  underCabinetEmissives.push(ledStrip);

  // Compact Countertop Microwave Oven tucked neatly on far-right Bay 3 counter
  const microX = counterStartX + bayW * 0.48;
  const microBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.26, 0.34),
    mats.darkBronze,
  );
  microBody.position.set(microX, 1.035, 0.21);
  microBody.castShadow = true;
  const microGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.2, 0.018),
    mats.inductionGlass,
  );
  microGlass.position.set(microX - 0.04, 1.035, 0.382);
  const microHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.16, 0.02),
    mats.champagneBrass,
  );
  microHandle.position.set(microX + 0.16, 1.035, 0.388);
  kGroup.add(microBody, microGlass, microHandle);

  // Upper doors in warm satin greige lacquer with recessed dark reveals & bronze edge pulls
  for (let b = 0; b < bays; b++) {
    const bx = counterStartX + bayW * 0.5 + b * bayW;
    if (b === 3) {
      // Bay 3: Opening Upper Cabinet revealing ceramic plates & glasses
      const uBack = new THREE.Mesh(
        new THREE.BoxGeometry(bayW - 0.04, 0.74, 0.02),
        mats.oakH,
      );
      uBack.position.set(bx, upperY + 0.39, 0.025);
      const uShelf = new THREE.Mesh(
        new THREE.BoxGeometry(bayW - 0.04, 0.02, 0.3),
        mats.oakH,
      );
      uShelf.position.set(bx, upperY + 0.36, 0.19);
      const plateStack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.06, 18),
        mats.ceramicWhite,
      );
      plateStack.position.set(bx - 0.1, upperY + 0.055, 0.22);
      const glass1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.032, 0.11, 14),
        mats.windowGlass,
      );
      glass1.position.set(bx + 0.08, upperY + 0.43, 0.22);
      const glass2 = glass1.clone();
      glass2.position.x = bx + 0.18;
      kGroup.add(uBack, uShelf, plateStack, glass1, glass2);

      const uPivot = new THREE.Group();
      uPivot.position.set(bx + bayW * 0.5 - 0.008, upperY, 0.365);
      const uDoor = new THREE.Mesh(
        createBevelledSlabGeometry(bayW - 0.016, 0.76, 0.022, 0.006, 0.002),
        mats.cabinetGreige,
      );
      uDoor.position.set(-bayW * 0.5 + 0.008, 0, 0);
      const uPull = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.012, 0.016),
        mats.darkBronze,
      );
      uPull.position.set(-bayW * 0.5 + 0.008, 0.035, 0.018);
      uPivot.add(uDoor, uPull);
      kGroup.add(uPivot);

      hingedParts.push({
        id: 'upper-cabinet',
        label: 'Upper Wall Cabinet',
        pivot: uPivot,
        openAngle: 1.38,
      });
      clickTargets.push({
        mesh: uDoor,
        actionType: 'hinged',
        actionId: 'upper-cabinet',
        label: 'Open/Close Wall Cabinet',
      });
    } else {
      const uDoor = new THREE.Mesh(
        createBevelledSlabGeometry(bayW - 0.014, 0.76, 0.022, 0.006, 0.002),
        mats.cabinetGreige,
      );
      uDoor.position.set(bx, upperY, 0.365);
      const uPull = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.012, 0.016),
        mats.darkBronze,
      );
      uPull.position.set(bx, upperY + 0.035, 0.382);
      kGroup.add(uDoor, uPull);
    }
  }

  // Lived-in Worktop Props: Chopping Board, Gooseneck Kettle, Spice Canister, Folded Towel, Herb Planter
  const board = new THREE.Mesh(
    createBevelledSlabGeometry(0.32, 0.022, 0.22, 0.015, 0.004),
    mats.walnutH,
  );
  board.position.set(counterStartX + bayW * 0.48, 0.903, 0.44);

  const kettleGroup = new THREE.Group();
  kettleGroup.position.set(counterStartX + bayW * 3.16, 0.903, 0.42);
  const kettleBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.084, 0.016, 20),
    mats.darkBronze,
  );
  kettleBase.position.y = 0.008;
  const kettleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.078, 0.15, 22),
    mats.matteBlackMetal,
  );
  kettleBody.position.y = 0.09;
  kettleBody.castShadow = true;
  const kettleLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.058, 0.012, 20),
    mats.champagneBrass,
  );
  kettleLid.position.y = 0.17;
  const kettleKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.018, 12),
    mats.walnutH,
  );
  kettleKnob.position.y = 0.184;
  const kettleHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.095, 0.052),
    mats.walnutH,
  );
  kettleHandle.position.set(0.08, 0.105, 0);
  const kettleSpout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.105, 10),
    mats.matteBlackMetal,
  );
  kettleSpout.position.set(-0.08, 0.11, 0);
  kettleSpout.rotation.z = 0.42;
  kettleGroup.add(kettleBase, kettleBody, kettleLid, kettleKnob, kettleHandle, kettleSpout);

  const canister = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.11, 16),
    mats.ceramicWhite,
  );
  canister.position.set(counterStartX + bayW * 3.55, 0.962, 0.14);
  const canisterLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.014, 16),
    mats.oakH,
  );
  canisterLid.position.set(counterStartX + bayW * 3.55, 1.022, 0.14);

  // Herb planter placed cleanly to the left of the RO unit on Bay 0 front-right corner
  const herbPot = buildPlanter(mats, {
    potRadius: 0.058,
    potHeight: 0.095,
    leafCount: 8,
    scale: 0.78,
  });
  herbPot.position.set(counterStartX + bayW * 0.86, 0.903, 0.45);

  const towel = new THREE.Mesh(
    createBevelledSlabGeometry(0.16, 0.022, 0.2, 0.015, 0.005),
    mats.linenTaupe,
  );
  towel.position.set(counterStartX + bayW * 3.08, 0.903, 0.18);

  // Wall-mounted RO Water Purifier (cleanly visible above sink wall)
  const roGroup = new THREE.Group();
  roGroup.position.set(sinkX - 0.12, 1.30, 0.11);
  const roBody = new THREE.Mesh(
    createBevelledSlabGeometry(0.24, 0.34, 0.15, 0.015, 0.004),
    mats.applianceEnamel,
  );
  const roVisor = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.13, 0.014),
    mats.windowGlass,
  );
  roVisor.position.set(0, 0.04, 0.078);
  const roTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.244, 0.022, 0.154),
    mats.darkBronze,
  );
  roTrim.position.y = 0.095;
  const roTap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.045, 10),
    mats.champagneBrass,
  );
  roTap.position.set(0, -0.13, 0.08);
  roTap.rotation.x = Math.PI / 3;
  roGroup.add(roBody, roVisor, roTrim, roTap);

  // Stainless Steel Dish-Drying Rack + Plates on Bay 3 open prep counter (clear of hob)
  const rackX = counterStartX + bayW * 3.68;
  const dishRack = new THREE.Group();
  dishRack.position.set(rackX, 0.905, 0.36);
  const rackTray = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.012, 0.32),
    mats.stainlessSteel,
  );
  dishRack.add(rackTray);
  for (let p = 0; p < 4; p++) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 0.012, 18),
      mats.ceramicWhite,
    );
    plate.rotation.z = Math.PI / 2 - 0.16;
    plate.position.set(-0.068 + p * 0.044, 0.095, -0.01);
    dishRack.add(plate);
  }

  // Row of 3 Masala / Spice Canisters with champagne brass lids on Bay 3 rear deck
  for (let s = 0; s < 3; s++) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.09, 14),
      mats.ceramicWhite,
    );
    jar.position.set(counterStartX + bayW * 3.12 + s * 0.078, 0.948, 0.12);
    const jarLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14),
      mats.champagneBrass,
    );
    jarLid.position.set(counterStartX + bayW * 3.12 + s * 0.078, 0.998, 0.12);
    kGroup.add(jar, jarLid);
  }

  kGroup.add(board, kettleGroup, canister, canisterLid, herbPot, towel, roGroup, dishRack);
  g.add(kGroup);

  return {
    group: g,
    colliders,
    drawers,
    hingedParts,
    underCabinetEmissives,
    clickTargets,
  };
}

function buildPrimaryBedroom(
  bed1: RoomSpec,
  layoutVariant: ApartmentSpec['layoutVariant'],
  y: number,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
) {
  const g = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const wardrobeDoors: InteractiveHingedHandle[] = [];
  const wardrobeLightEmissives: THREE.Mesh[] = [];
  const lamps: LampLightHandle[] = [];
  const clickTargets: BuiltFurnitureResult['clickTargets'] = [];

  const isMirroredEast =
    layoutVariant === '1bhk-east' || layoutVariant === '3bhk-east';

  // Bed position & orientation per apartment variant
  const bedGroup = new THREE.Group();
  const isCompact2Bhk = layoutVariant === '2bhk-east';
  if (isCompact2Bhk) {
    // Centered on solid North wall (X: 11.01..13.53) between bedroom door & bath door
    bedGroup.position.set(12.27, y, 1.82);
    bedGroup.rotation.y = 0;
    colliders.push({
      id: 'bed1-col',
      xMin: 11.3,
      xMax: 13.24,
      zMin: 1.8,
      zMax: 4.02,
    });
  } else if (layoutVariant === '1bhk-center') {
    bedGroup.position.set(4.05, y, 5.15);
    bedGroup.rotation.y = -Math.PI / 2;
    colliders.push({
      id: 'bed1-col',
      xMin: 1.95,
      xMax: 4.1,
      zMin: 4.25,
      zMax: 6.05,
    });
  } else if (layoutVariant === '1bhk-west' || layoutVariant === '1bhk-east') {
    const bx = isMirroredEast ? 11.86 : -11.86;
    bedGroup.position.set(bx, y, 2.65);
    bedGroup.rotation.y = isMirroredEast ? -Math.PI / 2 : Math.PI / 2;
    colliders.push({
      id: 'bed1-col',
      xMin: isMirroredEast ? 9.7 : -11.9,
      xMax: isMirroredEast ? 11.9 : -9.7,
      zMin: 1.7,
      zMax: 3.6,
    });
  } else {
    // 3bhk-west / 3bhk-east Master Suite
    const bx = isMirroredEast ? 17.25 : -17.25;
    bedGroup.position.set(bx, y, 3.85);
    bedGroup.rotation.y = isMirroredEast ? -Math.PI / 2 : Math.PI / 2;
    colliders.push({
      id: 'bed1-col',
      xMin: isMirroredEast ? 15.1 : -17.3,
      xMax: isMirroredEast ? 17.3 : -15.1,
      zMin: 2.9,
      zMax: 4.8,
    });
  }

  // Sculpted Fluted Walnut Headboard Feature Panel
  const slatCountHalf = isCompact2Bhk ? 14 : 16;
  const slatGeo = new THREE.BoxGeometry(0.032, 2.2, 0.03);
  for (let i = -slatCountHalf; i <= slatCountHalf; i++) {
    const slat = new THREE.Mesh(slatGeo, mats.walnutV);
    slat.position.set(i * 0.065, 1.1, 0.02);
    slat.castShadow = true;
    bedGroup.add(slat);
  }
  const upholsteredHeadboard = new THREE.Mesh(
    createBevelledSlabGeometry(isCompact2Bhk ? 1.84 : 1.92, 0.96, 0.09, 0.04, 0.018),
    mats.boucleOatmeal,
  );
  upholsteredHeadboard.position.set(0, 0.42, 0.06);
  upholsteredHeadboard.castShadow = true;
  bedGroup.add(upholsteredHeadboard);

  // Walnut Platform Frame + Legs
  const frame = new THREE.Mesh(
    createBevelledSlabGeometry(1.88, 0.14, 2.1, 0.025, 0.008),
    mats.walnutH,
  );
  frame.position.set(0, 0.16, 1.12);
  frame.castShadow = true;
  frame.receiveShadow = true;
  bedGroup.add(frame);

  // Tailored Mattress + Duvet with soft drape + Olive Bed Runner + 4 Pillows
  const mattress = new THREE.Mesh(
    createBevelledSlabGeometry(1.78, 0.22, 2.02, 0.045, 0.016),
    mats.beddingIvory,
  );
  mattress.position.set(0, 0.28, 1.12);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  bedGroup.add(mattress);

  const duvet = new THREE.Mesh(
    createCushionGeometry(1.82, 0.12, 1.44, 0.06, 0.024),
    mats.beddingIvory,
  );
  duvet.position.set(0, 0.44, 1.42);
  duvet.castShadow = true;
  bedGroup.add(duvet);

  const runner = new THREE.Mesh(
    createBevelledSlabGeometry(1.84, 0.045, 0.56, 0.025, 0.008),
    mats.linenOlive,
  );
  runner.position.set(0, 0.53, 1.82);
  bedGroup.add(runner);

  const pGeo = createCushionGeometry(0.68, 0.16, 0.42, 0.05, 0.024);
  for (const px of [-0.44, 0.44]) {
    const pBack = new THREE.Mesh(pGeo, mats.beddingIvory);
    pBack.position.set(px, 0.58, 0.32);
    pBack.rotation.x = 0.45;
    pBack.castShadow = true;
    const pFront = new THREE.Mesh(pGeo, mats.linenTaupe);
    pFront.scale.set(0.84, 0.85, 0.78);
    pFront.position.set(px, 0.55, 0.52);
    pFront.rotation.x = 0.36;
    pFront.castShadow = true;
    bedGroup.add(pBack, pFront);
  }

  // Nightstands + Suspended Brass Pendant Reading Lights (toggleable!)
  const nsOffset = isCompact2Bhk ? 1.1 : 1.24;
  const nsWidth = isCompact2Bhk ? 0.36 : 0.46;
  for (const side of [-1, 1]) {
    const ns = new THREE.Mesh(
      createBevelledSlabGeometry(nsWidth, 0.34, 0.42, 0.015, 0.004),
      mats.walnutH,
    );
    ns.position.set(side * nsOffset, 0.16, 0.28);
    ns.castShadow = true;
    bedGroup.add(ns);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 1.65, 8),
      mats.matteBlackMetal,
    );
    cord.position.set(side * nsOffset, 1.98, 0.28);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.1, 0.15, 18),
      mats.champagneBrass,
    );
    cone.position.set(side * nsOffset, 1.12, 0.28);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff2d6,
      emissive: new THREE.Color(0xffc978),
      emissiveIntensity: 0.15,
      roughness: 0.25,
    });
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 14, 14),
      bulbMat,
    );
    bulb.position.set(side * nsOffset, 1.04, 0.28);
    bedGroup.add(cord, cone, bulb);

    let pt: THREE.PointLight | undefined;
    if (!isSoftwareGl && side === -1) {
      pt = new THREE.PointLight(0xffca7a, 0, 3.6, 2);
      pt.position.set(side * nsOffset, 0.98, 0.28);
      bedGroup.add(pt);
    }
    const lampId = side < 0 ? 'bed-lamp-l' : 'bed-lamp-r';
    lamps.push({
      id: lampId,
      roomId: 'primary-bed',
      label: side < 0 ? 'Bedside Reading Light L' : 'Bedside Reading Light R',
      emissiveMesh: bulb,
      pointLight: pt,
    });
    clickTargets.push({
      mesh: cone,
      actionType: 'lamp',
      actionId: lampId,
      label: 'Toggle Reading Light',
    });
  }

  addContactShadow(bedGroup, 2.0, 2.2, mats, 0.005);
  g.add(bedGroup);

  // ----------------------------------------------------------------------------
  // CUSTOM FITTED 3-DOOR OAK WARDROBE + INTERIOR CLOTHES + LOCKER / SAFE
  // ----------------------------------------------------------------------------
  const wGroup = new THREE.Group();
  if (layoutVariant === '2bhk-east') {
    wGroup.position.set(10.08, y, 4.18);
    wGroup.rotation.y = Math.PI / 2;
    colliders.push({
      id: 'wardrobe-col',
      xMin: 10.06,
      xMax: 10.7,
      zMin: 3.08,
      zMax: 5.28,
    });
  } else if (layoutVariant === '1bhk-center') {
    wGroup.position.set(0.32, y, 5.15);
    wGroup.rotation.y = Math.PI / 2;
    colliders.push({
      id: 'wardrobe-col',
      xMin: 0.25,
      xMax: 0.92,
      zMin: 4.1,
      zMax: 6.2,
    });
  } else if (layoutVariant === '1bhk-west' || layoutVariant === '1bhk-east') {
    const wx = isMirroredEast ? 8.32 : -8.32;
    wGroup.position.set(wx, y, 3.15);
    wGroup.rotation.y = isMirroredEast ? Math.PI / 2 : -Math.PI / 2;
    colliders.push({
      id: 'wardrobe-col',
      xMin: isMirroredEast ? 8.3 : -8.98,
      xMax: isMirroredEast ? 8.98 : -8.3,
      zMin: 2.05,
      zMax: 4.25,
    });
  } else {
    // 3bhk-west / 3bhk-east
    const wx = isMirroredEast ? 11.55 : -11.55;
    wGroup.position.set(wx, y, 3.85);
    wGroup.rotation.y = isMirroredEast ? Math.PI / 2 : -Math.PI / 2;
    colliders.push({
      id: 'wardrobe-col',
      xMin: isMirroredEast ? 11.45 : -12.15,
      xMax: isMirroredEast ? 12.15 : -11.45,
      zMin: 2.75,
      zMax: 4.95,
    });
  }

  const wWidth = 2.16;
  const wHeight = 2.38;
  const wDepth = 0.6;

  // Wardrobe Outer Carcass (Back, Left, Right, Top, Bottom, 2 internal dividers)
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(wWidth, wHeight, 0.025),
    mats.walnutV,
  );
  backPanel.position.set(0, wHeight * 0.5, 0.012);
  const topPanel = new THREE.Mesh(
    new THREE.BoxGeometry(wWidth, 0.03, wDepth),
    mats.oakH,
  );
  topPanel.position.set(0, wHeight - 0.015, wDepth * 0.5);
  const botPanel = new THREE.Mesh(
    new THREE.BoxGeometry(wWidth, 0.08, wDepth),
    mats.oakH,
  );
  botPanel.position.set(0, 0.04, wDepth * 0.5);
  wGroup.add(backPanel, topPanel, botPanel);

  for (const vx of [-wWidth * 0.5 + 0.015, -wWidth / 6, wWidth / 6, wWidth * 0.5 - 0.015]) {
    const vert = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, wHeight - 0.08, wDepth - 0.02),
      mats.walnutV,
    );
    vert.position.set(vx, wHeight * 0.5, wDepth * 0.5 - 0.01);
    vert.receiveShadow = true;
    wGroup.add(vert);
  }

  // Interior Wardrobe LED Strip (responds when wardrobe opens!)
  const wLedMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e4,
    emissive: new THREE.Color(0xffd088),
    emissiveIntensity: 0.0,
    roughness: 0.3,
  });
  const wLed = new THREE.Mesh(
    new THREE.BoxGeometry(wWidth - 0.14, 0.015, 0.025),
    wLedMat,
  );
  wLed.position.set(0, wHeight - 0.045, wDepth - 0.09);
  wGroup.add(wLed);
  wardrobeLightEmissives.push(wLed);

  let wardrobePointLight: THREE.PointLight | undefined;
  if (!isSoftwareGl) {
    wardrobePointLight = new THREE.PointLight(0xffd28e, 0, 2.5, 2);
    wardrobePointLight.position.set(0, wHeight - 0.18, wDepth - 0.14);
    wGroup.add(wardrobePointLight);
  }

  // Left & Center Bays: Hanging Rail + Garments + Upper Shelf + Lower Drawers
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, wWidth * 0.64, 12),
    mats.champagneBrass,
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-wWidth / 6, 1.82, wDepth * 0.5);
  wGroup.add(rail);

  const upperShelf = new THREE.Mesh(
    new THREE.BoxGeometry(wWidth * 0.65, 0.024, wDepth - 0.06),
    mats.oakH,
  );
  upperShelf.position.set(-wWidth / 6, 1.94, wDepth * 0.5);
  wGroup.add(upperShelf);

  const garmentMats = [mats.linenOlive, mats.beddingIvory, mats.linenTaupe, mats.darkBronze, mats.boucleOatmeal];
  for (let i = 0; i < 6; i++) {
    const gx = -wWidth * 0.44 + i * 0.19;
    const garment = new THREE.Mesh(
      createBevelledSlabGeometry(0.065, 0.88, 0.42, 0.015, 0.008),
      garmentMats[i % garmentMats.length],
    );
    garment.position.set(gx, 0.92, wDepth * 0.5);
    garment.castShadow = true;
    wGroup.add(garment);
  }

  // Right Bay: Shelves + INTERNAL STEEL SAFE / LOCKER (Interactive!)
  for (const sy of [0.55, 1.15, 1.65]) {
    const sh = new THREE.Mesh(
      new THREE.BoxGeometry(wWidth / 3 - 0.04, 0.024, wDepth - 0.06),
      mats.oakH,
    );
    sh.position.set(wWidth / 3, sy, wDepth * 0.5);
    wGroup.add(sh);
  }

  // Steel Safe / Locker sitting on the 0.55m shelf
  const safeW = 0.44;
  const safeH = 0.36;
  const safeD = 0.36;
  const safeGroup = new THREE.Group();
  safeGroup.position.set(wWidth / 3, 0.562, 0.24);

  // Hollow Safe Body (Top, Bottom, Back, Left, Right walls so opening reveals real interior!)
  const wallT = 0.025;
  const sBack = new THREE.Mesh(
    new THREE.BoxGeometry(safeW, safeH, wallT),
    mats.matteBlackMetal,
  );
  sBack.position.set(0, safeH * 0.5, -safeD * 0.5 + wallT * 0.5);
  const sBot = new THREE.Mesh(
    new THREE.BoxGeometry(safeW, wallT, safeD),
    mats.matteBlackMetal,
  );
  sBot.position.set(0, wallT * 0.5, 0);
  const sTop = sBot.clone();
  sTop.position.y = safeH - wallT * 0.5;
  const sLeft = new THREE.Mesh(
    new THREE.BoxGeometry(wallT, safeH, safeD),
    mats.matteBlackMetal,
  );
  sLeft.position.set(-safeW * 0.5 + wallT * 0.5, safeH * 0.5, 0);
  const sRight = sLeft.clone();
  sRight.position.x = safeW * 0.5 - wallT * 0.5;
  const sShelf = new THREE.Mesh(
    new THREE.BoxGeometry(safeW - wallT * 2, 0.014, safeD - 0.06),
    mats.stainlessSteel,
  );
  sShelf.position.set(0, safeH * 0.48, -0.01);
  // Watch box & document folio inside locker
  const watchBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.06, 0.11),
    mats.walnutH,
  );
  watchBox.position.set(-0.08, safeH * 0.5 + 0.035, 0);
  const folio = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.02, 0.16),
    mats.champagneBrass,
  );
  folio.position.set(0.05, wallT + 0.012, 0);
  safeGroup.add(sBack, sBot, sTop, sLeft, sRight, sShelf, watchBox, folio);

  // Safe Hinged Door Pivot (pivots on right edge)
  const safePivot = new THREE.Group();
  safePivot.position.set(safeW * 0.5 - wallT, 0, safeD * 0.5);
  const safeDoorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(safeW - wallT * 2, safeH - wallT * 2, 0.026),
    mats.darkBronze,
  );
  safeDoorMesh.position.set(-(safeW - wallT * 2) * 0.5, safeH * 0.5, 0);
  const keypad = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.11, 0.014),
    mats.matteBlackMetal,
  );
  keypad.position.set(-(safeW - wallT * 2) * 0.35, safeH * 0.55, 0.018);
  const safeHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.08, 0.028),
    mats.champagneBrass,
  );
  safeHandle.position.set(-(safeW - wallT * 2) * 0.72, safeH * 0.5, 0.024);
  safePivot.add(safeDoorMesh, keypad, safeHandle);
  safeGroup.add(safePivot);
  wGroup.add(safeGroup);

  const lockerDoor: InteractiveHingedHandle = {
    id: 'wardrobe-locker',
    label: 'Wardrobe Safe / Locker',
    pivot: safePivot,
    openAngle: 1.65,
  };
  clickTargets.push({
    mesh: safeDoorMesh,
    actionType: 'locker',
    actionId: 'wardrobe-locker',
    label: 'Open/Close Wardrobe Locker',
  });

  // 3 Hinged Oak Wardrobe Doors (each 0.715m wide with 3mm reveal gaps)
  const doorW = wWidth / 3 - 0.008;
  const doorSpecs = [
    { id: 'wardrobe-door-l', cx: -wWidth / 3, hingeSide: -1, openAngle: -1.45 },
    { id: 'wardrobe-door-c', cx: 0, hingeSide: 1, openAngle: 1.45 },
    { id: 'wardrobe-door-r', cx: wWidth / 3, hingeSide: 1, openAngle: 1.45 },
  ];
  for (const ds of doorSpecs) {
    const pivot = new THREE.Group();
    pivot.position.set(ds.cx + ds.hingeSide * doorW * 0.5, 0.08, wDepth);
    const doorMesh = new THREE.Mesh(
      createBevelledSlabGeometry(doorW, wHeight - 0.1, 0.024, 0.006, 0.002),
      mats.oakV,
    );
    doorMesh.position.set(-ds.hingeSide * doorW * 0.5, 0, 0);
    doorMesh.castShadow = true;
    const pull = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.42, 0.018),
      mats.darkBronze,
    );
    pull.position.set(-ds.hingeSide * (doorW - 0.055), 1.05, 0.018);
    pivot.add(doorMesh, pull);
    wGroup.add(pivot);

    wardrobeDoors.push({
      id: ds.id,
      label: 'Wardrobe Doors',
      pivot,
      openAngle: ds.openAngle,
    });
    clickTargets.push({
      mesh: doorMesh,
      actionType: 'wardrobe',
      actionId: 'wardrobe',
      label: 'Open/Close Wardrobe',
    });
  }

  g.add(wGroup);

  // Full-length Walnut & Brass Dressing Mirror beside fitted wardrobe
  const mirrorG = buildDressingMirror(mats);
  if (layoutVariant === '2bhk-east') {
    mirrorG.position.set(10.12, y, 5.72);
    mirrorG.rotation.y = Math.PI / 2;
  } else if (layoutVariant === '1bhk-center') {
    mirrorG.position.set(0.32, y, 3.62);
    mirrorG.rotation.y = Math.PI / 2;
  } else if (layoutVariant === '1bhk-west' || layoutVariant === '1bhk-east') {
    mirrorG.position.set(isMirroredEast ? 8.32 : -8.32, y, 4.65);
    mirrorG.rotation.y = isMirroredEast ? Math.PI / 2 : -Math.PI / 2;
  } else {
    mirrorG.position.set(isMirroredEast ? 11.55 : -11.55, y, 5.52);
    mirrorG.rotation.y = isMirroredEast ? Math.PI / 2 : -Math.PI / 2;
  }
  g.add(mirrorG);

  return {
    group: g,
    colliders,
    wardrobeDoors,
    lockerDoor,
    wardrobeLightEmissives,
    wardrobePointLight,
    lamps,
    clickTargets,
  };
}

function buildSecondaryBedroom(
  bedRoom: RoomSpec,
  y: number,
  mats: MaterialLibrary,
  isThird = false,
  isMirroredEast = false,
  is3Bhk = false,
) {
  const g = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const lamps: LampLightHandle[] = [];

  const cx = (bedRoom.bounds.xMin + bedRoom.bounds.xMax) * 0.5;
  const cz = (bedRoom.bounds.zMin + bedRoom.bounds.zMax) * 0.5;
  const bedOffsetX = isMirroredEast ? -0.25 : 0.25;

  // Double/Guest Bed centered in room
  const bedG = new THREE.Group();
  bedG.position.set(cx + bedOffsetX, y, bedRoom.bounds.zMin + 0.14);
  const frame = new THREE.Mesh(
    createBevelledSlabGeometry(1.56, 0.14, 1.98, 0.02, 0.006),
    mats.oakH,
  );
  frame.position.set(0, 0.16, 0.99);
  frame.castShadow = true;
  const headboard = new THREE.Mesh(
    createBevelledSlabGeometry(1.6, 0.88, 0.08, 0.03, 0.012),
    isThird ? mats.walnutV : mats.linenTaupe,
  );
  headboard.position.set(0, 0.35, 0.04);
  const mattress = new THREE.Mesh(
    createBevelledSlabGeometry(1.48, 0.2, 1.9, 0.04, 0.012),
    mats.beddingIvory,
  );
  mattress.position.set(0, 0.28, 0.99);
  const duvet = new THREE.Mesh(
    createCushionGeometry(1.52, 0.1, 1.32, 0.05, 0.02),
    isThird ? mats.linenTaupe : mats.linenOlive,
  );
  duvet.position.set(0, 0.43, 1.25);
  const pillowL = new THREE.Mesh(
    createCushionGeometry(0.56, 0.14, 0.36, 0.04, 0.02),
    mats.beddingIvory,
  );
  pillowL.position.set(-0.36, 0.52, 0.28);
  pillowL.rotation.x = 0.35;
  const pillowR = pillowL.clone();
  pillowR.position.x = 0.36;
  bedG.add(frame, headboard, mattress, duvet, pillowL, pillowR);
  addContactShadow(bedG, 1.7, 2.0, mats, 0.005);
  g.add(bedG);

  colliders.push({
    id: `${bedRoom.id}-bed`,
    xMin: cx + bedOffsetX - 0.8,
    xMax: cx + bedOffsetX + 0.8,
    zMin: bedRoom.bounds.zMin + 0.1,
    zMax: bedRoom.bounds.zMin + 2.1,
  });

  // Compact Study Desk + Chair + Desk Lamp + Wall Bookcase
  const deskOnRight = isMirroredEast;
  const deskG = new THREE.Group();
  deskG.position.set(
    deskOnRight ? bedRoom.bounds.xMax - 0.42 : bedRoom.bounds.xMin + 0.42,
    y,
    cz + 0.15,
  );
  deskG.rotation.y = deskOnRight ? -Math.PI / 2 : Math.PI / 2;
  const deskTop = new THREE.Mesh(
    createBevelledSlabGeometry(1.18, 0.034, 0.54, 0.012, 0.004),
    mats.oakH,
  );
  deskTop.position.y = 0.74;
  deskTop.castShadow = true;
  for (const lx of [-0.52, 0.52]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.74, 0.46),
      mats.darkBronze,
    );
    leg.position.set(lx, 0.37, 0);
    deskG.add(leg);
  }
  const dChair = buildDiningChair(mats);
  dChair.position.set(0, 0, 0.44);
  dChair.rotation.y = Math.PI;
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.1, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf4ece0,
      emissive: new THREE.Color(0xffca7a),
      emissiveIntensity: 0.12,
    }),
  );
  lampShade.position.set(-0.38, 1.08, -0.1);
  const lampStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.012, 0.32, 8),
    mats.champagneBrass,
  );
  lampStem.position.set(-0.38, 0.92, -0.1);

  const bookShelf = new THREE.Mesh(
    createBevelledSlabGeometry(1.02, 0.028, 0.22, 0.008, 0.003),
    mats.walnutH,
  );
  bookShelf.position.set(0, 1.48, -0.18);
  const bookMats = [mats.linenOlive, mats.linenTaupe, mats.beddingIvory, mats.darkBronze];
  for (let b = 0; b < 5; b++) {
    const bk = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.22 + (b % 2) * 0.04, 0.16),
      bookMats[b % bookMats.length],
    );
    bk.position.set(-0.32 + b * 0.055, 1.62, -0.18);
    deskG.add(bk);
  }
  const smallPot = buildPlanter(mats, { potRadius: 0.06, potHeight: 0.09, leafCount: 8, scale: 0.75 });
  smallPot.position.set(0.28, 1.5, -0.18);
  deskG.add(deskTop, dChair, lampShade, lampStem, bookShelf, smallPot);
  g.add(deskG);

  // Framed Artwork centered above secondary bed headboard
  const artFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.56, 0.022),
    mats.walnutH,
  );
  artFrame.position.set(cx + bedOffsetX, y + 1.56, bedRoom.bounds.zMin + 0.09);
  const artCanvas = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.5),
    mats.artBedroom,
  );
  artCanvas.position.set(cx + bedOffsetX, y + 1.56, bedRoom.bounds.zMin + 0.103);
  g.add(artFrame, artCanvas);

  // Compact 2-Door Oak Wardrobe positioned clear of attached-bath-2 doorway in 3BHK
  const wMini = new THREE.Mesh(
    createBevelledSlabGeometry(0.95, 2.15, 0.55, 0.01, 0.003),
    mats.oakV,
  );
  const wMiniX = deskOnRight ? bedRoom.bounds.xMin + 0.34 : bedRoom.bounds.xMax - 0.34;
  const wMiniZ =
    is3Bhk && !isThird
      ? bedRoom.bounds.zMin + 0.85
      : bedRoom.bounds.zMax - 0.72;
  wMini.position.set(wMiniX, y, wMiniZ);
  wMini.rotation.y = deskOnRight ? Math.PI / 2 : -Math.PI / 2;
  wMini.castShadow = true;
  g.add(wMini);

  lamps.push({
    id: `${bedRoom.id}-desk-lamp`,
    roomId: bedRoom.id,
    label: `${bedRoom.name} Desk Lamp`,
    emissiveMesh: lampShade,
  });

  return { group: g, colliders, lamps };
}

function buildDetailedBathroom(
  bath: RoomSpec,
  y: number,
  mats: MaterialLibrary,
  isMirroredEast = false,
) {
  const g = new THREE.Group();
  const lamps: LampLightHandle[] = [];
  const bw = bath.bounds.xMax - bath.bounds.xMin;
  const cx = (bath.bounds.xMin + bath.bounds.xMax) * 0.5;

  // Mirror X layout inside bathroom when in East-mirrored wing so door clearance stays identical
  const xSign = isMirroredEast ? -1 : 1;
  const vanityW = Math.min(1.05, bw * 0.56);
  const vX = cx - xSign * bw * 0.16;
  const vZ = bath.bounds.zMin + 0.3;

  const vanity = new THREE.Mesh(
    createBevelledSlabGeometry(vanityW, 0.44, 0.46, 0.012, 0.004),
    mats.walnutH,
  );
  vanity.position.set(vX, y + 0.38, vZ);
  vanity.castShadow = true;
  const vTop = new THREE.Mesh(
    createBevelledSlabGeometry(vanityW + 0.02, 0.032, 0.48, 0.01, 0.004),
    mats.travertine,
  );
  vTop.position.set(vX, y + 0.82, vZ);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.16, 0.12, 22),
    mats.ceramicWhite,
  );
  basin.position.set(vX, y + 0.9, vZ + 0.02);
  const faucet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.018, 0.18, 12),
    mats.champagneBrass,
  );
  faucet.position.set(vX, y + 0.94, vZ - 0.14);

  // Backlit Slim Bronze Mirror
  const mirrorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(vanityW * 0.86, 0.92, 0.025),
    mats.darkBronze,
  );
  mirrorFrame.position.set(vX, y + 1.56, bath.bounds.zMin + 0.08);
  const mirrorFace = new THREE.Mesh(
    new THREE.PlaneGeometry(vanityW * 0.82, 0.88),
    mats.mirrorGlass,
  );
  mirrorFace.position.set(vX, y + 1.56, bath.bounds.zMin + 0.095);
  const backlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff4e0,
    emissive: new THREE.Color(0xffcf88),
    emissiveIntensity: 0.14,
  });
  const mirrorGlow = new THREE.Mesh(
    new THREE.BoxGeometry(vanityW * 0.88, 0.94, 0.012),
    backlightMat,
  );
  mirrorGlow.position.set(vX, y + 1.56, bath.bounds.zMin + 0.072);
  g.add(vanity, vTop, basin, faucet, mirrorGlow, mirrorFrame, mirrorFace);
  lamps.push({
    id: `${bath.id}-mirror-light`,
    roomId: bath.id,
    label: `${bath.name} Mirror Light`,
    emissiveMesh: mirrorGlow,
  });

  // Wall-Hung Ceramic WC + Concealed Dual-Flush Plate
  const wcX = isMirroredEast ? bath.bounds.xMin + 0.42 : bath.bounds.xMax - 0.42;
  const wcZ = bath.bounds.zMin + 0.38;
  const wcBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.13, 0.34, 20),
    mats.ceramicWhite,
  );
  wcBowl.position.set(wcX, y + 0.25, wcZ);
  wcBowl.castShadow = true;
  const wcSeat = new THREE.Mesh(
    createBevelledSlabGeometry(0.36, 0.038, 0.44, 0.14, 0.01),
    mats.ceramicWhite,
  );
  wcSeat.position.set(wcX, y + 0.42, wcZ);
  const flushPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.018),
    mats.champagneBrass,
  );
  flushPlate.position.set(wcX, y + 1.05, bath.bounds.zMin + 0.08);
  g.add(wcBowl, wcSeat, flushPlate);

  // Wall-mounted Storage Water Heater (Geyser) high above WC / corner
  const geyserGroup = new THREE.Group();
  geyserGroup.position.set(wcX, y + 2.1, bath.bounds.zMin + 0.22);
  const geyserTank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.42, 20),
    mats.applianceEnamel,
  );
  const geyserCapTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.152, 0.152, 0.04, 20),
    mats.darkBronze,
  );
  geyserCapTop.position.y = 0.21;
  const geyserCapBot = geyserCapTop.clone();
  geyserCapBot.position.y = -0.21;
  const geyserLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.014, 0.012),
    mats.champagneBrass,
  );
  geyserLed.position.set(0, -0.06, 0.15);
  geyserGroup.add(geyserTank, geyserCapTop, geyserCapBot, geyserLed);
  g.add(geyserGroup);

  // Walk-In Frameless Shower Enclosure (placed cleanly on dry side opposite door swing!)
  const isNarrowBath = bw < 1.9;
  const showerOnWest =
    bath.id === 'primary-bath' && (bw < 1.9 || Math.abs(bath.bounds.xMin) > 14);
  const shWallX = showerOnWest
    ? bath.bounds.xMin
    : isMirroredEast
      ? bath.bounds.xMin
      : bath.bounds.xMax;
  const shSign = shWallX === bath.bounds.xMin ? -1 : 1;
  const shWidth = isNarrowBath ? Math.min(0.8, bw * 0.48) : 0.94;
  const shX = shWallX - shSign * (shWidth * 0.5 + 0.04);
  const showerGlass = new THREE.Mesh(
    new THREE.BoxGeometry(shWidth, 2.08, 0.014),
    mats.showerGlass,
  );
  showerGlass.position.set(shX, y + 1.04, bath.bounds.zMax - 0.92);
  const clampA = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.06, 0.04),
    mats.champagneBrass,
  );
  clampA.position.set(shWallX - shSign * 0.08, y + 0.35, bath.bounds.zMax - 0.92);
  const clampB = clampA.clone();
  clampB.position.y = y + 1.75;

  // Rainfall Shower Head + Mixer + Linear Floor Drain + Recessed Niche
  const showerArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.024, 0.35),
    mats.champagneBrass,
  );
  showerArm.position.set(shWallX - shSign * 0.32, y + 2.12, bath.bounds.zMax - 0.24);
  const showerHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.018, 22),
    mats.champagneBrass,
  );
  showerHead.position.set(shWallX - shSign * 0.32, y + 2.1, bath.bounds.zMax - 0.4);
  const mixerPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.18, 0.025),
    mats.champagneBrass,
  );
  mixerPlate.position.set(shWallX - shSign * 0.32, y + 1.15, bath.bounds.zMax - 0.08);
  const floorDrain = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.008, 0.07),
    mats.stainlessSteel,
  );
  floorDrain.position.set(shWallX - shSign * 0.4, y + 0.005, bath.bounds.zMax - 0.22);

  // Vanity Countertop Toiletries (Soap Dispenser + Ceramic Tumbler)
  const soapBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.034, 0.13, 14),
    mats.linenOlive,
  );
  soapBottle.position.set(vX + vanityW * 0.32, y + 0.915, vZ);
  const soapPump = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.01, 0.04, 10),
    mats.champagneBrass,
  );
  soapPump.position.set(vX + vanityW * 0.32, y + 0.995, vZ);
  const tumbler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.024, 0.095, 14),
    mats.ceramicWhite,
  );
  tumbler.position.set(vX - vanityW * 0.32, y + 0.898, vZ + 0.04);

  // Recessed Shower Toiletries Shelf + Two Shampoo Bottles
  const nicheShelf = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.02, 0.38),
    mats.travertine,
  );
  nicheShelf.position.set(shWallX - shSign * 0.1, y + 1.24, bath.bounds.zMax - 0.55);
  const bottleA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.16, 12),
    mats.linenTaupe,
  );
  bottleA.position.set(shWallX - shSign * 0.11, y + 1.33, bath.bounds.zMax - 0.48);
  const bottleB = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.14, 12),
    mats.ceramicWhite,
  );
  bottleB.position.set(shWallX - shSign * 0.11, y + 1.32, bath.bounds.zMax - 0.62);

  // Double Waffle Bath & Hand Towels on Brass Rail
  const towelRail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.56, 10),
    mats.champagneBrass,
  );
  towelRail.rotation.z = Math.PI / 2;
  towelRail.position.set(cx - xSign * 0.15, y + 1.12, bath.bounds.zMax - 0.1);
  const foldedTowel = new THREE.Mesh(
    createBevelledSlabGeometry(0.28, 0.42, 0.05, 0.018, 0.008),
    mats.linenTaupe,
  );
  foldedTowel.position.set(cx - xSign * 0.25, y + 0.72, bath.bounds.zMax - 0.11);
  const handTowel = new THREE.Mesh(
    createBevelledSlabGeometry(0.18, 0.3, 0.04, 0.014, 0.006),
    mats.beddingIvory,
  );
  handTowel.position.set(cx + xSign * 0.02, y + 0.84, bath.bounds.zMax - 0.11);

  g.add(
    showerGlass,
    clampA,
    clampB,
    showerArm,
    showerHead,
    mixerPlate,
    floorDrain,
    soapBottle,
    soapPump,
    tumbler,
    nicheShelf,
    bottleA,
    bottleB,
    towelRail,
    foldedTowel,
    handTowel,
  );

  return { group: g, lamps };
}

function buildWashingMachine(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    createBevelledSlabGeometry(0.6, 0.85, 0.56, 0.012, 0.004),
    mats.applianceEnamel,
  );
  body.position.y = 0.01;
  body.castShadow = true;
  body.receiveShadow = true;
  const drumRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.022, 12, 24),
    mats.stainlessSteel,
  );
  drumRing.position.set(0, 0.44, 0.285);
  const drumGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.165, 0.02, 22),
    mats.inductionGlass,
  );
  drumGlass.rotation.x = Math.PI / 2;
  drumGlass.position.set(0, 0.44, 0.28);
  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.02, 14),
    mats.darkBronze,
  );
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.14, 0.76, 0.285);
  const drawer = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.075, 0.015),
    mats.cabinetGreige,
  );
  drawer.position.set(-0.16, 0.76, 0.282);
  g.add(body, drumRing, drumGlass, dial, drawer);
  return g;
}

function buildDryingRack(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  // Fold-out stainless A-frame clothes drying stand with cross rods & draped linen
  for (const sx of [-0.36, 0.36]) {
    const legA = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.92, 8),
      mats.stainlessSteel,
    );
    legA.position.set(sx, 0.44, 0.11);
    legA.rotation.x = -0.22;
    const legB = legA.clone();
    legB.position.z = -0.11;
    legB.rotation.x = 0.22;
    g.add(legA, legB);
  }
  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.018, 0.42),
    mats.stainlessSteel,
  );
  topFrame.position.y = 0.88;
  g.add(topFrame);

  for (const rz of [-0.14, -0.05, 0.05, 0.14]) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.74, 8),
      mats.stainlessSteel,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, 0.88, rz);
    g.add(rod);
  }
  const clothA = new THREE.Mesh(
    createBevelledSlabGeometry(0.24, 0.36, 0.032, 0.01, 0.004),
    mats.beddingIvory,
  );
  clothA.position.set(-0.18, 0.71, -0.05);
  const clothB = new THREE.Mesh(
    createBevelledSlabGeometry(0.22, 0.3, 0.032, 0.01, 0.004),
    mats.linenTaupe,
  );
  clothB.position.set(0.16, 0.74, 0.05);
  g.add(clothA, clothB);
  return g;
}

function buildUtilityLaundry(
  bal: ApartmentSpec['balconies'][number],
  y: number,
  mats: MaterialLibrary,
) {
  const g = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const cx = (bal.bounds.xMin + bal.bounds.xMax) * 0.5;
  const cz = (bal.bounds.zMin + bal.bounds.zMax) * 0.5;

  const washer = buildWashingMachine(mats);
  const rack = buildDryingRack(mats);

  if (bal.openEdge === 'north') {
    washer.position.set(bal.bounds.xMax - 0.52, y - 0.025, bal.bounds.zMax - 0.38);
    washer.rotation.y = Math.PI;
    colliders.push({
      id: 'utility-washer',
      xMin: bal.bounds.xMax - 0.85,
      xMax: bal.bounds.xMax - 0.2,
      zMin: bal.bounds.zMax - 0.7,
      zMax: bal.bounds.zMax - 0.05,
    });
    rack.position.set(bal.bounds.xMin + 0.65, y - 0.025, cz);
  } else if (bal.openEdge === 'east') {
    washer.position.set(bal.bounds.xMax - 0.48, y - 0.025, bal.bounds.zMin + 0.52);
    washer.rotation.y = -Math.PI / 2;
    colliders.push({
      id: 'utility-washer',
      xMin: bal.bounds.xMax - 0.82,
      xMax: bal.bounds.xMax - 0.15,
      zMin: bal.bounds.zMin + 0.2,
      zMax: bal.bounds.zMin + 0.85,
    });
    rack.position.set(cx, y - 0.025, bal.bounds.zMax - 0.58);
    rack.rotation.y = Math.PI / 2;
  } else {
    washer.position.set(bal.bounds.xMin + 0.48, y - 0.025, bal.bounds.zMin + 0.52);
    washer.rotation.y = Math.PI / 2;
    colliders.push({
      id: 'utility-washer',
      xMin: bal.bounds.xMin + 0.15,
      xMax: bal.bounds.xMin + 0.82,
      zMin: bal.bounds.zMin + 0.2,
      zMax: bal.bounds.zMin + 0.85,
    });
    rack.position.set(cx, y - 0.025, bal.bounds.zMax - 0.58);
    rack.rotation.y = Math.PI / 2;
  }

  // Woven laundry hamper basket
  const hamper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.17, 0.52, 18),
    mats.linenTaupe,
  );
  hamper.position.set(cx + (bal.openEdge === 'north' ? -0.25 : 0), y + 0.24, cz);
  hamper.castShadow = true;
  g.add(washer, rack, hamper);
  return { group: g, colliders };
}

function buildOutdoorChair(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  for (const lx of [-0.26, 0.26]) {
    for (const lz of [-0.26, 0.26]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.015, 0.36, 8),
        mats.teakExterior,
      );
      leg.position.set(lx, 0.18, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  }
  const seat = new THREE.Mesh(
    createCushionGeometry(0.58, 0.11, 0.56, 0.04, 0.018),
    mats.linenTaupe,
  );
  seat.position.y = 0.32;
  seat.castShadow = true;
  const back = new THREE.Mesh(
    createCushionGeometry(0.56, 0.38, 0.11, 0.04, 0.018),
    mats.linenTaupe,
  );
  back.position.set(0, 0.52, -0.22);
  back.rotation.x = -0.2;
  back.castShadow = true;
  g.add(seat, back);
  addContactShadow(g, 0.65, 0.65, mats, 0.005);
  return g;
}

function buildPujaMandir(mats: MaterialLibrary): {
  group: THREE.Group;
  diyaFlame: THREE.Mesh;
} {
  const g = new THREE.Group();
  // Base teak/walnut cabinet with drawer pulls
  const plinth = new THREE.Mesh(
    createBevelledSlabGeometry(0.84, 0.68, 0.44, 0.014, 0.004),
    mats.walnutH,
  );
  plinth.position.set(0, 0.04, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  const ledge = new THREE.Mesh(
    createBevelledSlabGeometry(0.9, 0.04, 0.48, 0.014, 0.004),
    mats.travertine,
  );
  ledge.position.set(0, 0.72, 0.01);
  ledge.castShadow = true;
  g.add(ledge);

  for (const dx of [-0.2, 0.2]) {
    const drawerFront = new THREE.Mesh(
      createBevelledSlabGeometry(0.38, 0.24, 0.02, 0.006, 0.002),
      mats.oakH,
    );
    drawerFront.position.set(dx, 0.44, 0.225);
    const pull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.018, 12),
      mats.champagneBrass,
    );
    pull.rotation.x = Math.PI / 2;
    pull.position.set(dx, 0.56, 0.242);
    g.add(drawerFront, pull);
  }

  // Carved Back Panel, Warm Backlit Mandala Medallion, Fluted Side Pilasters & Temple Shikhara Canopy
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 1.38, 0.036),
    mats.walnutV,
  );
  backPanel.position.set(0, 1.43, -0.18);
  backPanel.castShadow = true;
  const innerBackdrop = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 1.08, 0.018),
    mats.oakV,
  );
  innerBackdrop.position.set(0, 1.34, -0.155);
  const mandalaHaloMat = new THREE.MeshStandardMaterial({
    color: 0xffefc8,
    emissive: new THREE.Color(0xffbe63),
    emissiveIntensity: 0.42,
    roughness: 0.45,
  });
  const mandalaHalo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.012, 28),
    mandalaHaloMat,
  );
  mandalaHalo.rotation.x = Math.PI / 2;
  mandalaHalo.position.set(0, 1.34, -0.142);
  const mandalaOuterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.21, 0.012, 10, 32),
    mats.champagneBrass,
  );
  mandalaOuterRing.position.set(0, 1.34, -0.134);
  const mandalaInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.008, 8, 24),
    mats.champagneBrass,
  );
  mandalaInnerRing.position.set(0, 1.34, -0.132);
  const sacredEmblem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 0),
    mats.champagneBrass,
  );
  sacredEmblem.scale.set(1, 1.15, 0.35);
  sacredEmblem.position.set(0, 1.34, -0.126);
  g.add(
    backPanel,
    innerBackdrop,
    mandalaHalo,
    mandalaOuterRing,
    mandalaInnerRing,
    sacredEmblem,
  );

  for (const sx of [-0.36, 0.36]) {
    const pilaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 1.24, 0.14),
      mats.walnutV,
    );
    pilaster.position.set(sx, 1.36, -0.09);
    pilaster.castShadow = true;
    const brassCap = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.035, 0.15),
      mats.champagneBrass,
    );
    brassCap.position.set(sx, 1.98, -0.09);
    g.add(pilaster, brassCap);
  }

  const canopy = new THREE.Mesh(
    createBevelledSlabGeometry(0.92, 0.08, 0.38, 0.02, 0.006),
    mats.walnutH,
  );
  canopy.position.set(0, 2.02, -0.04);
  const shikharaCrown = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.22, 4),
    mats.champagneBrass,
  );
  shikharaCrown.rotation.y = Math.PI / 4;
  shikharaCrown.position.set(0, 2.2, -0.06);
  g.add(canopy, shikharaCrown);

  // Hanging Brass Temple Bell + Sacred Diya & Kalash on Altar
  const bellChain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.18, 8),
    mats.champagneBrass,
  );
  bellChain.position.set(0, 1.9, 0.04);
  const bellBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.075, 16),
    mats.champagneBrass,
  );
  bellBody.position.set(0, 1.8, 0.04);
  const kalash = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 14),
    mats.champagneBrass,
  );
  kalash.position.set(-0.18, 0.83, 0.04);
  const diyaBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.03, 0.032, 16),
    mats.champagneBrass,
  );
  diyaBowl.position.set(0.14, 0.78, 0.08);
  const diyaMat = new THREE.MeshStandardMaterial({
    color: 0xffebb8,
    emissive: new THREE.Color(0xffb84a),
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const diyaFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.016, 0.045, 10),
    diyaMat,
  );
  diyaFlame.position.set(0.14, 0.82, 0.08);
  g.add(bellChain, bellBody, kalash, diyaBowl, diyaFlame);

  addContactShadow(g, 0.9, 0.5, mats, 0.005);
  return { group: g, diyaFlame };
}

function buildFamilyLounge(
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
  isMirroredEast: boolean,
): {
  group: THREE.Group;
  shadeMesh: THREE.Mesh;
  lampGroup: THREE.Group;
  pointLight?: THREE.PointLight;
} {
  const g = new THREE.Group();
  const xSign = isMirroredEast ? -1 : 1;

  const rug = buildWovenRug(mats, 1.85, 1.45);
  rug.position.set(0, 0, 0.18);
  g.add(rug);

  const loveseat = buildDetailedSofa(mats, 1.62, 0.88);
  loveseat.position.set(-xSign * 1.12, 0, 0);
  loveseat.rotation.y = xSign * (Math.PI / 2);
  g.add(loveseat);

  const sideTable = buildBrassSideTable(mats);
  sideTable.position.set(-xSign * 1.12, 0, 1.02);
  g.add(sideTable);

  const lamp = buildFloorLamp(mats, isSoftwareGl);
  lamp.group.position.set(-xSign * 1.12, 0, -1.02);
  g.add(lamp.group);

  return {
    group: g,
    shadeMesh: lamp.shadeMesh,
    lampGroup: lamp.group,
    pointLight: lamp.pointLight,
  };
}

function buildDressingMirror(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    createBevelledSlabGeometry(0.58, 1.66, 0.032, 0.015, 0.004),
    mats.walnutV,
  );
  frame.position.set(0, 0.34, 0.02);
  frame.castShadow = true;
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(0.53, 1.6, 0.016),
    mats.champagneBrass,
  );
  trim.position.set(0, 1.17, 0.032);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.49, 1.56),
    mats.mirrorGlass,
  );
  glass.position.set(0, 1.17, 0.042);
  const ledge = new THREE.Mesh(
    createBevelledSlabGeometry(0.56, 0.024, 0.16, 0.01, 0.003),
    mats.walnutH,
  );
  ledge.position.set(0, 0.31, 0.09);
  g.add(frame, trim, glass, ledge);
  return g;
}

function buildSplitAcUnit(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    createBevelledSlabGeometry(0.92, 0.26, 0.21, 0.02, 0.006),
    mats.applianceEnamel,
  );
  body.castShadow = true;
  const louver = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.026, 0.028),
    mats.darkBronze,
  );
  louver.position.set(0, -0.09, 0.1);
  louver.rotation.x = 0.28;
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.012, 0.012),
    mats.champagneBrass,
  );
  trim.position.set(0, 0.04, 0.106);
  g.add(body, louver, trim);
  return g;
}
