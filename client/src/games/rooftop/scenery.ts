import {
  Color3,
  DynamicTexture,
  Matrix,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import type { ThemeInfo } from './themes';
import * as T from './textures';

/*
 * Everything the player sees that depends on the chosen world: materials,
 * obstacles, the track blocks, the far landscape and the chaser. The runner
 * (RooftopRunner.ts) owns the gameplay and asks this kit to dress it.
 */

export const ROOF_W = 9;
export type ObstacleKind = 'unit' | 'pipe' | 'tank';
/** Background pieces that slide toward the camera and wrap around. */
export interface Drifter {
  node: TransformNode;
  factor: number;
  min: number;
  span: number;
}
export interface Chaser {
  node: TransformNode;
  animate(dt: number, clock: number): void;
}
interface Place {
  x: number;
  y: number;
  z: number;
  s?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  ry?: number;
  rx?: number;
  rz?: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const hex = (s: string) => Color3.FromHexString(s);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- noise for the landscape

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 5) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += noise(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
function ridged(x: number, y: number, oct = 5) {
  let sum = 0;
  let amp = 0.55;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise(x * f, y * f) * 2 - 1);
    sum += n * n * amp;
    f *= 2.1;
    amp *= 0.5;
  }
  return sum;
}

// ---------------------------------------------------------------- mesh helpers

/** Pushes vertices in or out by a smooth pattern so spheres look like rocks or leaf clumps. */
function lumpy(mesh: Mesh, amount: number, seed: number) {
  const p = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < p.length; i += 3) {
    const [x, y, z] = [p[i], p[i + 1], p[i + 2]];
    const k = 1 + amount * (Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 1.7) * Math.sin(z * 3.3 + seed * 0.6) + 0.45 * Math.sin(x * 6.3 + y * 5.1 + z * 4.2 + seed));
    p[i] *= k;
    p[i + 1] *= k;
    p[i + 2] *= k;
  }
  mesh.setVerticesData(VertexBuffer.PositionKind, p);
  const n: number[] = [];
  VertexData.ComputeNormals(p, mesh.getIndices(), n);
  mesh.setVerticesData(VertexBuffer.NormalKind, n);
  return mesh;
}

/** A flat polygon in the xz plane, fanned from the first point (wings). */
function flatShape(name: string, pts: [number, number][], scene: Scene) {
  const positions: number[] = [];
  const indices: number[] = [];
  pts.forEach(([x, z]) => positions.push(x, 0, z));
  for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  return m;
}

export class ThemeKit {
  readonly mats: Record<string, PBRMaterial | StandardMaterial> = {};
  readonly floorY: number;
  private protos: Record<string, Mesh> = {};
  private s: Scene;

  constructor(scene: Scene, private theme: ThemeInfo, private shadows: ShadowGenerator, private quality: 'high' | 'low') {
    this.s = scene;
    this.floorY = { city: 0, mountains: -45, hills: -24, village: -16, halloween: -18 }[theme.id];
    this.makeMaterials();
    this.makeProtos();
  }

  get id() {
    return this.theme.id;
  }

  // ---------------------------------------------------------------- materials

  private pbr(name: string, color: Color3 | string, rough: number, metal = 0, tex?: Texture) {
    const m = new PBRMaterial(name, this.s);
    m.albedoColor = typeof color === 'string' ? hex(color) : color;
    m.roughness = rough;
    m.metallic = metal;
    if (tex) m.albedoTexture = tex;
    this.mats[name] = m;
    return m;
  }

  private glowMat(name: string, color: string, tex?: Texture) {
    const m = new StandardMaterial(name, this.s);
    m.emissiveColor = hex(color);
    m.disableLighting = true;
    if (tex) {
      m.emissiveTexture = tex;
      m.opacityTexture = tex;
      m.emissiveColor = Color3.White();
      m.backFaceCulling = false;
    }
    this.mats[name] = m;
    return m;
  }

