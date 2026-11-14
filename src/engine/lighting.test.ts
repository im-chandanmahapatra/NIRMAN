import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createInterpolatedLightingState,
  getSolarPosition,
  lerpLightingState,
  LIGHTING_PRESETS,
} from './lighting';

test('morning, evening, and night presets provide distinct atmospheres and solar arcs', () => {
  const { morning, evening, night } = LIGHTING_PRESETS;

  assert.ok(morning.sunIntensity > evening.sunIntensity);
  assert.ok(evening.sunIntensity > night.sunIntensity);

  // Evening sun sits low near horizon; morning sun sits crisper; night falls below bright daylight
  assert.ok(evening.sunElevationDeg < 18);
  assert.ok(morning.sunElevationDeg > 24);

  // Night lowers ambient & sky environment drastically and drives exterior lights high
  assert.ok(night.hemiIntensity < morning.hemiIntensity * 0.35);
  assert.ok(night.envIntensity < 0.2);
  assert.ok(night.exteriorLightIntensity > evening.exteriorLightIntensity);
  assert.equal(morning.exteriorLightIntensity, 0);

  // Selective window glow only illuminates in evening/night
  assert.equal(morning.winGlowEmissive, 0);
  assert.ok(night.winGlowEmissive > evening.winGlowEmissive);
});

test('lerpLightingState transitions smoothly and endpoints match exact presets', () => {
  const out = createInterpolatedLightingState(LIGHTING_PRESETS.morning);

  lerpLightingState(LIGHTING_PRESETS.morning, LIGHTING_PRESETS.night, 0, out);
  assert.ok(Math.abs(out.sunIntensity - LIGHTING_PRESETS.morning.sunIntensity) < 1e-5);
  assert.ok(Math.abs(out.envIntensity - LIGHTING_PRESETS.morning.envIntensity) < 1e-5);

  lerpLightingState(LIGHTING_PRESETS.morning, LIGHTING_PRESETS.night, 0.5, out);
  assert.ok(out.sunIntensity < LIGHTING_PRESETS.morning.sunIntensity);
  assert.ok(out.sunIntensity > LIGHTING_PRESETS.night.sunIntensity);
  assert.ok(out.exteriorLightIntensity > 0);
  assert.ok(out.exteriorLightIntensity < LIGHTING_PRESETS.night.exteriorLightIntensity);

  lerpLightingState(LIGHTING_PRESETS.morning, LIGHTING_PRESETS.night, 1, out);
  assert.ok(Math.abs(out.sunIntensity - LIGHTING_PRESETS.night.sunIntensity) < 1e-5);
  assert.ok(Math.abs(out.winGlowEmissive - LIGHTING_PRESETS.night.winGlowEmissive) < 1e-5);
});

test('getSolarPosition places sun above horizon when elevation > 0', () => {
  const pos = new THREE.Vector3();
  getSolarPosition(30, 45, 50, pos);
  assert.ok(pos.y > 24 && pos.y < 26);
  assert.ok(Math.abs(pos.length() - 50) < 1e-4);
});
