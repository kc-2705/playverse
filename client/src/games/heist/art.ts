import { DynamicTexture, Scene, Texture } from '@babylonjs/core';

/* Museum surfaces and paintings, painted on canvases at load time. */

type Ctx = CanvasRenderingContext2D;
const r = (a: number, b: number) => a + Math.random() * (b - a);

function make(scene: Scene, name: string, w: number, h: number, paint: (c: Ctx, w: number, h: number) => void, alpha = false) {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true);
  paint(tex.getContext() as Ctx, w, h);
  tex.update();
  tex.hasAlpha = alpha;
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

function veins(c: Ctx, x: number, y: number, w: number, h: number, color: string, count: number) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    c.lineWidth = r(0.5, 2.2);
    c.globalAlpha = r(0.15, 0.55);
    let px = x + Math.random() * w;
    let py = y + Math.random() * h;
    c.beginPath();
    c.moveTo(px, py);
    for (let k = 0; k < 8; k++) {
      px += r(-30, 30);
      py += r(-30, 30);
      c.quadraticCurveTo(px + r(-15, 15), py + r(-15, 15), px, py);
    }
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
}

/** Polished marble checkerboard: one texture repeat per 2 m map cell, so tiles are 1 m. */
export function marbleFloor(scene: Scene, cols: number, rows: number) {
  const tex = make(scene, 'marble', 512, 512, (c, w, h) => {
    const t = w / 2;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const light = (i + j) % 2 === 0;
        const g = c.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
        g.addColorStop(0, light ? '#d9d4cb' : '#2b2a2e');
        g.addColorStop(1, light ? '#c8c1b5' : '#1f1e22');
        c.fillStyle = g;
        c.fillRect(i * t, j * t, t, t);
        veins(c, i * t, j * t, t, t, light ? '#8f877a' : '#6a6670', 14);
      }
    }
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
    c.beginPath();
    c.moveTo(t, 0);
    c.lineTo(t, h);
    c.moveTo(0, t);
    c.lineTo(w, t);
    c.stroke();
  });
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = cols;
  tex.vScale = rows;
  return tex;
}

/** Museum wall: muted plaster above a dark wood panel and chair rail. */
export function wallPanel(scene: Scene) {
  return make(scene, 'wallPanel', 256, 256, (c, w, h) => {
    c.fillStyle = '#5d5866';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${r(0.02, 0.06)})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    const panelTop = h * 0.62;
    c.fillStyle = '#3a2a22';
    c.fillRect(0, panelTop, w, h - panelTop);
    c.strokeStyle = '#2a1c16';
    c.lineWidth = 3;
    c.strokeRect(14, panelTop + 14, w - 28, h - panelTop - 28);
    c.fillStyle = '#6e5440';
    c.fillRect(0, panelTop - 6, w, 8);
    c.fillStyle = '#241812';
    c.fillRect(0, h - 10, w, 10);
  });
}

const PALETTES = [
  ['#1d3557', '#457b9d', '#a8dadc', '#f1faee', '#e63946'],
  ['#2d1e2f', '#6b2d5c', '#f0a202', '#f18805', '#d95d39'],
  ['#0b3d2e', '#2f6d4f', '#9bc995', '#e9d985', '#b5651d'],
  ['#3d2c2e', '#7a4f3a', '#c08552', '#f3e9dc', '#5e3023'],
  ['#14213d', '#fca311', '#e5e5e5', '#283d5c', '#8d99ae'],
  ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
];

/** One of several original artworks for the gallery walls. */
export function painting(scene: Scene, index: number) {
  const pal = PALETTES[index % PALETTES.length];
  const kind = index % 4;
  return make(scene, `art${index}`, 256, 200, (c, w, h) => {
    if (kind === 0) {
      // Landscape: sky, sun, layered hills.
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, pal[0]);
      g.addColorStop(0.6, pal[3]);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = pal[4];
      c.beginPath();
      c.arc(r(50, 200), r(40, 80), r(14, 24), 0, Math.PI * 2);
      c.fill();
      for (let k = 0; k < 3; k++) {
        c.fillStyle = pal[1 + k];
        c.globalAlpha = 0.9;
        c.beginPath();
        c.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) c.lineTo(x, h * (0.55 + k * 0.12) + Math.sin(x / r(25, 45) + k) * 14);
        c.lineTo(w, h);
        c.fill();
      }
      c.globalAlpha = 1;
    } else if (kind === 1) {
      // Color-field abstract.
      c.fillStyle = pal[0];
      c.fillRect(0, 0, w, h);
      [[0.08, 0.08, 0.84, 0.45], [0.08, 0.58, 0.84, 0.34]].forEach(([x, y, ww, hh], k) => {
        c.fillStyle = pal[2 + k];
        c.globalAlpha = 0.85;
        c.fillRect(x * w + r(-3, 3), y * h, ww * w, hh * h);
      });
      c.globalAlpha = 1;
    } else if (kind === 2) {
      // Portrait silhouette on a dark ground.
      const g = c.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, pal[2]);
      g.addColorStop(1, pal[0]);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = pal[1];
      c.beginPath();
      c.ellipse(w / 2, h * 0.4, 30, 38, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(w / 2, h * 1.02, 75, 70, 0, Math.PI, 0);
      c.fill();
    } else {
      // Geometric shapes.
      c.fillStyle = pal[3];
      c.fillRect(0, 0, w, h);
      for (let k = 0; k < 9; k++) {
        c.fillStyle = pal[k % 5];
        c.globalAlpha = 0.8;
        c.beginPath();
        if (k % 2) c.arc(r(20, w - 20), r(20, h - 20), r(10, 40), 0, Math.PI * 2);
        else c.rect(r(0, w - 60), r(0, h - 50), r(30, 90), r(20, 70));
        c.fill();
      }
      c.globalAlpha = 1;
    }
    // Canvas weave and varnish.
    for (let i = 0; i < 2500; i++) {
      c.fillStyle = `rgba(0,0,0,${r(0.02, 0.07)})`;
      c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  });
}

