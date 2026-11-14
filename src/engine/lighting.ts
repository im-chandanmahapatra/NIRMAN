import * as THREE from 'three';
import { LightingMode } from '../architecture/buildingData';

export interface LightingPreset {
  mode: LightingMode;
  skyZenithHex: number;
  skyHorizonHex: number;
  skyGroundHex: number;
  sunGlowHex: number;
  fogHex: number;
  fogNear: number;
  fogFar: number;
  sunHex: number;
  sunIntensity: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  bounceHex: number;
  bounceIntensity: number;
  envIntensity: number;
  exposure: number;
  roomPointIntensity: number;
  lampPointIntensity: number;
  roomEmissive: number;
  lampEmissive: number;
  underCabinetEmissive: number;
  exteriorLightIntensity: number;
  exteriorFixtureEmissive: number;
  winGlowEmissive: number;
  lobbyEmissive: number;
  glassTintHex: number;
  glassOpacity: number;
  glassReflectivity: number;
  glassEnvIntensity: number;
}

export const LIGHTING_PRESETS: Record<LightingMode, LightingPreset> = {
  morning: {
    mode: 'morning',
    skyZenithHex: 0x6c94bd,
    skyHorizonHex: 0xe2d9ca,
    skyGroundHex: 0xbdb3a3,
    sunGlowHex: 0xffeccf,
    fogHex: 0xded6c8,
    fogNear: 105,
    fogFar: 285,
    sunHex: 0xffe4bc,
    sunIntensity: 1.98,
    sunElevationDeg: 34,
    sunAzimuthDeg: 44,
    hemiSkyHex: 0xc2d8ee,
    hemiGroundHex: 0x7c6c56,
    hemiIntensity: 0.38,
    bounceHex: 0xefe0ca,
    bounceIntensity: 0.22,
    envIntensity: 0.42,
    exposure: 0.96,
    roomPointIntensity: 0.3,
    lampPointIntensity: 0.2,
    roomEmissive: 0.25,
    lampEmissive: 0.3,
    underCabinetEmissive: 0.45,
    exteriorLightIntensity: 0.0,
    exteriorFixtureEmissive: 0.14,
    winGlowEmissive: 0.0,
    lobbyEmissive: 0.35,
    glassTintHex: 0x9eb2b9,
    glassOpacity: 0.3,
    glassReflectivity: 0.44,
    glassEnvIntensity: 0.28,
  },
  evening: {
    mode: 'evening',
    skyZenithHex: 0x3b4e70,
    skyHorizonHex: 0xd89b6e,
    skyGroundHex: 0x625648,
    sunGlowHex: 0xffb36b,
    fogHex: 0xb08a72,
    fogNear: 95,
    fogFar: 270,
    sunHex: 0xffb168,
    sunIntensity: 1.65,
    sunElevationDeg: 13,
    sunAzimuthDeg: -52,
    hemiSkyHex: 0x7686a6,
    hemiGroundHex: 0x5c4635,
    hemiIntensity: 0.34,
    bounceHex: 0xdca97e,
    bounceIntensity: 0.24,
    envIntensity: 0.34,
    exposure: 0.98,
    roomPointIntensity: 2.35,
    lampPointIntensity: 1.45,
    roomEmissive: 1.35,
    lampEmissive: 1.45,
    underCabinetEmissive: 1.25,
    exteriorLightIntensity: 1.8,
    exteriorFixtureEmissive: 1.5,
    winGlowEmissive: 0.92,
    lobbyEmissive: 1.35,
    glassTintHex: 0xa4acb8,
    glassOpacity: 0.36,
    glassReflectivity: 0.52,
    glassEnvIntensity: 0.34,
  },
  night: {
    mode: 'night',
    skyZenithHex: 0x101c2e,
    skyHorizonHex: 0x203048,
    skyGroundHex: 0x131924,
    sunGlowHex: 0x3e5478,
    fogHex: 0x1d2b40,
    fogNear: 95,
    fogFar: 255,
    sunHex: 0x7f9dc9,
    sunIntensity: 0.34,
    sunElevationDeg: 44,
    sunAzimuthDeg: -38,
    hemiSkyHex: 0x2a3c59,
    hemiGroundHex: 0x18130f,
    hemiIntensity: 0.16,
    bounceHex: 0x2f4361,
    bounceIntensity: 0.08,
    envIntensity: 0.16,
    exposure: 1.0,
    roomPointIntensity: 3.65,
    lampPointIntensity: 2.15,
    roomEmissive: 1.95,
    lampEmissive: 2.05,
    underCabinetEmissive: 1.75,
    exteriorLightIntensity: 2.85,
    exteriorFixtureEmissive: 2.1,
    winGlowEmissive: 1.35,
    lobbyEmissive: 1.85,
    glassTintHex: 0x222e3a,
    glassOpacity: 0.34,
    glassReflectivity: 0.54,
    glassEnvIntensity: 0.24,
  },
};

