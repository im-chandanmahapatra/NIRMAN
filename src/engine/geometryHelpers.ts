import * as THREE from 'three';
import { MaterialLibrary } from './materials';

/**
 * Create a rounded-corner bevelled box centered on X/Z, resting at Y=0..height,
 * with normalized UVs scaled in real-world meters so wood & stone maps stay natural.
 */
export function createBevelledSlabGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.025,
  bevel = 0.008,
): THREE.BufferGeometry {
  const r = Math.min(radius, width * 0.45, depth * 0.45);
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const innerH = Math.max(0.005, height - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerH,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();

  // Triplanar-style meter-scaled UVs so timber veneer and travertine slabs map evenly
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (uv && pos && nrm) {
    const scale = 0.72;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nrm.getX(i));
      const ny = Math.abs(nrm.getY(i));
      const nz = Math.abs(nrm.getZ(i));
      const px = pos.getX(i);
      const py = pos.getY(i);
      const pz = pos.getZ(i);
      if (ny >= nx && ny >= nz) {
        uv.setXY(i, (px + hw) * scale, (pz + hd) * scale);
      } else if (nz >= nx) {
        uv.setXY(i, (px + hw) * scale, py * scale);
      } else {
        uv.setXY(i, (pz + hd) * scale, py * scale);
      }
    }
    uv.needsUpdate = true;
  }

  return geo;
}

/**
 * Create an upholstered cushion with soft pillowed bevels and slight crown.
 */
export function createCushionGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.055,
  bevel = 0.024,
): THREE.BufferGeometry {
  const geo = createBevelledSlabGeometry(width, height, depth, radius, bevel);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / (width * 0.5);
    const nz = z / (depth * 0.5);
    const edgeFalloff = Math.max(0, 1 - (nx * nx * 0.55 + nz * nz * 0.55));
    if (y > height * 0.55) {
      pos.setY(i, y + edgeFalloff * 0.016);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Add a soft radial contact shadow disc flush at Y = yOffset.
 */
export function addContactShadow(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  mats: MaterialLibrary,
  yOffset = 0.004,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width * 1.18, depth * 1.18);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mats.contactShadow);
  mesh.position.y = yOffset;
  mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}

/**
 * Build a sculptural tropical indoor/balcony planter with multi-angle curved leaves.
 */
export function buildPlanter(
  mats: MaterialLibrary,
  options: {
    potRadius?: number;
    potHeight?: number;
    leafCount?: number;
    scale?: number;
    potMaterial?: THREE.Material;
  } = {},
): THREE.Group {
  const {
    potRadius = 0.19,
    potHeight = 0.34,
    leafCount = 14,
    scale = 1,
    potMaterial = mats.terracottaPot,
  } = options;

  const group = new THREE.Group();

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(potRadius * 0.72, 0.0),
    new THREE.Vector2(potRadius * 0.95, potHeight * 0.65),
    new THREE.Vector2(potRadius, potHeight * 0.94),
    new THREE.Vector2(potRadius * 0.96, potHeight),
    new THREE.Vector2(potRadius * 0.86, potHeight),
    new THREE.Vector2(potRadius * 0.84, potHeight * 0.88),
  ];
  const potGeo = new THREE.LatheGeometry(pts, 20);
  const potMesh = new THREE.Mesh(potGeo, potMaterial);
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  group.add(potMesh);

  const soilGeo = new THREE.CylinderGeometry(
    potRadius * 0.84,
    potRadius * 0.82,
    0.04,
    18,
  );
  const soilMesh = new THREE.Mesh(soilGeo, mats.soil);
  soilMesh.position.y = potHeight * 0.86;
  group.add(soilMesh);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.07, 0.12, 0.055, 0.28);
  leafShape.quadraticCurveTo(0.02, 0.4, 0, 0.46);
  leafShape.quadraticCurveTo(-0.02, 0.4, -0.055, 0.28);
  leafShape.quadraticCurveTo(-0.07, 0.12, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
  const lPos = leafGeo.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    const ly = lPos.getY(i);
    const lx = lPos.getX(i);
    lPos.setZ(i, -ly * ly * 0.75 + Math.abs(lx) * 0.2);
  }
  leafGeo.computeVertexNormals();

  const stemGeo = new THREE.CylinderGeometry(0.007, 0.011, 0.34, 6);

  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + (i % 2) * 0.35;
    const tier = i % 3;
    const tilt = 0.25 + tier * 0.24;
    const leafScale = 0.7 + (i % 4) * 0.16;

    const sprig = new THREE.Group();
    sprig.position.set(
      Math.cos(angle) * potRadius * 0.22,
      potHeight * 0.84,
      Math.sin(angle) * potRadius * 0.22,
    );
    sprig.rotation.y = angle;
    sprig.rotation.x = tilt;

    const stem = new THREE.Mesh(stemGeo, mats.foliageA);
    stem.position.y = 0.16 * leafScale;
    stem.scale.setScalar(leafScale);
    sprig.add(stem);

    const leaf = new THREE.Mesh(
      leafGeo,
      i % 3 === 0 ? mats.foliageA : i % 3 === 1 ? mats.foliageB : mats.foliageC,
    );
    leaf.position.y = 0.22 * leafScale;
    leaf.rotation.x = 0.45 + tier * 0.15;
    leaf.scale.set(leafScale, leafScale, leafScale);
    leaf.castShadow = true;
    sprig.add(leaf);

    group.add(sprig);
  }

  addContactShadow(group, potRadius * 2.1, potRadius * 2.1, mats, 0.004);
  group.scale.setScalar(scale);
  return group;
}

