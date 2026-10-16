import { DynamicTexture, Scene, Texture } from '@babylonjs/core';

/*
 * Surface textures painted on a canvas at load time, so the game ships no
 * large image files. On box top faces the canvas x axis runs along the roof
 * length and the y axis runs across it.
 */

type Ctx = CanvasRenderingContext2D;
const r = (a: number, b: number) => a + Math.random() * (b - a);

function canvasTexture(scene: Scene, name: string, w: number, h: number, paint: (c: Ctx, w: number, h: number) => void, u = 1, v = 1, alpha = false) {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as Ctx;
  paint(ctx, w, h);
  tex.update();
  tex.hasAlpha = alpha;
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = u;
  tex.vScale = v;
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

/** Many small dots, e.g. gravel or grass tips. `color` returns an rgba string. */
function speckle(c: Ctx, w: number, h: number, count: number, color: () => string, rmin = 0.5, rmax = 2.2, y0 = 0, y1 = h) {
  for (let i = 0; i < count; i++) {
    c.fillStyle = color();
    const s = r(rmin, rmax);
    c.fillRect(Math.random() * w, r(y0, y1), s, s);
  }
}

/** Soft dark or light patches: stains, worn spots, moss. */
function blotches(c: Ctx, w: number, h: number, count: number, rgb: string, alpha: number, smin = 20, smax = 90) {
  for (let i = 0; i < count; i++) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.save();
    c.translate(Math.random() * w, Math.random() * h);
    c.scale(r(smin, smax), r(smin * 0.6, smax * 0.7));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 1, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

const grey = (lo: number, hi: number, a = 0.6, tint: [number, number, number] = [0, -4, -8]) => () => {
  const v = Math.floor(r(lo, hi));
  return `rgba(${v + tint[0]},${v + tint[1]},${v + tint[2]},${r(a * 0.6, a)})`;
};

function grassBlades(c: Ctx, w: number, y0: number, y1: number, count: number, palette: string[]) {
  c.lineWidth = 1.4;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = r(y0, y1);
    c.strokeStyle = palette[Math.floor(Math.random() * palette.length)];
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + r(-3, 3), y + r(-7, -2));
    c.stroke();
  }
}

// ---------------------------------------------------------------- walking surfaces

export function concrete(scene: Scene) {
  return canvasTexture(scene, 'concrete', 512, 512, (c, w, h) => {
    c.fillStyle = '#7d7672';
    c.fillRect(0, 0, w, h);
    speckle(c, w, h, 9000, grey(95, 155, 0.75));
    blotches(c, w, h, 14, '40,34,30', 0.22, 30, 120);
    c.strokeStyle = 'rgba(35,30,28,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, h / 2);
    c.lineTo(w, h / 2);
    c.moveTo(0, 2);
    c.lineTo(w, 2);
    c.stroke();
  }, 16, 3);
}

/** Packed-dirt hiking path with pebbles and grassy edges. */
export function trail(scene: Scene) {
  return canvasTexture(scene, 'trail', 512, 512, (c, w, h) => {
    c.fillStyle = '#8b7458';
    c.fillRect(0, 0, w, h);
    blotches(c, w, h, 40, '70,52,34', 0.3, 20, 70);
    blotches(c, w, h, 25, '170,150,120', 0.25, 20, 60);
    speckle(c, w, h, 7000, grey(90, 170, 0.7, [6, 0, -10]), 0.6, 3);
    // Bigger pebbles.
    for (let i = 0; i < 260; i++) {
      const v = Math.floor(r(100, 175));
      c.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      c.beginPath();
      c.ellipse(Math.random() * w, Math.random() * h, r(2, 6), r(1.5, 4), r(0, 3), 0, Math.PI * 2);
      c.fill();
    }
    // Grass and rocks at both edges with a ragged border.
    for (const [a, b] of [[0, 62], [h - 62, h]] as const) {
      for (let x = 0; x < w; x += 4) {
        const depth = r(30, 62);
        c.fillStyle = '#4d6b2e';
        if (a === 0) c.fillRect(x, 0, 4, depth);
        else c.fillRect(x, h - depth, 4, depth);
      }
      grassBlades(c, w, a, b, 2600, ['#6f9440', '#5a7f32', '#86a850', '#3f5c24']);
    }
  }, 14, 1);
}

