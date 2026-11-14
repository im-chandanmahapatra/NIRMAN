import test from 'node:test';
import assert from 'node:assert/strict';
import { getApartmentSpec } from '../architecture/buildingData';
import {
  buildWallColliders,
  findRoomAtPosition,
  resolvePlayerMovement,
} from './collision';

test('closed doors block walkthrough movement while open doors allow passage', () => {
  const apt = getApartmentSpec(4, '2BHK');
  const colliders = buildWallColliders(apt);

  // Primary bedroom door is on Z = 1.7 around X = 11.05
  const startX = 11.05;
  const startZ = 1.25;
  const targetZ = 2.15;

  const blocked = resolvePlayerMovement(
    startX,
    startZ,
    startX,
    targetZ,
    0.26,
    colliders,
    { 'bed1-door': false },
  );
  assert.ok(
    blocked.z < 1.65,
    `Closed door should block movement, got z=${blocked.z}`,
  );

  const allowed = resolvePlayerMovement(
    startX,
    startZ,
    startX,
    targetZ,
    0.26,
    colliders,
    { 'bed1-door': true },
  );
  assert.ok(
    allowed.z > 2.0,
    `Open door should allow movement, got z=${allowed.z}`,
  );
});

test('walls prevent walking outside perimeter and room detection resolves accurately', () => {
  const apt = getApartmentSpec(4, '2BHK');
  const colliders = buildWallColliders(apt);

  // Attempt to walk through East exterior wall at X = 14.4
  const pushed = resolvePlayerMovement(
    13.9,
    3.5,
    14.8,
    3.5,
    0.26,
    colliders,
    {},
  );
  assert.ok(pushed.x <= 14.15, `Should stay inside east wall, got ${pushed.x}`);

  assert.equal(findRoomAtPosition(7.5, 4.0, apt).id, 'living');
  assert.equal(findRoomAtPosition(8.4, -1.5, apt).id, 'kitchen');
  assert.equal(findRoomAtPosition(7.2, 7.2, apt).id, 'main-balcony');
  assert.equal(findRoomAtPosition(7.2, -3.8, apt).id, 'utility-balcony');
});

test('Floor 8 2BHK utility doorway allows passage when open and blocks when closed', () => {
  const apt = getApartmentSpec(8, '2BHK');
  const colliders = buildWallColliders(apt);
  const blocked = resolvePlayerMovement(6.96, -2.65, 6.96, -3.55, 0.24, colliders, {
    'utility-door': false,
  });
  assert.ok(blocked.z > -3.0, `Closed utility door should block passage, got ${blocked.z}`);

  const allowed = resolvePlayerMovement(6.96, -2.65, 6.96, -3.55, 0.24, colliders, {
    'utility-door': true,
  });
  assert.ok(allowed.z < -3.45, `Open utility door should allow passage, got ${allowed.z}`);
});

test('3BHK West attached-bath-2-door blocks when closed and allows passage when open', () => {
  const apt = getApartmentSpec(6, 'F6-3BHK-W');
  const colliders = buildWallColliders(apt);

  const blocked = resolvePlayerMovement(-10.65, -2.15, -9.75, -2.15, 0.24, colliders, {
    'attached-bath-2-door': false,
  });
  assert.ok(blocked.x < -10.2, `Closed attached-bath-2-door should block, got x=${blocked.x}`);

  const allowed = resolvePlayerMovement(-10.65, -2.15, -9.75, -2.15, 0.24, colliders, {
    'attached-bath-2-door': true,
  });
  assert.ok(allowed.x > -9.9, `Open attached-bath-2-door should allow passage, got x=${allowed.x}`);
});

test('Mirrored 3BHK East utility balcony east railing blocks walking off deck', () => {
  const apt = getApartmentSpec(6, 'F6-3BHK-E');
  assert.equal(apt.layoutVariant, '3bhk-east');
  const utilBal = apt.balconies.find((b) => b.id === 'utility-balcony');
  assert.ok(utilBal);
  assert.equal(utilBal.openEdge, 'east');

  const colliders = buildWallColliders(apt);
  const clamped = resolvePlayerMovement(18.0, -2.8, 19.3, -2.8, 0.24, colliders, {});
  assert.ok(clamped.x <= 18.55, `East balcony railing should clamp movement, got x=${clamped.x}`);
});

test('Mirrored 1BHK East bedroom doorway blocks when closed and allows passage when open', () => {
  const apt = getApartmentSpec(2, 'F2-1BHK-E');
  assert.equal(apt.layoutVariant, '1bhk-east');
  const colliders = buildWallColliders(apt);

  // Mirrored bedroom partition sits at X = +8.2 with doorway centered at Z = 1.1
  const blocked = resolvePlayerMovement(7.75, 1.1, 8.65, 1.1, 0.24, colliders, {
    'bed1-door': false,
  });
  assert.ok(blocked.x < 8.15, `Closed mirrored 1BHK bed1-door should block, got x=${blocked.x}`);

  const allowed = resolvePlayerMovement(7.75, 1.1, 8.65, 1.1, 0.24, colliders, {
    'bed1-door': true,
  });
  assert.ok(allowed.x > 8.45, `Open mirrored 1BHK bed1-door should allow passage, got x=${allowed.x}`);
});