/**
 * Create a pleated sheer curtain wing using a continuous sinusoidal profile extruded vertically.
 */
export function createPleatedCurtainGeometry(
  width: number,
  height: number,
  pleats = 10,
  depth = 0.045,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const steps = pleats * 6;
  shape.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * width;
    const z = Math.sin(t * pleats * Math.PI * 2) * depth * 0.5;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export type TreeArchetype = 'spreading' | 'columnar' | 'multistem' | 'courtyard';

/**
 * Build an organic multi-silhouette site tree with distinct species proportions & irregular asymmetric crowns.
 */
export function buildExteriorTree(
  mats: MaterialLibrary,
  height = 5.4,
  seed = 1,
  archetype: TreeArchetype = 'spreading',
): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = mats.walnutV;
  const foliageMats = [mats.foliageA, mats.foliageB, mats.foliageC];

  const makeLeafClusterGeo = (rad: number, clusterSeed: number, flatRatio = 0.78) => {
    const geo = new THREE.IcosahedronGeometry(rad, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const wave =
        1 +
        0.16 * Math.sin(vx * 3.4 + clusterSeed) * Math.cos(vz * 3.2 - clusterSeed) +
        0.11 * Math.cos(vy * 4.1 + clusterSeed * 1.1);
      pos.setXYZ(i, vx * wave, vy * wave * flatRatio, vz * wave);
    }
    geo.computeVertexNormals();
    return geo;
  };

  if (archetype === 'columnar') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.16, height * 0.48, 8),
      trunkMat,
    );
    trunk.position.y = height * 0.24;
    trunk.castShadow = true;
    group.add(trunk);

    const colGeo = makeLeafClusterGeo(height * 0.145, seed * 2.1, 1.35);
    const tiers: Array<[number, number, number, number]> = [
      [0, height * 0.46, 0, 1.05],
      [height * 0.03, height * 0.62, -height * 0.02, 0.96],
      [-height * 0.02, height * 0.77, height * 0.02, 0.84],
      [0, height * 0.91, 0, 0.62],
    ];
    tiers.forEach(([ox, oy, oz, sc], idx) => {
      const m = new THREE.Mesh(colGeo, foliageMats[(idx + seed) % foliageMats.length]);
      m.position.set(ox, oy, oz);
      m.scale.setScalar(sc);
      m.rotation.y = seed + idx * 1.1;
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    });
    addContactShadow(group, height * 0.42, height * 0.42, mats, 0.015);
    return group;
  }

  if (archetype === 'multistem') {
    // Architectural multi-stem courtyard tree (like Plumeria / Gulmohar)
    const stemAngles = [0.2, 2.35, 4.4];
    const stemGeo = new THREE.CylinderGeometry(0.045, 0.095, height * 0.56, 8);
    const crownGeo = makeLeafClusterGeo(height * 0.16, seed * 1.9, 0.74);
    stemAngles.forEach((ang, idx) => {
      const lean = 0.2 + (idx % 2) * 0.07;
      const stem = new THREE.Mesh(stemGeo, trunkMat);
      stem.position.set(Math.cos(ang) * 0.24, height * 0.26, Math.sin(ang) * 0.24);
      stem.rotation.z = -Math.cos(ang) * lean;
      stem.rotation.x = Math.sin(ang) * lean;
      stem.castShadow = true;
      group.add(stem);

      const canopy = new THREE.Mesh(
        crownGeo,
        foliageMats[(seed + idx) % foliageMats.length],
      );
      canopy.position.set(
        Math.cos(ang) * height * 0.16,
        height * (0.62 + idx * 0.04),
        Math.sin(ang) * height * 0.16,
      );
      canopy.scale.set(1.22, 0.85, 1.14);
      canopy.rotation.y = ang + seed;
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      group.add(canopy);
    });
    const topCanopy = new THREE.Mesh(crownGeo, foliageMats[seed % foliageMats.length]);
    topCanopy.position.set(0.04, height * 0.77, -0.04);
    topCanopy.scale.set(1.28, 0.82, 1.18);
    topCanopy.castShadow = true;
    group.add(topCanopy);
    addContactShadow(group, height * 0.65, height * 0.65, mats, 0.015);
    return group;
  }

  // Spreading / Courtyard umbrella tree
  const isWide = archetype === 'spreading';
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.22, height * 0.44, 10),
    trunkMat,
  );
  trunk.position.y = height * 0.22;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const branchGeo = new THREE.CylinderGeometry(0.032, 0.075, height * 0.34, 7);
  const clusterGeoA = makeLeafClusterGeo(height * (isWide ? 0.175 : 0.15), seed * 1.7, isWide ? 0.72 : 0.84);
  const clusterGeoB = makeLeafClusterGeo(height * (isWide ? 0.145 : 0.125), seed * 2.9 + 1.3, isWide ? 0.74 : 0.88);

  const boughs: Array<[number, number, number]> = [
    [height * 0.19, height * 0.42, height * 0.12],
    [-height * 0.2, height * 0.45, -height * 0.1],
    [height * 0.08, height * 0.4, -height * 0.19],
    [-height * 0.11, height * 0.46, height * 0.18],
  ];

  boughs.forEach(([bx, by, bz]) => {
    const br = new THREE.Mesh(branchGeo, trunkMat);
    br.position.set(bx * 0.55, by, bz * 0.55);
    br.rotation.z = -(bx / height) * 2.2;
    br.rotation.x = (bz / height) * 2.2;
    group.add(br);
  });

  const spread = isWide ? 1.24 : 1.0;
  const clusters: Array<[number, number, number, number, number]> = [
    [0.04, height * 0.72, -0.02, 1.3 * spread, 0.82],
    [-0.08, height * 0.83, 0.05, 0.96 * spread, 0.76],
    [height * 0.2 * spread, height * 0.61, height * 0.12, 0.98 * spread, 0.78],
    [-height * 0.21 * spread, height * 0.64, -height * 0.11, 1.02 * spread, 0.76],
    [height * 0.1 * spread, height * 0.57, -height * 0.19, 0.94 * spread, 0.74],
    [-height * 0.12 * spread, height * 0.59, height * 0.2, 0.96 * spread, 0.78],
    [height * 0.25 * spread, height * 0.54, -0.06, 0.78 * spread, 0.72],
    [-height * 0.23 * spread, height * 0.55, height * 0.1, 0.82 * spread, 0.72],
  ];

  clusters.forEach(([ox, oy, oz, scX, scY], idx) => {
    const crown = new THREE.Mesh(
      idx % 2 === 0 ? clusterGeoA : clusterGeoB,
      foliageMats[(idx + seed) % foliageMats.length],
    );
    crown.position.set(ox, oy, oz);
    crown.scale.set(scX, scY, scX * 0.92);
    crown.rotation.y = (seed * 1.3 + idx) * 1.05;
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);
  });

  addContactShadow(group, height * 0.65 * spread, height * 0.65 * spread, mats, 0.015);
  return group;
}

