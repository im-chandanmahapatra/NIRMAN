export type FloorNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const ALL_FLOORS: readonly FloorNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export type ApartmentType = '1BHK' | '2BHK' | '3BHK';
export type ViewMode = 'exterior' | 'dollhouse' | 'floorplan' | 'walkthrough';
export type TourLevel = 'building' | 'floor' | 'apartment' | 'room' | 'rooftop';
export type LightingMode = 'morning' | 'evening' | 'night';
export type FanSpeed = 0 | 1 | 2 | 3;

export type LayoutVariant =
  | '1bhk-center'
  | '1bhk-west'
  | '1bhk-east'
  | '2bhk-east'
  | '3bhk-west'
  | '3bhk-east';

export interface ExteriorPresetSpec {
  id: 'tower-34' | 'entrance-lobby' | 'landscaping' | 'colony-park';
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const EXTERIOR_CAMERA_PRESETS: readonly ExteriorPresetSpec[] = [
  {
    id: 'tower-34',
    label: 'Tower 3/4 Overview',
    position: [37.5, 20.2, -66.5],
    target: [0.0, 12.2, -1.8],
    fov: 38,
  },
  {
    id: 'entrance-lobby',
    label: 'Entrance & Lobby',
    position: [4.8, 2.25, -18.2],
    target: [0.0, 2.1, -6.5],
    fov: 46,
  },
  {
    id: 'landscaping',
    label: 'Gate & Avenue',
    position: [10.8, 3.6, -35.8],
    target: [-1.0, 1.5, -18.5],
    fov: 48,
  },
  {
    id: 'colony-park',
    label: 'Colony Park & Walk',
    position: [31.5, 11.2, -23.5],
    target: [28.0, 2.5, 2.0],
    fov: 46,
  },
];

export interface RooftopPresetSpec {
  id: 'pool-overview' | 'pool-pergola' | 'terrace-panorama';
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const ROOFTOP_CAMERA_PRESETS: readonly RooftopPresetSpec[] = [
  {
    id: 'pool-overview',
    label: 'Pool & Deck',
    position: [-4.6, 38.6, 13.2],
    target: [-11.2, 32.5, 1.5],
    fov: 45,
  },
  {
    id: 'pool-pergola',
    label: 'East Pergola Lounge',
    position: [13.2, 34.4, 5.2],
    target: [7.8, 32.9, 2.4],
    fov: 50,
  },
  {
    id: 'terrace-panorama',
    label: 'Sky Terrace Panorama',
    position: [-15.8, 34.5, 5.4],
    target: [6.8, 32.8, 1.8],
    fov: 52,
  },
];

export const ARCH = {
  TOTAL_FLOORS: 10,
  FLOOR_HEIGHT: 3.2,
  SLAB_THICKNESS: 0.25,
  CEILING_CLEAR_HEIGHT: 2.8,
  EXT_WALL: 0.22,
  INT_WALL: 0.12,
  COUNTER_HEIGHT: 0.9,
  CABINET_DEPTH: 0.6,
  EYE_HEIGHT: 1.6,
  DOOR_HEIGHT: 2.18,
  WINDOW_SILL: 0.85,
  WINDOW_HEAD: 2.45,
  KITCHEN_WINDOW_SILL: 1.05,
  BATH_WINDOW_SILL: 1.5,
  BALCONY_PARAPET: 1.08,
  ROOF_PARAPET: 1.08,
} as const;

export interface Box2D {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export type FloorFinish = 'limestone' | 'oak' | 'bathroomTile' | 'balconyPaver' | 'corridorStone';

export type RoomCategory =
  | 'foyer'
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'hallway'
  | 'puja'
  | 'balcony';

export interface RoomSpec {
  id: string;
  name: string;
  category: RoomCategory;
  bounds: Box2D;
  floorFinish: FloorFinish;
  hasCeilingDrop?: boolean;
  hasFan?: boolean;
  fanCenter?: [number, number];
}

export interface WallOpening {
  id: string;
  kind: 'door' | 'slidingDoor' | 'window' | 'archway';
  /** Distance from start of wall segment to center of opening (metres) */
  offset: number;
  width: number;
  sillHeight: number;
  headHeight: number;
  doorId?: string;
  /** Swing angle in radians when opened (+1 or -1) */
  swingSign?: 1 | -1;
  /** Which side of opening hosts the hinge (0 = start edge, 1 = end edge) */
  hingeAtEnd?: boolean;
  hasCurtain?: boolean;
  curtainId?: string;
}

export interface WallSegmentSpec {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thickness: number;
  isExterior: boolean;
  height?: number;
  openings: WallOpening[];
}

export interface CameraPresetSpec {
  id: string;
  label: string;
  roomId: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export interface BalconySpec {
  id: string;
  name: string;
  bounds: Box2D;
  openEdge: 'south' | 'west' | 'east' | 'north';
}

export interface DerivedApartmentMetrics {
  usableIndoorSqm: number;
  balconySqm: number;
  sharedCirculationSqm: number;
  ceilingHeightM: number;
  roomBreakdown: Array<{ name: string; areaSqm: number; dimensions: string }>;
}

export interface ApartmentSpec {
  id: string;
  floor: FloorNumber;
  type: ApartmentType;
  layoutVariant: LayoutVariant;
  unitNumber: string;
  title: string;
  tagline: string;
  bounds: Box2D;
  entryPoint: [number, number, number];
  entryLookAt: [number, number, number];
  rooms: RoomSpec[];
  balconies: BalconySpec[];
  walls: WallSegmentSpec[];
  cameraPresets: CameraPresetSpec[];
  walkthroughOrder: string[];
  metrics: DerivedApartmentMetrics;
}

export interface BuildingCoreSpec {
  bounds: Box2D;
  lobbyBounds: Box2D;
  corridorBounds: Box2D;
  stairwellBounds: Box2D;
  liftBounds: Box2D;
  serviceShaftBounds: Box2D;
  sharedCirculationPerFloorSqm: number;
}

export const BUILDING_CORE: BuildingCoreSpec = {
  bounds: { xMin: -4.2, xMax: 4.2, zMin: -6.5, zMax: 0.5 },
  lobbyBounds: { xMin: -3.2, xMax: 3.2, zMin: -6.5, zMax: -1.5 },
  corridorBounds: { xMin: -4.2, xMax: 4.2, zMin: -1.5, zMax: 0.5 },
  stairwellBounds: { xMin: -3.1, xMax: -0.6, zMin: -5.2, zMax: -1.7 },
  liftBounds: { xMin: 0.6, xMax: 3.0, zMin: -4.1, zMax: -1.7 },
  serviceShaftBounds: { xMin: -0.6, xMax: 0.6, zMin: -3.2, zMax: -1.7 },
  sharedCirculationPerFloorSqm: 34.4,
};

export function boxArea(b: Box2D): number {
  return Math.max(0, b.xMax - b.xMin) * Math.max(0, b.zMax - b.zMin);
}

export function formatDimensions(b: Box2D): string {
  const w = (b.xMax - b.xMin).toFixed(1);
  const d = (b.zMax - b.zMin).toFixed(1);
  return `${w}m × ${d}m`;
}

export function deriveMetrics(
  rooms: RoomSpec[],
  balconies: BalconySpec[],
  unitShareCount = 2,
  wallAllowanceFactor = 0.955,
): DerivedApartmentMetrics {
  const indoorRooms = rooms.filter((r) => r.category !== 'balcony');
  const rawIndoor = indoorRooms.reduce((sum, r) => sum + boxArea(r.bounds), 0);
  const usableIndoorSqm = Number((rawIndoor * wallAllowanceFactor).toFixed(1));
  const balconySqm = Number(
    balconies.reduce((sum, b) => sum + boxArea(b.bounds), 0).toFixed(1),
  );
  return {
    usableIndoorSqm,
    balconySqm,
    sharedCirculationSqm: Number(
      (BUILDING_CORE.sharedCirculationPerFloorSqm / unitShareCount).toFixed(1),
    ),
    ceilingHeightM: ARCH.CEILING_CLEAR_HEIGHT,
    roomBreakdown: indoorRooms.map((r) => ({
      name: r.name,
      areaSqm: Number((boxArea(r.bounds) * wallAllowanceFactor).toFixed(1)),
      dimensions: formatDimensions(r.bounds),
    })),
  };
}

/**
 * Mirror an apartment layout cleanly across X = 0 for symmetrical East/West wings.
 */
function mirrorApartmentSpecX(
  src: ApartmentSpec,
  nextId: string,
  nextVariant: LayoutVariant,
  unitNumber: string,
  title: string,
  tagline: string,
): ApartmentSpec {
  const mirrorBox = (b: Box2D): Box2D => ({
    xMin: -b.xMax,
    xMax: -b.xMin,
    zMin: b.zMin,
    zMax: b.zMax,
  });

  const rooms: RoomSpec[] = src.rooms.map((r) => ({
    ...r,
    bounds: mirrorBox(r.bounds),
    fanCenter: r.fanCenter ? [-r.fanCenter[0], r.fanCenter[1]] : undefined,
  }));

  const balconies: BalconySpec[] = src.balconies.map((b) => ({
    ...b,
    bounds: mirrorBox(b.bounds),
    openEdge:
      b.openEdge === 'west' ? 'east' : b.openEdge === 'east' ? 'west' : b.openEdge,
  }));

  const walls: WallSegmentSpec[] = src.walls.map((w) => ({
    ...w,
    id: `${nextId}-${w.id}`,
    x1: -w.x1,
    x2: -w.x2,
    openings: w.openings.map((op) => ({
      ...op,
      id: `${nextId}-${op.id}`,
      swingSign: op.swingSign ? ((op.swingSign === 1 ? -1 : 1) as 1 | -1) : undefined,
    })),
  }));

  const cameraPresets: CameraPresetSpec[] = src.cameraPresets.map((p) => ({
    ...p,
    position: [-p.position[0], p.position[1], p.position[2]],
    target: [-p.target[0], p.target[1], p.target[2]],
  }));

  return {
    ...src,
    id: nextId,
    layoutVariant: nextVariant,
    unitNumber,
    title,
    tagline,
    bounds: mirrorBox(src.bounds),
    entryPoint: [-src.entryPoint[0], src.entryPoint[1], src.entryPoint[2]],
    entryLookAt: [-src.entryLookAt[0], src.entryLookAt[1], src.entryLookAt[2]],
    rooms,
    balconies,
    walls,
    cameraPresets,
    metrics: deriveMetrics(rooms, balconies, src.type === '1BHK' ? 3 : 2),
  };
}

// ============================================================================
// 1 BHK CENTER ("ATELIER SUITE") — CENTER BAY (X: -4.2..4.2, Z: 0.5..7.7)
// ============================================================================
function create1BHKCenterTemplate(floor: FloorNumber): ApartmentSpec {
  const y = (floor - 1) * ARCH.FLOOR_HEIGHT;
  const rooms: RoomSpec[] = [
    {
      id: 'foyer',
      name: 'Entry Gallery',
      category: 'foyer',
      bounds: { xMin: -1.4, xMax: 1.2, zMin: 0.5, zMax: 2.6 },
      floorFinish: 'limestone',
    },
    {
      id: 'puja',
      name: 'Puja Niche',
      category: 'puja',
      bounds: { xMin: -1.4, xMax: 0.2, zMin: 2.6, zMax: 3.3 },
      floorFinish: 'limestone',
    },
    {
      id: 'kitchen',
      name: 'Open Kitchen',
      category: 'kitchen',
      bounds: { xMin: -4.2, xMax: -1.4, zMin: 0.5, zMax: 3.3 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
    },
    {
      id: 'living',
      name: 'Living & Dining',
      category: 'living',
      bounds: { xMin: -4.2, xMax: 0.2, zMin: 3.3, zMax: 7.7 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [-2.0, 5.45],
    },
    {
      id: 'primary-bed',
      name: 'Bedroom Suite',
      category: 'bedroom',
      bounds: { xMin: 0.2, xMax: 4.2, zMin: 2.6, zMax: 7.7 },
      floorFinish: 'oak',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [2.2, 5.1],
    },
    {
      id: 'primary-bath',
      name: 'Bathroom',
      category: 'bathroom',
      bounds: { xMin: 1.2, xMax: 4.2, zMin: 0.5, zMax: 2.6 },
      floorFinish: 'bathroomTile',
    },
  ];

  const balconies: BalconySpec[] = [
    {
      id: 'main-balcony',
      name: 'South Balcony & Utility',
      bounds: { xMin: -3.9, xMax: -0.1, zMin: 7.7, zMax: 9.5 },
      openEdge: 'south',
    },
  ];

  const walls: WallSegmentSpec[] = [
    {
      id: '1bhkc-w-north',
      x1: -4.2,
      z1: 0.5,
      x2: 4.2,
      z2: 0.5,
      thickness: ARCH.EXT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-1bhkc-entry',
          kind: 'door',
          offset: 4.2,
          width: 1.0,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'entrance-door',
          swingSign: 1,
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '1bhkc-w-west',
      x1: -4.2,
      z1: 0.5,
      x2: -4.2,
      z2: 7.7,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-1bhkc-west-win',
          kind: 'window',
          offset: 6.45, // Z = 6.95 clear of F1-F3 West wing setback
          width: 1.0,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    {
      id: '1bhkc-w-east',
      x1: 4.2,
      z1: 0.5,
      x2: 4.2,
      z2: 7.7,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-1bhkc-east-win',
          kind: 'window',
          offset: 6.45,
          width: 1.0,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    {
      id: '1bhkc-w-south',
      x1: -4.2,
      z1: 7.7,
      x2: 4.2,
      z2: 7.7,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-1bhkc-balcony-door',
          kind: 'slidingDoor',
          offset: 2.2,
          width: 3.1,
          sillHeight: 0,
          headHeight: ARCH.WINDOW_HEAD,
          doorId: 'balcony-door',
          hasCurtain: true,
          curtainId: 'living-curtains',
        },
        {
          id: 'open-1bhkc-bed-win',
          kind: 'window',
          offset: 6.4,
          width: 2.4,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
          hasCurtain: true,
          curtainId: 'bed1-curtains',
        },
      ],
    },
    {
      id: '1bhkc-w-bed-w',
      x1: 0.2,
      z1: 2.6,
      x2: 0.2,
      z2: 7.7,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-1bhkc-bed-door',
          kind: 'door',
          offset: 0.65,
          width: 0.92,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'bed1-door',
          swingSign: 1,
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '1bhkc-w-bath-s',
      x1: 0.2,
      z1: 2.6,
      x2: 4.2,
      z2: 2.6,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-1bhkc-bath-door',
          kind: 'door',
          offset: 1.5,
          width: 0.82,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'primary-bath-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '1bhkc-w-bath-w',
      x1: 1.2,
      z1: 0.5,
      x2: 1.2,
      z2: 2.6,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
  ];

  const cameraPresets: CameraPresetSpec[] = [
    {
      id: 'arrival',
      label: 'Arrival Foyer',
      roomId: 'foyer',
      position: [-0.15, y + ARCH.EYE_HEIGHT, 0.95],
      target: [-1.85, y + 1.32, 4.5],
      fov: 56,
    },
    {
      id: 'living-balcony',
      label: 'Living → Balcony',
      roomId: 'living',
      position: [-2.1, y + ARCH.EYE_HEIGHT, 3.65],
      target: [-2.0, y + 1.15, 8.2],
      fov: 56,
    },
    {
      id: 'puja-view',
      label: 'Puja Niche',
      roomId: 'puja',
      position: [-1.15, y + ARCH.EYE_HEIGHT, 4.35],
      target: [-0.45, y + 1.2, 2.85],
      fov: 54,
    },
    {
      id: 'kitchen-closeup',
      label: 'Open Kitchen',
      roomId: 'kitchen',
      position: [-1.6, y + ARCH.EYE_HEIGHT, 2.3],
      target: [-3.85, y + 1.05, 1.85],
      fov: 52,
    },
    {
      id: 'primary-bedroom',
      label: 'Bedroom Suite',
      roomId: 'primary-bed',
      position: [1.15, y + ARCH.EYE_HEIGHT, 6.85],
      target: [2.75, y + 1.12, 4.4],
      fov: 56,
    },
    {
      id: 'wardrobe-locker',
      label: 'Wardrobe & Safe',
      roomId: 'primary-bed',
      position: [2.15, y + ARCH.EYE_HEIGHT, 3.55],
      target: [0.65, y + 1.18, 4.75],
      fov: 56,
    },
    {
      id: 'bathroom',
      label: 'Bathroom',
      roomId: 'primary-bath',
      position: [1.7, y + ARCH.EYE_HEIGHT, 2.15],
      target: [3.35, y + 1.1, 1.25],
      fov: 58,
    },
    {
      id: 'balcony',
      label: 'Balcony Vista',
      roomId: 'main-balcony',
      position: [-2.0, y + ARCH.EYE_HEIGHT, 8.15],
      target: [-1.4, y + 0.65, 13.5],
      fov: 62,
    },
  ];

  return {
    id: `F${floor}-1BHK-C`,
    floor,
    type: '1BHK',
    layoutVariant: '1bhk-center',
    unitNumber: `${floor}02`,
    title: `Floor ${floor} · Unit ${floor}02 (1 BHK)`,
    tagline: 'Center Atelier Suite · South Balcony & Puja Niche',
    bounds: { xMin: -4.2, xMax: 4.2, zMin: 0.5, zMax: 7.7 },
    entryPoint: [-0.15, y + ARCH.EYE_HEIGHT, 0.95],
    entryLookAt: [-1.85, y + 1.32, 4.5],
    rooms,
    balconies,
    walls,
    cameraPresets,
    walkthroughOrder: [
      'arrival',
      'living-balcony',
      'puja-view',
      'kitchen-closeup',
      'primary-bedroom',
      'wardrobe-locker',
      'bathroom',
      'balcony',
    ],
    metrics: deriveMetrics(rooms, balconies, 3),
  };
}

// ============================================================================
// 1 BHK WEST ("VERANDAH 1 BHK") — WEST WING (X: -12.0..-4.2, Z: -3.4..4.8)
// ============================================================================
function create1BHKWestTemplate(floor: FloorNumber): ApartmentSpec {
  const y = (floor - 1) * ARCH.FLOOR_HEIGHT;
  const rooms: RoomSpec[] = [
    {
      id: 'foyer',
      name: 'Arrival Foyer',
      category: 'foyer',
      bounds: { xMin: -6.4, xMax: -4.2, zMin: -1.4, zMax: 0.4 },
      floorFinish: 'limestone',
    },
    {
      id: 'puja',
      name: 'Puja Mandir',
      category: 'puja',
      bounds: { xMin: -9.6, xMax: -6.4, zMin: -0.6, zMax: 0.4 },
      floorFinish: 'limestone',
    },
    {
      id: 'kitchen',
      name: 'Fitted Kitchen',
      category: 'kitchen',
      bounds: { xMin: -9.6, xMax: -6.4, zMin: -3.4, zMax: -0.6 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
    },
    {
      id: 'living',
      name: 'Living & Dining',
      category: 'living',
      bounds: { xMin: -8.2, xMax: -4.2, zMin: 0.4, zMax: 4.8 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [-6.2, 2.8],
    },
    {
      id: 'primary-bed',
      name: 'Bedroom Suite',
      category: 'bedroom',
      bounds: { xMin: -12.0, xMax: -8.2, zMin: 0.4, zMax: 4.8 },
      floorFinish: 'oak',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [-10.1, 2.6],
    },
    {
      id: 'primary-bath',
      name: 'Bathroom',
      category: 'bathroom',
      bounds: { xMin: -12.0, xMax: -9.6, zMin: -2.4, zMax: 0.4 },
      floorFinish: 'bathroomTile',
    },
  ];

  const balconies: BalconySpec[] = [
    {
      id: 'main-balcony',
      name: 'South Verandah',
      bounds: { xMin: -8.2, xMax: -4.5, zMin: 4.8, zMax: 6.5 },
      openEdge: 'south',
    },
  ];

  const walls: WallSegmentSpec[] = [
    // Shared Corridor Wall (X = -4.2, Z: -1.4..4.8)
    {
      id: '1bhkw-w-east',
      x1: -4.2,
      z1: -1.4,
      x2: -4.2,
      z2: 4.8,
      thickness: ARCH.EXT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-1bhkw-entry',
          kind: 'door',
          offset: 0.9, // Z = -0.5 into core corridor!
          width: 1.0,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'entrance-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    // Foyer North Exterior Wall (X: -6.4..-4.2, Z = -1.4)
    {
      id: '1bhkw-w-foyer-n',
      x1: -6.4,
      z1: -1.4,
      x2: -4.2,
      z2: -1.4,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [],
    },
    // Step wall Foyer North (-1.4) to Kitchen North (-3.4) at X = -6.4
    {
      id: '1bhkw-w-step-k',
      x1: -6.4,
      z1: -3.4,
      x2: -6.4,
      z2: -1.4,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [],
    },
    // Kitchen North Exterior Wall (X: -9.6..-6.4, Z = -3.4)
    {
      id: '1bhkw-w-kitch-n',
      x1: -9.6,
      z1: -3.4,
      x2: -6.4,
      z2: -3.4,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-1bhkw-kitch-win',
          kind: 'window',
          offset: 1.6,
          width: 1.5,
          sillHeight: ARCH.KITCHEN_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    // Step wall Kitchen North (-3.4) to Bath North (-2.4) at X = -9.6
    {
      id: '1bhkw-w-step-b',
      x1: -9.6,
      z1: -3.4,
      x2: -9.6,
      z2: -2.4,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [],
    },
    // Bath North Exterior Wall (X: -12.0..-9.6, Z = -2.4)
    {
      id: '1bhkw-w-bath-n',
      x1: -12.0,
      z1: -2.4,
      x2: -9.6,
      z2: -2.4,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-1bhkw-bath-win',
          kind: 'window',
          offset: 1.2,
          width: 0.9,
          sillHeight: ARCH.BATH_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    // West Exterior Wall (X = -12.0, Z: -2.4..4.8) — side window placed South of bed headboard (Z=4.05, clear of 1.7..3.6 bed)
    {
      id: '1bhkw-w-west',
      x1: -12.0,
      z1: -2.4,
      x2: -12.0,
      z2: 4.8,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-1bhkw-bed-win-w',
          kind: 'window',
          offset: 6.42, // Z = 4.02 clear of bed headboard!
          width: 0.9,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    // South Exterior Wall (X: -12.0..-4.2, Z = 4.8)
    {
      id: '1bhkw-w-south',
      x1: -12.0,
      z1: 4.8,
      x2: -4.2,
      z2: 4.8,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-1bhkw-bed-win-s',
          kind: 'window',
          offset: 1.9, // X = -10.1
          width: 2.1,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
          hasCurtain: true,
          curtainId: 'bed1-curtains',
        },
        {
          id: 'open-1bhkw-balcony-door',
          kind: 'slidingDoor',
          offset: 5.7, // X = -6.3
          width: 3.1,
          sillHeight: 0,
          headHeight: ARCH.WINDOW_HEAD,
          doorId: 'balcony-door',
          hasCurtain: true,
          curtainId: 'living-curtains',
        },
      ],
    },
    // Bedroom East Partition (X = -8.2, Z: 0.4..4.8)
    {
      id: '1bhkw-w-bed-e',
      x1: -8.2,
      z1: 0.4,
      x2: -8.2,
      z2: 4.8,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-1bhkw-bed-door',
          kind: 'door',
          offset: 0.7, // Z = 1.1
          width: 0.92,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'bed1-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    // Bath South Partition (X: -12.0..-9.6, Z = 0.4)
    {
      id: '1bhkw-w-bath-s',
      x1: -12.0,
      z1: 0.4,
      x2: -9.6,
      z2: 0.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-1bhkw-bath-door',
          kind: 'door',
          offset: 1.25, // X = -10.75
          width: 0.82,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'primary-bath-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    // Bath East Partition (X = -9.6, Z: -2.4..0.4)
    {
      id: '1bhkw-w-bath-e',
      x1: -9.6,
      z1: -2.4,
      x2: -9.6,
      z2: 0.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
  ];

  const cameraPresets: CameraPresetSpec[] = [
    {
      id: 'arrival',
      label: 'Arrival Foyer',
      roomId: 'foyer',
      position: [-4.75, y + ARCH.EYE_HEIGHT, -0.35],
      target: [-6.8, y + 1.2, 2.8],
      fov: 56,
    },
    {
      id: 'living-balcony',
      label: 'Living & Verandah',
      roomId: 'living',
      position: [-6.2, y + ARCH.EYE_HEIGHT, 1.3],
      target: [-6.2, y + 1.12, 5.8],
      fov: 56,
    },
    {
      id: 'puja-view',
      label: 'Puja Mandir',
      roomId: 'puja',
      position: [-5.5, y + ARCH.EYE_HEIGHT, 0.25],
      target: [-7.7, y + 1.2, -0.2],
      fov: 54,
    },
    {
      id: 'kitchen-closeup',
      label: 'Fitted Kitchen',
      roomId: 'kitchen',
      position: [-7.6, y + ARCH.EYE_HEIGHT, -0.8],
      target: [-8.1, y + 1.05, -3.1],
      fov: 52,
    },
    {
      id: 'primary-bedroom',
      label: 'Bedroom Suite',
      roomId: 'primary-bed',
      position: [-8.85, y + ARCH.EYE_HEIGHT, 3.8],
      target: [-11.3, y + 1.12, 2.4],
      fov: 56,
    },
    {
      id: 'wardrobe-locker',
      label: 'Wardrobe & Safe',
      roomId: 'primary-bed',
      position: [-10.8, y + ARCH.EYE_HEIGHT, 2.6],
      target: [-8.5, y + 1.18, 2.9],
      fov: 56,
    },
    {
      id: 'bathroom',
      label: 'Bathroom',
      roomId: 'primary-bath',
      position: [-10.8, y + ARCH.EYE_HEIGHT, -0.35],
      target: [-10.8, y + 1.08, -2.1],
      fov: 58,
    },
    {
      id: 'balcony',
      label: 'Verandah Vista',
      roomId: 'main-balcony',
      position: [-6.3, y + ARCH.EYE_HEIGHT, 5.15],
      target: [-6.8, y + 0.65, 11.2],
      fov: 62,
    },
  ];

  return {
    id: `F${floor}-1BHK-W`,
    floor,
    type: '1BHK',
    layoutVariant: '1bhk-west',
    unitNumber: `${floor}01`,
    title: `Floor ${floor} · Unit ${floor}01 (1 BHK)`,
    tagline: 'West Verandah Suite · Corner Daylight & Puja Mandir',
    bounds: { xMin: -12.0, xMax: -4.2, zMin: -3.4, zMax: 4.8 },
    entryPoint: [-4.75, y + ARCH.EYE_HEIGHT, -0.35],
    entryLookAt: [-6.8, y + 1.2, 2.8],
    rooms,
    balconies,
    walls,
    cameraPresets,
    walkthroughOrder: [
      'arrival',
      'living-balcony',
      'puja-view',
      'kitchen-closeup',
      'primary-bedroom',
      'wardrobe-locker',
      'bathroom',
      'balcony',
    ],
    metrics: deriveMetrics(rooms, balconies, 3),
  };
}

// ============================================================================
// 2 BHK ("THE PAVILION RESIDENCE") — EAST WING (X: 4.2..14.4 + East Terrace 14.4..17.4, Z: -4.5..6.5)
// Structural envelope aligns flush at Z = -4.5 & Z = +6.5 with 3BHK wings!
// ============================================================================
function create2BHKTemplate(floor: FloorNumber): ApartmentSpec {
  const y = (floor - 1) * ARCH.FLOOR_HEIGHT;
  const rooms: RoomSpec[] = [
    {
      id: 'foyer',
      name: 'Arrival Foyer',
      category: 'foyer',
      bounds: { xMin: 4.2, xMax: 6.4, zMin: -1.7, zMax: 0.6 },
      floorFinish: 'limestone',
    },
    {
      id: 'puja',
      name: 'Puja Alcove',
      category: 'puja',
      bounds: { xMin: 4.2, xMax: 6.4, zMin: 0.6, zMax: 2.5 },
      floorFinish: 'limestone',
    },
    {
      id: 'living',
      name: 'Living Room',
      category: 'living',
      bounds: { xMin: 4.2, xMax: 10.0, zMin: 2.5, zMax: 6.5 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [7.2, 4.35],
    },
    {
      id: 'dining',
      name: 'Dining Area',
      category: 'dining',
      bounds: { xMin: 6.4, xMax: 10.0, zMin: 0.4, zMax: 2.5 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
    },
    {
      id: 'kitchen',
      name: 'Fitted Kitchen',
      category: 'kitchen',
      bounds: { xMin: 6.4, xMax: 10.0, zMin: -3.1, zMax: 0.4 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
    },
    {
      id: 'bedroom-hall',
      name: 'Private Hall',
      category: 'hallway',
      bounds: { xMin: 10.0, xMax: 11.1, zMin: -1.2, zMax: 1.7 },
      floorFinish: 'limestone',
    },
    {
      id: 'common-bath',
      name: 'Guest Bath',
      category: 'bathroom',
      bounds: { xMin: 11.1, xMax: 12.75, zMin: -1.2, zMax: 1.7 },
      floorFinish: 'bathroomTile',
    },
    {
      id: 'primary-bath',
      name: 'Primary Bath',
      category: 'bathroom',
      bounds: { xMin: 12.75, xMax: 14.4, zMin: -1.2, zMax: 1.7 },
      floorFinish: 'bathroomTile',
    },
    {
      id: 'secondary-bed',
      name: 'Bedroom 2 / Study',
      category: 'bedroom',
      bounds: { xMin: 10.0, xMax: 14.4, zMin: -4.5, zMax: -1.2 },
      floorFinish: 'oak',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [12.2, -2.85],
    },
    {
      id: 'primary-bed',
      name: 'Primary Bedroom',
      category: 'bedroom',
      bounds: { xMin: 10.0, xMax: 14.4, zMin: 1.7, zMax: 6.5 },
      floorFinish: 'oak',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [12.3, 4.1],
    },
  ];

  const balconies: BalconySpec[] = [
    {
      id: 'main-balcony',
      name: 'South Verandah',
      bounds: { xMin: 4.6, xMax: 9.8, zMin: 6.5, zMax: 8.4 },
      openEdge: 'south',
    },
    {
      id: 'bed-balcony',
      name: 'East Sky Terrace',
      bounds: { xMin: 14.4, xMax: 17.4, zMin: 1.7, zMax: 6.5 },
      openEdge: 'east',
    },
    {
      id: 'utility-balcony',
      name: 'Kitchen Utility',
      bounds: { xMin: 6.4, xMax: 10.0, zMin: -4.5, zMax: -3.1 },
      openEdge: 'north',
    },
  ];

  const walls: WallSegmentSpec[] = [
    {
      id: '2bhk-w-west',
      x1: 4.2,
      z1: -1.7,
      x2: 4.2,
      z2: 6.5,
      thickness: ARCH.EXT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-2bhk-entry',
          kind: 'door',
          offset: 1.2,
          width: 1.02,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'entrance-door',
          swingSign: 1,
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '2bhk-w-foyer-n',
      x1: 4.2,
      z1: -1.7,
      x2: 6.4,
      z2: -1.7,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [],
    },
    {
      id: '2bhk-w-foyer-kitch',
      x1: 6.4,
      z1: -3.1,
      x2: 6.4,
      z2: 0.6,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-2bhk-foyer-arch',
          kind: 'archway',
          offset: 2.75,
          width: 1.65,
          sillHeight: 0,
          headHeight: 2.45,
        },
      ],
    },
    {
      id: '2bhk-w-foyer-s',
      x1: 4.2,
      z1: 0.6,
      x2: 5.5,
      z2: 0.6,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
    {
      id: '2bhk-w-kitch-n',
      x1: 6.4,
      z1: -3.1,
      x2: 10.0,
      z2: -3.1,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-2bhk-utility-door',
          kind: 'door',
          offset: 0.56,
          width: 0.84,
          sillHeight: 0,
          headHeight: 2.28,
          doorId: 'utility-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
        {
          id: 'open-2bhk-kitch-win',
          kind: 'window',
          offset: 2.3,
          width: 1.75,
          sillHeight: ARCH.KITCHEN_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    {
      id: '2bhk-w-bed2-n',
      x1: 10.0,
      z1: -4.5,
      x2: 14.4,
      z2: -4.5,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-2bhk-bed2-win',
          kind: 'window',
          offset: 2.2,
          width: 1.8,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
          hasCurtain: true,
          curtainId: 'bed2-curtains',
        },
      ],
    },
    {
      id: '2bhk-w-kitch-bed2-step',
      x1: 10.0,
      z1: -4.5,
      x2: 10.0,
      z2: -3.1,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [],
    },
    {
      id: '2bhk-w-east',
      x1: 14.4,
      z1: -4.5,
      x2: 14.4,
      z2: 6.5,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-2bhk-bath-win',
          kind: 'window',
          offset: 4.55, // Z = 0.05 in Primary Bath
          width: 0.9,
          sillHeight: ARCH.BATH_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
        {
          id: 'open-2bhk-bed1-terrace-door',
          kind: 'slidingDoor',
          offset: 8.6, // Z = 4.10 opening from Primary Bed onto East Sky Terrace!
          width: 2.4,
          sillHeight: 0,
          headHeight: ARCH.WINDOW_HEAD,
          doorId: 'bed1-balcony-door',
          hasCurtain: true,
          curtainId: 'bed1-curtains',
        },
      ],
    },
    {
      id: '2bhk-w-south',
      x1: 4.2,
      z1: 6.5,
      x2: 14.4,
      z2: 6.5,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-2bhk-balcony-door',
          kind: 'slidingDoor',
          offset: 3.0, // X = 7.2
          width: 3.6,
          sillHeight: 0.0,
          headHeight: ARCH.WINDOW_HEAD,
          doorId: 'balcony-door',
          hasCurtain: true,
          curtainId: 'living-curtains',
        },
        {
          id: 'open-2bhk-bed1-swin',
          kind: 'window',
          offset: 8.0, // X = 12.2
          width: 2.2,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    {
      id: '2bhk-w-spine',
      x1: 10.0,
      z1: -3.1,
      x2: 10.0,
      z2: 6.5,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-2bhk-hall-arch',
          kind: 'archway',
          offset: 3.35, // Z = 0.25 into bedroom-hall
          width: 1.4,
          sillHeight: 0,
          headHeight: 2.4,
        },
      ],
    },
    {
      id: '2bhk-w-bed2-s',
      x1: 10.0,
      z1: -1.2,
      x2: 14.4,
      z2: -1.2,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-2bhk-bed2-door',
          kind: 'door',
          offset: 0.55,
          width: 0.9,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'bed2-door',
          swingSign: 1, // Swings North into Bedroom 2 clear of furniture
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '2bhk-w-bed1-n',
      x1: 10.0,
      z1: 1.7,
      x2: 14.4,
      z2: 1.7,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-2bhk-bed1-door',
          kind: 'door',
          offset: 0.55,
          width: 0.92,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'bed1-door',
          swingSign: -1, // Swings South into Primary Bed clear of wardrobe
          hingeAtEnd: false,
        },
        {
          id: 'open-2bhk-pbath-door',
          kind: 'door',
          offset: 3.92, // X = 13.92 along East wall leaving 2.52m solid headboard wall!
          width: 0.78,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'primary-bath-door',
          swingSign: 1, // Swings North into bath dry corner
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '2bhk-w-bath-w',
      x1: 11.1,
      z1: -1.2,
      x2: 11.1,
      z2: 1.7,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-2bhk-cbath-door',
          kind: 'door',
          offset: 1.45,
          width: 0.82,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'common-bath-door',
          swingSign: 1,
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '2bhk-w-bath-mid',
      x1: 12.75,
      z1: -1.2,
      x2: 12.75,
      z2: 1.7,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
  ];

  const cameraPresets: CameraPresetSpec[] = [
    {
      id: 'arrival',
      label: 'Arrival Foyer',
      roomId: 'foyer',
      position: [4.62, y + ARCH.EYE_HEIGHT, -0.45],
      target: [6.75, y + 1.15, 1.35],
      fov: 58,
    },
    {
      id: 'puja-view',
      label: 'Puja Alcove',
      roomId: 'puja',
      position: [6.15, y + ARCH.EYE_HEIGHT, 1.6],
      target: [4.55, y + 1.15, 1.55],
      fov: 54,
    },
    {
      id: 'living-balcony',
      label: 'Living → Balcony',
      roomId: 'living',
      position: [8.85, y + ARCH.EYE_HEIGHT, 2.85],
      target: [6.5, y + 1.08, 5.45],
      fov: 56,
    },
    {
      id: 'living-kitchen',
      label: 'Dining → Kitchen',
      roomId: 'dining',
      position: [7.6, y + ARCH.EYE_HEIGHT, 5.35],
      target: [8.25, y + 1.15, -1.85],
      fov: 56,
    },
    {
      id: 'kitchen-closeup',
      label: 'Kitchen Counter',
      roomId: 'kitchen',
      position: [8.35, y + ARCH.EYE_HEIGHT, -0.35],
      target: [8.65, y + 1.1, -2.75],
      fov: 56,
    },
    {
      id: 'primary-bedroom',
      label: 'Primary Bedroom',
      roomId: 'primary-bed',
      position: [11.2, y + ARCH.EYE_HEIGHT, 5.55],
      target: [12.35, y + 1.08, 2.7],
      fov: 56,
    },
    {
      id: 'wardrobe-locker',
      label: 'Wardrobe & Mirror',
      roomId: 'primary-bed',
      position: [12.85, y + ARCH.EYE_HEIGHT, 4.75],
      target: [10.3, y + 1.18, 4.15],
      fov: 56,
    },
    {
      id: 'secondary-bedroom',
      label: 'Bedroom 2 / Study',
      roomId: 'secondary-bed',
      position: [11.0, y + ARCH.EYE_HEIGHT, -1.7],
      target: [12.8, y + 1.05, -3.55],
      fov: 56,
    },
    {
      id: 'bathroom',
      label: 'Primary Bath',
      roomId: 'primary-bath',
      position: [13.85, y + ARCH.EYE_HEIGHT, 1.18],
      target: [13.45, y + 1.05, -0.75],
      fov: 58,
    },
    {
      id: 'balcony',
      label: 'East Sky Terrace',
      roomId: 'bed-balcony',
      position: [15.0, y + ARCH.EYE_HEIGHT, 4.1],
      target: [21.5, y + 0.68, 3.6],
      fov: 62,
    },
  ];

  return {
    id: `F${floor}-2BHK-E`,
    floor,
    type: '2BHK',
    layoutVariant: '2bhk-east',
    unitNumber: `${floor}02`,
    title: `Floor ${floor} · Unit ${floor}02 (2 BHK)`,
    tagline: 'East Pavilion Residence · South Verandah & East Sky Terrace',
    bounds: { xMin: 4.2, xMax: 14.4, zMin: -4.5, zMax: 6.5 },
    entryPoint: [4.62, y + ARCH.EYE_HEIGHT, -0.45],
    entryLookAt: [6.75, y + 1.15, 1.35],
    rooms,
    balconies,
    walls,
    cameraPresets,
    walkthroughOrder: [
      'arrival',
      'puja-view',
      'living-balcony',
      'living-kitchen',
      'kitchen-closeup',
      'primary-bedroom',
      'wardrobe-locker',
      'secondary-bedroom',
      'bathroom',
      'balcony',
    ],
    metrics: deriveMetrics(rooms, balconies, 2),
  };
}

// ============================================================================
// 3 BHK ("THE COURTYARD RESIDENCE") — WEST WING (X: -17.4..-4.2, Z: -4.5..6.5)
// Complete sealed partition grid: ZERO uncovered floor pockets, full Master Bath North wall!
// ============================================================================
function create3BHKWestTemplate(floor: FloorNumber): ApartmentSpec {
  const y = (floor - 1) * ARCH.FLOOR_HEIGHT;
  const rooms: RoomSpec[] = [
    {
      id: 'foyer',
      name: 'Arrival Foyer',
      category: 'foyer',
      bounds: { xMin: -6.4, xMax: -4.2, zMin: -1.4, zMax: 0.6 },
      floorFinish: 'limestone',
    },
    {
      id: 'puja',
      name: 'Puja Mandir',
      category: 'puja',
      bounds: { xMin: -5.8, xMax: -4.2, zMin: 0.6, zMax: 2.5 },
      floorFinish: 'limestone',
    },
    {
      id: 'dining',
      name: 'Dining Salon',
      category: 'dining',
      bounds: { xMin: -8.6, xMax: -5.8, zMin: 0.6, zMax: 2.5 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
    },
    {
      id: 'family-lounge',
      name: 'Family Lounge',
      category: 'living',
      bounds: { xMin: -11.4, xMax: -8.6, zMin: 0.6, zMax: 2.5 },
      floorFinish: 'limestone',
    },
    {
      id: 'living',
      name: 'Grand Living',
      category: 'living',
      bounds: { xMin: -11.4, xMax: -4.2, zMin: 2.5, zMax: 6.5 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [-7.9, 4.5],
    },
    {
      id: 'gallery',
      name: 'Bedroom Gallery',
      category: 'hallway',
      bounds: { xMin: -14.8, xMax: -6.4, zMin: -1.4, zMax: 0.6 },
      floorFinish: 'limestone',
    },
    {
      id: 'kitchen',
      name: 'Gourmet Kitchen',
      category: 'kitchen',
      bounds: { xMin: -17.4, xMax: -13.8, zMin: -4.5, zMax: -1.4 },
      floorFinish: 'limestone',
      hasCeilingDrop: true,
    },
    {
      id: 'primary-bed',
      name: 'Master Suite',
      category: 'bedroom',
      bounds: { xMin: -17.4, xMax: -11.4, zMin: 0.6, zMax: 6.5 },
      floorFinish: 'oak',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [-14.4, 3.85],
    },
    {
      id: 'primary-bath',
      name: 'Master Bath',
      category: 'bathroom',
      bounds: { xMin: -17.4, xMax: -14.8, zMin: -1.4, zMax: 0.6 },
      floorFinish: 'bathroomTile',
    },
    {
      id: 'secondary-bed',
      name: 'Bedroom 2',
      category: 'bedroom',
      bounds: { xMin: -13.8, xMax: -10.2, zMin: -4.5, zMax: -1.4 },
      floorFinish: 'oak',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [-12.0, -2.95],
    },
    {
      id: 'attached-bath-2',
      name: 'Bath 2 (Attached)',
      category: 'bathroom',
      bounds: { xMin: -10.2, xMax: -8.6, zMin: -4.5, zMax: -1.4 },
      floorFinish: 'bathroomTile',
    },
    {
      id: 'common-bath',
      name: 'Shared Bath',
      category: 'bathroom',
      bounds: { xMin: -8.6, xMax: -7.1, zMin: -4.5, zMax: -1.4 },
      floorFinish: 'bathroomTile',
    },
    {
      id: 'third-bed',
      name: 'Bedroom 3 / Guest',
      category: 'bedroom',
      bounds: { xMin: -7.1, xMax: -4.2, zMin: -4.5, zMax: -1.4 },
      floorFinish: 'oak',
      hasCeilingDrop: true,
      hasFan: true,
      fanCenter: [-5.65, -2.95],
    },
  ];

  const balconies: BalconySpec[] = [
    {
      id: 'main-balcony',
      name: 'South Verandah',
      bounds: { xMin: -11.1, xMax: -4.6, zMin: 6.5, zMax: 8.4 },
      openEdge: 'south',
    },
    {
      id: 'utility-balcony',
      name: 'Kitchen Utility',
      bounds: { xMin: -18.7, xMax: -17.4, zMin: -4.2, zMax: -1.4 },
      openEdge: 'west',
    },
  ];

  const walls: WallSegmentSpec[] = [
    {
      id: '3bhk-w-east',
      x1: -4.2,
      z1: -4.5,
      x2: -4.2,
      z2: 6.5,
      thickness: ARCH.EXT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-3bhk-entry',
          kind: 'door',
          offset: 4.0, // Z = -0.5
          width: 1.05,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'entrance-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    {
      id: '3bhk-w-west',
      x1: -17.4,
      z1: -4.5,
      x2: -17.4,
      z2: 6.5,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-3bhk-utility-door',
          kind: 'door',
          offset: 1.7, // Z = -2.8
          width: 0.9,
          sillHeight: 0,
          headHeight: 2.35,
          doorId: 'utility-door',
          swingSign: 1,
          hingeAtEnd: false,
        },
        {
          id: 'open-3bhk-bath1-win',
          kind: 'window',
          offset: 4.1, // Z = -0.4 inside Master Bath (-1.4..0.6)
          width: 0.9,
          sillHeight: ARCH.BATH_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    {
      id: '3bhk-w-north',
      x1: -17.4,
      z1: -4.5,
      x2: -4.2,
      z2: -4.5,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-3bhk-kitch-win',
          kind: 'window',
          offset: 1.8, // X = -15.6
          width: 1.7,
          sillHeight: ARCH.KITCHEN_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
        {
          id: 'open-3bhk-bed2-win',
          kind: 'window',
          offset: 5.4, // X = -12.0
          width: 1.8,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
          hasCurtain: true,
          curtainId: 'bed2-curtains',
        },
        {
          id: 'open-3bhk-abath2-win',
          kind: 'window',
          offset: 8.0, // X = -9.4
          width: 0.8,
          sillHeight: ARCH.BATH_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
        {
          id: 'open-3bhk-cbath-win',
          kind: 'window',
          offset: 9.55, // X = -7.85
          width: 0.8,
          sillHeight: ARCH.BATH_WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
        {
          id: 'open-3bhk-bed3-win',
          kind: 'window',
          offset: 11.75, // X = -5.65
          width: 1.8,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
        },
      ],
    },
    {
      id: '3bhk-w-south',
      x1: -17.4,
      z1: 6.5,
      x2: -4.2,
      z2: 6.5,
      thickness: ARCH.EXT_WALL,
      isExterior: true,
      openings: [
        {
          id: 'open-3bhk-master-swin',
          kind: 'window',
          offset: 3.0,
          width: 2.6,
          sillHeight: ARCH.WINDOW_SILL,
          headHeight: ARCH.WINDOW_HEAD,
          hasCurtain: true,
          curtainId: 'bed1-curtains',
        },
        {
          id: 'open-3bhk-balcony-door',
          kind: 'slidingDoor',
          offset: 9.55,
          width: 4.2,
          sillHeight: 0,
          headHeight: ARCH.WINDOW_HEAD,
          doorId: 'balcony-door',
          hasCurtain: true,
          curtainId: 'living-curtains',
        },
      ],
    },
    // Master Bath North Partition (X: -17.4 to -14.8, Z = -1.4) + Kitchen Archway (-14.8 to -13.8)
    {
      id: '3bhk-w-mbath-n',
      x1: -17.4,
      z1: -1.4,
      x2: -13.8,
      z2: -1.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-3bhk-kitch-arch',
          kind: 'archway',
          offset: 3.1, // X = -14.3, width = 1.0 -> -14.8..-13.8 open archway into Kitchen!
          width: 1.0,
          sillHeight: 0,
          headHeight: 2.45,
        },
      ],
    },
    // North Wing South Partition (X: -13.8 to -4.2, Z = -1.4)
    {
      id: '3bhk-w-nwing-s',
      x1: -13.8,
      z1: -1.4,
      x2: -4.2,
      z2: -1.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-3bhk-bed2-door',
          kind: 'door',
          offset: 2.95, // X = -10.85
          width: 0.9,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'bed2-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
        {
          id: 'open-3bhk-cbath-door',
          kind: 'door',
          offset: 5.95, // X = -7.85
          width: 0.8,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'common-bath-door',
          swingSign: 1, // Swings North into Shared Bath clear of shower
          hingeAtEnd: false,
        },
        {
          id: 'open-3bhk-bed3-door',
          kind: 'door',
          offset: 7.45, // X = -6.35
          width: 0.9,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'bed3-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    // Kitchen East Wall (X = -13.8, Z: -4.5..-1.4)
    {
      id: '3bhk-w-kitch-e',
      x1: -13.8,
      z1: -4.5,
      x2: -13.8,
      z2: -1.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
    // Bedroom 2 / Attached Bath 2 Wall (X = -10.2, Z: -4.5..-1.4) with Ensuite Door!
    {
      id: '3bhk-w-bed2-e',
      x1: -10.2,
      z1: -4.5,
      x2: -10.2,
      z2: -1.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-3bhk-abath2-door',
          kind: 'door',
          offset: 2.35, // Z = -2.15 near South end of Bed 2
          width: 0.8,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'attached-bath-2-door',
          swingSign: 1,
          hingeAtEnd: false,
        },
      ],
    },
    // Attached Bath 2 / Common Bath Divider (X = -8.6, Z: -4.5..-1.4)
    {
      id: '3bhk-w-abath-e',
      x1: -8.6,
      z1: -4.5,
      x2: -8.6,
      z2: -1.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
    // Common Bath / Bed 3 Divider (X = -7.1, Z: -4.5..-1.4)
    {
      id: '3bhk-w-bath2-e',
      x1: -7.1,
      z1: -4.5,
      x2: -7.1,
      z2: -1.4,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
    // Master Suite East Wall (X = -11.4, Z: 0.6..6.5)
    {
      id: '3bhk-w-master-e',
      x1: -11.4,
      z1: 0.6,
      x2: -11.4,
      z2: 6.5,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-3bhk-master-door',
          kind: 'door',
          offset: 0.65, // Z = 1.25 clear of wardrobe
          width: 0.95,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'bed1-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    // Master Bath South Wall (X: -17.4..-11.4, Z = 0.6)
    {
      id: '3bhk-w-mbath-s',
      x1: -17.4,
      z1: 0.6,
      x2: -11.4,
      z2: 0.6,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [
        {
          id: 'open-3bhk-mbath-door',
          kind: 'door',
          offset: 2.12, // X = -15.28 near East wall (-14.8), completely clear of SW shower
          width: 0.84,
          sillHeight: 0,
          headHeight: ARCH.DOOR_HEIGHT,
          doorId: 'primary-bath-door',
          swingSign: -1,
          hingeAtEnd: false,
        },
      ],
    },
    // Master Bath East Wall (X = -14.8, Z: -1.4..0.6)
    {
      id: '3bhk-w-mbath-e',
      x1: -14.8,
      z1: -1.4,
      x2: -14.8,
      z2: 0.6,
      thickness: ARCH.INT_WALL,
      isExterior: false,
      openings: [],
    },
  ];

  const cameraPresets: CameraPresetSpec[] = [
    {
      id: 'arrival',
      label: 'Arrival Foyer',
      roomId: 'foyer',
      position: [-5.45, y + ARCH.EYE_HEIGHT, 0.15],
      target: [-8.6, y + 1.18, 2.85],
      fov: 56,
    },
    {
      id: 'puja-view',
      label: 'Puja Mandir',
      roomId: 'puja',
      position: [-6.45, y + ARCH.EYE_HEIGHT, 1.65],
      target: [-4.45, y + 1.18, 1.65],
      fov: 54,
    },
    {
      id: 'living-balcony',
      label: 'Grand Living',
      roomId: 'living',
      position: [-7.8, y + ARCH.EYE_HEIGHT, 1.4],
      target: [-7.8, y + 1.15, 7.0],
      fov: 56,
    },
    {
      id: 'family-lounge',
      label: 'Family Lounge',
      roomId: 'family-lounge',
      position: [-6.9, y + ARCH.EYE_HEIGHT, 2.15],
      target: [-10.3, y + 1.1, 1.3],
      fov: 56,
    },
    {
      id: 'living-kitchen',
      label: 'Gallery → Kitchen',
      roomId: 'gallery',
      position: [-7.6, y + ARCH.EYE_HEIGHT, -0.35],
      target: [-15.2, y + 1.18, -2.5],
      fov: 56,
    },
    {
      id: 'kitchen-closeup',
      label: 'Gourmet Kitchen',
      roomId: 'kitchen',
      position: [-14.2, y + ARCH.EYE_HEIGHT, -1.75],
      target: [-16.6, y + 1.05, -3.65],
      fov: 52,
    },
    {
      id: 'primary-bedroom',
      label: 'Master Suite',
      roomId: 'primary-bed',
      position: [-12.2, y + ARCH.EYE_HEIGHT, 5.7],
      target: [-15.3, y + 1.15, 3.6],
      fov: 56,
    },
    {
      id: 'wardrobe-locker',
      label: 'Wardrobe & Safe',
      roomId: 'primary-bed',
      position: [-13.6, y + ARCH.EYE_HEIGHT, 3.85],
      target: [-12.0, y + 1.18, 2.55],
      fov: 54,
    },
    {
      id: 'secondary-bedroom',
      label: 'Bedroom 2',
      roomId: 'secondary-bed',
      position: [-11.1, y + ARCH.EYE_HEIGHT, -1.85],
      target: [-12.4, y + 1.05, -3.6],
      fov: 56,
    },
    {
      id: 'attached-bath-2',
      label: 'Bath 2 (Attached)',
      roomId: 'attached-bath-2',
      position: [-9.4, y + ARCH.EYE_HEIGHT, -1.9],
      target: [-9.4, y + 1.05, -4.1],
      fov: 58,
    },
    {
      id: 'third-bedroom',
      label: 'Bedroom 3 / Guest',
      roomId: 'third-bed',
      position: [-6.45, y + ARCH.EYE_HEIGHT, -1.85],
      target: [-5.1, y + 1.05, -3.6],
      fov: 56,
    },
    {
      id: 'bathroom',
      label: 'Master Bath',
      roomId: 'primary-bath',
      position: [-15.35, y + ARCH.EYE_HEIGHT, 0.2],
      target: [-16.8, y + 1.1, -0.75],
      fov: 58,
    },
    {
      id: 'balcony',
      label: 'Verandah Vista',
      roomId: 'main-balcony',
      position: [-7.8, y + ARCH.EYE_HEIGHT, 6.9],
      target: [-8.2, y + 0.65, 13.5],
      fov: 62,
    },
  ];

  return {
    id: `F${floor}-3BHK-W`,
    floor,
    type: '3BHK',
    layoutVariant: '3bhk-west',
    unitNumber: `${floor}01`,
    title: `Floor ${floor} · Unit ${floor}01 (3 BHK)`,
    tagline: 'West Courtyard Residence · Puja Mandir & Dual Suites',
    bounds: { xMin: -17.4, xMax: -4.2, zMin: -4.5, zMax: 6.5 },
    entryPoint: [-5.45, y + ARCH.EYE_HEIGHT, 0.15],
    entryLookAt: [-8.6, y + 1.18, 2.85],
    rooms,
    balconies,
    walls,
    cameraPresets,
    walkthroughOrder: [
      'arrival',
      'puja-view',
      'living-balcony',
      'family-lounge',
      'living-kitchen',
      'kitchen-closeup',
      'primary-bedroom',
      'wardrobe-locker',
      'secondary-bedroom',
      'attached-bath-2',
      'third-bedroom',
      'bathroom',
      'balcony',
    ],
    metrics: deriveMetrics(rooms, balconies, 2),
  };
}

// ============================================================================
// NIRMAN FLOOR-BY-FLOOR APARTMENT MATRIX (Floors 1–10)
// - Floors 1, 2, 3: 1 BHK ONLY (3 units per floor: West 1BHK, Center 1BHK, East 1BHK)
// - Floors 4, 5, 8, 10: 2 BHK + 3 BHK MIX (West 3BHK + East 2BHK)
// - Floors 6, 7, 9: 3 BHK ONLY (West 3BHK + East 3BHK)
// ============================================================================
export function getFloorApartmentDistribution(floor: FloorNumber): ApartmentSpec[] {
  if (floor === 1 || floor === 2 || floor === 3) {
    const west = create1BHKWestTemplate(floor);
    const center = create1BHKCenterTemplate(floor);
    const east = mirrorApartmentSpecX(
      west,
      `F${floor}-1BHK-E`,
      '1bhk-east',
      `${floor}03`,
      `Floor ${floor} · Unit ${floor}03 (1 BHK)`,
      'East Verandah Suite · Morning Light & Puja Mandir',
    );
    return [west, center, east];
  }

  if (floor === 4 || floor === 5 || floor === 8 || floor === 10) {
    return [create3BHKWestTemplate(floor), create2BHKTemplate(floor)];
  }

  // Floors 6, 7, 9 -> 3 BHK only
  const west3 = create3BHKWestTemplate(floor);
  const east3 = mirrorApartmentSpecX(
    west3,
    `F${floor}-3BHK-E`,
    '3bhk-east',
    `${floor}02`,
    `Floor ${floor} · Unit ${floor}02 (3 BHK)`,
    'East Courtyard Residence · Puja Mandir & Dual Suites',
  );
  return [west3, east3];
}

export const ALL_APARTMENTS: ApartmentSpec[] = ALL_FLOORS.flatMap((floor) =>
  getFloorApartmentDistribution(floor),
);

export function getApartmentsOnFloor(floor: FloorNumber): ApartmentSpec[] {
  return ALL_APARTMENTS.filter((a) => a.floor === floor);
}

export function getApartmentById(id: string): ApartmentSpec | undefined {
  return ALL_APARTMENTS.find((a) => a.id === id);
}

export function getApartmentSpec(
  floor: FloorNumber,
  typeOrId?: ApartmentType | string,
): ApartmentSpec {
  const onFloor = getApartmentsOnFloor(floor);
  if (typeOrId) {
    const byId = onFloor.find((a) => a.id === typeOrId);
    if (byId) return byId;
    const byType = onFloor.find((a) => a.type === typeOrId);
    if (byType) return byType;
  }
  return onFloor[0] ?? ALL_APARTMENTS[0];
}

// ============================================================================
// URL QUERY PARAMETER PARSER / SERIALIZER + ANGAN RETURN URL VALIDATION
// ============================================================================
export interface ParsedTourUrlState {
  level: TourLevel;
  floor: FloorNumber;
  aptId: string;
  roomId: string | null;
  lighting: LightingMode;
  anganUrl: string | null;
}

export function sanitizeExternalReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function parseTourUrl(search: string, envAnganUrl?: string): ParsedTourUrlState {
  const params = new URLSearchParams(search);
  const rawFloor = Number(params.get('floor'));
  const floor: FloorNumber =
    Number.isInteger(rawFloor) && rawFloor >= 1 && rawFloor <= 10
      ? (rawFloor as FloorNumber)
      : 1;

  const rawView = params.get('view') ?? params.get('mode');
  const rawApt = params.get('apt');
  const rawType = params.get('type');
  const rawRoom = params.get('room');
  const autostart = params.get('autostart') === '1';

  const apt = getApartmentSpec(floor, rawApt ?? rawType ?? undefined);
  const validRoom = rawRoom
    ? apt.rooms.find((r) => r.id === rawRoom)?.id ??
      apt.balconies.find((b) => b.id === rawRoom)?.id ??
      null
    : null;

  let level: TourLevel = 'building';
  if (rawView === 'rooftop') {
    level = 'rooftop';
  } else if (rawView === 'floor') {
    level = 'floor';
  } else if (rawView === 'apartment' || rawView === 'dollhouse' || rawView === 'floorplan') {
    level = 'apartment';
  } else if (rawView === 'room' || rawView === 'walkthrough') {
    level = 'room';
  } else if (rawView === 'building' || rawView === 'exterior') {
    level = 'building';
  } else if (validRoom) {
    level = 'room';
  } else if (rawApt || rawType) {
    level = 'apartment';
  } else if (autostart) {
    level = 'building';
  }

  const rawLight = params.get('light');
  const lighting: LightingMode =
    rawLight === 'evening' || rawLight === 'night' || rawLight === 'morning'
      ? rawLight
      : 'morning';

  const anganFromQuery = sanitizeExternalReturnUrl(params.get('anganUrl'));
  const anganFromEnv = sanitizeExternalReturnUrl(envAnganUrl);

  return {
    level,
    floor,
    aptId: apt.id,
    roomId: validRoom,
    lighting,
    anganUrl: anganFromQuery ?? anganFromEnv,
  };
}

export function serializeTourUrl(state: {
  level: TourLevel;
  floor: FloorNumber;
  aptId: string;
  roomId?: string | null;
  lighting: LightingMode;
  anganUrl?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('view', state.level);
  params.set('floor', String(state.floor));
  if (state.level === 'apartment' || state.level === 'room') {
    params.set('apt', state.aptId);
  }
  if (state.level === 'room' && state.roomId) {
    params.set('room', state.roomId);
  }
  if (state.lighting !== 'morning') {
    params.set('light', state.lighting);
  }
  if (state.anganUrl) {
    params.set('anganUrl', state.anganUrl);
  }
  return `?${params.toString()}`;
}