/** Meadow grass with a worn path down the middle lane. */
export function meadow(scene: Scene, name = 'meadow', u = 12, v = 1, path = true) {
  return canvasTexture(scene, name, 512, 512, (c, w, h) => {
    c.fillStyle = '#5a8a35';
    c.fillRect(0, 0, w, h);
    blotches(c, w, h, 40, '120,160,60', 0.35, 30, 100);
    blotches(c, w, h, 30, '40,80,25', 0.35, 30, 100);
    if (path) {
      const grd = c.createLinearGradient(0, h * 0.3, 0, h * 0.7);
      grd.addColorStop(0, 'rgba(150,125,80,0)');
      grd.addColorStop(0.3, 'rgba(150,125,80,0.75)');
      grd.addColorStop(0.7, 'rgba(150,125,80,0.75)');
      grd.addColorStop(1, 'rgba(150,125,80,0)');
      c.fillStyle = grd;
      c.fillRect(0, h * 0.3, w, h * 0.4);
      speckle(c, w, h, 1500, grey(110, 160, 0.6, [10, 2, -15]), 0.6, 2.5, h * 0.36, h * 0.64);
    }
    grassBlades(c, w, 0, h, 9000, ['#78a845', '#5f9036', '#9cc35a', '#46722a', '#6a9a3c']);
    // Small wildflowers.
    for (let i = 0; i < 160; i++) {
      c.fillStyle = ['#ffffff', '#ffe066', '#f7a8d8', '#c9b6ff'][i % 4];
      const y = Math.random() * h;
      if (path && y > h * 0.32 && y < h * 0.68) continue;
      c.fillRect(Math.random() * w, y, 2.5, 2.5);
    }
  }, u, v);
}

/** Rounded cobblestones in staggered rows. */
export function cobbles(scene: Scene) {
  return canvasTexture(scene, 'cobbles', 512, 512, (c, w, h) => {
    c.fillStyle = '#5e5348';
    c.fillRect(0, 0, w, h);
    const size = 32;
    for (let row = 0; row < h / size; row++) {
      const off = row % 2 ? size / 2 : 0;
      for (let col = -1; col < w / size + 1; col++) {
        const x = col * size + off + r(-2, 2);
        const y = row * size + r(-2, 2);
        const v = Math.floor(r(120, 175));
        const g = c.createRadialGradient(x + size * 0.4, y + size * 0.35, 2, x + size / 2, y + size / 2, size * 0.6);
        g.addColorStop(0, `rgb(${v + 20},${v + 12},${v})`);
        g.addColorStop(1, `rgb(${v - 40},${v - 46},${v - 52})`);
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(x + 2, y + 2, size - 4 + r(-2, 2), size - 4 + r(-2, 2), 9);
        c.fill();
      }
    }
    speckle(c, w, h, 3000, grey(60, 120, 0.4));
    blotches(c, w, h, 12, '50,40,30', 0.25);
  }, 18, 3);
}