/**
 * Build a composite modern passenger car (chassis, sloped cabin, darkened glazing,
 * wheel arches, 4 tires + alloy rims, subtle headlights/taillights) to human residential scale (~4.5m x 1.85m).
 */
export function buildSiteVehicle(
  mats: MaterialLibrary,
  bodyMat: THREE.Material,
  emissiveOut: THREE.Mesh[],
): THREE.Group {
  const g = new THREE.Group();

  // Lower sculpted body (L = 4.55m along Z, W = 1.84m along X)
  const chassis = new THREE.Mesh(
    createBevelledSlabGeometry(1.82, 0.58, 4.5, 0.16, 0.045),
    bodyMat,
  );
  chassis.position.set(0, 0.22, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  g.add(chassis);

  // Upper sloped cabin greenhouse
  const cabin = new THREE.Mesh(
    createBevelledSlabGeometry(1.48, 0.46, 2.35, 0.14, 0.05),
    bodyMat,
  );
  cabin.position.set(0, 0.75, -0.18);
  cabin.castShadow = true;
  g.add(cabin);

  // Tinted windshield + side window band
  const glassBand = new THREE.Mesh(
    createBevelledSlabGeometry(1.5, 0.36, 2.22, 0.12, 0.025),
    mats.carCabinGlass,
  );
  glassBand.position.set(0, 0.78, -0.18);
  g.add(glassBand);

  // Grilles & Bumpers
  const frontGrille = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.22, 0.06),
    mats.matteBlackMetal,
  );
  frontGrille.position.set(0, 0.42, 2.24);
  g.add(frontGrille);

  // 4 Rubber Wheels + Brushed Alloy Rims
  const tireGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 18);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 14);
  for (const wx of [-0.88, 0.88]) {
    for (const wz of [-1.36, 1.38]) {
      const tire = new THREE.Mesh(tireGeo, mats.rubberGasket);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, 0.32, wz);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, mats.stainlessSteel);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, 0.32, wz);
      g.add(tire, rim);
    }
  }

  // Headlight strips (soft glow in evening/night)
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e0,
    emissive: new THREE.Color(0xffe1a8),
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  for (const hx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.04), headMat);
    hl.position.set(hx, 0.58, 2.25);
    g.add(hl);
    emissiveOut.push(hl);
  }

  addContactShadow(g, 2.0, 4.7, mats, 0.015);
  return g;
}

