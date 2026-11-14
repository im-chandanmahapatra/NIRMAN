import * as THREE from 'three';

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export interface TextureBundle {
  plasterColor: THREE.CanvasTexture;
  exteriorLimestoneColor: THREE.CanvasTexture;
  stoneGreigeColor: THREE.CanvasTexture;
  stoneGreigeBump: THREE.CanvasTexture;
  plasterBump: THREE.CanvasTexture;
  poolTileColor: THREE.CanvasTexture;
  limestoneColor: THREE.CanvasTexture;
  limestoneBump: THREE.CanvasTexture;
  limestoneRoughness: THREE.CanvasTexture;
  oakColorH: THREE.CanvasTexture;
  oakColorV: THREE.CanvasTexture;
  oakBumpH: THREE.CanvasTexture;
  oakBumpV: THREE.CanvasTexture;
  walnutColorH: THREE.CanvasTexture;
  walnutColorV: THREE.CanvasTexture;
  walnutBumpH: THREE.CanvasTexture;
  walnutBumpV: THREE.CanvasTexture;
  travertineColor: THREE.CanvasTexture;
  travertineBump: THREE.CanvasTexture;
  travertineRoughness: THREE.CanvasTexture;
  boucleColor: THREE.CanvasTexture;
  boucleBump: THREE.CanvasTexture;
  rugColor: THREE.CanvasTexture;
  rugBump: THREE.CanvasTexture;
  bathTileColor: THREE.CanvasTexture;
  bathTileBump: THREE.CanvasTexture;
  balconyPaverColor: THREE.CanvasTexture;
  balconyPaverBump: THREE.CanvasTexture;
  drivewayColor: THREE.CanvasTexture;
  drivewayBump: THREE.CanvasTexture;
  lawnColor: THREE.CanvasTexture;
  lawnBump: THREE.CanvasTexture;
  neighborFacadeColor: THREE.CanvasTexture;
  gatePlaqueTex: THREE.CanvasTexture;
  brushedMetalRoughness: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  artworkLiving: THREE.CanvasTexture;
  artworkBedroom: THREE.CanvasTexture;
  clockFace: THREE.CanvasTexture;
  dispose: () => void;
}