/** Dark, cracked graveyard flagstones with moss. */
export function flagstones(scene: Scene) {
  return canvasTexture(scene, 'flagstones', 512, 512, (c, w, h) => {
    c.fillStyle = '#15121a';
    c.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const rowH = r(60, 110);
      let x = 0;
      while (x < w) {
        const slabW = r(70, 150);
        const v = Math.floor(r(52, 78));
        c.fillStyle = `rgb(${v},${v - 4},${v + 6})`;
        c.fillRect(x + 3, y + 3, Math.min(slabW, w - x) - 6, rowH - 6);
        x += slabW;
      }
      y += rowH;
    }
    speckle(c, w, h, 5000, grey(30, 100, 0.5, [0, -2, 6]));
    blotches(c, w, h, 30, '40,70,35', 0.35, 10, 50); // moss
    c.strokeStyle = 'rgba(10,8,12,0.8)';
    c.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) {
      let x = Math.random() * w;
      let yy = Math.random() * h;
      c.beginPath();
      c.moveTo(x, yy);
      for (let k = 0; k < 5; k++) {
        x += r(-14, 14);
        yy += r(-14, 14);
        c.lineTo(x, yy);
      }
      c.stroke();
    }
  }, 10, 2);
}

// ---------------------------------------------------------------- walls and cliffs

/** Layered grey-brown cliff rock. */
export function cliffRock(scene: Scene, name = 'cliff', base = '#6d665e', u = 4, v = 6) {
  return canvasTexture(scene, name, 512, 512, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    // Horizontal strata.
    for (let y = 0; y < h; y += r(10, 40)) {
      const v2 = Math.floor(r(80, 130));
      c.fillStyle = `rgba(${v2},${v2 - 6},${v2 - 12},0.45)`;
      c.fillRect(0, y, w, r(4, 16));
    }
    blotches(c, w, h, 30, '40,36,32', 0.35, 20, 80);
    blotches(c, w, h, 20, '150,140,125', 0.2, 20, 60);
    speckle(c, w, h, 6000, grey(60, 150, 0.6));
    c.strokeStyle = 'rgba(25,22,20,0.7)';
    c.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      let x = Math.random() * w;
      let y = Math.random() * h;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += r(-6, 6);
        y += r(8, 22);
        c.lineTo(x, y);
      }
      c.stroke();
    }
  }, u, v);
}

/** Brown soil with stones and roots, for the hill embankments. */
export function earth(scene: Scene) {
  return canvasTexture(scene, 'earth', 512, 512, (c, w, h) => {
    c.fillStyle = '#6a4e34';
    c.fillRect(0, 0, w, h);
    blotches(c, w, h, 40, '90,68,44', 0.4, 20, 70);
    blotches(c, w, h, 30, '50,36,22', 0.4, 20, 70);
    speckle(c, w, h, 6000, grey(70, 140, 0.6, [12, 0, -14]));
    for (let i = 0; i < 120; i++) {
      const v = Math.floor(r(100, 160));
      c.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      c.beginPath();
      c.ellipse(Math.random() * w, Math.random() * h, r(3, 9), r(2, 6), r(0, 3), 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(45,30,18,0.7)';
    c.lineWidth = 1.5;
    for (let i = 0; i < 30; i++) {
      let x = Math.random() * w;
      let y = Math.random() * h;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += r(-12, 12);
        y += r(4, 12);
        c.lineTo(x, y);
      }
      c.stroke();
    }
  }, 4, 6);
}

/** Stone blocks in mortar. `moss` adds green patches for the haunted walls. */
export function stoneBlocks(scene: Scene, name: string, base: [number, number, number], mortar: string, moss = 0, u = 4, v = 8) {
  return canvasTexture(scene, name, 512, 512, (c, w, h) => {
    c.fillStyle = mortar;
    c.fillRect(0, 0, w, h);
    const rowH = 42;
    for (let row = 0; row < h / rowH; row++) {
      let x = row % 2 ? -r(20, 50) : 0;
      while (x < w) {
        const bw = r(60, 110);
        const k = r(-18, 18);
        c.fillStyle = `rgb(${base[0] + k},${base[1] + k},${base[2] + k})`;
        c.fillRect(x + 3, row * rowH + 3, bw - 6, rowH - 6);
        x += bw;
      }
    }
    speckle(c, w, h, 5000, grey(base[0] - 50, base[0] + 30, 0.4));
    blotches(c, w, h, 20, '30,25,20', 0.25, 15, 60);
    if (moss) blotches(c, w, h, moss, '45,75,35', 0.45, 10, 45);
  }, u, v);
}

// ---------------------------------------------------------------- props

export function wood(scene: Scene, name: string, base: string, dark: string, u = 1, v = 1) {
  return canvasTexture(scene, name, 256, 256, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = dark;
    for (let i = 0; i < 70; i++) {
      c.globalAlpha = r(0.15, 0.5);
      c.lineWidth = r(0.6, 2);
      const y = Math.random() * h;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + r(-6, 6), w * 0.7, y + r(-6, 6), w, y + r(-3, 3));
      c.stroke();
    }
    c.globalAlpha = 1;
    // Plank seams.
    c.fillStyle = dark;
    for (let y = 0; y < h; y += 64) c.fillRect(0, y, w, 3);
  }, u, v);
}