export interface InterpolatedLightingState {
  skyZenith: THREE.Color;
  skyHorizon: THREE.Color;
  skyGround: THREE.Color;
  sunGlow: THREE.Color;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  sun: THREE.Color;
  sunIntensity: number;
  sunPosition: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  bounce: THREE.Color;
  bounceIntensity: number;
  envIntensity: number;
  exposure: number;
  roomPointIntensity: number;
  lampPointIntensity: number;
  roomEmissive: number;
  lampEmissive: number;
  underCabinetEmissive: number;
  exteriorLightIntensity: number;
  exteriorFixtureEmissive: number;
  winGlowEmissive: number;
  lobbyEmissive: number;
  glassTint: THREE.Color;
  glassOpacity: number;
  glassReflectivity: number;
  glassEnvIntensity: number;
}

export function getSolarPosition(
  elevationDeg: number,
  azimuthDeg: number,
  radius = 64,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const cosEl = Math.cos(el);
  target.set(
    Math.sin(az) * cosEl * radius,
    Math.sin(el) * radius,
    -Math.cos(az) * cosEl * radius,
  );
  return target;
}

export function createInterpolatedLightingState(
  preset: LightingPreset,
): InterpolatedLightingState {
  return {
    skyZenith: new THREE.Color(preset.skyZenithHex),
    skyHorizon: new THREE.Color(preset.skyHorizonHex),
    skyGround: new THREE.Color(preset.skyGroundHex),
    sunGlow: new THREE.Color(preset.sunGlowHex),
    fog: new THREE.Color(preset.fogHex),
    fogNear: preset.fogNear,
    fogFar: preset.fogFar,
    sun: new THREE.Color(preset.sunHex),
    sunIntensity: preset.sunIntensity,
    sunPosition: getSolarPosition(preset.sunElevationDeg, preset.sunAzimuthDeg),
    hemiSky: new THREE.Color(preset.hemiSkyHex),
    hemiGround: new THREE.Color(preset.hemiGroundHex),
    hemiIntensity: preset.hemiIntensity,
    bounce: new THREE.Color(preset.bounceHex),
    bounceIntensity: preset.bounceIntensity,
    envIntensity: preset.envIntensity,
    exposure: preset.exposure,
    roomPointIntensity: preset.roomPointIntensity,
    lampPointIntensity: preset.lampPointIntensity,
    roomEmissive: preset.roomEmissive,
    lampEmissive: preset.lampEmissive,
    underCabinetEmissive: preset.underCabinetEmissive,
    exteriorLightIntensity: preset.exteriorLightIntensity,
    exteriorFixtureEmissive: preset.exteriorFixtureEmissive,
    winGlowEmissive: preset.winGlowEmissive,
    lobbyEmissive: preset.lobbyEmissive,
    glassTint: new THREE.Color(preset.glassTintHex),
    glassOpacity: preset.glassOpacity,
    glassReflectivity: preset.glassReflectivity,
    glassEnvIntensity: preset.glassEnvIntensity,
  };
}

const _cTmp = new THREE.Color();