/**
 * Build a landscaped courtyard timber & dark-bronze park bench.
 */
export function buildSiteBench(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [-0.72, 0.72]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.48), mats.darkBronze);
    leg.position.set(sx, 0.22, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  for (const sz of [-0.14, 0.0, 0.14]) {
    const slat = new THREE.Mesh(
      createBevelledSlabGeometry(1.72, 0.04, 0.11, 0.008, 0.003),
      mats.teakExterior,
    );
    slat.position.set(0, 0.44, sz);
    slat.castShadow = true;
    g.add(slat);
  }
  addContactShadow(g, 1.8, 0.6, mats, 0.012);
  return g;
}

/**
 * Build true 3D extruded bevelled "NIRMAN" architectural signage from crisp vector letter shapes.
 */
export function buildNirman3DSignage(
  mats: MaterialLibrary,
  emissiveOut: THREE.Mesh[],
  scale = 1,
): THREE.Group {
  const g = new THREE.Group();
  const H = 1.0;
  const T = 0.135;

  const makeLetterShape = (ch: string): { shapes: THREE.Shape[]; width: number } => {
    const s = new THREE.Shape();
    if (ch === 'N') {
      const w = 0.68;
      s.moveTo(0, 0);
      s.lineTo(T, 0);
      s.lineTo(T, H * 0.68);
      s.lineTo(w - T, 0);
      s.lineTo(w, 0);
      s.lineTo(w, H);
      s.lineTo(w - T, H);
      s.lineTo(w - T, H * 0.32);
      s.lineTo(T, H);
      s.lineTo(0, H);
      s.closePath();
      return { shapes: [s], width: w };
    }
    if (ch === 'I') {
      const w = 0.16;
      s.moveTo(0, 0);
      s.lineTo(w, 0);
      s.lineTo(w, H);
      s.lineTo(0, H);
      s.closePath();
      return { shapes: [s], width: w };
    }
    if (ch === 'R') {
      const w = 0.64;
      const mid = H * 0.49;
      s.moveTo(0, 0);
      s.lineTo(T, 0);
      s.lineTo(T, mid - T * 0.45);
      s.lineTo(w * 0.48, mid - T * 0.45);
      s.lineTo(w - T * 0.85, 0);
      s.lineTo(w, 0);
      s.lineTo(w * 0.66, mid - T * 0.18);
      s.quadraticCurveTo(w, mid + 0.04, w, H * 0.74);
      s.quadraticCurveTo(w, H, w * 0.6, H);
      s.lineTo(0, H);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(T, mid + T * 0.45);
      hole.lineTo(w * 0.56, mid + T * 0.45);
      hole.quadraticCurveTo(w - T * 0.9, mid + T * 0.45, w - T * 0.9, H * 0.74);
      hole.quadraticCurveTo(w - T * 0.9, H - T * 0.9, w * 0.56, H - T * 0.9);
      hole.lineTo(T, H - T * 0.9);
      hole.closePath();
      s.holes.push(hole);
      return { shapes: [s], width: w };
    }
    if (ch === 'M') {
      const w = 0.82;
      s.moveTo(0, 0);
      s.lineTo(T, 0);
      s.lineTo(T, H * 0.66);
      s.lineTo(w * 0.5, H * 0.24);
      s.lineTo(w - T, H * 0.66);
      s.lineTo(w - T, 0);
      s.lineTo(w, 0);
      s.lineTo(w, H);
      s.lineTo(w - T * 0.9, H);
      s.lineTo(w * 0.5, H * 0.46);
      s.lineTo(T * 0.9, H);
      s.lineTo(0, H);
      s.closePath();
      return { shapes: [s], width: w };
    }
    // 'A'
    const w = 0.7;
    const mid = H * 0.34;
    s.moveTo(0, 0);
    s.lineTo(T, 0);
    s.lineTo(T * 1.4, mid);
    s.lineTo(w - T * 1.4, mid);
    s.lineTo(w - T, 0);
    s.lineTo(w, 0);
    s.lineTo(w * 0.5 + T * 0.42, H);
    s.lineTo(w * 0.5 - T * 0.42, H);
    s.closePath();

    const hole = new THREE.Path();
    hole.moveTo(T * 1.7, mid + T * 0.8);
    hole.lineTo(w - T * 1.7, mid + T * 0.8);
    hole.lineTo(w * 0.5, H - T * 1.25);
    hole.closePath();
    s.holes.push(hole);
    return { shapes: [s], width: w };
  };

  const letters = ['N', 'I', 'R', 'M', 'A', 'N'];
  const gap = 0.34;
  const specs = letters.map((ch) => makeLetterShape(ch));
  const totalWidth =
    specs.reduce((sum, item) => sum + item.width, 0) + gap * (letters.length - 1);

  // Clean integrated architectural backing fascia plate (concealed mounting, no scaffolding)
  const backingPanel = new THREE.Mesh(
    createBevelledSlabGeometry(totalWidth + 0.95, 1.42, 0.08, 0.015, 0.005),
    mats.facadeTrimPlaster,
  );
  backingPanel.position.set(0, -0.21, -0.055);
  backingPanel.castShadow = true;
  backingPanel.receiveShadow = true;
  g.add(backingPanel);

  // Subtle recessed bronze perimeter reveal frame on signage plate
  const frameTrim = new THREE.Mesh(
    new THREE.BoxGeometry(totalWidth + 1.0, 0.04, 0.095),
    mats.darkBronze,
  );
  frameTrim.position.set(0, 1.22, -0.055);
  const frameTrimBot = frameTrim.clone();
  frameTrimBot.position.y = -0.22;
  g.add(frameTrim, frameTrimBot);

  // Controlled warm halo backlighting strip behind letters (off in morning, gentle glow at night)
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0xd8c3a2,
    emissive: new THREE.Color(0xffce84),
    emissiveIntensity: 0.04,
    roughness: 0.6,
  });

  let cursorX = -totalWidth * 0.5;
  specs.forEach(({ shapes, width }) => {
    const faceGeo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.085,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.01,
      bevelSegments: 2,
      curveSegments: 8,
    });
    const letterMesh = new THREE.Mesh(faceGeo, mats.darkBronze);
    letterMesh.position.set(cursorX, 0, -0.005);
    letterMesh.castShadow = true;

    const haloGeo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.018,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 6,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.set(cursorX, 0, -0.022);
    haloMesh.userData.maxEmissiveScale = 0.28;

    g.add(letterMesh, haloMesh);
    emissiveOut.push(haloMesh);
    cursorX += width + gap;
  });

  g.scale.setScalar(scale);
  return g;
}

