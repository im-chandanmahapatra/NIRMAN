import { ApartmentSpec, Box2D, WallSegmentSpec } from '../architecture/buildingData';

export interface ColliderBox extends Box2D {
  id: string;
  doorId?: string;
}

/**
 * Derive static wall + closed-door colliders directly from an apartment's
 * parametric wall openings so physical navigation matches rendered openings.
 */
export function buildWallColliders(apartment: ApartmentSpec): ColliderBox[] {
  const colliders: ColliderBox[] = [];

  for (const wall of apartment.walls) {
    const dx = wall.x2 - wall.x1;
    const dz = wall.z2 - wall.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;

    const halfT = wall.thickness * 0.5;
    const isHorizontal = Math.abs(dx) >= Math.abs(dz);
    const sorted = [...wall.openings].sort((a, b) => a.offset - b.offset);

    let cursor = 0;
    for (const op of sorted) {
      const start = Math.max(0, op.offset - op.width * 0.5);
      const end = Math.min(len, op.offset + op.width * 0.5);

      if (start - cursor > 0.04) {
        colliders.push(
          segmentSliceToBox(
            `${wall.id}-s-${cursor.toFixed(2)}`,
            wall,
            cursor,
            start,
            halfT,
            isHorizontal,
          ),
        );
      }

      // Windows with sill >= 0.45 always block walking; doors block only when closed
      if (op.kind === 'window') {
        colliders.push(
          segmentSliceToBox(`${wall.id}-w-${op.id}`, wall, start, end, halfT, isHorizontal),
        );
      } else if (op.doorId) {
        colliders.push({
          ...segmentSliceToBox(`${wall.id}-d-${op.id}`, wall, start, end, halfT, isHorizontal),
          doorId: op.doorId,
        });
      }
      cursor = Math.max(cursor, end);
    }

    if (len - cursor > 0.04) {
      colliders.push(
        segmentSliceToBox(
          `${wall.id}-s-${cursor.toFixed(2)}`,
          wall,
          cursor,
          len,
          halfT,
          isHorizontal,
        ),
      );
    }
  }

  // Balcony outer railings block stepping off the edge
  for (const bal of apartment.balconies) {
    const { xMin, xMax, zMin, zMax } = bal.bounds;
    if (bal.openEdge === 'south') {
      colliders.push({
        id: `${bal.id}-rail-s`,
        xMin,
        xMax,
        zMin: zMax - 0.14,
        zMax: zMax + 0.14,
      });
      colliders.push({
        id: `${bal.id}-rail-w`,
        xMin: xMin - 0.1,
        xMax: xMin + 0.1,
        zMin,
        zMax,
      });
      colliders.push({
        id: `${bal.id}-rail-e`,
        xMin: xMax - 0.1,
        xMax: xMax + 0.1,
        zMin,
        zMax,
      });
    } else if (bal.openEdge === 'west') {
      colliders.push({
        id: `${bal.id}-rail-w`,
        xMin: xMin - 0.14,
        xMax: xMin + 0.14,
        zMin,
        zMax,
      });
      colliders.push({
        id: `${bal.id}-rail-n`,
        xMin,
        xMax,
        zMin: zMin - 0.1,
        zMax: zMin + 0.1,
      });
      colliders.push({
        id: `${bal.id}-rail-s`,
        xMin,
        xMax,
        zMin: zMax - 0.1,
        zMax: zMax + 0.1,
      });
    } else if (bal.openEdge === 'east') {
      colliders.push({
        id: `${bal.id}-rail-e`,
        xMin: xMax - 0.14,
        xMax: xMax + 0.14,
        zMin,
        zMax,
      });
      colliders.push({
        id: `${bal.id}-rail-n`,
        xMin,
        xMax,
        zMin: zMin - 0.1,
        zMax: zMin + 0.1,
      });
      colliders.push({
        id: `${bal.id}-rail-s`,
        xMin,
        xMax,
        zMin: zMax - 0.1,
        zMax: zMax + 0.1,
      });
    }
  }

  return colliders;
}

function segmentSliceToBox(
  id: string,
  wall: WallSegmentSpec,
  d0: number,
  d1: number,
  halfT: number,
  isHorizontal: boolean,
): ColliderBox {
  const len = Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
  const t0 = d0 / len;
  const t1 = d1 / len;
  const ax = wall.x1 + (wall.x2 - wall.x1) * t0;
  const az = wall.z1 + (wall.z2 - wall.z1) * t0;
  const bx = wall.x1 + (wall.x2 - wall.x1) * t1;
  const bz = wall.z1 + (wall.z2 - wall.z1) * t1;

  if (isHorizontal) {
    return {
      id,
      xMin: Math.min(ax, bx),
      xMax: Math.max(ax, bx),
      zMin: Math.min(az, bz) - halfT,
      zMax: Math.max(az, bz) + halfT,
    };
  }
  return {
    id,
    xMin: Math.min(ax, bx) - halfT,
    xMax: Math.max(ax, bx) + halfT,
    zMin: Math.min(az, bz),
    zMax: Math.max(az, bz),
  };
}

export function resolvePlayerMovement(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  radius: number,
  colliders: ColliderBox[],
  openDoors: Record<string, boolean>,
): { x: number; z: number } {
  const totalDist = Math.hypot(targetX - currentX, targetZ - currentZ);
  const subSteps = Math.max(1, Math.ceil(totalDist / 0.08));
  let x = currentX;
  let z = currentZ;
  const stepX = (targetX - currentX) / subSteps;
  const stepZ = (targetZ - currentZ) / subSteps;

  for (let s = 0; s < subSteps; s++) {
    x += stepX;
    z += stepZ;

    // Two-pass circle-vs-AABB push-out per sub-step (preserves smooth wall sliding)
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        if (c.doorId && openDoors[c.doorId]) continue;

        const closestX = Math.max(c.xMin, Math.min(x, c.xMax));
        const closestZ = Math.max(c.zMin, Math.min(z, c.zMax));
        const dx = x - closestX;
        const dz = z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 1e-5) {
            const push = radius - dist;
            x += (dx / dist) * push;
            z += (dz / dist) * push;
          } else {
            const leftPen = x - c.xMin;
            const rightPen = c.xMax - x;
            const topPen = z - c.zMin;
            const botPen = c.zMax - z;
            const minPen = Math.min(leftPen, rightPen, topPen, botPen);
            if (minPen === leftPen) x = c.xMin - radius;
            else if (minPen === rightPen) x = c.xMax + radius;
            else if (minPen === topPen) z = c.zMin - radius;
            else z = c.zMax + radius;
          }
        }
      }
    }
  }

  return { x, z };
}

export function findRoomAtPosition(
  x: number,
  z: number,
  apartment: ApartmentSpec,
): { id: string; name: string } {
  for (const b of apartment.balconies) {
    if (
      x >= b.bounds.xMin &&
      x <= b.bounds.xMax &&
      z >= b.bounds.zMin &&
      z <= b.bounds.zMax
    ) {
      return { id: b.id, name: b.name };
    }
  }
  for (const r of apartment.rooms) {
    if (
      x >= r.bounds.xMin &&
      x <= r.bounds.xMax &&
      z >= r.bounds.zMin &&
      z <= r.bounds.zMax
    ) {
      return { id: r.id, name: r.name };
    }
  }
  return { id: 'interior', name: apartment.title };
}