export function createTextureBundle(maxAnisotropy: number): TextureBundle {
  const created: THREE.CanvasTexture[] = [];
  const track = (t: THREE.CanvasTexture) => {
    created.push(t);
    return t;
  };

  // 1. Warm Limestone White Plaster (#E7E2D8 with organic trowel micro-variation)
  const [pC, pCtx] = makeCanvas(512, 512);
  const [pB, pBCtx] = makeCanvas(512, 512);
  pCtx.fillStyle = '#E7E2D8';
  pCtx.fillRect(0, 0, 512, 512);
  pBCtx.fillStyle = '#808080';
  pBCtx.fillRect(0, 0, 512, 512);
  const r1 = seededRandom(101);
  for (let i = 0; i < 420; i++) {
    const x = r1() * 512;
    const y = r1() * 512;
    const rad = 18 + r1() * 52;
    const v = r1() > 0.5 ? 236 : 220;
    const g = pCtx.createRadialGradient(x, y, 2, x, y, rad);
    g.addColorStop(0, `rgba(${v},${v - 5},${v - 13},0.08)`);
    g.addColorStop(1, 'rgba(231,226,216,0)');
    pCtx.fillStyle = g;
    pCtx.beginPath();
    pCtx.arc(x, y, rad, 0, Math.PI * 2);
    pCtx.fill();

    const bv = Math.floor(114 + r1() * 26);
    pBCtx.fillStyle = `rgba(${bv},${bv},${bv},0.16)`;
    pBCtx.beginPath();
    pBCtx.arc(x, y, rad * 0.65, 0, Math.PI * 2);
    pBCtx.fill();
  }
  const plasterColor = track(finalizeTexture(pC, true, maxAnisotropy, 2, 2));
  const plasterBump = track(finalizeTexture(pB, false, maxAnisotropy, 2, 2));

  // 1b. Architectural Warm Off-White Limestone Exterior Plaster (#E8E3DA with fine mineral trowel grain)
  const [ebC, ebCtx] = makeCanvas(512, 512);
  ebCtx.fillStyle = '#E8E3DA';
  ebCtx.fillRect(0, 0, 512, 512);
  const r1b = seededRandom(115);
  for (let i = 0; i < 460; i++) {
    const x = r1b() * 512;
    const y = r1b() * 512;
    const rad = 16 + r1b() * 48;
    const light = r1b() > 0.5;
    const g = ebCtx.createRadialGradient(x, y, 2, x, y, rad);
    g.addColorStop(
      0,
      light ? 'rgba(245,241,234,0.12)' : 'rgba(210,203,191,0.11)',
    );
    g.addColorStop(1, 'rgba(232,227,218,0)');
    ebCtx.fillStyle = g;
    ebCtx.beginPath();
    ebCtx.arc(x, y, rad, 0, Math.PI * 2);
    ebCtx.fill();
  }
  const exteriorLimestoneColor = track(finalizeTexture(ebC, true, maxAnisotropy, 2, 2));

  // 1c. Secondary Architectural Mineral Greige Ashlar Stone (#BCB5A9 with subtle crisp joints)
  const [sgC, sgCtx] = makeCanvas(512, 512);
  const [sgB, sgBCtx] = makeCanvas(512, 512);
  sgCtx.fillStyle = '#BCB5A9';
  sgCtx.fillRect(0, 0, 512, 512);
  sgBCtx.fillStyle = '#888888';
  sgBCtx.fillRect(0, 0, 512, 512);
  const r1c = seededRandom(129);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const shade = Math.floor((r1c() - 0.5) * 8);
      sgCtx.fillStyle = `rgb(${188 + shade},${181 + shade},${169 + shade})`;
      sgCtx.fillRect(c * 256 + 2, r * 128 + 2, 252, 124);
    }
  }
  for (let i = 0; i < 600; i++) {
    sgCtx.fillStyle = r1c() > 0.5 ? 'rgba(218,212,201,0.09)' : 'rgba(150,142,130,0.09)';
    sgCtx.fillRect(r1c() * 512, r1c() * 512, 8 + r1c() * 24, 2 + r1c() * 5);
  }
  sgCtx.fillStyle = '#9C9488';
  sgBCtx.fillStyle = '#3B3B3B';
  for (let r = 0; r < 4; r++) {
    const y = r * 128;
    sgCtx.fillRect(0, y, 512, 3);
    sgBCtx.fillRect(0, y, 512, 3);
    const xJoint = (r % 2) * 128 + 128;
    sgCtx.fillRect(xJoint, y, 3, 128);
    sgBCtx.fillRect(xJoint, y, 3, 128);
  }
  const stoneGreigeColor = track(finalizeTexture(sgC, true, maxAnisotropy, 1.5, 1.5));
  const stoneGreigeBump = track(finalizeTexture(sgB, false, maxAnisotropy, 1.5, 1.5));

  // 2. Honed Mineral Limestone Floor Tiles (#C7C1B5–#D5CFC3 subtle large-format stone)
  const [lC, lCtx] = makeCanvas(1024, 1024);
  const [lB, lBCtx] = makeCanvas(1024, 1024);
  const [lR, lRCtx] = makeCanvas(1024, 1024);
  lCtx.fillStyle = '#CEC8BC';
  lCtx.fillRect(0, 0, 1024, 1024);
  lBCtx.fillStyle = '#929292';
  lBCtx.fillRect(0, 0, 1024, 1024);
  lRCtx.fillStyle = '#848484';
  lRCtx.fillRect(0, 0, 1024, 1024);
  const r2 = seededRandom(202);
  const tileTones = ['#D2CCC0', '#C9C3B7', '#CEC8BC', '#C5BFB3'];
  for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 2; gy++) {
      lCtx.fillStyle = tileTones[(gx * 2 + gy) % tileTones.length];
      lCtx.fillRect(gx * 512, gy * 512, 512, 512);
    }
  }
  for (let i = 0; i < 2200; i++) {
    const x = r2() * 1024;
    const y = r2() * 1024;
    const w = 6 + r2() * 38;
    const h = 2 + r2() * 14;
    const dark = r2() > 0.5;
    lCtx.fillStyle = dark ? 'rgba(146,138,125,0.11)' : 'rgba(232,226,216,0.1)';
    lCtx.fillRect(x, y, w, h);
    lRCtx.fillStyle = dark ? 'rgba(155,155,155,0.16)' : 'rgba(92,92,92,0.14)';
    lRCtx.fillRect(x, y, w, h);
  }
  const groutPositions = [0, 512];
  lCtx.fillStyle = '#9F978A';
  lBCtx.fillStyle = '#2E2E2E';
  lRCtx.fillStyle = '#D8D8D8';
  for (const pos of groutPositions) {
    lCtx.fillRect(pos, 0, 4, 1024);
    lCtx.fillRect(0, pos, 1024, 4);
    lBCtx.fillRect(pos, 0, 5, 1024);
    lBCtx.fillRect(0, pos, 1024, 5);
    lRCtx.fillRect(pos, 0, 5, 1024);
    lRCtx.fillRect(0, pos, 1024, 5);
  }
  const limestoneColor = track(finalizeTexture(lC, true, maxAnisotropy, 1, 1));
  const limestoneBump = track(finalizeTexture(lB, false, maxAnisotropy, 1, 1));
  const limestoneRoughness = track(finalizeTexture(lR, false, maxAnisotropy, 1, 1));

  // 3. Seamless Fine Quarter-Sawn Timber Veneer (continuous wrap, no harsh square band jumps)
  function buildWoodSet(
    baseHex: string,
    fiberHex: string,
    poreHex: string,
    vertical: boolean,
    seed: number,
  ): [THREE.CanvasTexture, THREE.CanvasTexture] {
    const [wc, wCtx] = makeCanvas(512, 512);
    const [wb, wBCtx] = makeCanvas(512, 512);
    wCtx.fillStyle = baseHex;
    wCtx.fillRect(0, 0, 512, 512);
    wBCtx.fillStyle = '#848484';
    wBCtx.fillRect(0, 0, 512, 512);

    const rw = seededRandom(seed);
    // Subtle soft longitudinal tone variation (wrapped across seam)
    for (let p = 0; p < 16; p++) {
      const pos = p * 32;
      const g = vertical
        ? wCtx.createLinearGradient(pos, 0, pos + 32, 0)
        : wCtx.createLinearGradient(0, pos, 0, pos + 32);
      const dark = rw() > 0.5;
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, dark ? 'rgba(34,20,10,0.035)' : 'rgba(255,244,228,0.03)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      wCtx.fillStyle = g;
      if (vertical) wCtx.fillRect(pos, 0, 32, 512);
      else wCtx.fillRect(0, pos, 512, 32);
    }

    for (let i = 0; i < 820; i++) {
      const pos = rw() * 512;
      const start = rw() * 512;
      const len = 85 + rw() * 260;
      const thick = 0.55 + rw() * 1.45;
      const wave = (rw() - 0.5) * 3.5;

      const drawStroke = (ctx: CanvasRenderingContext2D, off: number) => {
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(pos, start - off);
          ctx.quadraticCurveTo(pos + wave, start - off + len * 0.5, pos, start - off + len);
        } else {
          ctx.moveTo(start - off, pos);
          ctx.quadraticCurveTo(start - off + len * 0.5, pos + wave, start - off + len, pos);
        }
        ctx.stroke();
      };

      wCtx.strokeStyle = i % 3 === 0 ? poreHex : fiberHex;
      wCtx.lineWidth = thick;
      drawStroke(wCtx, 0);
      if (start + len > 512) drawStroke(wCtx, 512);

      wBCtx.strokeStyle =
        i % 3 === 0 ? 'rgba(58,58,58,0.4)' : 'rgba(155,155,155,0.22)';
      wBCtx.lineWidth = thick;
      drawStroke(wBCtx, 0);
      if (start + len > 512) drawStroke(wBCtx, 512);
    }

    return [
      track(finalizeTexture(wc, true, maxAnisotropy, 1, 1)),
      track(finalizeTexture(wb, false, maxAnisotropy, 1, 1)),
    ];
  }

  // Calibrated Natural Oak & Warm Walnut (#6F503C target family)
  const [oakColorH, oakBumpH] = buildWoodSet(
    '#AE8D65',
    'rgba(138,105,66,0.2)',
    'rgba(92,64,38,0.16)',
    false,
    303,
  );
  const [oakColorV, oakBumpV] = buildWoodSet(
    '#AE8D65',
    'rgba(138,105,66,0.2)',
    'rgba(92,64,38,0.16)',
    true,
    304,
  );
  const [walnutColorH, walnutBumpH] = buildWoodSet(
    '#6F503C',
    'rgba(78,52,36,0.34)',
    'rgba(42,26,16,0.28)',
    false,
    404,
  );
  const [walnutColorV, walnutBumpV] = buildWoodSet(
    '#6F503C',
    'rgba(78,52,36,0.34)',
    'rgba(42,26,16,0.28)',
    true,
    405,
  );

  // 4. Honed Travertine (linear sedimentary veins, pores, & roughness variation)
  const [tC, tCtx] = makeCanvas(512, 512);
  const [tB, tBCtx] = makeCanvas(512, 512);
  const [tR, tRCtx] = makeCanvas(512, 512);
  tCtx.fillStyle = '#CFC7B8';
  tCtx.fillRect(0, 0, 512, 512);
  tBCtx.fillStyle = '#888888';
  tBCtx.fillRect(0, 0, 512, 512);
  tRCtx.fillStyle = '#787878';
  tRCtx.fillRect(0, 0, 512, 512);
  const r3 = seededRandom(505);
  for (let y = 0; y < 512; y += 3) {
    const alpha = 0.05 + r3() * 0.12;
    const isLight = r3() > 0.45;
    tCtx.fillStyle = isLight
      ? `rgba(232,226,214,${alpha})`
      : `rgba(164,152,135,${alpha})`;
    tCtx.fillRect(0, y, 512, 2 + r3() * 5);
    tRCtx.fillStyle = isLight ? 'rgba(90,90,90,0.14)' : 'rgba(155,155,155,0.14)';
    tRCtx.fillRect(0, y, 512, 2 + r3() * 5);
  }
  for (let i = 0; i < 360; i++) {
    const px = r3() * 512;
    const py = r3() * 512;
    const pw = 3 + r3() * 14;
    const ph = 1 + r3() * 2.2;
    tCtx.fillStyle = 'rgba(124,112,96,0.26)';
    tCtx.fillRect(px, py, pw, ph);
    tBCtx.fillStyle = 'rgba(55,55,55,0.5)';
    tBCtx.fillRect(px, py, pw, ph);
    tRCtx.fillStyle = 'rgba(195,195,195,0.45)';
    tRCtx.fillRect(px, py, pw, ph);
  }
  const travertineColor = track(finalizeTexture(tC, true, maxAnisotropy, 1, 1));
  const travertineBump = track(finalizeTexture(tB, false, maxAnisotropy, 1, 1));
  const travertineRoughness = track(finalizeTexture(tR, false, maxAnisotropy, 1, 1));

  // 5. Fine Bouclé / Linen Upholstery Weave
  const [fC, fCtx] = makeCanvas(256, 256);
  const [fB, fBCtx] = makeCanvas(256, 256);
  fCtx.fillStyle = '#DAD2C4';
  fCtx.fillRect(0, 0, 256, 256);
  fBCtx.fillStyle = '#808080';
  fBCtx.fillRect(0, 0, 256, 256);
  const r4 = seededRandom(606);
  for (let y = 0; y < 256; y += 3) {
    for (let x = 0; x < 256; x += 3) {
      const n = r4();
      const tone = n > 0.5 ? 'rgba(245,240,231,0.24)' : 'rgba(158,148,132,0.22)';
      fCtx.fillStyle = tone;
      fCtx.fillRect(x, y, 2, 2);
      const b = Math.floor(104 + n * 58);
      fBCtx.fillStyle = `rgb(${b},${b},${b})`;
      fBCtx.fillRect(x, y, 2, 2);
    }
  }
  const boucleColor = track(finalizeTexture(fC, true, maxAnisotropy, 4, 4));
  const boucleBump = track(finalizeTexture(fB, false, maxAnisotropy, 4, 4));

  // 6. Woven Wool Dhurrie Rug (with muted olive & mineral border)
  const [rC, rCtx] = makeCanvas(512, 512);
  const [rB, rBCtx] = makeCanvas(512, 512);
  rCtx.fillStyle = '#CFC7B7';
  rCtx.fillRect(0, 0, 512, 512);
  rBCtx.fillStyle = '#808080';
  rBCtx.fillRect(0, 0, 512, 512);
  rCtx.strokeStyle = '#928571';
  rCtx.lineWidth = 18;
  rCtx.strokeRect(24, 24, 464, 464);
  rCtx.strokeStyle = '#7C8067';
  rCtx.lineWidth = 6;
  rCtx.strokeRect(42, 42, 428, 428);
  const r5 = seededRandom(707);
  for (let y = 0; y < 512; y += 2) {
    const rowTone = r5() > 0.5 ? 'rgba(246,241,232,0.12)' : 'rgba(108,96,80,0.11)';
    rCtx.fillStyle = rowTone;
    rCtx.fillRect(0, y, 512, 1);
    const bv = Math.floor(105 + r5() * 48);
    rBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    rBCtx.fillRect(0, y, 512, 1);
  }
  const rugColor = track(finalizeTexture(rC, true, maxAnisotropy, 1, 1));
  const rugBump = track(finalizeTexture(rB, false, maxAnisotropy, 1, 1));

  // 7. Bathroom Satin Large-Format Wall/Floor Tiles (FIXED btBCtx grout lines!)
  const [btC, btCtx] = makeCanvas(512, 512);
  const [btB, btBCtx] = makeCanvas(512, 512);
  btCtx.fillStyle = '#DCD6CA';
  btCtx.fillRect(0, 0, 512, 512);
  btBCtx.fillStyle = '#8A8A8A';
  btBCtx.fillRect(0, 0, 512, 512);
  const r6 = seededRandom(808);
  for (let i = 0; i < 550; i++) {
    btCtx.fillStyle = r6() > 0.5 ? 'rgba(186,177,164,0.11)' : 'rgba(244,239,231,0.1)';
    btCtx.fillRect(r6() * 512, r6() * 512, 24 + r6() * 48, 3 + r6() * 10);
  }
  btCtx.fillStyle = '#ACA395';
  btBCtx.fillStyle = '#2B2B2B';
  for (const x of [0, 256]) {
    btCtx.fillRect(x, 0, 3, 512);
    btBCtx.fillRect(x, 0, 3, 512);
  }
  for (const y of [0, 128, 256, 384]) {
    btCtx.fillRect(0, y, 512, 3);
    btBCtx.fillRect(0, y, 512, 3);
  }
  const bathTileColor = track(finalizeTexture(btC, true, maxAnisotropy, 1, 1));
  const bathTileBump = track(finalizeTexture(btB, false, maxAnisotropy, 1, 1));

  // 7b. Mosaic Swimming Pool Ceramic Tesserae
  const [ptC, ptCtx] = makeCanvas(256, 256);
  ptCtx.fillStyle = '#2E7D9C';
  ptCtx.fillRect(0, 0, 256, 256);
  const rPool = seededRandom(909);
  const tilePx = 32;
  for (let ty = 0; ty < 256; ty += tilePx) {
    for (let tx = 0; tx < 256; tx += tilePx) {
      const l = 38 + Math.floor(rPool() * 18);
      const s = 56 + Math.floor(rPool() * 18);
      ptCtx.fillStyle = `hsl(196, ${s}%, ${l}%)`;
      ptCtx.fillRect(tx + 2, ty + 2, tilePx - 3, tilePx - 3);
    }
  }
  const poolTileColor = track(finalizeTexture(ptC, true, maxAnisotropy, 6, 4));

  // 8. Balcony Anti-Slip Outdoor Paver (#C2B9A8 with subtle block variation)
  const [bpC, bpCtx] = makeCanvas(512, 512);
  const [bpB, bpBCtx] = makeCanvas(512, 512);
  bpCtx.fillStyle = '#C2B9A8';
  bpCtx.fillRect(0, 0, 512, 512);
  bpBCtx.fillStyle = '#888888';
  bpBCtx.fillRect(0, 0, 512, 512);
  const r8 = seededRandom(818);
  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 512; y += 128) {
      const shade = Math.floor((r8() - 0.5) * 14);
      bpCtx.fillStyle = `rgb(${194 + shade},${185 + shade},${168 + shade})`;
      bpCtx.fillRect(x + 2, y + 2, 60, 124);
    }
  }
  for (let x = 0; x < 512; x += 64) {
    bpCtx.fillStyle = '#9D9384';
    bpCtx.fillRect(x, 0, 4, 512);
    bpBCtx.fillStyle = '#383838';
    bpBCtx.fillRect(x, 0, 4, 512);
  }
  for (let y = 0; y < 512; y += 128) {
    bpCtx.fillStyle = '#9D9384';
    bpCtx.fillRect(0, y, 512, 3);
    bpBCtx.fillStyle = '#383838';
    bpBCtx.fillRect(0, y, 512, 3);
  }
  const balconyPaverColor = track(finalizeTexture(bpC, true, maxAnisotropy, 2, 2));
  const balconyPaverBump = track(finalizeTexture(bpB, false, maxAnisotropy, 2, 2));

  // 9. Articulated Driveway Cobble / Stone Paver Course
  const [dwC, dwCtx] = makeCanvas(512, 512);
  const [dwB, dwBCtx] = makeCanvas(512, 512);
  dwCtx.fillStyle = '#ABA396';
  dwCtx.fillRect(0, 0, 512, 512);
  dwBCtx.fillStyle = '#8A8A8A';
  dwBCtx.fillRect(0, 0, 512, 512);
  const r9 = seededRandom(929);
  const rowH = 32;
  const colW = 64;
  for (let row = 0; row < 512 / rowH; row++) {
    const stagger = (row % 2) * (colW * 0.5);
    for (let col = -1; col < 512 / colW + 1; col++) {
      const px = col * colW + stagger;
      const py = row * rowH;
      const delta = Math.floor((r9() - 0.5) * 18);
      dwCtx.fillStyle = `rgb(${176 + delta},${169 + delta},${157 + delta})`;
      dwCtx.fillRect(px + 2, py + 2, colW - 4, rowH - 4);
      dwBCtx.fillStyle = '#404040';
      dwBCtx.strokeStyle = '#363636';
      dwBCtx.lineWidth = 3;
      dwBCtx.strokeRect(px, py, colW, rowH);
    }
  }
  const drivewayColor = track(finalizeTexture(dwC, true, maxAnisotropy, 6, 8));
  const drivewayBump = track(finalizeTexture(dwB, false, maxAnisotropy, 6, 8));

  // 10. Natural Landscaped Lawn / Grass Ground Cover (varied muted olive-sage mottling)
  const [lnC, lnCtx] = makeCanvas(512, 512);
  const [lnB, lnBCtx] = makeCanvas(512, 512);
  lnCtx.fillStyle = '#6A7853';
  lnCtx.fillRect(0, 0, 512, 512);
  lnBCtx.fillStyle = '#808080';
  lnBCtx.fillRect(0, 0, 512, 512);
  const r10 = seededRandom(1010);
  for (let i = 0; i < 650; i++) {
    const x = r10() * 512;
    const y = r10() * 512;
    const rad = 14 + r10() * 44;
    const g = lnCtx.createRadialGradient(x, y, 2, x, y, rad);
    const warm = r10() > 0.5;
    g.addColorStop(0, warm ? 'rgba(124,132,96,0.22)' : 'rgba(84,96,65,0.22)');
    g.addColorStop(1, 'rgba(106,120,83,0)');
    lnCtx.fillStyle = g;
    lnCtx.beginPath();
    lnCtx.arc(x, y, rad, 0, Math.PI * 2);
    lnCtx.fill();
  }
  for (let i = 0; i < 4200; i++) {
    const x = r10() * 512;
    const y = r10() * 512;
    lnCtx.fillStyle = r10() > 0.5 ? 'rgba(140,148,110,0.28)' : 'rgba(72,82,54,0.26)';
    lnCtx.fillRect(x, y, 2, 4);
    const bv = Math.floor(96 + r10() * 68);
    lnBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    lnBCtx.fillRect(x, y, 2, 4);
  }
  const lawnColor = track(finalizeTexture(lnC, true, maxAnisotropy, 12, 12));
  const lawnBump = track(finalizeTexture(lnB, false, maxAnisotropy, 12, 12));

  // 11. Articulated Neighboring Residential Tower Facade (crisp multi-bay stone & recessed glazing)
  const [nfC, nfCtx] = makeCanvas(512, 512);
  nfCtx.fillStyle = '#D5CEC2';
  nfCtx.fillRect(0, 0, 512, 512);
  const rows = 5;
  const cols = 5;
  const cellW = 512 / cols;
  const cellH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const fy = r * cellH;
    // Mineral spandrel cornice band
    nfCtx.fillStyle = '#C2B9AC';
    nfCtx.fillRect(0, fy, 512, 12);
    nfCtx.fillStyle = '#8F877B';
    nfCtx.fillRect(0, fy + 12, 512, 2);
    for (let c = 0; c < cols; c++) {
      const fx = c * cellW;
      // Recessed bronze window frame + natural architectural glazing
      nfCtx.fillStyle = '#4B453D';
      nfCtx.fillRect(fx + 14, fy + 20, cellW - 28, cellH - 34);
      const wg = nfCtx.createLinearGradient(0, fy + 20, 0, fy + cellH - 14);
      wg.addColorStop(0, '#5B6A74');
      wg.addColorStop(0.65, '#46525A');
      wg.addColorStop(1, '#363E44');
      nfCtx.fillStyle = wg;
      nfCtx.fillRect(fx + 17, fy + 23, cellW - 34, cellH - 40);
      // Fine central mullion & horizontal transom
      nfCtx.fillStyle = '#4B453D';
      nfCtx.fillRect(fx + cellW * 0.5 - 1.5, fy + 23, 3, cellH - 40);
      nfCtx.fillRect(fx + 17, fy + cellH * 0.62, cellW - 34, 2);
    }
  }
  const neighborFacadeColor = track(finalizeTexture(nfC, true, maxAnisotropy, 1, 2));

  // 12. Crisp Engraved Brushed Brass Entrance Plaque Texture ("NIRMANA RESIDENCES")
  const [gpC, gpCtx] = makeCanvas(512, 192);
  const gpGrad = gpCtx.createLinearGradient(0, 0, 512, 192);
  gpGrad.addColorStop(0, '#D4BF92');
  gpGrad.addColorStop(0.5, '#C4A874');
  gpGrad.addColorStop(1, '#B39662');
  gpCtx.fillStyle = gpGrad;
  gpCtx.fillRect(0, 0, 512, 192);
  gpCtx.strokeStyle = '#3B342C';
  gpCtx.lineWidth = 6;
  gpCtx.strokeRect(12, 12, 488, 168);
  gpCtx.fillStyle = '#2A241E';
  gpCtx.textAlign = 'center';
  gpCtx.font = '600 60px Georgia, serif';
  gpCtx.fillText('NIRMAN', 256, 102);
  gpCtx.font = '500 22px system-ui, sans-serif';
  gpCtx.fillText('PRIVATE RESIDENCES', 256, 144);
  const gatePlaqueTex = track(finalizeTexture(gpC, true, maxAnisotropy, 1, 1));

  // 13. Brushed Metal Roughness Map
  const [bm, bmCtx] = makeCanvas(256, 256);
  bmCtx.fillStyle = '#505050';
  bmCtx.fillRect(0, 0, 256, 256);
  const r7 = seededRandom(909);
  for (let y = 0; y < 256; y++) {
    const v = Math.floor(62 + r7() * 34);
    bmCtx.fillStyle = `rgb(${v},${v},${v})`;
    bmCtx.fillRect(0, y, 256, 1);
  }
  const brushedMetalRoughness = track(finalizeTexture(bm, false, maxAnisotropy, 2, 2));

  // 14. Soft Radial Contact Shadow Disc
  const [cs, csCtx] = makeCanvas(256, 256);
  const grad = csCtx.createRadialGradient(128, 128, 16, 128, 128, 124);
  grad.addColorStop(0, 'rgba(22, 18, 14, 0.65)');
  grad.addColorStop(0.55, 'rgba(22, 18, 14, 0.3)');
  grad.addColorStop(1, 'rgba(22, 18, 14, 0)');
  csCtx.fillStyle = grad;
  csCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(cs);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;
  created.push(contactShadow);

  // 15. Restrained Architectural Artwork Canvases (palette harmonized: #E7E2D8, #C7C1B5, #7C8067, #B78A72)
  function makeArt(bg: string, shapeA: string, shapeB: string, lineCol: string): THREE.CanvasTexture {
    const [ac, aCtx] = makeCanvas(512, 640);
    aCtx.fillStyle = bg;
    aCtx.fillRect(0, 0, 512, 640);
    aCtx.fillStyle = shapeA;
    aCtx.beginPath();
    aCtx.arc(230, 270, 128, 0, Math.PI * 2);
    aCtx.fill();
    aCtx.fillStyle = shapeB;
    aCtx.fillRect(212, 310, 170, 204);
    aCtx.strokeStyle = lineCol;
    aCtx.lineWidth = 4;
    aCtx.beginPath();
    aCtx.moveTo(120, 160);
    aCtx.lineTo(380, 490);
    aCtx.stroke();
    return track(finalizeTexture(ac, true, maxAnisotropy, 1, 1));
  }

  const artworkLiving = makeArt('#ECE7DE', '#B78A72', '#7C8067', '#443E36');
  const artworkBedroom = makeArt('#EAE4DA', '#A49B8D', '#C7C1B5', '#443E36');

  // 16. Minimalist Architectural Wall Clock Dial
  const [ckC, ckCtx] = makeCanvas(256, 256);
  ckCtx.fillStyle = '#EFECE5';
  ckCtx.fillRect(0, 0, 256, 256);
  ckCtx.strokeStyle = '#443E36';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const r0 = i % 3 === 0 ? 86 : 94;
    const r1 = 108;
    ckCtx.lineWidth = i % 3 === 0 ? 4 : 2;
    ckCtx.beginPath();
    ckCtx.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
    ckCtx.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
    ckCtx.stroke();
  }
  ckCtx.strokeStyle = '#2B251E';
  ckCtx.lineWidth = 4.5;
  ckCtx.beginPath();
  ckCtx.moveTo(128, 128);
  ckCtx.lineTo(86, 98);
  ckCtx.stroke();
  ckCtx.lineWidth = 3;
  ckCtx.beginPath();
  ckCtx.moveTo(128, 128);
  ckCtx.lineTo(178, 86);
  ckCtx.stroke();
  ckCtx.fillStyle = '#B89D6B';
  ckCtx.beginPath();
  ckCtx.arc(128, 128, 6, 0, Math.PI * 2);
  ckCtx.fill();
  const clockFace = track(finalizeTexture(ckC, true, maxAnisotropy, 1, 1));

  return {
    plasterColor,
    exteriorLimestoneColor,
    stoneGreigeColor,
    stoneGreigeBump,
    plasterBump,
    poolTileColor,
    limestoneColor,
    limestoneBump,
    limestoneRoughness,
    oakColorH,
    oakColorV,
    oakBumpH,
    oakBumpV,
    walnutColorH,
    walnutColorV,
    walnutBumpH,
    walnutBumpV,
    travertineColor,
    travertineBump,
    travertineRoughness,
    boucleColor,
    boucleBump,
    rugColor,
    rugBump,
    bathTileColor,
    bathTileBump,
    balconyPaverColor,
    balconyPaverBump,
    drivewayColor,
    drivewayBump,
    lawnColor,
    lawnBump,
    neighborFacadeColor,
    gatePlaqueTex,
    brushedMetalRoughness,
    contactShadow,
    artworkLiving,
    artworkBedroom,
    clockFace,
    dispose: () => {
      for (const tex of created) tex.dispose();
    },
  };
}
