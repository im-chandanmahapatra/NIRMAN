import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_APARTMENTS,
  ALL_FLOORS,
  ARCH,
  Box2D,
  getApartmentsOnFloor,
  getApartmentSpec,
  parseTourUrl,
  ROOFTOP_CAMERA_PRESETS,
  serializeTourUrl,
} from './buildingData';

function overlapArea(a: Box2D, b: Box2D): number {
  const ox = Math.max(0, Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin));
  const oz = Math.max(0, Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin));
  return ox * oz;
}

test('NIRMAN has 10 floors with exact unit type distribution per floor', () => {
  assert.equal(ARCH.TOTAL_FLOORS, 10);
  assert.equal(ALL_FLOORS.length, 10);

  // Floors 1, 2, 3: 1 BHK only
  for (const f of [1, 2, 3] as const) {
    const units = getApartmentsOnFloor(f);
    assert.equal(units.length, 3);
    assert.ok(units.every((u) => u.type === '1BHK'), `Floor ${f} must contain only 1BHK`);
  }

  // Floors 4, 5, 8, 10: 2 BHK + 3 BHK mix
  for (const f of [4, 5, 8, 10] as const) {
    const units = getApartmentsOnFloor(f);
    assert.equal(units.length, 2);
    assert.ok(units.some((u) => u.type === '2BHK'), `Floor ${f} missing 2BHK`);
    assert.ok(units.some((u) => u.type === '3BHK'), `Floor ${f} missing 3BHK`);
    assert.ok(!units.some((u) => u.type === '1BHK'), `Floor ${f} must not contain 1BHK`);
  }

  // Floors 6, 7, 9: 3 BHK only
  for (const f of [6, 7, 9] as const) {
    const units = getApartmentsOnFloor(f);
    assert.equal(units.length, 2);
    assert.ok(units.every((u) => u.type === '3BHK'), `Floor ${f} must contain only 3BHK`);
  }

  // Distinct IDs & unit numbers across all apartments
  const ids = new Set(ALL_APARTMENTS.map((a) => a.id));
  const unitNumbers = new Set(ALL_APARTMENTS.map((a) => a.unitNumber));
  assert.equal(ids.size, ALL_APARTMENTS.length);
  assert.equal(unitNumbers.size, ALL_APARTMENTS.length);
});

test('every apartment has Indian Puja space and 3BHK has two attached baths + family lounge', () => {
  for (const apt of ALL_APARTMENTS) {
    assert.ok(
      apt.rooms.some((r) => r.category === 'puja'),
      `${apt.id} missing Puja space`,
    );
    if (apt.type === '3BHK') {
      assert.ok(apt.rooms.some((r) => r.id === 'primary-bath'), `${apt.id} missing primary-bath`);
      assert.ok(
        apt.rooms.some((r) => r.id === 'attached-bath-2'),
        `${apt.id} missing attached-bath-2`,
      );
      assert.ok(
        apt.rooms.some((r) => r.id === 'family-lounge'),
        `${apt.id} missing family-lounge`,
      );
    }
  }
});

test('derived indoor areas match realistic 1/2/3 BHK footprints', () => {
  const oneC = getApartmentSpec(2, 'F2-1BHK-C');
  const oneW = getApartmentSpec(2, 'F2-1BHK-W');
  const twoE = getApartmentSpec(4, 'F4-2BHK-E');
  const threeW = getApartmentSpec(6, 'F6-3BHK-W');
  const threeE = getApartmentSpec(6, 'F6-3BHK-E');

  assert.ok(oneC.metrics.usableIndoorSqm >= 54 && oneC.metrics.usableIndoorSqm <= 66);
  assert.ok(oneW.metrics.usableIndoorSqm >= 54 && oneW.metrics.usableIndoorSqm <= 68);
  assert.ok(twoE.metrics.usableIndoorSqm >= 90 && twoE.metrics.usableIndoorSqm <= 104);
  assert.ok(threeW.metrics.usableIndoorSqm >= 125 && threeW.metrics.usableIndoorSqm <= 142);
  assert.equal(threeE.metrics.usableIndoorSqm, threeW.metrics.usableIndoorSqm);
});

test('rooms within every apartment do not overlap each other', () => {
  for (const apt of ALL_APARTMENTS) {
    for (let i = 0; i < apt.rooms.length; i++) {
      for (let j = i + 1; j < apt.rooms.length; j++) {
        const area = overlapArea(apt.rooms[i].bounds, apt.rooms[j].bounds);
        assert.ok(
          area < 0.01,
          `${apt.id}: ${apt.rooms[i].id} overlaps ${apt.rooms[j].id} by ${area.toFixed(3)} sqm`,
        );
      }
    }
  }
});

test('camera presets, rooftop presets, and URL state round-trip cleanly', () => {
  assert.ok(ROOFTOP_CAMERA_PRESETS.length >= 3);

  for (const apt of ALL_APARTMENTS) {
    const expectedFloorY = (apt.floor - 1) * ARCH.FLOOR_HEIGHT;
    assert.ok(
      Math.abs(apt.entryPoint[1] - (expectedFloorY + ARCH.EYE_HEIGHT)) < 0.05,
    );
    assert.ok(apt.cameraPresets.length >= 8);
    for (const presetId of apt.walkthroughOrder) {
      assert.ok(
        apt.cameraPresets.some((p) => p.id === presetId),
        `Missing preset ${presetId} in ${apt.id}`,
      );
    }
  }

  const parsedDefault = parseTourUrl('');
  assert.equal(parsedDefault.level, 'building');
  assert.equal(parsedDefault.anganUrl, null);

  const parsedDeep = parseTourUrl(
    '?view=room&floor=4&apt=F4-3BHK-W&room=primary-bed&light=evening&anganUrl=https://angan.example.com',
  );
  assert.equal(parsedDeep.level, 'room');
  assert.equal(parsedDeep.floor, 4);
  assert.equal(parsedDeep.aptId, 'F4-3BHK-W');
  assert.equal(parsedDeep.roomId, 'primary-bed');
  assert.equal(parsedDeep.lighting, 'evening');
  assert.equal(parsedDeep.anganUrl, 'https://angan.example.com/');

  const badAngan = parseTourUrl('?anganUrl=javascript:alert(1)');
  assert.equal(badAngan.anganUrl, null);

  const serialized = serializeTourUrl({
    level: 'apartment',
    floor: 8,
    aptId: 'F8-2BHK-E',
    lighting: 'night',
  });
  const roundTripped = parseTourUrl(serialized);
  assert.equal(roundTripped.level, 'apartment');
  assert.equal(roundTripped.floor, 8);
  assert.equal(roundTripped.aptId, 'F8-2BHK-E');
  assert.equal(roundTripped.lighting, 'night');
});

test('all wall openings fit inside walls with unified window head height datum', () => {
  for (const apt of ALL_APARTMENTS) {
    for (const wall of apt.walls) {
      const len = Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
      for (const op of wall.openings) {
        assert.ok(
          op.offset - op.width * 0.5 >= -0.001 && op.offset + op.width * 0.5 <= len + 0.001,
          `${apt.id} ${wall.id} opening ${op.id} exceeds wall length ${len.toFixed(2)}`,
        );
        if (op.kind === 'window') {
          assert.equal(
            op.headHeight,
            ARCH.WINDOW_HEAD,
            `${apt.id} ${op.id} headHeight ${op.headHeight} must match ${ARCH.WINDOW_HEAD}`,
          );
        }
      }
    }
  }
});