export function lerpLightingState(
  from: LightingPreset,
  to: LightingPreset,
  t: number,
  out: InterpolatedLightingState,
): InterpolatedLightingState {
  const k = THREE.MathUtils.clamp(t, 0, 1);
  // Ease in-out cubic for natural twilight progression
  const s = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

  const lerpColor = (dest: THREE.Color, aHex: number, bHex: number) => {
    dest.setHex(aHex);
    _cTmp.setHex(bHex);
    dest.lerp(_cTmp, s);
  };

  lerpColor(out.skyZenith, from.skyZenithHex, to.skyZenithHex);
  lerpColor(out.skyHorizon, from.skyHorizonHex, to.skyHorizonHex);
  lerpColor(out.skyGround, from.skyGroundHex, to.skyGroundHex);
  lerpColor(out.sunGlow, from.sunGlowHex, to.sunGlowHex);
  lerpColor(out.fog, from.fogHex, to.fogHex);
  lerpColor(out.sun, from.sunHex, to.sunHex);
  lerpColor(out.hemiSky, from.hemiSkyHex, to.hemiSkyHex);
  lerpColor(out.hemiGround, from.hemiGroundHex, to.hemiGroundHex);
  lerpColor(out.bounce, from.bounceHex, to.bounceHex);
  lerpColor(out.glassTint, from.glassTintHex, to.glassTintHex);

  out.fogNear = THREE.MathUtils.lerp(from.fogNear, to.fogNear, s);
  out.fogFar = THREE.MathUtils.lerp(from.fogFar, to.fogFar, s);

  const el = THREE.MathUtils.lerp(from.sunElevationDeg, to.sunElevationDeg, s);
  const az = THREE.MathUtils.lerp(from.sunAzimuthDeg, to.sunAzimuthDeg, s);
  getSolarPosition(el, az, 64, out.sunPosition);

  out.sunIntensity = THREE.MathUtils.lerp(from.sunIntensity, to.sunIntensity, s);
  out.hemiIntensity = THREE.MathUtils.lerp(from.hemiIntensity, to.hemiIntensity, s);
  out.bounceIntensity = THREE.MathUtils.lerp(from.bounceIntensity, to.bounceIntensity, s);
  out.envIntensity = THREE.MathUtils.lerp(from.envIntensity, to.envIntensity, s);
  out.exposure = THREE.MathUtils.lerp(from.exposure, to.exposure, s);
  out.roomPointIntensity = THREE.MathUtils.lerp(from.roomPointIntensity, to.roomPointIntensity, s);
  out.lampPointIntensity = THREE.MathUtils.lerp(from.lampPointIntensity, to.lampPointIntensity, s);
  out.roomEmissive = THREE.MathUtils.lerp(from.roomEmissive, to.roomEmissive, s);
  out.lampEmissive = THREE.MathUtils.lerp(from.lampEmissive, to.lampEmissive, s);
  out.underCabinetEmissive = THREE.MathUtils.lerp(from.underCabinetEmissive, to.underCabinetEmissive, s);
  out.exteriorLightIntensity = THREE.MathUtils.lerp(
    from.exteriorLightIntensity,
    to.exteriorLightIntensity,
    s,
  );
  out.exteriorFixtureEmissive = THREE.MathUtils.lerp(
    from.exteriorFixtureEmissive,
    to.exteriorFixtureEmissive,
    s,
  );
  out.winGlowEmissive = THREE.MathUtils.lerp(from.winGlowEmissive, to.winGlowEmissive, s);
  out.lobbyEmissive = THREE.MathUtils.lerp(from.lobbyEmissive, to.lobbyEmissive, s);
  out.glassOpacity = THREE.MathUtils.lerp(from.glassOpacity, to.glassOpacity, s);
  out.glassReflectivity = THREE.MathUtils.lerp(from.glassReflectivity, to.glassReflectivity, s);
  out.glassEnvIntensity = THREE.MathUtils.lerp(from.glassEnvIntensity, to.glassEnvIntensity, s);

  return out;
}

export interface SkyDomeHandle {
  mesh: THREE.Mesh;
  uniforms: {
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uGroundColor: { value: THREE.Color };
    uSunGlowColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunGlowStrength: { value: number };
  };
  dispose: () => void;
}

export function createSkyDome(initial: InterpolatedLightingState): SkyDomeHandle {
  const uniforms = {
    uZenithColor: { value: initial.skyZenith.clone() },
    uHorizonColor: { value: initial.skyHorizon.clone() },
    uGroundColor: { value: initial.skyGround.clone() },
    uSunGlowColor: { value: initial.sunGlow.clone() },
    uSunDir: { value: initial.sunPosition.clone().normalize() },
    uSunGlowStrength: { value: 0.45 },
  };

  const geo = new THREE.SphereGeometry(210, 32, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      uniform vec3 uSunGlowColor;
      uniform vec3 uSunDir;
      uniform float uSunGlowStrength;
      varying vec3 vWorldDir;
      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, -1.0, 1.0);
        vec3 col;
        if (h >= 0.0) {
          float t = pow(h, 0.52);
          col = mix(uHorizonColor, uZenithColor, t);
        } else {
          float t = pow(-h, 0.65);
          col = mix(uHorizonColor, uGroundColor, t);
        }
        float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
        float halo = pow(sunDot, 10.0) * 0.42 + pow(sunDot, 72.0) * 0.45;
        col = mix(col, uSunGlowColor, clamp(halo * uSunGlowStrength, 0.0, 0.72));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  return {
    mesh,
    uniforms,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