export function bark(scene: Scene, name = 'bark', base = '#4a3826') {
  return canvasTexture(scene, name, 256, 256, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      c.strokeStyle = `rgba(20,14,8,${r(0.3, 0.7)})`;
      c.lineWidth = r(1, 3);
      const x = Math.random() * w;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + r(-5, 5), h);
      c.stroke();
    }
    speckle(c, w, h, 1500, grey(60, 120, 0.4, [8, 0, -10]));
  }, 1, 2);
}

export function straw(scene: Scene) {
  return canvasTexture(scene, 'straw', 256, 256, (c, w, h) => {
    c.fillStyle = '#c9a54e';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      c.strokeStyle = ['#e2c26a', '#a9842f', '#d8b75c', '#8c6c26'][i % 4];
      c.lineWidth = 1;
      const x = Math.random() * w;
      const y = Math.random() * h;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + r(-14, 14), y + r(-3, 3));
      c.stroke();
    }
  }, 2, 2);
}

export function roofTiles(scene: Scene, name: string, base: [number, number, number]) {
  return canvasTexture(scene, name, 256, 256, (c, w, h) => {
    c.fillStyle = `rgb(${base[0] - 40},${base[1] - 30},${base[2] - 20})`;
    c.fillRect(0, 0, w, h);
    const tw = 22;
    const th = 18;
    for (let row = 0; row < h / th; row++) {
      for (let col = -1; col < w / tw + 1; col++) {
        const k = r(-20, 20);
        const x = col * tw + (row % 2 ? tw / 2 : 0);
        const g = c.createLinearGradient(0, row * th, 0, row * th + th);
        g.addColorStop(0, `rgb(${base[0] + k},${base[1] + k},${base[2] + k})`);
        g.addColorStop(1, `rgb(${base[0] + k - 45},${base[1] + k - 40},${base[2] + k - 35})`);
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(x + 1, row * th, tw - 2, th - 1, [0, 0, 8, 8]);
        c.fill();
      }
    }
  }, 3, 3);
}

