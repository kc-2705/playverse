import {
  Color3,
  Color4,
  CubeTexture,
  DynamicTexture,
  DirectionalLight,
  Engine,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Matrix,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TrailMesh,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { WingsuitAudio } from './audio';
import { centerX, difficulty, fbm, floorY, halfWidth, seeded, terrainHeight, wallHeight } from './canyon';
import { loadHero } from '../shared/hero';
import { cliffRock, skyGradient } from '../rooftop/textures';

/*
 * Wingsuit Canyon
 * Glide down an endless, winding canyon. Diving trades height for speed,
 * pulling up trades speed for height. Points come from distance, rings,
 * flying close to the rock, and threading stone arches. Your best run is
 * saved and replayed as a ghost.
 */

export type WingState = 'loading' | 'ready' | 'flying' | 'paused' | 'over';
export interface WingStats {
  distance: number;
  score: number;
  rings: number;
  closeCalls: number;
  arches: number;
  gates: number;
  speed: number;
  height: number;
  durationMs: number;
  reason?: string;
  newBest?: boolean;
}
export interface WingCallbacks {
  onState: (s: WingState) => void;
  onHud: (s: WingStats) => void;
  onProgress?: (p: number) => void;
  onEvent?: (text: string) => void;
  onGameOver: (s: WingStats) => void;
}

const CHUNK = 200;
const AHEAD = 7;
const GLIDE_PITCH = -0.38; // natural glide angle (nose down), about 2.5 : 1
const MIN_SPEED = 16;
const MAX_SPEED = 95;
const DRAG = (9.8 * Math.sin(-GLIDE_PITCH)) / (44 * 44); // terminal speed 44 m/s in a neutral glide
const GHOST_KEY = 'pv.wingsuit.ghost.v2'; // v2: the canyon gained hurdles, so older ghosts no longer fit
const GHOST_RATE = 0.1;

interface Pillar {
  x: number;
  z: number;
  r: number;
  top: number;
}
interface Arch {
  z: number;
  cx: number;
  span: number;
  base: number;
  rise: number;
  tube: number;
  passed: boolean;
}
interface Ring {
  mesh: Mesh;
  pos: Vector3;
  taken: boolean;
}
/** A rock wall across the canyon with one window to fly through. */
interface Gate {
  z: number;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  thick: number;
  warned: boolean;
  passed: boolean;
}
/** A stone slab spanning the canyon: fly over or under it. */
interface Bridge {
  z: number;
  y: number;
  thick: number;
  depth: number;
  warned: boolean;
  passed: boolean;
}
interface Chunk {
  index: number;
  meshes: Mesh[];
  pillars: Pillar[];
  arches: Arch[];
  gates: Gate[];
  bridges: Bridge[];
  rings: Ring[];
}
type Sample = [number, number, number, number, number, number];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hex = (s: string) => Color3.FromHexString(s);

export class WingsuitGame {
  private engine: Engine;
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private camera!: FreeCamera;
  private sun!: DirectionalLight;
  private shadows?: ShadowGenerator;
  private audio = new WingsuitAudio();
  private disposed = false;
  private state: WingState = 'loading';

  private flyer!: TransformNode;
  private ghost!: TransformNode;
  private ghostRun: { score: number; samples: Sample[] } | null = null;
  private recording: Sample[] = [];
  private recordTimer = 0;
  private streaks: { mesh: Mesh; off: Vector3 }[] = [];
  private chunks = new Map<number, Chunk>();
  private mats: Record<string, PBRMaterial | StandardMaterial> = {};

  private pos = new Vector3();
  private yaw = 0;
  private pitch = GLIDE_PITCH;
  private bank = 0;
  private speed = 38;
  private input = { steer: 0, pitch: 0 };
  private time = 0;
  private clock = 0;
  private score = 0;
  private rings = 0;
  private closeCalls = 0;
  private arches = 0;
  private gates = 0;
  private near = false;
  private farFor = 2;
  private hudTimer = 0;
  private shake = 0;

  constructor(container: HTMLElement, private cb: WingCallbacks, private quality: 'high' | 'low' = 'high') {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Wingsuit Canyon game');
    container.appendChild(canvas);
    this.canvas = canvas;
    this.engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true }, true);
    this.engine.setHardwareScalingLevel(quality === 'high' ? 1 / Math.min(window.devicePixelRatio, 1.5) : 1.25);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.91, 0.73, 0.55, 1);
    try {
      const saved = localStorage.getItem(GHOST_KEY);
      if (saved) this.ghostRun = JSON.parse(saved);
    } catch {
      this.ghostRun = null;
    }
  }

  // ------------------------------------------------------------------ setup

  async load() {
    this.setState('loading');
    this.cb.onProgress?.(0.05);
    this.setupScene();
    this.cb.onProgress?.(0.15);
    await this.buildFlyer();
    if (this.disposed) return;
    this.cb.onProgress?.(0.7);
    this.buildGhost();
    this.buildStreaks();
    this.reset();
    this.cb.onProgress?.(1);
    if (import.meta.env.DEV) Object.assign(window, { __wing: this, __h: terrainHeight, __canyon: { centerX, floorY } });
    this.engine.runRenderLoop(() => {
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
    this.setState('ready');
  }

  private onResize = () => this.engine.resize();

  private setupScene() {
    const s = this.scene;
    this.camera = new FreeCamera('cam', new Vector3(0, 10, -10), s);
    this.camera.minZ = 0.3;
    this.camera.maxZ = 2600;
    this.camera.fov = 0.95;
    this.camera.inputs.clear();

    const skyMat = new StandardMaterial('sky', s);
    skyMat.emissiveTexture = skyGradient(s, [[0, '#b9805a'], [0.47, '#f2c38f'], [0.5, '#ffe2b8'], [0.56, '#f6c9a0'], [0.7, '#9fbfe0'], [1, '#3f74b8']]);
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    const sky = MeshBuilder.CreateSphere('sky', { diameter: 4800, segments: 24, sideOrientation: Mesh.BACKSIDE }, s);
    sky.material = skyMat;
    sky.infiniteDistance = true;
    sky.applyFog = false;
    sky.isPickable = false;
    const sunMat = new StandardMaterial('sunMat', s);
    sunMat.emissiveColor = hex('#fff1cf');
    sunMat.disableLighting = true;
    sunMat.backFaceCulling = false;
    const sunDisc = MeshBuilder.CreateDisc('sunDisc', { radius: 70, tessellation: 48 }, s);
    sunDisc.material = sunMat;
    sunDisc.position = new Vector3(-700, 520, 1800);
    sunDisc.lookAt(Vector3.Zero());
    sunDisc.infiniteDistance = true;
    sunDisc.applyFog = false;

    s.environmentTexture = new CubeTexture('/assets/env/sky.env', s);
    s.environmentIntensity = 0.6;
    const hemi = new HemisphericLight('fill', new Vector3(0, 1, 0), s);
    hemi.intensity = 0.55;
    hemi.diffuse = hex('#c9d8f0');
    hemi.groundColor = hex('#6b3a24');
    this.sun = new DirectionalLight('sun', new Vector3(0.45, -0.75, 0.5).normalize(), s);
    this.sun.intensity = 3.2;
    this.sun.diffuse = hex('#ffe0b5');
    if (this.quality === 'high') {
      // Only the flyer casts a shadow; on the canyon floor it shows how low you are.
      this.shadows = new ShadowGenerator(1024, this.sun);
      this.shadows.useBlurExponentialShadowMap = true;
      this.shadows.darkness = 0.4;
    }

    s.fogMode = Scene.FOGMODE_EXP2;
    s.fogDensity = 0.0017;
    s.fogColor = hex('#e9bd92');

    const ip = s.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.05;
    ip.contrast = 1.12;
    if (this.quality === 'high') {
      ip.vignetteEnabled = true;
      ip.vignetteWeight = 1.4;
      ip.vignetteColor = new Color4(0.15, 0.06, 0.02, 0);
      new GlowLayer('glow', s, { mainTextureRatio: 0.5 }).intensity = 0.5;
    }

    const terrain = new PBRMaterial('terrain', s);
    terrain.albedoColor = Color3.White();
    // Fine rock grain on top of the painted strata colours (vertex colours).
    terrain.albedoTexture = cliffRock(s, 'grain', '#d6cfc6', 46, 22);
    terrain.roughness = 0.95;
    terrain.metallic = 0;
    this.mats.terrain = terrain;
    const water = new PBRMaterial('water', s);
    water.albedoColor = hex('#1e5a63');
    water.roughness = 0.06;
    water.metallic = 0.1;
    water.alpha = 0.88;
    this.mats.water = water;
    const rock = new PBRMaterial('rock', s);
    rock.albedoTexture = cliffRock(s, 'canyonRock', '#a8583a', 2, 6);
    rock.roughness = 0.95;
    this.mats.rock = rock;
    const ring = new StandardMaterial('ring', s);
    ring.emissiveColor = hex('#ffc93c');
    ring.disableLighting = true;
    this.mats.ring = ring;
    const scrub = new PBRMaterial('scrub', s);
    scrub.albedoColor = hex('#4d5a2c');
    scrub.roughness = 1;
    this.mats.scrub = scrub;
  }

  /** Remy, lying face down in a T-pose, with fabric wings between arms, body and legs. */
  private async buildFlyer() {
    const s = this.scene;
    const hero = await loadHero(s);
    if (this.disposed) return;
    hero.setTPose();
    const bones = new Map(s.transformNodes.filter((n) => n.name.startsWith('mixamorig:')).map((n) => [n.name.slice(10), n]));
    const at = (n: string) => bones.get(n)?.getAbsolutePosition().clone() ?? Vector3.Zero();
    hero.root.computeWorldMatrix(true);
    s.transformNodes.forEach((n) => n.computeWorldMatrix(true));
    const hips = at('Hips');

    const suit = new PBRMaterial('suit', s);
    suit.albedoColor = hex('#ff5a1f');
    suit.roughness = 0.55;
    suit.backFaceCulling = false;
    suit.twoSidedLighting = true;
    const wing = (name: string, pts: Vector3[]) => {
      const positions: number[] = [];
      pts.forEach((p) => positions.push(p.x, p.y, p.z));
      const indices: number[] = [];
      for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1);
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      const vd = new VertexData();
      vd.positions = positions;
      vd.indices = indices;
      vd.normals = normals;
      const m = new Mesh(name, s);
      vd.applyToMesh(m);
      m.material = suit;
      m.parent = hero.root;
      return m;
    };
    const membranes: Mesh[] = [];
    for (const side of ['Left', 'Right']) {
      // Wrist → shoulder → hip → knee, pulled slightly in so the fabric hugs the body.
      const hand = at(`${side}Hand`);
      const shoulder = at(`${side}Arm`);
      const upLeg = at(`${side}UpLeg`);
      const knee = at(`${side}Leg`);
      membranes.push(wing(`${side}Wing`, [shoulder, hand, Vector3.Lerp(hand, knee, 0.45), knee, upLeg]));
    }
    const lFoot = at('LeftFoot');
    const rFoot = at('RightFoot');
    membranes.push(wing('LegWing', [hips.add(new Vector3(0, -0.12, 0)), lFoot, rFoot]));

    // Face down, head forward (+z), pivoting at the hips.
    this.flyer = new TransformNode('flyer', s);
    const prone = new TransformNode('prone', s);
    prone.parent = this.flyer;
    prone.rotation.x = Math.PI / 2;
    hero.root.parent = prone;
    hero.root.position.y = -hips.y;
    for (const m of [...hero.meshes, ...membranes]) {
      m.receiveShadows = false;
      this.shadows?.addShadowCaster(m);
    }
  }

  /** Your best run, replayed as a glowing marker with a light trail and a "Your best" label. */
  private buildGhost() {
    const s = this.scene;
    const mat = new StandardMaterial('ghostMat', s);
    mat.emissiveColor = hex('#7fe3ff');
    mat.disableLighting = true;
    const node = new TransformNode('ghost', s);
    const orb = MeshBuilder.CreateSphere('ghostOrb', { diameter: 0.7, segments: 16 }, s);
    orb.material = mat;
    orb.parent = node;
    orb.isPickable = false;
    const trailMat = new StandardMaterial('ghostTrailMat', s);
    trailMat.emissiveColor = hex('#7fe3ff');
    trailMat.disableLighting = true;
    trailMat.alpha = 0.35;
    const trail = new TrailMesh('ghostTrail', orb, s, 0.35, 70, true);
    trail.material = trailMat;
    trail.isPickable = false;
    const tex = new DynamicTexture('ghostLabel', { width: 256, height: 64 }, s, true);
    const c = tex.getContext() as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(10,20,40,0.7)';
    c.beginPath();
    c.roundRect(24, 8, 208, 48, 24);
    c.fill();
    c.fillStyle = '#bff3ff';
    c.font = 'bold 30px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('Your best', 128, 33);
    tex.update();
    tex.hasAlpha = true;
    const labelMat = new StandardMaterial('ghostLabelMat', s);
    labelMat.diffuseTexture = tex;
    labelMat.useAlphaFromDiffuseTexture = true;
    labelMat.emissiveColor = Color3.White();
    labelMat.disableLighting = true;
    const label = MeshBuilder.CreatePlane('ghostLabel', { width: 2.4, height: 0.6 }, s);
    label.material = labelMat;
    label.billboardMode = Mesh.BILLBOARDMODE_ALL;
    label.position.y = 1.2;
    label.parent = node;
    label.isPickable = false;
    this.ghostTrail = trail;
    node.setEnabled(false);
    this.ghost = node;
  }
  private ghostTrail?: TrailMesh;

  private buildStreaks() {
    const mat = new StandardMaterial('streak', this.scene);
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.alpha = 0.22;
    const base = MeshBuilder.CreateBox('streak', { width: 0.025, height: 0.025, depth: 3.5 }, this.scene);
    base.material = mat;
    base.isVisible = false;
    for (let i = 0; i < 40; i++) {
      const mesh = base.createInstance(`streak${i}`) as unknown as Mesh;
      this.streaks.push({ mesh, off: new Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, Math.random() * 50 - 10) });
    }
  }

  // ------------------------------------------------------------------ the canyon

  private buildChunk(index: number): Chunk {
    const s = this.scene;
    const z0 = index * CHUNK;
    const zMid = z0 + CHUNK / 2;
    const cx = centerX(zMid);
    const width = 460;
    const sub = this.quality === 'high' ? 5 : 8;
    const ground = MeshBuilder.CreateGround(`terrain${index}`, { width, height: CHUNK, subdivisionsX: Math.round(width / sub), subdivisionsY: Math.round(CHUNK / sub), updatable: true }, s);
    ground.position.set(cx, 0, zMid);
    const pos = ground.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = terrainHeight(pos[i] + cx, pos[i + 2] + zMid);
    const normals: number[] = [];
    VertexData.ComputeNormals(pos, ground.getIndices(), normals);
    const colors: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] + cx;
      const z = pos[i + 2] + zMid;
      const rel = pos[i + 1] - floorY(z);
      const ny = normals[i + 1];
      const n = fbm(x / 30, z / 30, 3);
      // Sandstone strata: red, orange and cream layers.
      const band = 0.5 + 0.5 * Math.sin(rel * 0.33 + n * 3);
      let c: [number, number, number] = [0.62 + band * 0.2, 0.27 + band * 0.22, 0.15 + band * 0.13];
      if (band > 0.88) c = [0.86, 0.71, 0.53];
      if (rel < 3) c = rel < 0.5 ? [0.36, 0.3, 0.24] : [0.78, 0.62, 0.45]; // wet bank, then sand
      if (ny > 0.9 && rel > 40) c = [0.55 + n * 0.1, 0.45, 0.28]; // mesa tops
      const shade = 0.6 + 0.4 * ny;
      colors.push(c[0] * shade, c[1] * shade, c[2] * shade, 1);
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, pos);
    ground.setVerticesData(VertexBuffer.NormalKind, normals);
    ground.setVerticesData(VertexBuffer.ColorKind, colors);
    ground.refreshBoundingInfo();
    ground.material = this.mats.terrain;
    ground.receiveShadows = true;
    ground.isPickable = false;
    const meshes: Mesh[] = [ground];

    // River.
    const left: Vector3[] = [];
    const right: Vector3[] = [];
    for (let z = z0 - 2; z <= z0 + CHUNK + 2; z += 8) {
      const c = centerX(z);
      const w = halfWidth(z) * 0.43;
      left.push(new Vector3(c - w, floorY(z) - 0.7, z));
      right.push(new Vector3(c + w, floorY(z) - 0.7, z));
    }
    const river = MeshBuilder.CreateRibbon(`river${index}`, { pathArray: [left, right] }, s);
    river.material = this.mats.water;
    river.isPickable = false;
    meshes.push(river);

    // Scrub on the banks.
    const rand = seeded(index * 7919 + 13);
    const scrub = MeshBuilder.CreateIcoSphere('scrub', { radius: 1, subdivisions: 2 }, s);
    scrub.material = this.mats.scrub;
    const buf: number[] = [];
    for (let i = 0; i < 40; i++) {
      const z = z0 + rand() * CHUNK;
      const side = rand() < 0.5 ? -1 : 1;
      const x = centerX(z) + side * halfWidth(z) * (0.5 + rand() * 0.45);
      const sc = 0.6 + rand() * 1.4;
      Matrix.Compose(new Vector3(sc, sc * 0.6, sc), Quaternion.Identity(), new Vector3(x, terrainHeight(x, z), z)).toArray(buf, i * 16);
    }
    scrub.thinInstanceSetBuffer('matrix', new Float32Array(buf), 16, true);
    scrub.thinInstanceRefreshBoundingInfo(false);
    scrub.isPickable = false;
    meshes.push(scrub);

    // Obstacles and rings. The first stretch is clear so a run starts calmly.
    const pillars: Pillar[] = [];
    const arches: Arch[] = [];
    const rings: Ring[] = [];
    const gates: Gate[] = [];
    const bridges: Bridge[] = [];
    const level = difficulty(z0);
    if (index >= 2) {
      const count = Math.floor(rand() * 2 + level * 4);
      // Gates and bridges sit near the middle of their stretch; keep towers clear of them so every hurdle can be passed.
      const hurdleZ = index >= 3 && index % 3 !== 0 ? z0 + 100 : null;
      for (let i = 0; i < count; i++) {
        const z = z0 + 20 + rand() * (CHUNK - 40);
        if (hurdleZ !== null && Math.abs(z - hurdleZ) < 50) continue;
        const x = centerX(z) + (rand() - 0.5) * halfWidth(z) * 1.0;
        const r = 3 + rand() * 3;
        const ground0 = terrainHeight(x, z);
        const h = 25 + rand() * 45;
        // A hoodoo: stacked, tapering rock with a wider cap.
        const parts = [
          MeshBuilder.CreateCylinder('hoodoo', { height: h, diameterBottom: r * 2.2, diameterTop: r * 1.5, tessellation: 10 }, s),
          MeshBuilder.CreateCylinder('cap', { height: 4, diameterBottom: r * 1.9, diameterTop: r * 2.4, tessellation: 10 }, s),
        ];
        parts[0].position.set(x, ground0 + h / 2 - 2, z);
        parts[1].position.set(x, ground0 + h - 0.5, z);
        const hoodoo = Mesh.MergeMeshes(parts, true)!;
        hoodoo.material = this.mats.rock;
        hoodoo.isPickable = false;
        meshes.push(hoodoo);
        pillars.push({ x, z, r: r * 1.1, top: ground0 + h + 1.5 });
      }
      // Every third stretch has a rock gate, the next a stone bridge, the next maybe an arch.
      if (index >= 4 && index % 3 === 1) gates.push(this.buildGate(z0 + 100, rand, level, meshes));
      if (index >= 3 && index % 3 === 2) bridges.push(this.buildBridge(z0 + 80 + rand() * 40, rand, meshes));
      if (index >= 3 && index % 3 === 0 && rand() < 0.7) {
        const z = z0 + 60 + rand() * 80;
        const cx2 = centerX(z);
        const span = halfWidth(z) + 14;
        const base = floorY(z) - 6;
        const rise = 50 + rand() * 30;
        const tube = 5;
        const path: Vector3[] = [];
        for (let i = 0; i <= 32; i++) {
          const t = (i / 32) * Math.PI;
          path.push(new Vector3(cx2 - Math.cos(t) * span, base + Math.sin(t) * rise, z));
        }
        const arch = MeshBuilder.CreateTube('arch', { path, radius: tube, tessellation: 12, cap: Mesh.CAP_ALL }, s);
        arch.material = this.mats.rock;
        arch.isPickable = false;
        meshes.push(arch);
        arches.push({ z, cx: cx2, span, base, rise, tube, passed: false });
      }
    }
    if (index >= 1) {
      for (let i = 0; i < 3; i++) {
        const z = z0 + 30 + i * 60 + rand() * 20;
        const x = centerX(z) + (rand() - 0.5) * halfWidth(z) * 0.8;
        const y = Math.max(terrainHeight(x, z) + 9, floorY(z) + 10 + rand() * 30);
        const ring = MeshBuilder.CreateTorus('ring', { diameter: 11, thickness: 0.55, tessellation: 40 }, s);
        ring.material = this.mats.ring;
        ring.position.set(x, y, z);
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = Math.atan2(centerX(z + 5) - centerX(z - 5), 10);
        ring.isPickable = false;
        meshes.push(ring);
        rings.push({ mesh: ring, pos: new Vector3(x, y, z), taken: false });
      }
    }
    return { index, meshes, pillars, arches, gates, bridges, rings };
  }

  private buildGate(z: number, rand: () => number, level: number, meshes: Mesh[]): Gate {
    const s = this.scene;
    const cx = centerX(z);
    const span = halfWidth(z) + 45; // reaches well into the cliffs
    const base = floorY(z) - 12;
    const top = floorY(z) + wallHeight(z) + 10;
    const gw = 16 - 6 * level;
    const gh = 12 - 4 * level;
    const gx = cx + (rand() - 0.5) * halfWidth(z) * 0.8;
    const gy = floorY(z) + 14 + rand() * 22;
    const thick = 4;
    const block = (x0: number, x1: number, y0: number, y1: number) => {
      const b = MeshBuilder.CreateBox('gate', { width: x1 - x0, height: y1 - y0, depth: thick }, s);
      b.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
      b.material = this.mats.rock;
      b.isPickable = false;
      meshes.push(b);
    };
    block(cx - span, gx - gw / 2, base, top);
    block(gx + gw / 2, cx + span, base, top);
    block(gx - gw / 2, gx + gw / 2, base, gy - gh / 2);
    block(gx - gw / 2, gx + gw / 2, gy + gh / 2, top);
    // A glowing frame so the window is easy to spot from far away.
    for (const [w, h, x, y] of [[gw + 0.8, 0.4, gx, gy - gh / 2], [gw + 0.8, 0.4, gx, gy + gh / 2], [0.4, gh, gx - gw / 2, gy], [0.4, gh, gx + gw / 2, gy]]) {
      const bar = MeshBuilder.CreateBox('gateFrame', { width: w, height: h, depth: thick + 0.2 }, s);
      bar.position.set(x, y, z);
      bar.material = this.mats.ring;
      bar.isPickable = false;
      meshes.push(bar);
    }
    return { z, gx, gy, gw, gh, thick, warned: false, passed: false };
  }

  private buildBridge(z: number, rand: () => number, meshes: Mesh[]): Bridge {
    const cx = centerX(z);
    const span = halfWidth(z) + 40;
    const y = floorY(z) + 10 + rand() * 18;
    const thick = 5;
    const depth = 12;
    const slab = MeshBuilder.CreateBox('bridge', { width: span * 2, height: thick, depth }, this.scene);
    slab.position.set(cx, y, z);
    slab.material = this.mats.rock;
    slab.isPickable = false;
    meshes.push(slab);
    return { z, y, thick, depth, warned: false, passed: false };
  }

  /** Keeps chunks built ahead of the flyer and drops the ones behind. Builds at most one per frame. */
  private updateChunks(all = false) {
    const cur = Math.floor(this.pos.z / CHUNK);
    for (const [i, c] of this.chunks) {
      if (i < cur - 1 || i > cur + AHEAD) {
        c.meshes.forEach((m) => m.dispose());
        this.chunks.delete(i);
      }
    }
    for (let i = cur - 1; i <= cur + AHEAD; i++) {
      if (i < -1 || this.chunks.has(i)) continue;
      this.chunks.set(i, this.buildChunk(i));
      if (!all) break;
    }
  }

  // ------------------------------------------------------------------ controls

  /** steer: -1 left … 1 right. pitch: 1 dive … -1 pull up. */
  setInput(steer: number, pitch: number) {
    this.input.steer = clamp(steer, -1, 1);
    this.input.pitch = clamp(pitch, -1, 1);
  }

  start() {
    this.reset();
    this.audio.startWind();
    this.setState('flying');
  }

  pause() {
    if (this.state !== 'flying') return;
    this.audio.stopWind();
    this.setState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.startWind();
    this.setState('flying');
  }

  setSound(on: boolean) {
    this.audio.setEnabled(on);
    if (on && this.state === 'flying') this.audio.startWind();
  }

  focus() {
    this.canvas.focus();
  }

  get bestGhostScore() {
    return this.ghostRun?.score ?? 0;
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.audio.dispose();
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.remove();
  }

  private setState(s: WingState) {
    this.state = s;
    this.cb.onState(s);
  }

  private reset() {
    const z = 30;
    this.pos.set(centerX(z), floorY(z) + 38, z);
    this.yaw = Math.atan2(centerX(z + 10) - centerX(z - 10), 20);
    this.pitch = GLIDE_PITCH;
    this.bank = 0;
    this.speed = 38;
    this.time = 0;
    this.score = 0;
    this.rings = 0;
    this.closeCalls = 0;
    this.arches = 0;
    this.gates = 0;
    this.near = false;
    this.farFor = 2;
    this.recording = [];
    this.recordTimer = 0;
    this.shake = 0;
    for (const c of this.chunks.values()) c.meshes.forEach((m) => m.dispose());
    this.chunks.clear();
    this.updateChunks(true);
    this.flyer.setEnabled(true);
    this.ghost.setEnabled(Boolean(this.ghostRun?.samples.length));
    this.placeFlyer();
  }

  // ------------------------------------------------------------------ loop

  private update(dt: number) {
    this.clock += dt;
    if (this.state === 'flying') {
      this.time += dt;
      this.fly(dt);
      this.updateChunks();
      this.checkWorld(dt);
      this.record(dt);
    }
    this.updateGhost();
    this.updateStreaks(dt);
    this.updateCamera(dt);
    this.hudTimer -= dt;
    if (this.state === 'flying' && this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.cb.onHud(this.stats());
      this.audio.setSpeed(this.speed, this.near);
    }
  }

  private fly(dt: number) {
    const k = 1 - Math.exp(-dt * 3);
    // Pitch: dive steeper or flare up from the natural glide angle.
    const targetPitch = GLIDE_PITCH - this.input.pitch * (this.input.pitch > 0 ? 0.42 : 0.5);
    this.pitch += (targetPitch - this.pitch) * k;
    this.bank += (this.input.steer * 0.85 - this.bank) * (1 - Math.exp(-dt * 4));
    this.yaw = clamp(this.yaw + this.bank * 0.95 * dt * (this.speed / 45), -1.1, 1.1);
    // Gravity along the flight path minus drag.
    // Less drag further down the canyon, so the glide gets faster (up to ~60 m/s).
    const drag = DRAG / (1 + 0.8 * difficulty(this.pos.z));
    this.speed = clamp(this.speed + (9.8 * Math.sin(-this.pitch) - drag * this.speed * this.speed) * dt, MIN_SPEED, MAX_SPEED);
    const dir = new Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    this.pos.addInPlace(dir.scale(this.speed * dt));
    // Distance points.
    this.score += this.speed * dt * Math.cos(this.yaw) * 0.5;
    this.placeFlyer();
  }

  private placeFlyer() {
    this.flyer.position.copyFrom(this.pos);
    this.flyer.rotation.set(-this.pitch, this.yaw, -this.bank);
  }

  private checkWorld(dt: number) {
    const { x, y, z } = this.pos;
    const ground = terrainHeight(x, z);
    if (y < ground + 0.6) return this.crash(ground > floorY(z) + 4 ? 'You hit the canyon wall' : 'You hit the ground');
    // Wingtips: the suit spans about 1.8 m.
    const side = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).scale(0.9);
    if (terrainHeight(x + side.x, z + side.z) > y + 0.2 || terrainHeight(x - side.x, z - side.z) > y + 0.2) return this.crash('Your wing clipped the rock');

    for (const c of this.chunks.values()) {
      if (Math.abs(c.index * CHUNK + CHUNK / 2 - z) > CHUNK) continue;
      for (const p of c.pillars) {
        if (y < p.top && Math.hypot(x - p.x, z - p.z) < p.r + 0.7) return this.crash('You hit a rock tower');
      }
      for (const a of c.arches) {
        if (Math.abs(z - a.z) < a.tube + 1) {
          // Distance from the flyer to the arch's centre line, in the arch's plane.
          let best = Infinity;
          for (let i = 0; i <= 48; i++) {
            const t = (i / 48) * Math.PI;
            best = Math.min(best, Math.hypot(x - (a.cx - Math.cos(t) * a.span), y - (a.base + Math.sin(t) * a.rise)));
          }
          const dz = Math.max(0, Math.abs(z - a.z) - 0.2);
          if (Math.hypot(best, dz) < a.tube + 0.6) return this.crash('You hit a stone arch');
        }
        if (!a.passed && z > a.z) {
          a.passed = true;
          const u = clamp((x - a.cx) / a.span, -1, 1);
          const under = a.base + Math.sqrt(1 - u * u) * a.rise - a.tube;
          if (Math.abs(x - a.cx) < a.span && y < under) {
            this.arches++;
            this.score += 150;
            this.audio.arch();
            this.cb.onEvent?.('Threaded the arch! +150');
          }
        }
      }
      for (const g of c.gates) {
        if (!g.warned && g.z - z > 0 && g.z - z < 170) {
          g.warned = true;
          this.cb.onEvent?.('Rock gate ahead! Find the glowing window');
        }
        if (Math.abs(z - g.z) < g.thick / 2 + 0.6 && !(Math.abs(x - g.gx) < g.gw / 2 - 0.6 && Math.abs(y - g.gy) < g.gh / 2 - 0.6)) return this.crash('You hit a rock gate');
        if (!g.passed && z > g.z + g.thick / 2) {
          g.passed = true;
          this.gates++;
          this.score += 100;
          this.audio.arch();
          this.cb.onEvent?.('Through the gate! +100');
        }
      }
      for (const b of c.bridges) {
        if (!b.warned && b.z - z > 0 && b.z - z < 150) {
          b.warned = true;
          this.cb.onEvent?.(y > b.y ? 'Stone bridge ahead! Stay above it' : 'Stone bridge ahead! Go under or over');
        }
        if (Math.abs(z - b.z) < b.depth / 2 + 0.6 && Math.abs(y - b.y) < b.thick / 2 + 0.6) return this.crash('You hit a stone bridge');
        if (!b.passed && z > b.z + b.depth / 2) {
          b.passed = true;
          this.score += 50;
          this.audio.ring();
          this.cb.onEvent?.(y > b.y ? 'Over the bridge! +50' : 'Under the bridge! +50');
        }
      }
      for (const r of c.rings) {
        if (r.taken || Math.abs(z - r.pos.z) > 1.5) continue;
        if (Math.hypot(x - r.pos.x, y - r.pos.y) < 5.2) {
          r.taken = true;
          r.mesh.setEnabled(false);
          this.rings++;
          this.score += 100;
          this.speed = Math.min(MAX_SPEED, this.speed + 6);
          this.audio.ring();
          this.cb.onEvent?.('Ring +100');
        }
      }
    }

    // Flying close to the rock scores extra.
    const clearance = y - ground;
    const wallClose = terrainHeight(x + side.x * 6, z + side.z * 6) > y - 1.5 || terrainHeight(x - side.x * 6, z - side.z * 6) > y - 1.5;
    const near = clearance < 7 || wallClose;
    if (near) {
      this.score += 45 * dt * (this.speed / 40);
      if (!this.near && this.farFor > 1) {
        this.closeCalls++;
        this.score += 25;
        this.audio.closeCall();
        this.cb.onEvent?.(wallClose ? 'Close call! +25' : 'Low pass! +25');
      }
      this.farFor = 0;
    } else this.farFor += dt;
    this.near = near;
  }

  private crash(reason: string) {
    if (this.state !== 'flying') return;
    this.audio.stopWind();
    this.audio.crash();
    this.shake = 0.6;
    this.flyer.setEnabled(false);
    const stats = this.stats(reason);
    if (stats.score > (this.ghostRun?.score ?? 0) && this.recording.length > 10) {
      this.ghostRun = { score: stats.score, samples: this.recording };
      stats.newBest = true;
      try {
        localStorage.setItem(GHOST_KEY, JSON.stringify(this.ghostRun));
      } catch {
        /* storage full or blocked: the ghost just won't be saved */
      }
    }
    this.setState('over');
    this.cb.onGameOver(stats);
  }

  private stats(reason?: string): WingStats {
    return {
      distance: Math.max(0, Math.floor(this.pos.z - 30)),
      score: Math.floor(this.score),
      rings: this.rings,
      closeCalls: this.closeCalls,
      arches: this.arches,
      gates: this.gates,
      speed: Math.round(this.speed * 3.6),
      height: Math.max(0, Math.round(this.pos.y - terrainHeight(this.pos.x, this.pos.z))),
      durationMs: Math.round(this.time * 1000),
      reason,
    };
  }

  private record(dt: number) {
    this.recordTimer -= dt;
    if (this.recordTimer > 0 || this.recording.length > 6000) return;
    this.recordTimer = GHOST_RATE;
    const r = (v: number) => Math.round(v * 100) / 100;
    this.recording.push([r(this.pos.x), r(this.pos.y), r(this.pos.z), r(this.yaw), r(this.pitch), r(this.bank)]);
  }

  private updateGhost() {
    const run = this.ghostRun;
    if (!run || this.state !== 'flying') {
      this.ghost.setEnabled(false);
      this.ghostTrail?.setEnabled(false);
      return;
    }
    const f = this.time / GHOST_RATE;
    const i = Math.floor(f);
    const a = run.samples[i];
    const b = run.samples[i + 1];
    if (!a || !b) {
      this.ghost.setEnabled(false);
      this.ghostTrail?.setEnabled(false);
      return;
    }
    const t = f - i;
    const lerp = (k: number) => a[k] + (b[k] - a[k]) * t;
    this.ghost.setEnabled(true);
    this.ghostTrail?.setEnabled(true);
    this.ghost.position.set(lerp(0), lerp(1), lerp(2));
  }

  private updateStreaks(dt: number) {
    const show = this.state === 'flying' && this.speed > 28;
    const fwd = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    for (const s of this.streaks) {
      s.mesh.isVisible = show;
      if (!show) continue;
      s.off.z -= this.speed * dt * 0.6;
      if (s.off.z < -12) s.off.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, 40 + Math.random() * 10);
      s.mesh.position.set(
        this.pos.x + right.x * s.off.x + fwd.x * s.off.z,
        this.pos.y + s.off.y,
        this.pos.z + right.z * s.off.x + fwd.z * s.off.z,
      );
      s.mesh.rotation.y = this.yaw;
    }
  }

  private updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 4);
    let pos: Vector3;
    let target: Vector3;
    if (this.state === 'ready') {
      // Slow orbit around the flyer on the start screen.
      const a = this.clock * 0.25;
      pos = this.pos.add(new Vector3(Math.sin(a) * 7, 2.2, Math.cos(a) * 7));
      target = this.pos.clone();
    } else {
      const back = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      pos = this.pos.subtract(back.scale(7)).add(new Vector3(0, 2.2, 0));
      target = this.pos.add(new Vector3(Math.sin(this.yaw) * 25, Math.sin(this.pitch) * 12, Math.cos(this.yaw) * 25));
    }
    this.camera.position = Vector3.Lerp(this.camera.position, pos, this.state === 'ready' ? 1 : k);
    if (this.shake > 0) {
      this.camera.position.addInPlace(new Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).scale(this.shake));
      this.shake = Math.max(0, this.shake - dt);
    }
    this.camera.upVector = new Vector3(Math.sin(-this.bank * 0.3) * Math.cos(this.yaw), Math.cos(this.bank * 0.3), -Math.sin(-this.bank * 0.3) * Math.sin(this.yaw));
    this.camera.setTarget(target);
    const wantFov = 0.88 + clamp((this.speed - 40) * 0.006, -0.05, 0.3);
    this.camera.fov += (wantFov - this.camera.fov) * k;
    // Keep the flyer's shadow sharp by following it.
    this.sun.position = this.pos.subtract(this.sun.direction.scale(60));
  }
}
