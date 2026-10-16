import {
  AbstractMesh,
  AnimationGroup,
  AssetContainer,
  Color3,
  Color4,
  CubeTexture,
  DirectionalLight,
  Engine,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  SpotLight,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { HeistAudio } from './audio';
import { loadHero } from '../shared/hero';
import { exitTexture, markTexture, marbleFloor, masterpiece, painting, wallPanel } from './art';
import { LEVELS, type CellPos, type LevelDef } from './levels';

/*
 * Night Heist
 * A top-down stealth game. The museum is a grid of 2 m cells. Guards follow
 * patrol routes and see in a cone that walls block; anything they notice
 * fills a meter, and a full meter means you're caught. Running and thrown
 * coins make noise that guards walk over to check.
 */

export type HeistState = 'loading' | 'briefing' | 'playing' | 'paused' | 'caught' | 'escaped' | 'won';
export interface HeistHud {
  level: number;
  levelName: string;
  time: number;
  gems: number;
  gemsTotal: number;
  coinsLeft: number;
  hasPainting: boolean;
  alert: number;
  score: number;
  steal: number;
  prompt: string | null;
}
export interface LevelResult {
  level: number;
  name: string;
  escape: number;
  gems: number;
  gemPoints: number;
  timeBonus: number;
  ghost: number;
  total: number;
  seconds: number;
}
export interface HeistResult {
  score: number;
  levelsCleared: number;
  gems: number;
  durationMs: number;
  reason?: string;
}
export interface HeistCallbacks {
  onState: (s: HeistState) => void;
  onHud: (h: HeistHud) => void;
  onProgress?: (p: number) => void;
  onLevelDone: (r: LevelResult) => void;
  onEnd: (r: HeistResult) => void;
}

const CELL = 2;
const WALL_H = 2.4;
const RADIUS = 0.32;
const WALK = 2.3;
const RUN = 4.6;
const GUARD_RANGE = 7.5;
const GUARD_HALF = 0.6;
const CAM_RANGE = 9;
const CAM_HALF = 0.36;
const FAN_RAYS = 30;
const COINS_PER_LEVEL = 3;
const STEAL_TIME = 1.3;

type Anims = { idle?: AnimationGroup; walk?: AnimationGroup; run?: AnimationGroup; cur?: AnimationGroup };
type P2 = [number, number];
type GuardMode = 'patrol' | 'pause' | 'alert' | 'investigate' | 'look' | 'return';

interface Guard {
  node: TransformNode;
  anims: Anims;
  extra: { dispose(): void }[];
  x: number;
  z: number;
  heading: number;
  route: P2[];
  stops: Set<number>;
  routeIdx: number;
  path: P2[];
  pathIdx: number;
  mode: GuardMode;
  timer: number;
  lookBase: number;
  susp: number;
  lastSeen: P2;
  fan: Mesh;
  fanMat: StandardMaterial;
  light: SpotLight;
  mark: Mesh;
}
interface SecurityCam {
  node: TransformNode;
  x: number;
  z: number;
  base: number;
  sweep: number;
  phase: number;
  heading: number;
  susp: number;
  fan: Mesh;
  fanMat: StandardMaterial;
  led: Mesh;
}
interface Laser {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  on: number;
  off: number;
  offset: number;
  beams: Mesh[];
  active: boolean;
}
interface Gem {
  mesh: Mesh;
  x: number;
  z: number;
  taken: boolean;
}
interface Ring {
  mesh: Mesh;
  age: number;
  size: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const hex = (s: string) => Color3.FromHexString(s);

export class HeistGame {
  private engine: Engine;
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private camera!: FreeCamera;
  private moon!: DirectionalLight;
  private hemi!: HemisphericLight;
  private shadows!: ShadowGenerator;
  private audio = new HeistAudio();
  private disposed = false;

  private state: HeistState = 'loading';
  private levelIndex = 0;
  private level!: LevelDef;
  private map: string[] = [];
  private rows = 0;
  private cols = 0;
  private root: TransformNode | null = null;
  private perLevel: { dispose(): void }[] = [];

  private player!: TransformNode;
  private playerAnims: Anims = {};
  private tube!: Mesh;
  private guardAssets!: AssetContainer;
  private px = 0;
  private pz = 0;
  private heading = 0;
  private input = { x: 0, z: 0, run: false, interact: false };
  private stepTimer = 0;
  private noiseTimer = 0;

  private guards: Guard[] = [];
  private cams: SecurityCam[] = [];
  private lasers: Laser[] = [];
  private gems: Gem[] = [];
  private rings: Ring[] = [];
  private coin: { mesh: Mesh; from: Vector3; to: Vector3; t: number } | null = null;
  private painting!: { canvas: Mesh; x: number; z: number };
  private exit!: { x: number; z: number; mat: StandardMaterial };
  private markQ!: StandardMaterial;
  private markX!: StandardMaterial;
  private mats: Record<string, PBRMaterial | StandardMaterial> = {};

  private time = 0;
  private clock = 0;
  private hasPainting = false;
  private steal = 0;
  private cutTimer = 0;
  private gemsTaken = 0;
  private coinsLeft = COINS_PER_LEVEL;
  private maxAlert = 0;
  private hudTimer = 0;
  private flash = 0;
  private prompt: string | null = null;

  private totalScore = 0;
  private totalGems = 0;
  private totalMs = 0;
  private cleared = 0;

  constructor(container: HTMLElement, private cb: HeistCallbacks, private quality: 'high' | 'low' = 'high') {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Night Heist game');
    container.appendChild(canvas);
    this.canvas = canvas;
    this.engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true }, true);
    this.engine.setHardwareScalingLevel(quality === 'high' ? 1 / Math.min(window.devicePixelRatio, 1.5) : 1.25);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.02, 0.02, 0.04, 1);
  }

  // ------------------------------------------------------------------ setup

  async load() {
    this.setState('loading');
    this.cb.onProgress?.(0.05);
    this.setupScene();
    this.setupMaterials();
    this.cb.onProgress?.(0.2);
    await this.loadCharacters();
    if (this.disposed) return;
    this.cb.onProgress?.(0.85);
    this.buildLevel(0);
    this.cb.onProgress?.(1);
    if (import.meta.env.DEV) (window as unknown as { __heist?: unknown }).__heist = this;
    this.engine.runRenderLoop(() => {
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
    this.setState('briefing');
  }

  private onResize = () => this.engine.resize();

  private setupScene() {
    const s = this.scene;
    this.camera = new FreeCamera('cam', new Vector3(0, 20, -10), s);
    this.camera.fov = 0.85;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 300;
    this.camera.inputs.clear();

    s.environmentTexture = new CubeTexture('/assets/env/sky.env', s);
    s.environmentIntensity = 0.18;

    this.hemi = new HemisphericLight('ambient', new Vector3(0, 1, 0), s);
    this.hemi.intensity = 0.32;
    this.hemi.diffuse = hex('#8090c8');
    this.hemi.groundColor = hex('#1a1424');

    // Moonlight through the skylights, casting long wall shadows.
    this.moon = new DirectionalLight('moon', new Vector3(0.42, -1, 0.38).normalize(), s);
    this.moon.intensity = 1.1;
    this.moon.diffuse = hex('#a9b8ff');
    this.moon.position = new Vector3(-20, 40, -20);
    this.shadows = new ShadowGenerator(this.quality === 'high' ? 2048 : 1024, this.moon);
    if (this.quality === 'high') {
      this.shadows.usePercentageCloserFiltering = true;
      this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    }
    this.shadows.bias = 0.004;
    this.shadows.darkness = 0.45;

    const ip = s.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.25;
    ip.contrast = 1.15;
    if (this.quality === 'high') {
      ip.vignetteEnabled = true;
      ip.vignetteWeight = 2.2;
      ip.vignetteColor = new Color4(0, 0, 0, 0);
      const glow = new GlowLayer('glow', s, { mainTextureRatio: 0.5 });
      glow.intensity = 0.7;
    }
  }

  private pbr(name: string, color: string, rough: number, metal = 0, tex?: Texture) {
    const m = new PBRMaterial(name, this.scene);
    m.albedoColor = hex(color);
    m.roughness = rough;
    m.metallic = metal;
    m.maxSimultaneousLights = 8;
    if (tex) m.albedoTexture = tex;
    this.mats[name] = m;
    return m;
  }

  private glow(name: string, color: string, alpha = 1) {
    const m = new StandardMaterial(name, this.scene);
    m.emissiveColor = hex(color);
    m.disableLighting = true;
    m.alpha = alpha;
    this.mats[name] = m;
    return m;
  }

  private setupMaterials() {
    const s = this.scene;
    this.pbr('wall', '#ffffff', 0.85, 0, wallPanel(s));
    this.pbr('cap', '#16141c', 0.9);
    this.pbr('frame', '#c9a24a', 0.35, 0.9);
    this.pbr('marble', '#e8e4dc', 0.3);
    this.pbr('bronze', '#8a5a2b', 0.35, 0.85);
    this.pbr('darkWood', '#2e1f17', 0.6);
    this.pbr('velvet', '#5a1020', 0.9);
    this.pbr('steel', '#2a2d33', 0.4, 0.8);
    const glass = this.pbr('glass', '#c8e0ff', 0.05, 0);
    glass.alpha = 0.18;
    this.pbr('coin', '#ffcf40', 0.2, 1).emissiveColor = hex('#3a2a00');
    this.glow('gemA', '#3de0ff');
    this.glow('gemB', '#ff4fd8');
    this.glow('gemC', '#5dff8a');
    this.glow('laser', '#ff1a1a', 0.85);
    this.glow('led', '#ff2020');
    this.glow('lens', '#fff4c0');
    this.glow('ring', '#ffffff', 0.5);
    for (let i = 0; i < 6; i++) {
      const m = this.pbr(`art${i}`, '#ffffff', 0.6, 0, painting(s, i));
      m.emissiveTexture = m.albedoTexture;
      m.emissiveColor = new Color3(0.12, 0.12, 0.12);
    }
    const q = new StandardMaterial('markQ', s);
    q.diffuseTexture = markTexture(s, '?', '#ffd23f');
    q.diffuseTexture.hasAlpha = true;
    q.emissiveColor = Color3.White();
    q.disableLighting = true;
    q.useAlphaFromDiffuseTexture = true;
    this.markQ = q;
    const x = q.clone('markX');
    x.diffuseTexture = markTexture(s, '!', '#ff3b3b');
    x.diffuseTexture.hasAlpha = true;
    this.markX = x;
  }

  private async loadCharacters() {
    const hero = await loadHero(this.scene);
    if (this.disposed) return;
    this.cb.onProgress?.(0.5);
    this.player = new TransformNode('player', this.scene);
    hero.root.parent = this.player;
    hero.meshes.forEach((m) => {
      this.shadows.addShadowCaster(m, true);
      m.receiveShadows = true;
    });
    this.playerAnims = { ...hero.anims };
    this.play(this.playerAnims, 'idle');
    // The rolled-up canvas carried on the back after the theft.
    this.tube = MeshBuilder.CreateCylinder('tube', { height: 1.1, diameter: 0.16, tessellation: 12 }, this.scene);
    this.tube.material = this.mats.darkWood;
    this.tube.parent = this.player;
    this.tube.position.set(0.12, 1.25, -0.22);
    this.tube.rotation.z = 0.6;
    this.tube.setEnabled(false);

    this.guardAssets = await LoadAssetContainerAsync('/assets/characters/Xbot.glb', this.scene);
    // Dress the mannequin in a navy security uniform.
    for (const m of this.guardAssets.materials) {
      if (m instanceof PBRMaterial) {
        m.maxSimultaneousLights = 8;
        if (/body/i.test(m.name)) {
          m.albedoColor = hex('#3d4c78');
          m.metallic = 0.1;
          m.roughness = 0.7;
        } else {
          m.albedoColor = hex('#111216');
        }
      }
    }
    for (const m of this.scene.materials) if (m instanceof PBRMaterial) m.maxSimultaneousLights = 8;
  }

  // ------------------------------------------------------------------ grid helpers

  private cellX = (c: number) => c * CELL;
  private cellZ = (r: number) => (this.rows - 1 - r) * CELL;
  private toCell(x: number, z: number): CellPos {
    return [Math.round(x / CELL), this.rows - 1 - Math.round(z / CELL)];
  }
  private at(c: number, r: number) {
    return this.map[r]?.[c] ?? '#';
  }
  private solid(c: number, r: number) {
    return '#SD'.includes(this.at(c, r));
  }
  private opaque(c: number, r: number) {
    return '#S'.includes(this.at(c, r));
  }
  private opaqueAt(x: number, z: number) {
    const [c, r] = this.toCell(x, z);
    return this.opaque(c, r);
  }

  /** How far a ray travels before a wall stops it. */
  private rayLength(x: number, z: number, angle: number, max: number) {
    const sx = Math.sin(angle);
    const sz = Math.cos(angle);
    for (let d = 0.2; d < max; d += 0.15) if (this.opaqueAt(x + sx * d, z + sz * d)) return d;
    return max;
  }

  private clearLine(x0: number, z0: number, x1: number, z1: number) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / 0.2);
    for (let i = 1; i < n; i++) if (this.opaqueAt(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)) return false;
    return true;
  }

  private collides(x: number, z: number) {
    const [c, r] = this.toCell(x, z);
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (!this.solid(c + dc, r + dr)) continue;
        const cx = this.cellX(c + dc);
        const cz = this.cellZ(r + dr);
        const half = (this.at(c + dc, r + dr) === '#' ? CELL : CELL * 0.62) / 2;
        const nx = Math.max(cx - half, Math.min(x, cx + half));
        const nz = Math.max(cz - half, Math.min(z, cz + half));
        if ((x - nx) ** 2 + (z - nz) ** 2 < RADIUS * RADIUS) return true;
      }
    }
    return false;
  }

  /** A* over the grid (8 directions, no corner cutting). Returns world points. */
  private findPath(from: CellPos, to: CellPos): P2[] {
    const key = (c: number, r: number) => r * this.cols + c;
    const h = (c: number, r: number) => {
      const dx = Math.abs(c - to[0]);
      const dy = Math.abs(r - to[1]);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const open = new Map<number, { c: number; r: number; g: number; f: number }>();
    const came = new Map<number, number>();
    const gScore = new Map<number, number>();
    open.set(key(...from), { c: from[0], r: from[1], g: 0, f: h(...from) });
    gScore.set(key(...from), 0);
    while (open.size) {
      let best: { c: number; r: number; g: number; f: number } | undefined;
      for (const n of open.values()) if (!best || n.f < best.f) best = n;
      const cur = best!;
      const ck = key(cur.c, cur.r);
      open.delete(ck);
      if (cur.c === to[0] && cur.r === to[1]) {
        const out: P2[] = [];
        let k: number | undefined = ck;
        while (k !== undefined) {
          out.unshift([this.cellX(k % this.cols), this.cellZ(Math.floor(k / this.cols))]);
          k = came.get(k);
        }
        return out;
      }
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (!dc && !dr) continue;
          const nc = cur.c + dc;
          const nr = cur.r + dr;
          if (this.solid(nc, nr)) continue;
          if (dc && dr && (this.solid(cur.c + dc, cur.r) || this.solid(cur.c, cur.r + dr))) continue;
          const g = cur.g + (dc && dr ? 1.414 : 1);
          const nk = key(nc, nr);
          if (g < (gScore.get(nk) ?? Infinity)) {
            gScore.set(nk, g);
            came.set(nk, ck);
            open.set(nk, { c: nc, r: nr, g, f: g + h(nc, nr) });
          }
        }
      }
    }
    return [];
  }

  // ------------------------------------------------------------------ level building

  private own<T extends { dispose(): void }>(thing: T) {
    this.perLevel.push(thing);
    return thing;
  }

  private mesh<T extends AbstractMesh>(m: T, shadow = false) {
    m.parent = this.root;
    m.isPickable = false;
    m.receiveShadows = true;
    if (shadow) this.shadows.addShadowCaster(m);
    return m;
  }

  private teardown() {
    this.perLevel.forEach((t) => t.dispose());
    this.perLevel = [];
    this.root?.dispose();
    this.root = null;
    this.guards = [];
    this.cams = [];
    this.lasers = [];
    this.gems = [];
    this.rings = [];
    this.coin = null;
  }

  private buildLevel(index: number) {
    this.teardown();
    const s = this.scene;
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.map = this.level.map;
    this.rows = this.map.length;
    this.cols = this.map[0].length;
    this.root = new TransformNode('level', s);

    // Floor.
    const floor = this.mesh(MeshBuilder.CreateGround('floor', { width: this.cols * CELL, height: this.rows * CELL }, s));
    floor.position.set(((this.cols - 1) * CELL) / 2, 0, ((this.rows - 1) * CELL) / 2);
    const floorMat = this.own(this.pbr('floor', '#ffffff', 0.18, 0, marbleFloor(s, this.cols, this.rows)));
    floor.material = floorMat;

    // Walls (merged into one mesh) with dark caps on top.
    const walls: Mesh[] = [];
    const caps: Mesh[] = [];
    this.map.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch !== '#') return;
        const w = MeshBuilder.CreateBox('w', { width: CELL, height: WALL_H, depth: CELL }, s);
        w.position.set(this.cellX(c), WALL_H / 2, this.cellZ(r));
        walls.push(w);
        const cap = MeshBuilder.CreateBox('cap', { width: CELL + 0.02, height: 0.06, depth: CELL + 0.02 }, s);
        cap.position.set(this.cellX(c), WALL_H + 0.03, this.cellZ(r));
        caps.push(cap);
      }),
    );
    const wallMesh = this.mesh(Mesh.MergeMeshes(walls, true, true)!, true);
    wallMesh.material = this.mats.wall;
    const capMesh = this.mesh(Mesh.MergeMeshes(caps, true, true)!);
    capMesh.material = this.mats.cap;

    let artN = 0;
    let gemN = 0;
    this.map.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        const x = this.cellX(c);
        const z = this.cellZ(r);
        if (ch === 'P') {
          this.px = x;
          this.pz = z;
        } else if (ch === 'S') this.buildStatue(x, z, (c * 7 + r * 3) % 2 === 0);
        else if (ch === 'D') this.buildCase(x, z, (c * 3 + r) % 3);
        else if (ch === 'g') this.buildGem(x, z, gemN++);
        else if (ch === '$') this.buildMasterpiece(x, z);
        else if (ch === 'X') this.buildExit(x, z);
        // Hang art on walls the camera can see (north, east and west sides of a room).
        if ('#SD'.includes(ch) || ch === '$') return;
        for (const [dc, dr, nx, nz] of [[0, -1, 0, -1], [1, 0, -1, 0], [-1, 0, 1, 0]] as const) {
          if (this.at(c + dc, r + dr) !== '#' || Math.random() > (dr ? 0.4 : 0.2)) continue;
          this.buildArt(x - nx * (CELL / 2 - 0.05), z - nz * (CELL / 2 - 0.05), Math.atan2(-nx, -nz), artN++ % 6);
        }
      }),
    );

    this.level.guards.forEach((g, i) => this.buildGuard(g.path, i));
    this.level.cameras.forEach((c) => this.buildCamera(c.at, c.facing, c.sweep));
    this.level.lasers.forEach((l) => this.buildLaser(l));

    // Reset the run state for this level.
    this.heading = 0;
    this.player.position.set(this.px, 0, this.pz);
    this.player.rotation.y = 0;
    this.tube.setEnabled(false);
    this.play(this.playerAnims, 'idle');
    this.time = 0;
    this.hasPainting = false;
    this.steal = 0;
    this.gemsTaken = 0;
    this.coinsLeft = COINS_PER_LEVEL;
    this.maxAlert = 0;
    this.flash = 0;
    this.hemi.diffuse = hex('#8090c8');
    this.input = { x: 0, z: 0, run: false, interact: false };
    for (const m of this.scene.materials) if (m instanceof PBRMaterial) m.maxSimultaneousLights = 8;
    this.overviewCamera(true);
  }

  private buildArt(x: number, z: number, rot: number, i: number) {
    const s = this.scene;
    const frame = this.mesh(MeshBuilder.CreateBox('frame', { width: 1.32, height: 1.06, depth: 0.06 }, s));
    frame.material = this.mats.frame;
    frame.position.set(x, 1.5, z);
    frame.rotation.y = rot;
    const art = this.mesh(MeshBuilder.CreatePlane('art', { width: 1.16, height: 0.9 }, s));
    art.material = this.mats[`art${i}`];
    art.parent = frame;
    art.position.z = -0.035;
  }

  private buildStatue(x: number, z: number, knot: boolean) {
    const s = this.scene;
    const base = this.mesh(MeshBuilder.CreateBox('plinth', { width: 1.1, height: 1.0, depth: 1.1 }, s), true);
    base.position.set(x, 0.5, z);
    base.material = this.mats.marble;
    if (knot) {
      const k = this.mesh(MeshBuilder.CreateTorusKnot('art', { radius: 0.32, tube: 0.1, radialSegments: 96, tubularSegments: 16, p: 2, q: 3 }, s), true);
      k.position.set(x, 1.55, z);
      k.material = this.mats.bronze;
    } else {
      // A simple marble bust.
      const torso = this.mesh(MeshBuilder.CreateCylinder('bust', { height: 0.5, diameterTop: 0.38, diameterBottom: 0.6, tessellation: 24 }, s), true);
      torso.position.set(x, 1.25, z);
      torso.material = this.mats.marble;
      const head = this.mesh(MeshBuilder.CreateSphere('head', { diameterX: 0.3, diameterY: 0.38, diameterZ: 0.32, segments: 16 }, s), true);
      head.position.set(x, 1.7, z);
      head.material = this.mats.marble;
    }
  }

  private buildCase(x: number, z: number, kind: number) {
    const s = this.scene;
    const base = this.mesh(MeshBuilder.CreateBox('caseBase', { width: 1.2, height: 0.9, depth: 1.2 }, s), true);
    base.position.set(x, 0.45, z);
    base.material = this.mats.darkWood;
    const item =
      kind === 0
        ? MeshBuilder.CreateTorus('crown', { diameter: 0.36, thickness: 0.08, tessellation: 24 }, s)
        : kind === 1
          ? MeshBuilder.CreateCylinder('vase', { height: 0.5, diameterTop: 0.16, diameterBottom: 0.22, tessellation: 18 }, s)
          : MeshBuilder.CreatePolyhedron('jewel', { type: 1, size: 0.16 }, s);
    this.mesh(item);
    item.position.set(x, kind === 1 ? 1.15 : 1.05, z);
    item.material = kind === 0 ? this.mats.frame : kind === 1 ? this.mats.velvet : this.mats.gemA;
    const glass = this.mesh(MeshBuilder.CreateBox('glass', { width: 1.1, height: 0.8, depth: 1.1 }, s));
    glass.position.set(x, 1.3, z);
    glass.material = this.mats.glass;
  }

  private buildGem(x: number, z: number, i: number) {
    const gem = this.mesh(MeshBuilder.CreatePolyhedron('gem', { type: 1, size: 0.2 }, this.scene));
    gem.material = this.mats[['gemA', 'gemB', 'gemC'][i % 3]];
    gem.position.set(x, 0.9, z);
    this.gems.push({ mesh: gem, x, z, taken: false });
  }

  private buildMasterpiece(x: number, z: number) {
    const s = this.scene;
    const wz = z + CELL / 2 - 0.06;
    const frame = this.mesh(MeshBuilder.CreateBox('masterFrame', { width: 1.9, height: 1.55, depth: 0.1 }, s));
    frame.material = this.mats.frame;
    frame.position.set(x, 1.45, wz);
    const backing = this.mesh(MeshBuilder.CreatePlane('backing', { width: 1.7, height: 1.35 }, s));
    backing.material = this.mats.cap;
    backing.position.set(x, 1.45, wz - 0.052);
    const canvasMat = this.own(this.pbr('masterpiece', '#ffffff', 0.55, 0, masterpiece(s, this.levelIndex)));
    canvasMat.emissiveTexture = canvasMat.albedoTexture;
    canvasMat.emissiveColor = new Color3(0.25, 0.25, 0.25);
    const canvas = this.mesh(MeshBuilder.CreatePlane('masterpiece', { width: 1.7, height: 1.35 }, s));
    canvas.material = canvasMat;
    canvas.position.set(x, 1.45, wz - 0.056);
    // Velvet rope posts in front.
    for (const dx of [-0.8, 0.8]) {
      const post = this.mesh(MeshBuilder.CreateCylinder('post', { height: 0.9, diameter: 0.07, tessellation: 10 }, s));
      post.material = this.mats.frame;
      post.position.set(x + dx, 0.45, z + 0.1);
    }
    const rope = this.mesh(MeshBuilder.CreateCylinder('rope', { height: 1.6, diameter: 0.05, tessellation: 8 }, s));
    rope.rotation.z = Math.PI / 2;
    rope.position.set(x, 0.8, z + 0.1);
    rope.material = this.mats.velvet;
    // A warm gallery spotlight on the painting.
    const spot = new SpotLight('paintingLight', new Vector3(x, WALL_H + 0.6, z - 1.2), new Vector3(0, -0.9, 1).normalize(), 1.0, 2, s);
    spot.diffuse = hex('#ffd9a0');
    spot.intensity = 26;
    spot.range = 8;
    spot.parent = this.root;
    this.painting = { canvas, x, z };
  }

  private buildExit(x: number, z: number) {
    const s = this.scene;
    const tex = exitTexture(s);
    const mat = this.own(new StandardMaterial('exitMat', s));
    mat.emissiveTexture = tex;
    mat.opacityTexture = tex;
    mat.emissiveColor = hex('#ff4040');
    mat.disableLighting = true;
    const disc = this.mesh(MeshBuilder.CreateGround('exit', { width: 1.9, height: 1.9 }, s));
    disc.position.set(x, 0.03, z);
    disc.material = mat;
    this.own(tex);
    this.exit = { x, z, mat };
  }

  /** A flat, see-through fan on the floor showing what a guard or camera can see. */
  private makeFan(color: string) {
    const positions = new Array((FAN_RAYS + 2) * 3).fill(0);
    const colors: number[] = [1, 1, 1, 0.42];
    const indices: number[] = [];
    for (let i = 0; i <= FAN_RAYS; i++) {
      colors.push(1, 1, 1, 0.06);
      if (i < FAN_RAYS) indices.push(0, i + 1, i + 2);
    }
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.colors = colors;
    const fan = this.mesh(new Mesh('fan', this.scene));
    vd.applyToMesh(fan, true);
    fan.hasVertexAlpha = true;
    fan.receiveShadows = false;
    const mat = this.own(new StandardMaterial('fanMat', this.scene));
    // Unlit materials only show their emissive color (times the vertex color and alpha).
    mat.diffuseColor = Color3.Black();
    mat.emissiveColor = hex(color);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;
    mat.zOffset = -2;
    fan.material = mat;
    fan.alwaysSelectAsActiveMesh = true;
    return { fan, mat };
  }

  private updateFan(fan: Mesh, x: number, z: number, heading: number, half: number, range: number) {
    const p = fan.getVerticesData(VertexBuffer.PositionKind)!;
    p[0] = x;
    p[1] = 0.05;
    p[2] = z;
    for (let i = 0; i <= FAN_RAYS; i++) {
      const a = heading - half + (2 * half * i) / FAN_RAYS;
      const d = this.rayLength(x, z, a, range);
      p[(i + 1) * 3] = x + Math.sin(a) * d;
      p[(i + 1) * 3 + 1] = 0.05;
      p[(i + 1) * 3 + 2] = z + Math.cos(a) * d;
    }
    fan.updateVerticesData(VertexBuffer.PositionKind, p);
  }

  private buildGuard(points: CellPos[], i: number) {
    const s = this.scene;
    const entries = this.guardAssets.instantiateModelsToScene((n) => `${n}_g${i}`, false, { doNotInstantiate: true });
    const node = new TransformNode(`guard${i}`, s);
    node.parent = this.root;
    const model = entries.rootNodes[0] as AbstractMesh;
    model.parent = node;
    model.rotation = new Vector3(0, Math.PI, 0);
    model.rotationQuaternion = null;
    model.getChildMeshes().forEach((m) => {
      this.shadows.addShadowCaster(m, false);
      m.receiveShadows = true;
    });
    const groups = entries.animationGroups;
    groups.forEach((a) => a.stop());
    const anims: Anims = {
      idle: groups.find((a) => /idle/i.test(a.name)),
      walk: groups.find((a) => /walk/i.test(a.name)),
      run: groups.find((a) => /run/i.test(a.name)),
    };
    // Flashlight held at chest height.
    const torch = MeshBuilder.CreateCylinder('torch', { height: 0.26, diameterTop: 0.09, diameterBottom: 0.06, tessellation: 10 }, s);
    torch.rotation.x = Math.PI / 2;
    torch.position.set(0.22, 1.12, 0.32);
    torch.material = this.mats.steel;
    torch.parent = node;
    const lens = MeshBuilder.CreateDisc('lens', { radius: 0.045, tessellation: 12 }, s);
    lens.position.set(0.22, 1.12, 0.46);
    lens.rotation.y = Math.PI;
    lens.material = this.mats.lens;
    lens.parent = node;
    const light = new SpotLight(`torch${i}`, new Vector3(0.22, 1.2, 0.5), new Vector3(0, -0.42, 1).normalize(), 1.15, 4, s);
    light.diffuse = hex('#ffe6b0');
    light.intensity = 90;
    light.range = GUARD_RANGE + 2;
    light.parent = node;
    const mark = MeshBuilder.CreatePlane('mark', { size: 0.85 }, s);
    mark.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mark.position.y = 2.5;
    mark.parent = node;
    mark.isVisible = false;
    const { fan, mat } = this.makeFan('#ffd54a');

    // Patrol route: A* between the waypoints, looping back to the first.
    const route: P2[] = [];
    const stops = new Set<number>();
    points.forEach((p, k) => {
      const next = points[(k + 1) % points.length];
      const seg = this.findPath(p, next);
      if (k > 0) seg.shift();
      route.push(...seg);
      stops.add(route.length - 1);
    });
    // The loop's last point repeats the first, so drop it and pause at the start instead.
    stops.delete(route.length - 1);
    route.pop();
    stops.add(0);
    const [sx, sz] = [this.cellX(points[0][0]), this.cellZ(points[0][1])];
    node.position.set(sx, 0, sz);
    const guard: Guard = {
      node,
      anims,
      extra: [...groups, ...entries.skeletons],
      x: sx,
      z: sz,
      heading: 0,
      route,
      stops,
      routeIdx: Math.min(1, route.length - 1),
      path: [],
      pathIdx: 0,
      mode: 'patrol',
      timer: 0,
      lookBase: 0,
      susp: 0,
      lastSeen: [sx, sz],
      fan,
      fanMat: mat,
      light,
      mark,
    };
    const first = route[guard.routeIdx];
    if (first) guard.heading = Math.atan2(first[0] - sx, first[1] - sz);
    guard.extra.forEach((e) => this.own(e));
    this.play(anims, 'walk');
    this.guards.push(guard);
  }

  private buildCamera(at: CellPos, facing: number, sweep: number) {
    const s = this.scene;
    const x = this.cellX(at[0]);
    const z = this.cellZ(at[1]);
    const base = (facing * Math.PI) / 180;
    // Mount on the wall behind the camera's view.
    const bx = x - Math.sin(base) * 0.75;
    const bz = z - Math.cos(base) * 0.75;
    const node = new TransformNode('secCam', s);
    node.parent = this.root;
    node.position.set(bx, WALL_H - 0.25, bz);
    const body = MeshBuilder.CreateBox('camBody', { width: 0.24, height: 0.22, depth: 0.5 }, s);
    body.material = this.mats.steel;
    body.parent = node;
    body.position.z = 0.15;
    body.rotation.x = 0.35;
    const lensM = MeshBuilder.CreateCylinder('camLens', { height: 0.06, diameter: 0.16, tessellation: 14 }, s);
    lensM.rotation.x = Math.PI / 2 + 0.35;
    lensM.position.set(0, -0.09, 0.42);
    lensM.material = this.mats.cap;
    lensM.parent = node;
    const led = MeshBuilder.CreateSphere('led', { diameter: 0.06 }, s);
    led.position.set(0.08, 0.1, 0.3);
    led.material = this.mats.led;
    led.parent = node;
    this.shadows.addShadowCaster(body);
    const { fan, mat } = this.makeFan('#ff4a4a');
    this.cams.push({ node, x: bx, z: bz, base, sweep: (sweep * Math.PI) / 180, phase: rnd(0, 6), heading: base, susp: 0, fan, fanMat: mat, led });
  }

  private buildLaser(def: LevelDef['lasers'][number]) {
    const s = this.scene;
    const horizontal = def.a[1] === def.b[1];
    const [c1, c2] = horizontal ? [Math.min(def.a[0], def.b[0]), Math.max(def.a[0], def.b[0])] : [def.a[0], def.a[0]];
    const [r1, r2] = horizontal ? [def.a[1], def.a[1]] : [Math.min(def.a[1], def.b[1]), Math.max(def.a[1], def.b[1])];
    // Beams run across the corridor, from wall to wall.
    const x1 = this.cellX(c1) - (horizontal ? CELL / 2 : 0);
    const x2 = this.cellX(c2) + (horizontal ? CELL / 2 : 0);
    const z1 = this.cellZ(r1) + (horizontal ? 0 : CELL / 2);
    const z2 = this.cellZ(r2) - (horizontal ? 0 : CELL / 2);
    const len = Math.hypot(x2 - x1, z2 - z1);
    const beams: Mesh[] = [];
    for (const y of [0.35, 0.75, 1.15]) {
      const b = this.mesh(MeshBuilder.CreateCylinder('beam', { height: len, diameter: 0.035, tessellation: 6 }, s));
      b.material = this.mats.laser;
      b.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      b.rotation = horizontal ? new Vector3(0, 0, Math.PI / 2) : new Vector3(Math.PI / 2, 0, 0);
      beams.push(b);
    }
    for (const [ex, ez] of [[x1, z1], [x2, z2]]) {
      const emitter = this.mesh(MeshBuilder.CreateBox('emitter', { width: 0.16, height: 1.4, depth: 0.16 }, s), true);
      emitter.position.set(ex, 0.7, ez);
      emitter.material = this.mats.steel;
    }
    this.lasers.push({ x1, z1, x2, z2, on: def.on, off: def.off, offset: def.offset, beams, active: false });
  }

  // ------------------------------------------------------------------ controls

  setInput(x: number, z: number, run: boolean) {
    this.input.x = x;
    this.input.z = z;
    this.input.run = run;
  }

  setInteract(down: boolean) {
    this.input.interact = down;
  }

  throwCoin() {
    if (this.state !== 'playing' || this.coinsLeft <= 0 || this.coin) return;
    this.coinsLeft--;
    const dist = Math.max(1, Math.min(7, this.rayLength(this.px, this.pz, this.heading, 7.5) - 0.5));
    const to = new Vector3(this.px + Math.sin(this.heading) * dist, 0.04, this.pz + Math.cos(this.heading) * dist);
    const mesh = this.mesh(MeshBuilder.CreateCylinder('coin', { height: 0.03, diameter: 0.2, tessellation: 16 }, this.scene));
    mesh.material = this.mats.coin;
    this.coin = { mesh, from: new Vector3(this.px, 1.2, this.pz), to, t: 0 };
    this.audio.throwCoin();
  }

  /** Starts the current level from its briefing screen. */
  begin() {
    if (this.state !== 'briefing') return;
    this.audio.startAmbience();
    this.setState('playing');
  }

  nextLevel() {
    if (this.state !== 'escaped') return;
    this.buildLevel(this.levelIndex + 1);
    this.setState('briefing');
  }

  restart() {
    this.audio.stopSiren();
    this.totalScore = 0;
    this.totalGems = 0;
    this.totalMs = 0;
    this.cleared = 0;
    this.buildLevel(0);
    this.setState('briefing');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.audio.stopAmbience();
    this.setState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.startAmbience();
    this.setState('playing');
  }

  setSound(on: boolean) {
    this.audio.setEnabled(on);
    if (on && this.state === 'playing') this.audio.startAmbience();
  }

  focus() {
    this.canvas.focus();
  }

  get levelCount() {
    return LEVELS.length;
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

  private setState(s: HeistState) {
    this.state = s;
    this.cb.onState(s);
    this.pushHud();
  }

  // ------------------------------------------------------------------ loop

  private play(a: Anims, name: 'idle' | 'walk' | 'run', speed = 1) {
    const next = a[name];
    if (!next) return;
    if (a.cur !== next) {
      a.cur?.stop();
      next.start(true, speed);
      a.cur = next;
    } else next.speedRatio = speed;
  }

  private update(dt: number) {
    this.clock += dt;
    const playing = this.state === 'playing';
    const alive = playing || this.state === 'briefing';
    if (playing) {
      this.time += dt;
      this.movePlayer(dt);
      this.updateObjectives(dt);
      this.updateCoin(dt);
    }
    if (alive) for (const g of this.guards) this.updateGuard(g, dt, playing);
    if (alive) for (const c of this.cams) this.updateCam(c, dt, playing);
    this.updateLasers(playing);
    this.updateRings(dt);
    for (const gem of this.gems) {
      gem.mesh.rotation.y += dt * 1.6;
      gem.mesh.position.y = 0.9 + Math.sin(this.clock * 2 + gem.x) * 0.08;
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      const on = Math.floor(this.flash * 6) % 2 === 0;
      this.hemi.diffuse = on ? hex('#ff2a2a') : hex('#8090c8');
      this.hemi.intensity = on ? 0.9 : 0.32;
    }
    if (playing) this.maxAlert = Math.max(this.maxAlert, this.alertLevel());
    this.updateCamera(dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && (playing || this.state === 'briefing')) {
      this.hudTimer = 0.1;
      this.pushHud();
    }
  }

  private alertLevel() {
    let a = 0;
    for (const g of this.guards) a = Math.max(a, g.susp);
    for (const c of this.cams) a = Math.max(a, c.susp);
    return a;
  }

  private movePlayer(dt: number) {
    let { x, z } = this.input;
    const len = Math.hypot(x, z);
    const moving = len > 0.15;
    const running = moving && this.input.run;
    if (moving) {
      x /= Math.max(1, len);
      z /= Math.max(1, len);
      const speed = (running ? RUN : WALK) * Math.min(1, len);
      const nx = this.px + x * speed * dt;
      if (!this.collides(nx, this.pz)) this.px = nx;
      const nz = this.pz + z * speed * dt;
      if (!this.collides(this.px, nz)) this.pz = nz;
      const target = Math.atan2(x, z);
      this.heading += wrapAngle(target - this.heading) * (1 - Math.exp(-dt * 14));
      this.play(this.playerAnims, running ? 'run' : 'walk', running ? 1.15 : 1.35);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = running ? 0.3 : 0.48;
        this.audio.step(running);
      }
      if (running) {
        this.noiseTimer -= dt;
        if (this.noiseTimer <= 0) {
          this.noiseTimer = 0.35;
          this.makeNoise(this.px, this.pz, 6.5);
        }
      }
    } else this.play(this.playerAnims, 'idle');
    this.player.position.set(this.px, 0, this.pz);
    this.player.rotation.y = this.heading;
  }

  private updateObjectives(dt: number) {
    this.prompt = null;
    for (const gem of this.gems) {
      if (gem.taken || Math.hypot(gem.x - this.px, gem.z - this.pz) > 0.9) continue;
      gem.taken = true;
      gem.mesh.setEnabled(false);
      this.gemsTaken++;
      this.audio.gem();
    }
    if (!this.hasPainting) {
      const d = Math.hypot(this.painting.x - this.px, this.painting.z - this.pz);
      if (d < 1.5) {
        this.prompt = this.input.interact ? 'Cutting the canvas…' : 'Hold E to steal the painting';
        if (this.input.interact) {
          this.steal = Math.min(1, this.steal + dt / STEAL_TIME);
          this.cutTimer -= dt;
          if (this.cutTimer <= 0) {
            this.cutTimer = 0.22;
            this.audio.cut();
          }
          if (this.steal >= 1) {
            this.hasPainting = true;
            this.painting.canvas.setEnabled(false);
            this.tube.setEnabled(true);
            this.exit.mat.emissiveColor = hex('#3dff7a');
            this.audio.stolen();
            this.prompt = null;
          }
        } else this.steal = Math.max(0, this.steal - dt * 2);
      } else this.steal = 0;
    }
    const toExit = Math.hypot(this.exit.x - this.px, this.exit.z - this.pz);
    if (toExit < 1.0) {
      if (this.hasPainting) this.escape();
      else this.prompt = 'The exit is here. Steal the painting first.';
    }
  }

  private updateCoin(dt: number) {
    if (!this.coin) return;
    const c = this.coin;
    c.t = Math.min(1, c.t + dt / 0.55);
    const p = Vector3.Lerp(c.from, c.to, c.t);
    p.y += Math.sin(c.t * Math.PI) * 1.4;
    c.mesh.position.copyFrom(p);
    c.mesh.rotation.x += dt * 20;
    if (c.t >= 1) {
      c.mesh.rotation.x = 0;
      this.audio.coinLand();
      this.makeNoise(c.to.x, c.to.z, 9, true);
      this.coin = null;
    }
  }

  /** Guards within `radius` hear it and walk over to check. */
  private makeNoise(x: number, z: number, radius: number, loud = false) {
    this.addRing(x, z, loud ? radius : radius * 0.6);
    for (const g of this.guards) {
      if (g.mode === 'alert' || Math.hypot(g.x - x, g.z - z) > radius) continue;
      this.investigate(g, [x, z]);
    }
  }

  private addRing(x: number, z: number, size: number) {
    const mesh = this.mesh(MeshBuilder.CreateTorus('ring', { diameter: 2, thickness: 0.05, tessellation: 40 }, this.scene));
    mesh.material = this.mats.ring;
    mesh.position.set(x, 0.06, z);
    mesh.scaling.setAll(0.1);
    this.rings.push({ mesh, age: 0, size });
  }

  private updateRings(dt: number) {
    this.rings = this.rings.filter((r) => {
      r.age += dt;
      const t = r.age / 0.7;
      if (t >= 1) {
        r.mesh.dispose();
        return false;
      }
      r.mesh.scaling.set(r.size * t, 1, r.size * t);
      r.mesh.visibility = 1 - t;
      return true;
    });
  }

  // ------------------------------------------------------------------ guards

  private investigate(g: Guard, target: P2) {
    const path = this.findPath(this.toCell(g.x, g.z), this.toCell(target[0], target[1]));
    if (!path.length) return;
    g.path = path;
    g.pathIdx = 0;
    g.mode = 'investigate';
  }

  /** Walks a guard toward the next point; returns true when the point is reached. */
  private stepToward(g: Guard, tx: number, tz: number, speed: number, dt: number) {
    const dx = tx - g.x;
    const dz = tz - g.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) return true;
    const want = Math.atan2(dx, dz);
    const diff = wrapAngle(want - g.heading);
    g.heading += Math.sign(diff) * Math.min(Math.abs(diff), dt * 5);
    if (Math.abs(diff) < 0.9) {
      const step = Math.min(d, speed * dt);
      g.x += (dx / d) * step;
      g.z += (dz / d) * step;
    }
    return false;
  }

  private updateGuard(g: Guard, dt: number, active: boolean) {
    // Seeing.
    let sees = false;
    if (active) {
      const dx = this.px - g.x;
      const dz = this.pz - g.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.85) return this.caught('A guard grabbed you', g);
      if (d < GUARD_RANGE && Math.abs(wrapAngle(Math.atan2(dx, dz) - g.heading)) < GUARD_HALF && this.clearLine(g.x, g.z, this.px, this.pz)) {
        sees = true;
        const rate = (0.7 + (1 - d / GUARD_RANGE) * 2.4) * (this.input.run ? 1.5 : 1);
        if (g.susp < 0.2 && g.susp + dt * rate >= 0.2) this.audio.suspicious();
        g.susp += dt * rate;
        g.lastSeen = [this.px, this.pz];
        if (g.susp >= 0.2) g.mode = 'alert';
        if (g.susp >= 1) return this.caught('A guard spotted you', g);
      }
    }
    if (!sees) {
      g.susp = Math.max(0, g.susp - dt * 0.28);
      if (g.mode === 'alert') this.investigate(g, g.lastSeen);
    }

    // Moving.
    switch (g.mode) {
      case 'alert': {
        const want = Math.atan2(g.lastSeen[0] - g.x, g.lastSeen[1] - g.z);
        g.heading += wrapAngle(want - g.heading) * (1 - Math.exp(-dt * 6));
        this.play(g.anims, 'idle');
        break;
      }
      case 'patrol': {
        const [tx, tz] = g.route[g.routeIdx];
        if (this.stepToward(g, tx, tz, 1.5, dt)) {
          if (g.stops.has(g.routeIdx)) {
            g.mode = 'pause';
            g.timer = 1.6;
            g.lookBase = g.heading;
          }
          g.routeIdx = (g.routeIdx + 1) % g.route.length;
        }
        this.play(g.anims, 'walk', 1.05);
        break;
      }
      case 'pause':
      case 'look': {
        const span = g.mode === 'look' ? 2.6 : 1.6;
        g.timer -= dt;
        g.heading = g.lookBase + Math.sin((span - g.timer) * 2.6) * 0.75;
        this.play(g.anims, 'idle');
        if (g.timer <= 0) {
          if (g.mode === 'pause') g.mode = 'patrol';
          else {
            const back = g.route[g.routeIdx];
            g.path = this.findPath(this.toCell(g.x, g.z), this.toCell(back[0], back[1]));
            g.pathIdx = 0;
            g.mode = 'return';
          }
        }
        break;
      }
      case 'investigate':
      case 'return': {
        const target = g.path[g.pathIdx];
        if (!target) {
          if (g.mode === 'investigate') {
            g.mode = 'look';
            g.timer = 2.6;
            g.lookBase = g.heading;
          } else g.mode = 'patrol';
          break;
        }
        const speed = g.mode === 'investigate' ? 2.7 : 1.5;
        if (this.stepToward(g, target[0], target[1], speed, dt)) g.pathIdx++;
        this.play(g.anims, g.mode === 'investigate' ? 'run' : 'walk', g.mode === 'investigate' ? 0.75 : 1.05);
        break;
      }
    }
    g.node.position.set(g.x, 0, g.z);
    g.node.rotation.y = g.heading;
    this.updateFan(g.fan, g.x, g.z, g.heading, GUARD_HALF, GUARD_RANGE);
    const k = Math.min(1, g.susp);
    g.fanMat.emissiveColor = Color3.Lerp(hex('#ffd54a'), hex('#ff2a2a'), k);
    const curious = g.susp > 0.05 || g.mode === 'investigate' || g.mode === 'look';
    g.mark.isVisible = curious;
    g.mark.material = g.susp > 0.6 ? this.markX : this.markQ;
  }

  private updateCam(c: SecurityCam, dt: number, active: boolean) {
    c.heading = c.base + Math.sin(this.clock * 0.6 + c.phase) * (c.sweep / 2);
    c.node.rotation.y = c.heading;
    c.led.isVisible = Math.floor(this.clock * 2) % 2 === 0;
    let sees = false;
    if (active) {
      const dx = this.px - c.x;
      const dz = this.pz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < CAM_RANGE && Math.abs(wrapAngle(Math.atan2(dx, dz) - c.heading)) < CAM_HALF && this.clearLine(c.x, c.z, this.px, this.pz)) {
        sees = true;
        if (c.susp < 0.2 && c.susp + dt * 1.6 >= 0.2) this.audio.suspicious();
        c.susp += dt * 1.6;
        if (c.susp >= 1) return this.caught('A security camera spotted you');
      }
    }
    if (!sees) c.susp = Math.max(0, c.susp - dt * 0.5);
    this.updateFan(c.fan, c.x, c.z, c.heading, CAM_HALF, CAM_RANGE);
    c.fanMat.emissiveColor = Color3.Lerp(hex('#ff6a6a'), hex('#ff1010'), Math.min(1, c.susp));
  }

  private updateLasers(playing: boolean) {
    for (const l of this.lasers) {
      const t = (this.clock + l.offset) % (l.on + l.off);
      const wasActive = l.active;
      l.active = t < l.on;
      const warning = !l.active && t > l.on + l.off - 0.45;
      const visible = l.active || (warning && Math.floor(this.clock * 16) % 2 === 0);
      l.beams.forEach((b) => (b.isVisible = visible));
      if (l.active && !wasActive && playing) this.audio.laserOn();
      if (!playing || !l.active) continue;
      // Distance from the player to the beam's line.
      const vx = l.x2 - l.x1;
      const vz = l.z2 - l.z1;
      const u = Math.max(0, Math.min(1, ((this.px - l.x1) * vx + (this.pz - l.z1) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(this.px - (l.x1 + vx * u), this.pz - (l.z1 + vz * u));
      if (d < RADIUS + 0.05) return this.caught('You tripped a laser');
    }
  }

  // ------------------------------------------------------------------ outcomes

  private caught(reason: string, by?: Guard) {
    if (this.state !== 'playing') return;
    this.setState('caught');
    this.audio.stopAmbience();
    this.audio.caught();
    this.flash = 2.2;
    this.play(this.playerAnims, 'idle');
    if (by) {
      by.susp = 1;
      by.mark.isVisible = true;
      by.mark.material = this.markX;
      by.heading = Math.atan2(this.px - by.x, this.pz - by.z);
      by.node.rotation.y = by.heading;
      this.play(by.anims, 'idle');
    }
    this.totalMs += this.time * 1000;
    window.setTimeout(() => {
      if (this.disposed) return;
      this.cb.onEnd({ score: this.totalScore, levelsCleared: this.cleared, gems: this.totalGems, durationMs: Math.round(this.totalMs), reason });
    }, 1500);
  }

  private escape() {
    const seconds = Math.round(this.time);
    const escape = 600;
    const gemPoints = this.gemsTaken * 100;
    const timeBonus = Math.max(0, Math.round((60 - this.time) * 5));
    const ghost = this.maxAlert < 0.25 ? 200 : 0;
    const total = escape + gemPoints + timeBonus + ghost;
    this.totalScore += total;
    this.totalGems += this.gemsTaken;
    this.totalMs += this.time * 1000;
    this.cleared++;
    this.audio.stopAmbience();
    this.audio.escaped();
    this.play(this.playerAnims, 'idle');
    const last = this.levelIndex === LEVELS.length - 1;
    this.setState(last ? 'won' : 'escaped');
    this.cb.onLevelDone({ level: this.levelIndex + 1, name: this.level.name, escape, gems: this.gemsTaken, gemPoints, timeBonus, ghost, total, seconds });
    if (last) this.cb.onEnd({ score: this.totalScore, levelsCleared: this.cleared, gems: this.totalGems, durationMs: Math.round(this.totalMs) });
  }

  // ------------------------------------------------------------------ camera and HUD

  private overviewCamera(snap = false) {
    const w = (this.cols - 1) * CELL;
    const h = (this.rows - 1) * CELL;
    const size = Math.max(w * 0.62, h);
    // Aim below the map's center so the map sits in the top part of the screen, above the briefing card.
    const pos = new Vector3(w / 2, size * 1.25 + 6, h / 2 - size * 0.95);
    if (snap) this.camera.position.copyFrom(pos);
    return { pos, target: new Vector3(w / 2, 0, h / 2 - size * 0.32) };
  }

  private updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 3.5);
    let pos: Vector3;
    let target: Vector3;
    if (this.state === 'briefing') ({ pos, target } = this.overviewCamera());
    else {
      // Steep enough that a wall just south of the thief can't hide them (walls are 2.4 m tall).
      pos = new Vector3(this.px, 14, this.pz - 5.6);
      target = new Vector3(this.px, 0.6, this.pz + 1);
    }
    this.camera.position = Vector3.Lerp(this.camera.position, pos, k);
    this.camTarget = this.camTarget ? Vector3.Lerp(this.camTarget, target, k) : target;
    this.camera.setTarget(this.camTarget);
  }
  private camTarget?: Vector3;

  private pushHud() {
    if (!this.level) return;
    this.cb.onHud({
      level: this.levelIndex + 1,
      levelName: this.level.name,
      time: this.time,
      gems: this.gemsTaken,
      gemsTotal: this.gems.length,
      coinsLeft: this.coinsLeft,
      hasPainting: this.hasPainting,
      alert: Math.min(1, this.alertLevel()),
      score: this.totalScore,
      steal: this.steal,
      prompt: this.prompt,
    });
  }

  /** Text for the briefing screen. */
  get briefing() {
    return { level: this.levelIndex + 1, name: this.level?.name ?? '', painting: this.level?.painting ?? '', brief: this.level?.brief ?? '' };
  }
}