/** The painting you're here to steal, one per level. */
export function masterpiece(scene: Scene, level: number) {
  return make(scene, `master${level}`, 512, 400, (c, w, h) => {
    if (level === 0) {
      // Harbor at Midnight: swirling night sky over boats.
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0b1d4a');
      g.addColorStop(0.65, '#2a4c8a');
      g.addColorStop(1, '#0a1a33');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.lineWidth = 5;
      for (let i = 0; i < 70; i++) {
        c.strokeStyle = ['#6fa3e0', '#a9c8f0', '#3d6bb3', '#f2d16b'][i % 4];
        c.globalAlpha = 0.6;
        const cx = r(0, w);
        const cy = r(0, h * 0.6);
        c.beginPath();
        c.arc(cx, cy, r(10, 50), r(0, 3), r(3, 6));
        c.stroke();
      }
      c.globalAlpha = 1;
      for (const [x, y, s] of [[90, 70, 26], [300, 50, 16], [420, 110, 20], [200, 130, 12]]) {
        const sg = c.createRadialGradient(x, y, 0, x, y, s * 2);
        sg.addColorStop(0, '#fff7c2');
        sg.addColorStop(0.4, '#f2d16b');
        sg.addColorStop(1, 'rgba(242,209,107,0)');
        c.fillStyle = sg;
        c.beginPath();
        c.arc(x, y, s * 2, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#10182a';
      for (const x of [80, 230, 360]) {
        c.beginPath();
        c.moveTo(x, h * 0.78);
        c.lineTo(x + 90, h * 0.78);
        c.lineTo(x + 75, h * 0.86);
        c.lineTo(x + 12, h * 0.86);
        c.fill();
        c.fillRect(x + 42, h * 0.55, 4, h * 0.23);
      }
    } else if (level === 1) {
      // Lady in Blue: classical portrait.
      const g = c.createRadialGradient(w / 2, h * 0.35, 20, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, '#6b5a3c');
      g.addColorStop(1, '#1d160e');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f3f7a';
      c.beginPath();
      c.ellipse(w / 2, h * 1.05, 150, 190, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = '#e8c7a6';
      c.fillRect(w / 2 - 22, h * 0.48, 44, 50);
      c.beginPath();
      c.ellipse(w / 2, h * 0.38, 52, 66, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a2416';
      c.beginPath();
      c.ellipse(w / 2, h * 0.3, 62, 52, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = '#f0e6c8';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.arc(w / 2 - 50 + i * 12.5, h * 0.62 + Math.sin(i / 2.6) * 10, 5, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      // The Golden Orchard: trees heavy with golden fruit.
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#f6d58e');
      g.addColorStop(0.6, '#c7a052');
      g.addColorStop(1, '#5e6b2a');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      for (const x of [90, 250, 410]) {
        c.fillStyle = '#4a3120';
        c.fillRect(x - 8, h * 0.45, 16, h * 0.45);
        c.fillStyle = '#3f6b2a';
        c.beginPath();
        c.arc(x, h * 0.38, 80, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffcf3a';
        for (let i = 0; i < 16; i++) {
          c.beginPath();
          c.arc(x + r(-60, 60), h * 0.38 + r(-55, 45), 7, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    for (let i = 0; i < 6000; i++) {
      c.fillStyle = `rgba(0,0,0,${r(0.02, 0.08)})`;
      c.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  });
}

/** "?" and "!" marks shown above guards. */
export function markTexture(scene: Scene, symbol: string, color: string) {
  return make(scene, `mark${symbol}`, 128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(10,10,20,0.75)';
    c.beginPath();
    c.arc(w / 2, h / 2, 54, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 6;
    c.stroke();
    c.fillStyle = color;
    c.font = 'bold 84px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(symbol, w / 2, h / 2 + 4);
  }, true);
}

/** Exit floor marker. */
export function exitTexture(scene: Scene) {
  return make(scene, 'exitMark', 256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(w / 2, h / 2, 110, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = 'bold 64px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('EXIT', w / 2, h / 2);
  }, true);
}