/**
 * Build an exterior outdoor AC condenser unit with louvered fan grille and wall-mount brackets.
 */
export function buildAcCondenserUnit(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(
    createBevelledSlabGeometry(0.84, 0.58, 0.3, 0.015, 0.006),
    mats.applianceEnamel,
  );
  housing.castShadow = true;
  housing.receiveShadow = true;
  g.add(housing);

  const grille = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.02, 18),
    mats.matteBlackMetal,
  );
  grille.rotation.x = Math.PI / 2;
  grille.position.set(-0.14, 0.29, 0.155);
  g.add(grille);

  for (let i = -2; i <= 2; i++) {
    const louver = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.012, 0.025),
      mats.darkBronze,
    );
    louver.position.set(-0.14, 0.29 + i * 0.075, 0.162);
    g.add(louver);
  }

  const brandBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.04, 0.012),
    mats.darkBronze,
  );
  brandBadge.position.set(0.24, 0.42, 0.155);
  g.add(brandBadge);

  return g;
}

/**
 * Build a poolside teak & linen sun lounger for the NIRMAN rooftop terrace.
 */
export function buildPoolLounger(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();

  const frame = new THREE.Mesh(
    createBevelledSlabGeometry(0.76, 0.07, 1.98, 0.02, 0.008),
    mats.teakExterior,
  );
  frame.position.set(0, 0.24, 0);
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  for (const lx of [-0.32, 0.32]) {
    for (const lz of [-0.82, 0.78]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), mats.teakExterior);
      leg.position.set(lx, 0.12, lz);
      leg.castShadow = true;
      g.add(leg);
    }
  }

  const flatCushion = new THREE.Mesh(
    createCushionGeometry(0.7, 0.08, 1.24, 0.03, 0.015),
    mats.boucleOatmeal,
  );
  flatCushion.position.set(0, 0.31, 0.34);
  flatCushion.castShadow = true;
  g.add(flatCushion);

  const backrest = new THREE.Group();
  backrest.position.set(0, 0.31, -0.32);
  backrest.rotation.x = 0.44;
  const backWood = new THREE.Mesh(
    createBevelledSlabGeometry(0.72, 0.05, 0.64, 0.018, 0.006),
    mats.teakExterior,
  );
  backWood.position.set(0, 0, -0.32);
  const backPad = new THREE.Mesh(
    createCushionGeometry(0.68, 0.08, 0.6, 0.03, 0.015),
    mats.boucleOatmeal,
  );
  backPad.position.set(0, 0.04, -0.32);
  const headrest = new THREE.Mesh(
    createCushionGeometry(0.42, 0.09, 0.18, 0.04, 0.018),
    mats.linenOlive,
  );
  headrest.position.set(0, 0.12, -0.5);
  backrest.add(backWood, backPad, headrest);
  g.add(backrest);

  addContactShadow(g, 0.9, 2.1, mats, 0.012);
  return g;
}