/** House walls with windows; lit windows also go into the emissive texture. */
export function houseWall(scene: Scene, name: string, kind: 'cottage' | 'haunted') {
  const lit: [number, number, number, number][] = [];
  const albedo = canvasTexture(scene, name, 256, 256, (c, w, h) => {
    const haunted = kind === 'haunted';
    c.fillStyle = haunted ? '#2a2430' : '#e6d8bd';
    c.fillRect(0, 0, w, h);
    if (haunted) {
      for (let x = 0; x < w; x += 18) {
        c.fillStyle = `rgba(0,0,0,${r(0.2, 0.5)})`;
        c.fillRect(x, 0, 2, h);
      }
    } else {
      blotches(c, w, h, 14, '160,140,110', 0.3, 15, 50);
      // Timber frame.
      c.fillStyle = '#4a3020';
      c.fillRect(0, 0, w, 10);
      c.fillRect(0, h / 2 - 5, w, 10);
      c.fillRect(0, 0, 10, h);
      c.fillRect(w - 10, 0, 10, h);
      c.save();
      c.lineWidth = 8;
      c.strokeStyle = '#4a3020';
      c.beginPath();
      c.moveTo(10, h / 2);
      c.lineTo(w / 2, 10);
      c.lineTo(w - 10, h / 2);
      c.stroke();
      c.restore();
    }
    for (const [x, y] of [[40, 150], [150, 150], [40, 40], [150, 40]]) {
      const on = Math.random() < (haunted ? 0.55 : 0.3);
      c.fillStyle = haunted ? '#120e16' : '#5a3a24';
      c.fillRect(x - 6, y - 6, 62, 72);
      c.fillStyle = on ? (haunted ? '#ff9a3a' : '#ffd38a') : haunted ? '#0c0a10' : '#33404c';
      c.fillRect(x, y, 50, 60);
      c.fillStyle = haunted ? '#120e16' : '#5a3a24';
      c.fillRect(x + 23, y, 4, 60);
      c.fillRect(x, y + 28, 50, 4);
      if (on) lit.push([x, y, 50, 60]);
    }
  });
  const emissive = canvasTexture(scene, `${name}E`, 256, 256, (c, w, h) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    c.fillStyle = kind === 'haunted' ? '#ff8a20' : '#ffc070';
    for (const [x, y, ww, hh] of lit) c.fillRect(x, y, ww, hh);
  });
  return { albedo, emissive };
}

/** A spider web with a transparent background. */
export function web(scene: Scene) {
  return canvasTexture(scene, 'web', 512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(235,235,245,0.85)';
    c.lineWidth = 2;
    const cx = w / 2;
    const cy = h * 0.42;
    const spokes = 12;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * h);
      c.stroke();
    }
    c.lineWidth = 1.4;
    for (let ring = 1; ring < 12; ring++) {
      const rad = ring * 26;
      c.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        const x = cx + Math.cos(a) * rad;
        const y = cy + Math.sin(a) * rad;
        if (i === 0) c.moveTo(x, y);
        else c.quadraticCurveTo(cx + Math.cos(a - 0.26) * rad * 0.92, cy + Math.sin(a - 0.26) * rad * 0.92, x, y);
      }
      c.stroke();
    }
  }, 1, 1, true);
}

/** Jack-o'-lantern face; the dark background becomes transparent. */
export function pumpkinFace(scene: Scene) {
  return canvasTexture(scene, 'pumpkinFace', 256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffcc4a';
    const tri = (pts: number[]) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fill();
    };
    tri([60, 110, 100, 60, 115, 115]);
    tri([196, 110, 156, 60, 141, 115]);
    tri([118, 140, 128, 118, 138, 140]);
    c.beginPath();
    c.moveTo(50, 160);
    const teeth = [70, 186, 92, 172, 112, 196, 132, 178, 152, 198, 172, 174, 192, 190, 206, 160];
    for (let i = 0; i < teeth.length; i += 2) c.lineTo(teeth[i], teeth[i + 1]);
    c.quadraticCurveTo(128, 236, 50, 160);
    c.fill();
  }, 1, 1, true);
}

/** Sky gradient for the dome, with optional stars above the horizon. */
export function skyGradient(scene: Scene, stops: [number, string][], stars = false) {
  const w = stars ? 1024 : 16;
  return canvasTexture(scene, 'skyGrad', w, 512, (c, ww, h) => {
    // Canvas top maps to the bottom of the dome.
    const lg = c.createLinearGradient(0, 0, 0, h);
    for (const [at, col] of stops) lg.addColorStop(at, col);
    c.fillStyle = lg;
    c.fillRect(0, 0, ww, h);
    if (stars) {
      for (let i = 0; i < 900; i++) {
        const y = r(h * 0.56, h);
        const a = r(0.3, 1) * Math.min(1, (y - h * 0.56) / (h * 0.15));
        c.fillStyle = `rgba(255,255,240,${a})`;
        const s = Math.random() < 0.08 ? 2 : 1;
        c.fillRect(Math.random() * ww, y, s, s);
      }
    }
  });
}