  private makeMaterials() {
    const s = this.s;
    const white = Color3.White();
    // Shared by every world.
    this.pbr('metal', new Color3(0.7, 0.72, 0.75), 0.35, 0.9);
    this.pbr('darkMetal', new Color3(0.18, 0.19, 0.21), 0.5, 0.8);
    this.pbr('rust', new Color3(0.45, 0.26, 0.17), 0.8, 0.4);
    this.pbr('wood', new Color3(0.42, 0.29, 0.18), 0.8);
    this.pbr('warn', new Color3(0.95, 0.75, 0.1), 0.6);
    const gold = this.pbr('gold', new Color3(1, 0.77, 0.25), 0.18, 1);
    gold.emissiveColor = new Color3(0.35, 0.22, 0);

    switch (this.theme.id) {
      case 'city': {
        this.pbr('top', white, 0.95, 0, T.concrete(s));
        this.pbr('parapet', new Color3(0.55, 0.5, 0.46), 0.85);
        // Building walls: a window grid, warm lights in some rooms at dusk.
        for (const [key, base] of [['wallA', '#6e6a6a'], ['wallB', '#8a7766'], ['wallC', '#5d6670']] as const) {
          const tex = new DynamicTexture(`win-${key}`, { width: 256, height: 512 }, s, true);
          const ctx = tex.getContext() as CanvasRenderingContext2D;
          ctx.fillStyle = base;
          ctx.fillRect(0, 0, 256, 512);
          const emit = new DynamicTexture(`winE-${key}`, { width: 256, height: 512 }, s, true);
          const ectx = emit.getContext() as CanvasRenderingContext2D;
          ectx.fillStyle = '#000';
          ectx.fillRect(0, 0, 256, 512);
          for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 6; col++) {
              const x = 10 + col * 41;
              const y = 8 + row * 31.5;
              const lit = Math.random() < 0.38;
              ctx.fillStyle = lit ? '#ffcf8a' : Math.random() < 0.5 ? '#2c3440' : '#3c4652';
              ctx.fillRect(x, y, 30, 22);
              if (lit) {
                ectx.fillStyle = Math.random() < 0.7 ? '#ffb45a' : '#ffe2a8';
                ectx.fillRect(x, y, 30, 22);
              }
            }
          }
          tex.update();
          emit.update();
          const m = this.pbr(key, white, 0.75, 0.05, tex);
          m.emissiveTexture = emit;
          m.emissiveColor = white;
          m.emissiveIntensity = 1.4;
        }
        break;
      }
      case 'mountains': {
        this.pbr('top', white, 0.95, 0, T.trail(s));
        this.pbr('body', white, 0.92, 0, T.cliffRock(s));
        this.pbr('rock', white, 0.9, 0, T.cliffRock(s, 'rockTex', '#7a736a', 1, 1));
        this.pbr('bark', white, 0.9, 0, T.bark(s));
        this.pbr('needles', '#2a4424', 0.9);
        this.pbr('floor', white, 1, 0, T.meadow(s, 'forestFloor', 26, 11, false)).albedoColor = hex('#7f8f6a');
        break;
      }
      case 'hills': {
        this.pbr('top', white, 0.95, 0, T.meadow(s));
        this.pbr('body', white, 0.95, 0, T.earth(s));
        this.pbr('fence', white, 0.85, 0, T.wood(s, 'fenceTex', '#9a7a55', '#5e4630'));
        this.pbr('straw', white, 0.95, 0, T.straw(s));
        this.pbr('bark', white, 0.9, 0, T.bark(s));
        this.pbr('leaves', '#4a7a2c', 0.85);
        this.pbr('bush', '#3d6a26', 0.9);
        this.pbr('wool', '#ece8de', 1);
        this.pbr('sheepHead', '#2a2420', 0.8);
        this.pbr('rock', white, 0.9, 0, T.cliffRock(s, 'rockTex', '#8a847a', 1, 1));
        this.pbr('floor', white, 1, 0, T.meadow(s, 'field', 26, 11, false));
        break;
      }
      case 'village': {
        this.pbr('top', white, 0.9, 0, T.cobbles(s));
        this.pbr('body', white, 0.9, 0, T.stoneBlocks(s, 'sandstone', [184, 160, 128], '#7a6650'));
        this.pbr('stone', white, 0.9, 0, T.stoneBlocks(s, 'sandstoneS', [184, 160, 128], '#7a6650', 0, 2, 1));
        this.pbr('crate', white, 0.85, 0, T.wood(s, 'crateTex', '#a07a4a', '#5a3e22'));
        this.pbr('beam', white, 0.85, 0, T.wood(s, 'beamTex', '#6a4a2c', '#3a2614'));
        this.pbr('roofRed', white, 0.8, 0, T.roofTiles(s, 'roofRedTex', [168, 82, 50]));
        this.pbr('roofBrown', white, 0.8, 0, T.roofTiles(s, 'roofBrownTex', [118, 84, 60]));
        const cottage = T.houseWall(s, 'cottage', 'cottage');
        const cm = this.pbr('cottage', white, 0.85, 0, cottage.albedo);
        cm.emissiveTexture = cottage.emissive;
        cm.emissiveColor = white;
        this.pbr('bark', white, 0.9, 0, T.bark(s));
        this.pbr('leaves', '#557f30', 0.85);
        this.pbr('bush', '#3f6c28', 0.9);
        this.pbr('flowers', '#d8506a', 0.8);
        this.glowMat('lampGlow', '#ffc26a');
        for (const [k, c] of [['cloth1', '#ece6d6'], ['cloth2', '#c0504d'], ['cloth3', '#4f7fbd'], ['cloth4', '#e8c547']] as const) {
          const m = this.pbr(k, c, 0.95);
          m.backFaceCulling = false;
          m.twoSidedLighting = true;
        }
        this.pbr('floor', white, 1, 0, T.meadow(s, 'field', 26, 11, false));
        break;
      }
      case 'halloween': {
        this.pbr('top', white, 0.9, 0, T.flagstones(s));
        this.pbr('body', white, 0.9, 0, T.stoneBlocks(s, 'cryptStone', [70, 66, 78], '#1e1a22', 30));
        this.pbr('stone', white, 0.9, 0, T.stoneBlocks(s, 'graveStone', [110, 106, 116], '#3a3640', 10, 1, 1));
        this.pbr('iron', '#141216', 0.45, 0.85);
        const pumpkin = this.pbr('pumpkin', '#e0701c', 0.6);
        pumpkin.emissiveColor = new Color3(0.25, 0.08, 0);
        this.pbr('stem', '#4a5a22', 0.8);
        this.glowMat('face', '#ffffff', T.pumpkinFace(s));
        const webM = new StandardMaterial('web', s);
        const webT = T.web(s);
        webM.diffuseTexture = webT;
        webM.opacityTexture = webT;
        webM.emissiveColor = new Color3(0.35, 0.35, 0.42);
        webM.backFaceCulling = false;
        this.mats.web = webM;
        this.pbr('bark', '#2a2228', 0.9, 0, T.bark(s, 'deadBark', '#3a3036'));
        const haunted = T.houseWall(s, 'haunted', 'haunted');
        const hm = this.pbr('haunted', white, 0.9, 0, haunted.albedo);
        hm.emissiveTexture = haunted.emissive;
        hm.emissiveColor = white;
        hm.emissiveIntensity = 1.6;
        this.pbr('darkRoof', '#1b1820', 0.8, 0, T.roofTiles(s, 'darkRoofTex', [52, 46, 60]));
        this.glowMat('candle', '#ff9a3a');
        this.glowMat('eyes', '#ff2a2a');
        this.pbr('floor', '#3a3448', 1, 0, T.meadow(s, 'graveGrass', 26, 11, false));
        break;
      }
    }
  }

  // ---------------------------------------------------------------- reusable models

  /** Merges parts into one model that can be stamped many times cheaply. */
  private proto(name: string, parts: Mesh[]) {
    const m = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!;
    m.name = name;
    m.setEnabled(false);
    m.isPickable = false;
    this.protos[name] = m;
    return m;
  }

  /** Draws a model at many places in one draw call, attached to `parent`. */
  private scatter(protoName: string, parent: TransformNode, places: Place[], castShadow = false) {
    if (!places.length) return;
    const proto = this.protos[protoName];
    const m = proto.clone(`${protoName}-set`, parent)!;
    // Thin-instance positions live on the geometry, and clones share it, so each set needs its own copy.
    m.makeGeometryUnique();
    m.setEnabled(true);
    m.receiveShadows = true;
    m.isPickable = false;
    const buf = new Float32Array(16 * places.length);
    const scale = new Vector3();
    const pos = new Vector3();
    places.forEach((p, i) => {
      scale.set(p.sx ?? p.s ?? 1, p.sy ?? p.s ?? 1, p.sz ?? p.s ?? 1);
      pos.set(p.x, p.y, p.z);
      Matrix.Compose(scale, Quaternion.RotationYawPitchRoll(p.ry ?? 0, p.rx ?? 0, p.rz ?? 0), pos).copyToArray(buf, i * 16);
    });
    m.thinInstanceSetBuffer('matrix', buf, 16, true);
    m.thinInstanceRefreshBoundingInfo(false);
    if (castShadow) this.shadows.addShadowCaster(m);
    return m;
  }

  private box(w: number, h: number, d: number, mat: string, x = 0, y = 0, z = 0) {
    const b = MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, this.s);
    b.position.set(x, y, z);
    b.material = this.mats[mat];
    return b;
  }

  private cyl(opts: { h: number; d?: number; top?: number; bottom?: number; tess?: number }, mat: string, x = 0, y = 0, z = 0) {
    const c = MeshBuilder.CreateCylinder('c', { height: opts.h, diameter: opts.d, diameterTop: opts.top ?? opts.d, diameterBottom: opts.bottom ?? opts.d, tessellation: opts.tess ?? 12 }, this.s);
    c.position.set(x, y, z);
    c.material = this.mats[mat];
    return c;
  }

  /** A lumpy, faceted boulder. */
  private rock(radius: number, seed = Math.random() * 10) {
    const r = MeshBuilder.CreateIcoSphere('rock', { radius, subdivisions: 2 }, this.s);
    lumpy(r, 0.22, seed);
    r.convertToFlatShadedMesh();
    r.material = this.mats.rock;
    return r;
  }

  private leafBall(radius: number, mat: string, x: number, y: number, z: number) {
    const l = MeshBuilder.CreateIcoSphere('leaf', { radius, subdivisions: 2 }, this.s);
    lumpy(l, 0.18, Math.random() * 10);
    l.position.set(x, y, z);
    l.material = this.mats[mat];
    return l;
  }

  /** A triangular roof: ridge along x, `depth` across, `height` tall, base at y = 0. */
  private gable(length: number, depth: number, height: number, mat: string) {
    const m = MeshBuilder.CreateCylinder('gable', { tessellation: 3, height: length, diameter: 2 }, this.s);
    m.rotation.z = Math.PI / 2;
    m.bakeCurrentTransformIntoVertices();
    m.scaling.set(1, height / 1.5, depth / 1.732);
    m.position.y = (0.5 * height) / 1.5;
    m.bakeCurrentTransformIntoVertices();
    m.convertToFlatShadedMesh();
    m.material = this.mats[mat];
    return m;
  }

  private pine() {
    const parts = [this.cyl({ h: 1.6, top: 0.18, bottom: 0.3, tess: 8 }, 'bark', 0, 0.8, 0)];
    [[2.6, 1.9, 2.0], [2.0, 1.6, 3.2], [1.3, 1.4, 4.3]].forEach(([d, h, y]) => {
      const c = this.cyl({ h, top: 0, bottom: d, tess: 9 }, 'needles', 0, y, 0);
      lumpy(c, 0.06, Math.random() * 10);
      parts.push(c);
    });
    return parts;
  }

  private oak(scale = 1) {
    const parts = [this.cyl({ h: 2.2 * scale, top: 0.28 * scale, bottom: 0.42 * scale, tess: 8 }, 'bark', 0, 1.1 * scale, 0)];
    parts.push(this.leafBall(1.0 * scale, 'leaves', 0, 2.75 * scale, 0));
    parts.push(this.leafBall(0.75 * scale, 'leaves', 0.55 * scale, 2.35 * scale, 0.2 * scale));
    parts.push(this.leafBall(0.7 * scale, 'leaves', -0.5 * scale, 2.45 * scale, -0.25 * scale));
    return parts;
  }

  private deadTree() {
    const parts = [this.cyl({ h: 3.2, top: 0.12, bottom: 0.38, tess: 7 }, 'bark', 0, 1.6, 0)];
    for (let i = 0; i < 5; i++) {
      const b = this.cyl({ h: rnd(1, 1.8), top: 0.03, bottom: 0.12, tess: 5 }, 'bark');
      const a = (i / 5) * Math.PI * 2 + rnd(-0.3, 0.3);
      b.rotation.set(0, a, rnd(0.6, 1.1));
      b.position.set(Math.cos(a) * 0.35, rnd(1.6, 3), -Math.sin(a) * 0.35);
      parts.push(b);
    }
    return parts;
  }

  private pumpkinParts(scale: number) {
    const body = MeshBuilder.CreateSphere('pumpkin', { diameter: 2, segments: 16 }, this.s);
    const p = body.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < p.length; i += 3) {
      const ang = Math.atan2(p[i + 2], p[i]);
      const k = 1 - 0.06 * (1 - Math.cos(ang * 10));
      p[i] *= k;
      p[i + 2] *= k;
      p[i + 1] *= 0.68;
    }
    body.setVerticesData(VertexBuffer.PositionKind, p);
    const n: number[] = [];
    VertexData.ComputeNormals(p, body.getIndices(), n);
    body.setVerticesData(VertexBuffer.NormalKind, n);
    body.scaling.setAll(scale);
    body.position.y = 0.68 * scale;
    body.material = this.mats.pumpkin;
    const stem = this.cyl({ h: 0.4 * scale, top: 0.1 * scale, bottom: 0.18 * scale, tess: 6 }, 'stem', 0, 1.42 * scale, 0);
    stem.rotation.z = 0.25;
    const face = MeshBuilder.CreatePlane('face', { width: 1.3 * scale, height: 1.0 * scale }, this.s);
    face.position.set(0, 0.7 * scale, -0.93 * scale);
    face.material = this.mats.face;
    return [body, stem, face];
  }

  private makeProtos() {
    switch (this.theme.id) {
      case 'mountains':
        this.proto('rockA', [this.rock(1)]);
        this.proto('rockB', [this.rock(1)]);
        this.proto('pine', this.pine());
        break;
      case 'hills':
        this.proto('rockA', [this.rock(1)]);
        this.proto('oak', this.oak());
        this.proto('bush', [this.leafBall(0.6, 'bush', 0, 0.4, 0), this.leafBall(0.45, 'bush', 0.45, 0.3, 0.1)]);
        this.proto('post', [this.box(0.16, 1.3, 0.16, 'fence', 0, 0.65, 0)]);
        {
          const hay = this.cyl({ h: 1.5, d: 1.1, tess: 16 }, 'straw');
          hay.rotation.z = Math.PI / 2;
          hay.position.y = 0.55;
          this.proto('hay', [hay]);
        }
        {
          const body = this.leafBall(0.55, 'wool', 0, 0.75, 0);
          body.scaling.set(0.8, 0.75, 1.15);
          const head = MeshBuilder.CreateSphere('head', { diameterX: 0.3, diameterY: 0.32, diameterZ: 0.42, segments: 8 }, this.s);
          head.position.set(0, 0.85, 0.65);
          head.material = this.mats.sheepHead;
          const legs = [-0.2, 0.2].flatMap((x) => [-0.3, 0.3].map((z) => this.box(0.08, 0.5, 0.08, 'sheepHead', x, 0.25, z)));
          this.proto('sheep', [body, head, ...legs]);
        }
        break;
      case 'village': {
        this.proto('merlon', [this.box(0.55, 0.5, 0.5, 'stone', 0, 0.25, 0)]);
        this.proto('lamp', [
          this.cyl({ h: 2.6, d: 0.09, tess: 6 }, 'darkMetal', 0, 1.3, 0),
          this.box(0.32, 0.4, 0.32, 'lampGlow', 0, 2.75, 0),
          this.cyl({ h: 0.2, top: 0, bottom: 0.5, tess: 4 }, 'darkMetal', 0, 3.05, 0),
        ]);
        this.proto('planter', [this.box(0.8, 0.45, 0.5, 'crate', 0, 0.22, 0), this.leafBall(0.35, 'bush', -0.15, 0.55, 0), this.leafBall(0.2, 'flowers', 0.2, 0.6, 0)]);
        for (const [name, roof] of [['cottageA', 'roofRed'], ['cottageB', 'roofBrown']] as const) {
          const body = this.box(7, 5, 6, 'cottage', 0, 2.5, 0);
          const top = this.gable(7.6, 6.8, 3.4, roof);
          top.position.y = 5;
          const chimney = this.box(0.7, 2, 0.7, 'stone', 2.2, 6.5, 1.2);
          this.proto(name, [body, top, chimney]);
        }
        {
          const nave = this.box(8, 8, 14, 'stone', 0, 4, 0);
          const navRoof = this.gable(14, 8.6, 4, 'roofBrown');
          navRoof.rotation.y = Math.PI / 2;
          navRoof.position.y = 8;
          const tower = this.box(4, 16, 4, 'stone', 0, 8, -8);
          const spire = this.cyl({ h: 8, top: 0, bottom: 5.4, tess: 4 }, 'roofBrown', 0, 20, -8);
          spire.rotation.y = Math.PI / 4;
          this.proto('church', [nave, navRoof, tower, spire]);
        }
        this.proto('oak', this.oak(1.6));
        this.proto('bush', [this.leafBall(0.7, 'bush', 0, 0.5, 0)]);
        break;
      }
      case 'halloween': {
        this.proto('bar', [this.box(0.05, 1.3, 0.05, 'iron', 0, 0.65, 0), this.cyl({ h: 0.2, top: 0, bottom: 0.1, tess: 4 }, 'iron', 0, 1.4, 0)]);
        this.proto('pumpkin', this.pumpkinParts(0.4));
        this.proto('tomb', [this.box(0.7, 0.9, 0.18, 'stone', 0, 0.45, 0), Object.assign(this.cyl({ h: 0.18, d: 0.7, tess: 16 }, 'stone', 0, 0.9, 0), { rotation: new Vector3(Math.PI / 2, 0, 0) })]);
        this.proto('cross', [this.box(0.16, 1.3, 0.16, 'stone', 0, 0.65, 0), this.box(0.7, 0.16, 0.16, 'stone', 0, 0.95, 0)]);
        this.proto('deadTree', this.deadTree());
        {
          const body = this.box(7, 7, 6, 'haunted', 0, 3.5, 0);
          const roof = this.gable(7.6, 6.8, 5, 'darkRoof');
          roof.position.y = 7;
          const tower = this.box(2.4, 12, 2.4, 'haunted', 2.6, 6, -1.8);
          const towerRoof = this.cyl({ h: 4, top: 0, bottom: 3.2, tess: 4 }, 'darkRoof', 2.6, 14, -1.8);
          towerRoof.rotation.y = Math.PI / 4;
          this.proto('haunted', [body, roof, tower, towerRoof]);
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------- the track

  /** Builds one block of the track (a rooftop, cliff, embankment or wall) under `root`. */
  dressBlock(root: Mesh, length: number) {
    const s = this.s;
    const id = this.theme.id;
    const half = ROOF_W / 2;
    const own = (m: Mesh, shadow = false) => {
      m.parent = root;
      m.receiveShadows = true;
      m.isPickable = false;
      if (shadow) this.shadows.addShadowCaster(m);
      return m;
    };
    const body = own(MeshBuilder.CreateBox('body', { width: ROOF_W + 1.2, height: 70, depth: length }, s));
    body.position.set(0, -35 - 0.2, length / 2);
    body.material = id === 'city' ? this.mats[pick(['wallA', 'wallB', 'wallC'])] : this.mats.body;
    const top = own(MeshBuilder.CreateBox('roofTop', { width: ROOF_W + 1.2, height: 0.25, depth: length }, s));
    top.position.set(0, -0.12, length / 2);
    top.material = this.mats.top;

    const along = (step: number, jitter = 0) => {
      const zs: number[] = [];
      for (let z = 0.6; z < length - 0.4; z += step) zs.push(Math.min(length - 0.3, z + rnd(-jitter, jitter)));
      return zs;
    };

    switch (id) {
      case 'city': {
        for (const side of [-1, 1]) {
          const wall = own(MeshBuilder.CreateBox('parapet', { width: 0.35, height: 0.8, depth: length }, s), true);
          wall.position.set(side * (half + 0.45), 0.4, length / 2);
          wall.material = this.mats.parapet;
        }
        // Antennas and vents at the edges, never in the lanes.
        for (let i = 0; i < Math.floor(length / 14); i++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          if (Math.random() < 0.5) {
            const h = rnd(2, 5);
            const ant = own(MeshBuilder.CreateCylinder('antenna', { diameter: 0.07, height: h }, s));
            ant.position.set(side * (half + 0.45), 0.8 + h / 2, rnd(2, length - 2));
            ant.material = this.mats.darkMetal;
          } else {
            const vent = own(MeshBuilder.CreateCylinder('vent', { diameter: 0.5, height: 0.9 }, s), true);
            vent.position.set(side * (half - 0.3), 0.45, rnd(2, length - 2));
            vent.material = this.mats.metal;
          }
        }
        break;
      }
      case 'mountains': {
        // Loose rocks along both cliff edges and the odd pine clinging to the side.
        const rocks: Place[] = [];
        for (const side of [-1, 1]) {
          for (const z of along(1.1, 0.4)) {
            const sc = rnd(0.25, 0.6);
            rocks.push({ x: side * (half + rnd(0.1, 0.7)), y: sc * 0.3, z, s: sc, sy: sc * rnd(0.6, 1), ry: rnd(0, 6) });
          }
        }
        this.scatter('rockA', root, rocks.filter((_, i) => i % 2 === 0), true);
        this.scatter('rockB', root, rocks.filter((_, i) => i % 2 === 1), true);
        this.scatter(
          'pine',
          root,
          along(15, 5).map((z) => ({ x: (Math.random() < 0.5 ? -1 : 1) * (half + rnd(1.0, 1.6)), y: -0.2, z, s: rnd(0.55, 0.85), ry: rnd(0, 6) })),
          true,
        );
        break;
      }
      case 'hills': {
        for (const side of [-1, 1]) {
          for (const y of [0.55, 1.05]) {
            const rail = own(MeshBuilder.CreateBox('rail', { width: 0.08, height: 0.12, depth: length - 0.6 }, s), true);
            rail.position.set(side * (half + 0.35), y, length / 2);
            rail.material = this.mats.fence;
          }
        }
        const posts: Place[] = [];
        for (const side of [-1, 1]) for (const z of along(2.4)) posts.push({ x: side * (half + 0.35), y: 0, z, ry: rnd(-0.1, 0.1) });
        this.scatter('post', root, posts, true);
        this.scatter(
          'bush',
          root,
          along(9, 3).map((z) => ({ x: (Math.random() < 0.5 ? -1 : 1) * (half + rnd(0.9, 1.4)), y: -0.1, z, s: rnd(0.7, 1.3), ry: rnd(0, 6) })),
        );
        this.scatter(
          'oak',
          root,
          along(26, 8).map((z) => ({ x: (Math.random() < 0.5 ? -1 : 1) * (half + rnd(1.6, 2.2)), y: -0.2, z, s: rnd(0.9, 1.3), ry: rnd(0, 6) })),
          true,
        );
        break;
      }
      case 'village': {
        // Town wall: a low parapet with battlements, street lamps and flower boxes.
        for (const side of [-1, 1]) {
          const wall = own(MeshBuilder.CreateBox('wall', { width: 0.5, height: 0.7, depth: length }, s), true);
          wall.position.set(side * (half + 0.4), 0.35, length / 2);
          wall.material = this.mats.stone;
        }
        const merlons: Place[] = [];
        for (const side of [-1, 1]) for (const z of along(1.5)) merlons.push({ x: side * (half + 0.4), y: 0.7, z });
        this.scatter('merlon', root, merlons, true);
        this.scatter('lamp', root, along(13, 1).map((z, i) => ({ x: (i % 2 ? -1 : 1) * (half - 0.2), y: 0, z })), true);
        this.scatter('planter', root, along(17, 4).map((z, i) => ({ x: (i % 2 ? 1 : -1) * (half - 0.35), y: 0, z, ry: Math.PI / 2 })), true);
        break;
      }
      case 'halloween': {
        for (const side of [-1, 1]) {
          for (const y of [0.15, 1.05]) {
            const rail = own(MeshBuilder.CreateBox('rail', { width: 0.06, height: 0.06, depth: length - 0.6 }, s));
            rail.position.set(side * (half + 0.35), y, length / 2);
            rail.material = this.mats.iron;
          }
        }
        const bars: Place[] = [];
        for (const side of [-1, 1]) for (const z of along(this.quality === 'high' ? 0.4 : 0.7)) bars.push({ x: side * (half + 0.35), y: 0, z });
        this.scatter('bar', root, bars, true);
        this.scatter('pumpkin', root, along(8, 3).map((z) => ({ x: (Math.random() < 0.5 ? -1 : 1) * (half - 0.3), y: 0, z, s: rnd(0.8, 1.2), ry: rnd(-0.4, 0.4) })), true);
        this.scatter('tomb', root, along(11, 4).map((z) => ({ x: (Math.random() < 0.5 ? -1 : 1) * (half + rnd(1, 1.5)), y: -0.1, z, s: rnd(0.8, 1.2), ry: rnd(-0.3, 0.3), rz: rnd(-0.12, 0.12) })), true);
        this.scatter('deadTree', root, along(24, 8).map((z) => ({ x: (Math.random() < 0.5 ? -1 : 1) * (half + rnd(1.4, 2)), y: -0.2, z, s: rnd(0.9, 1.3), ry: rnd(0, 6) })), true);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- obstacles

  /**
   * Adds the model for one obstacle under `node`. Collision sizes are fixed
   * in the runner: 'unit' is about 1 m tall (jump), 'pipe' blocks 1.2–1.7 m
   * (slide), 'tank' is 3.7 m tall (change lanes).
   */
  buildObstacle(kind: ObstacleKind, node: TransformNode) {
    const add = (m: Mesh) => {
      m.parent = node;
      this.shadows.addShadowCaster(m);
      m.receiveShadows = true;
      m.isPickable = false;
      return m;
    };
    const id = this.theme.id;
    const posts = (h: number, mat: string, x = 1.05, tilt = 0) => {
      for (const sx of [-1, 1]) {
        const p = add(this.box(0.14, h, 0.14, mat, sx * x, h / 2, 0));
        p.rotation.z = sx * tilt;
      }
    };

    if (id === 'city') {
      if (kind === 'unit') {
        // Air-conditioning unit.
        add(this.box(1.7, 1.0, 1.1, 'metal', 0, 0.5, 0));
        add(this.cyl({ h: 0.06, d: 0.8 }, 'darkMetal', 0, 1.03, 0));
      } else if (kind === 'pipe') {
        const pipe = add(this.cyl({ h: 2.2, d: 0.45, tess: 16 }, 'rust', 0, 1.45, 0));
        pipe.rotation.z = Math.PI / 2;
        posts(1.5, 'darkMetal', 1.0);
        add(this.box(2.24, 0.1, 0.47, 'warn', 0, 1.45, 0));
      } else {
        // Water tank on a base.
        add(this.cyl({ h: 2.0, d: 1.9, tess: 20 }, 'wood', 0, 2.1, 0));
        add(this.cyl({ h: 0.6, top: 0, bottom: 2.0, tess: 20 }, 'darkMetal', 0, 3.4, 0));
        add(this.box(1.8, 1.1, 1.8, 'darkMetal', 0, 0.55, 0));
      }
      return;
    }

    if (id === 'mountains') {
      if (kind === 'unit') {
        const b = add(this.rock(1));
        b.scaling.set(0.85, 0.5, 0.6);
        b.position.y = 0.48;
        b.rotation.y = rnd(0, 6);
      } else if (kind === 'pipe') {
        const log = add(this.cyl({ h: 2.5, d: 0.46, tess: 12 }, 'bark', 0, 1.45, 0));
        log.rotation.z = Math.PI / 2 + 0.03;
        for (const sx of [-1, 1]) {
          const r = add(this.rock(1));
          r.scaling.set(0.35, 0.62, 0.45);
          r.position.set(sx * 1.08, 0.6, 0);
        }
      } else {
        // A pillar of stacked boulders.
        [[0.95, 0.85], [0.78, 2.15], [0.55, 3.15]].forEach(([rad, y]) => {
          const r = add(this.rock(rad));
          r.position.y = y;
          r.scaling.y = 0.82;
          r.rotation.y = rnd(0, 6);
        });
      }
      return;
    }

    if (id === 'hills') {
      if (kind === 'unit') {
        const hay = add(this.cyl({ h: 1.6, d: 1.0, tess: 18 }, 'straw', 0, 0.5, 0));
        hay.rotation.z = Math.PI / 2;
      } else if (kind === 'pipe') {
        posts(1.85, 'fence', 1.05);
        for (const y of [1.32, 1.62]) add(this.box(2.3, 0.14, 0.09, 'fence', 0, y, 0));
      } else {
        this.oak(1.1).forEach(add);
      }
      return;
    }

    if (id === 'village') {
      if (kind === 'unit') {
        // A stack of market crates.
        add(this.box(0.82, 0.82, 0.8, 'crate', -0.43, 0.41, 0)).rotation.y = 0.08;
        add(this.box(0.82, 0.95, 0.8, 'crate', 0.43, 0.475, 0)).rotation.y = -0.06;
      } else if (kind === 'pipe') {
        // Washing line between two poles.
        posts(2.25, 'beam', 1.1);
        const rope = add(this.cyl({ h: 2.3, d: 0.03, tess: 5 }, 'beam', 0, 2.1, 0));
        rope.rotation.z = Math.PI / 2;
        [-0.75, -0.2, 0.32, 0.8].forEach((x, i) => {
          const h = rnd(0.7, 0.85);
          const cloth = add(MeshBuilder.CreatePlane('cloth', { width: 0.46, height: h }, this.s));
          cloth.position.set(x, 2.08 - h / 2, 0);
          cloth.material = this.mats[`cloth${(i % 4) + 1}`];
        });
      } else {
        // Stone well with a little roof.
        add(this.cyl({ h: 0.95, d: 1.75, tess: 18 }, 'stone', 0, 0.475, 0));
        posts(2.95, 'beam', 0.8);
        const roof = add(this.gable(2.1, 1.9, 0.75, 'roofRed'));
        roof.position.y = 2.95;
        const winch = add(this.cyl({ h: 1.6, d: 0.14, tess: 8 }, 'beam', 0, 2.3, 0));
        winch.rotation.z = Math.PI / 2;
        add(this.cyl({ h: 0.3, top: 0.32, bottom: 0.24, tess: 10 }, 'crate', 0, 1.7, 0));
      }
      return;
    }

    // Halloween
    if (kind === 'unit') {
      this.pumpkinParts(0.75).forEach(add);
    } else if (kind === 'pipe') {
      posts(2.35, 'bark', 1.12, 0.05);
      const beam = add(this.cyl({ h: 2.5, d: 0.16, tess: 7 }, 'bark', 0, 2.3, 0));
      beam.rotation.z = Math.PI / 2 + 0.04;
      const w = add(MeshBuilder.CreatePlane('web', { width: 2.2, height: 1.12 }, this.s));
      w.position.set(0, 1.74, 0);
      w.material = this.mats.web;
    } else {
      // A small crypt with a cross on top.
      add(this.box(1.8, 2.4, 1.5, 'stone', 0, 1.2, 0));
      const roof = add(this.gable(1.95, 1.7, 0.75, 'darkRoof'));
      roof.position.y = 2.4;
      add(this.box(0.12, 0.55, 0.12, 'stone', 0, 3.42, 0));
      add(this.box(0.4, 0.1, 0.12, 'stone', 0, 3.5, 0));
      add(this.box(0.8, 1.4, 0.05, 'iron', 0, 0.7, -0.76));
      add(this.box(0.5, 0.12, 0.06, 'candle', 0, 1.6, -0.77));
    }
  }

  // ---------------------------------------------------------------- the far landscape

  /** Builds the background. Returns pieces the runner scrolls toward the camera. */
  buildBackdrop(): Drifter[] {
    if (this.theme.id === 'city') return this.cityBackdrop();
    this.buildTerrain();
    const drifters: Drifter[] = [];
    const len = 220;
    for (let i = 0; i < 3; i++) {
      const chunk = new TransformNode(`chunk${i}`, this.s);
      chunk.position.set(0, this.floorY, -60 + i * len);
      const ground = MeshBuilder.CreateGround('floor', { width: 560, height: len }, this.s);
      ground.parent = chunk;
      ground.position.z = len / 2;
      ground.material = this.mats.floor;
      ground.isPickable = false;
      this.fillChunk(chunk, len);
      drifters.push({ node: chunk, factor: 1, min: -60 - len, span: len * 3 });
    }
    return drifters;
  }

  private cityBackdrop(): Drifter[] {
    // Distant towers on both sides; they drift slowly and recycle for a sense of depth.
    const out: Drifter[] = [];
    for (let i = 0; i < 70; i++) {
      const h = rnd(25, 110);
      const b = MeshBuilder.CreateBox(`sky${i}`, { width: rnd(10, 22), depth: rnd(10, 22), height: h }, this.s);
      b.material = this.mats[pick(['wallA', 'wallB', 'wallC'])];
      const side = i % 2 ? 1 : -1;
      b.position.set(side * rnd(22, 140), h / 2 - 55, rnd(-20, 600));
      b.isPickable = false;
      out.push({ node: b, factor: 0.35, min: -60, span: 660 });
    }
    return out;
  }

  /** Scatter for one stretch of valley floor (local z from 0 to `len`). */
  private fillChunk(chunk: TransformNode, len: number) {
    const q = this.quality === 'high' ? 1 : 0.5;
    const spread = (count: number, near: number, far: number, bias = 1.4) =>
      Array.from({ length: Math.round(count * q) }, () => {
        const side = Math.random() < 0.5 ? -1 : 1;
        return { x: side * (near + Math.pow(Math.random(), bias) * (far - near)), y: 0, z: rnd(0, len), ry: rnd(0, 6) } as Place;
      });
    switch (this.theme.id) {
      case 'mountains':
        this.scatter('pine', chunk, spread(320, 9, 230).map((p) => ({ ...p, s: rnd(1.2, 2.6) })));
        this.scatter('rockA', chunk, spread(40, 10, 200).map((p) => ({ ...p, s: rnd(1, 3) })));
        break;
      case 'hills':
        this.scatter('oak', chunk, spread(80, 10, 220).map((p) => ({ ...p, s: rnd(1.2, 2.2) })));
        this.scatter('bush', chunk, spread(140, 8, 180).map((p) => ({ ...p, s: rnd(1, 2) })));
        this.scatter('sheep', chunk, spread(30, 12, 90, 1).map((p) => ({ ...p, s: rnd(1.1, 1.4) })));
        this.scatter('hay', chunk, spread(16, 12, 100, 1).map((p) => ({ ...p, s: 1.4 })));
        break;
      case 'village':
        this.scatter('cottageA', chunk, spread(22, 12, 120).map((p) => ({ ...p, ry: pick([0, Math.PI / 2, Math.PI]) + rnd(-0.15, 0.15) })));
        this.scatter('cottageB', chunk, spread(22, 12, 120).map((p) => ({ ...p, ry: pick([0, Math.PI / 2, Math.PI]) + rnd(-0.15, 0.15) })));
        this.scatter('church', chunk, [{ x: pick([-1, 1]) * rnd(40, 70), y: 0, z: rnd(40, 180), ry: rnd(-0.2, 0.2) }]);
        this.scatter('oak', chunk, spread(50, 10, 200).map((p) => ({ ...p, s: rnd(1, 1.5) })));
        this.scatter('bush', chunk, spread(60, 9, 150).map((p) => ({ ...p, s: rnd(0.8, 1.6) })));
        break;
      case 'halloween':
        this.scatter('haunted', chunk, spread(12, 16, 120).map((p) => ({ ...p, ry: pick([0, Math.PI / 2]) + rnd(-0.2, 0.2) })));
        this.scatter('deadTree', chunk, spread(90, 8, 200).map((p) => ({ ...p, s: rnd(1.6, 3) })));
        this.scatter('tomb', chunk, spread(140, 8, 70, 1).map((p) => ({ ...p, s: rnd(1.2, 1.8), rz: rnd(-0.15, 0.15) })));
        this.scatter('cross', chunk, spread(50, 8, 70, 1).map((p) => ({ ...p, s: rnd(1.2, 1.6), rz: rnd(-0.15, 0.15) })));
        this.scatter('pumpkin', chunk, spread(40, 8, 60, 1).map((p) => ({ ...p, s: rnd(1.5, 2.5), ry: Math.PI + rnd(-0.6, 0.6) })));
        break;
    }
  }

  /** Mountains or hills that frame the valley and close off the horizon. */
  private buildTerrain() {
    const id = this.theme.id;
    const W = 2800;
    const D = 2000;
    const cz = 650;
    const sub = this.quality === 'high' ? 1 : 0.6;
    const g = MeshBuilder.CreateGround('terrain', { width: W, height: D, subdivisionsX: Math.round(220 * sub), subdivisionsY: Math.round(160 * sub), updatable: true }, this.s);
    g.position.set(0, this.floorY, cz);
    const height = (x: number, z: number) => {
      if (id === 'mountains') {
        const mask = Math.max(smooth(240, 700, Math.abs(x)), smooth(650, 1250, z));
        return mask * (ridged(x / 300 + 7, z / 300 + 3) * 330 + fbm(x / 70, z / 70, 3) * 24) - 14 * (1 - mask);
      }
      const amp = id === 'hills' ? 170 : id === 'village' ? 130 : 75;
      const mask = Math.max(smooth(90, 360, Math.abs(x)), smooth(380, 850, z));
      return mask * (fbm(x / 240 + 11, z / 240 + 5, 4) * amp * 1.4 + fbm(x / 60, z / 60, 2) * 10) - 8 * (1 - mask);
    };
    const pos = g.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = height(pos[i], pos[i + 2] + cz);
    const normals: number[] = [];
    VertexData.ComputeNormals(pos, g.getIndices(), normals);
    const colors: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2] + cz;
      const h = pos[i + 1];
      const ny = normals[i + 1];
      const n = fbm(x / 90, z / 90, 3);
      let c: [number, number, number];
      if (id === 'mountains') {
        const forest: [number, number, number] = n > 0.5 ? [0.13, 0.2, 0.1] : [0.26, 0.33, 0.17];
        const rockC: [number, number, number] = [0.42 + n * 0.1, 0.4 + n * 0.08, 0.37 + n * 0.06];
        const snow: [number, number, number] = [0.93, 0.95, 1];
        const rockW = Math.max(smooth(0.86, 0.7, ny), smooth(90, 150, h));
        const snowW = smooth(170 + n * 70, 210 + n * 70, h) * smooth(0.4, 0.6, ny);
        c = forest.map((f, k) => f + (rockC[k] - f) * rockW) as [number, number, number];
        c = c.map((f, k) => f + (snow[k] - f) * snowW) as [number, number, number];
      } else if (id === 'halloween') {
        c = [0.07 + n * 0.05, 0.07 + n * 0.04, 0.1 + n * 0.06];
      } else {
        // Patchwork of fields and woods.
        const field = noise(x / 45, z / 45);
        const greens: [number, number, number] = field > 0.62 ? (id === 'village' ? [0.72, 0.6, 0.3] : [0.62, 0.62, 0.28]) : field < 0.3 ? [0.16, 0.28, 0.1] : [0.3 + n * 0.12, 0.46 + n * 0.1, 0.18];
        const shade = 0.75 + 0.25 * ny;
        c = greens.map((v) => v * shade) as [number, number, number];
      }
      colors.push(c[0], c[1], c[2], 1);
    }
    g.updateVerticesData(VertexBuffer.PositionKind, pos);
    g.setVerticesData(VertexBuffer.NormalKind, normals);
    g.setVerticesData(VertexBuffer.ColorKind, colors);
    g.refreshBoundingInfo();
    const m = new PBRMaterial('terrainMat', this.s);
    m.albedoColor = Color3.White();
    m.roughness = 1;
    m.metallic = 0;
    g.material = m;
    g.isPickable = false;
    g.freezeWorldMatrix();

    // Woods, cottages or dead trees on the slopes.
    const items: Place[] = [];
    const want = Math.round((id === 'village' ? 120 : 700) * sub);
    const proto = id === 'mountains' ? 'pine' : id === 'hills' ? 'oak' : id === 'village' ? pick(['cottageA', 'cottageB']) : 'deadTree';
    for (let tries = 0; items.length < want && tries < want * 12; tries++) {
      const x = rnd(-1100, 1100);
      const z = rnd(100, 1400);
      const h = height(x, z);
      if (Math.abs(x) < 240 && z < 500) continue;
      if (id === 'mountains' && (h > 110 || h < 5 || fbm(x / 120, z / 120, 2) < 0.45)) continue;
      if (id !== 'mountains' && h < 3) continue;
      const big = id === 'mountains' ? rnd(4, 8) : id === 'village' ? rnd(1, 1.6) : rnd(3, 6);
      items.push({ x, y: h - 0.5, z: z - cz, s: big, ry: rnd(0, 6) });
    }
    const forest = this.scatter(proto, g, items);
    forest?.freezeWorldMatrix();
  }

  // ---------------------------------------------------------------- the chaser

  buildChaser(): Chaser {
    if (this.theme.id === 'city') return this.drone();
    const look = {
      mountains: { body: '#4a3020', head: '#f2efe6', wing: '#3a2618', span: 1.05, flap: 4.5, amp: 0.4 },
      hills: { body: '#6a4a2e', head: '#7a5a3a', wing: '#4e3622', span: 0.95, flap: 5.5, amp: 0.45 },
      village: { body: '#18161c', head: '#18161c', wing: '#121016', span: 0.8, flap: 8, amp: 0.55 },
      halloween: { body: '#1a1418', head: '#1a1418', wing: '#2c2028', span: 0.9, flap: 13, amp: 0.75 },
    }[this.theme.id];
    const bat = this.theme.id === 'halloween';
    const node = new TransformNode('chaser', this.s);
    node.scaling.setAll(1.25);
    node.rotation.x = 0.35; // nose down a little so the camera sees the wings from above
    const bodyMat = this.pbr('chaserBody', look.body, 0.85);
    const headMat = this.pbr('chaserHead', look.head, 0.8);
    const wingMat = this.pbr('chaserWing', look.wing, 0.9);
    wingMat.backFaceCulling = false;
    wingMat.twoSidedLighting = true;
    const body = MeshBuilder.CreateSphere('cBody', { diameterX: 0.34, diameterY: 0.3, diameterZ: bat ? 0.45 : 0.75, segments: 12 }, this.s);
    body.material = bodyMat;
    body.parent = node;
    const head = MeshBuilder.CreateSphere('cHead', { diameter: bat ? 0.24 : 0.22, segments: 10 }, this.s);
    head.material = headMat;
    head.parent = node;
    head.position.set(0, 0.06, bat ? 0.25 : 0.38);
    if (bat) {
      for (const sx of [-1, 1]) {
        const ear = this.cyl({ h: 0.14, top: 0, bottom: 0.08, tess: 4 }, 'chaserBody', sx * 0.06, 0.18, 0.25);
        ear.parent = node;
        const eye = MeshBuilder.CreateSphere('eye', { diameter: 0.045 }, this.s);
        eye.material = this.mats.eyes;
        eye.parent = node;
        eye.position.set(sx * 0.055, 0.09, 0.36);
      }
    } else {
      const beak = this.cyl({ h: 0.14, top: 0, bottom: 0.08, tess: 6 }, 'warn', 0, 0.04, 0.53);
      beak.rotation.x = Math.PI / 2;
      beak.parent = node;
      const tail = flatShape('tail', [[0, -0.25], [-0.16, -0.62], [0.16, -0.62]], this.s);
      tail.material = wingMat;
      tail.parent = node;
    }
    const wings: TransformNode[] = [];
    for (const sx of [-1, 1]) {
      const pivot = new TransformNode('wingPivot', this.s);
      pivot.parent = node;
      pivot.position.set(sx * 0.12, 0.05, 0);
      const span = look.span;
      const pts: [number, number][] = bat
        ? [[0, 0], [0, 0.2], [span * 0.4, 0.3], [span, 0.22], [span * 0.86, -0.18], [span * 0.66, -0.06], [span * 0.48, -0.36], [span * 0.26, -0.12], [0, -0.26]]
        : [[0, 0], [0, 0.2], [span * 0.45, 0.26], [span * 0.85, 0.16], [span * 1.05, -0.05], [span * 0.95, -0.3], [span * 0.7, -0.4], [span * 0.35, -0.42], [0, -0.3]];
      const wing = flatShape('wing', pts.map(([x, z]) => [x * sx, z] as [number, number]), this.s);
      wing.material = wingMat;
      wing.parent = pivot;
      wings.push(pivot);
      this.shadows.addShadowCaster(wing);
    }
    this.shadows.addShadowCaster(body);
    return {
      node,
      animate: (_dt, clock) => {
        // Wings held in a shallow V (so they read from behind) and flapping.
        const a = 0.3 + Math.sin(clock * look.flap) * look.amp;
        wings[0].rotation.z = -a;
        wings[1].rotation.z = a;
      },
    };
  }

  private drone(): Chaser {
    const d = new TransformNode('drone', this.s);
    const body = MeshBuilder.CreateSphere('droneBody', { diameterX: 0.7, diameterY: 0.28, diameterZ: 0.7, segments: 12 }, this.s);
    body.material = this.mats.darkMetal;
    body.parent = d;
    const rotors: Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = this.box(0.6, 0.05, 0.08, 'darkMetal', Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      arm.parent = d;
      arm.rotation.y = -a;
      const rotor = this.cyl({ h: 0.02, d: 0.42 }, 'metal', Math.cos(a) * 0.58, 0.06, Math.sin(a) * 0.58);
      rotor.parent = d;
      rotor.visibility = 0.55;
      rotors.push(rotor);
    }
    const light = MeshBuilder.CreateSphere('droneLight', { diameter: 0.12 }, this.s);
    light.material = this.glowMat('droneLightMat', '#ff1a1a');
    light.parent = d;
    light.position.set(0, -0.12, 0.3);
    this.shadows.addShadowCaster(body);
    return {
      node: d,
      animate: (dt, clock) => {
        light.isVisible = Math.floor(clock * 3) % 2 === 0;
        rotors.forEach((r) => (r.rotation.y += dt * 40));
      },
    };
  }
}
