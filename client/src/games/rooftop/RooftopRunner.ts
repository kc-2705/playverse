import {
  AbstractMesh,
  AnimationGroup,
  Color3,
  Color4,
  CubeTexture,
  DirectionalLight,
  DynamicTexture,
  Engine,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { RunnerAudio } from './audio';
import { loadHero, playClip } from '../shared/hero';
import { ThemeKit, type Chaser, type Drifter, type ObstacleKind } from './scenery';
import { skyGradient } from './textures';
import { themeById, themeIndex, type ThemeId, type ThemeInfo } from './themes';

/*
 * Rooftop Runner
 * The runner stays at z = 0 and the world moves toward the camera. The track is
 * a row of separate blocks (rooftops, cliff tops, town walls…) with gaps between
 * them; a block can be higher (climb) or lower (drop). Obstacles sit in three
 * lanes. How it all looks comes from the chosen theme (see scenery.ts).
 */

export type RunnerState = 'loading' | 'ready' | 'running' | 'paused' | 'over';
export interface RunnerStats {
  distance: number;
  coins: number;
  score: number;
  durationMs: number;
  theme: number;
  reason?: string;
}
export interface RunnerCallbacks {
  onState: (s: RunnerState) => void;
  onHud: (s: RunnerStats) => void;
  onProgress?: (p: number) => void;
  onGameOver: (s: RunnerStats) => void;
}

const LANES = [-2.2, 0, 2.2];
const SPAWN_Z = 220;
const START_SPEED = 13;
const MAX_SPEED = 30;
const GRAVITY = -34;
const JUMP_V = 12.5;
const SLIDE_TIME = 0.8;
const CLIMB_REACH = 1.9; // how high a ledge the runner can pull up onto

interface Building {
  root: Mesh;
  start: number; // z of the front edge (closest to camera after movement… farthest before)
  length: number;
  height: number;
  active: boolean;
  props: TransformNode[];
}
interface Obstacle {
  node: TransformNode;
  kind: ObstacleKind;
  lane: number;
  y0: number;
  y1: number;
  depth: number;
  active: boolean;
}
interface Coin {
  mesh: AbstractMesh;
  active: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export class RooftopRunner {
  private engine: Engine;
  private scene: Scene;
  private camera!: FreeCamera;
  private shadows!: ShadowGenerator;
  private sun!: DirectionalLight;
  private cb: RunnerCallbacks;
  private audio = new RunnerAudio();

  private state: RunnerState = 'loading';
  private speed = START_SPEED;
  private distance = 0;
  private coins = 0;
  private runMs = 0;
  private lane = 1;
  private x = 0;
  private y = 0;
  private vy = 0;
  private slide = 0;
  private climb = 0;
  private grounded = true;
  private clock = 0;
  private shake = 0;
  private nextRowAt = 0;

  private player!: TransformNode;
  private runAnim?: AnimationGroup;
  private idleAnim?: AnimationGroup;
  private jumpAnim?: AnimationGroup;
  private slideAnim?: AnimationGroup;
  private climbAnim?: AnimationGroup;
  private pose: 'run' | 'jump' | 'slide' | 'climb' | 'none' = 'none';
  private jumping = false;
  private chaser!: Chaser;

  private buildings: Building[] = [];
  private obstacles: Obstacle[] = [];
  private coinPool: Coin[] = [];
  private drifters: Drifter[] = [];
  private kit!: ThemeKit;
  private theme: ThemeInfo;
  private nextBuildingZ = 0;

  private canvas: HTMLCanvasElement;
  private disposed = false;

  /**
   * Each game gets its own canvas inside `container`. Two engines sharing one
   * canvas share one WebGL context and corrupt each other's rendering.
   */
  constructor(container: HTMLElement, cb: RunnerCallbacks, private quality: 'high' | 'low' = 'high', themeId: ThemeId = 'city') {
    this.cb = cb;
    this.theme = themeById(themeId);
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', `Rooftop Runner game, ${this.theme.name}`);
    container.appendChild(canvas);
    this.canvas = canvas;
    this.engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true }, true);
    this.engine.setHardwareScalingLevel(quality === 'high' ? 1 / Math.min(window.devicePixelRatio, 1.5) : 1.25);
    this.scene = new Scene(this.engine);
    const fog = Color3.FromHexString(this.theme.look.fog.color);
    this.scene.clearColor = new Color4(fog.r, fog.g, fog.b, 1);
  }

  // ------------------------------------------------------------------ setup

  async load() {
    this.setState('loading');
    this.cb.onProgress?.(0.05);
    this.setupLighting();
    this.kit = new ThemeKit(this.scene, this.theme, this.shadows, this.quality);
    this.cb.onProgress?.(0.2);
    await this.loadRunner();
    // The page may have closed (or React remounted it) while the model loaded.
    if (this.disposed) return;
    this.cb.onProgress?.(0.75);
    this.drifters = this.kit.buildBackdrop();
    this.chaser = this.kit.buildChaser();
    this.buildPools();
    this.resetWorld();
    this.cb.onProgress?.(1);

    // Lets browser tests look inside the scene during development.
    if (import.meta.env.DEV) (window as unknown as { __runner?: unknown }).__runner = this;
    this.engine.runRenderLoop(() => {
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
    this.setState('ready');
  }

  private onResize = () => this.engine.resize();

  private setupLighting() {
    const scene = this.scene;
    const look = this.theme.look;
    const c3 = (h: string) => Color3.FromHexString(h);
    this.camera = new FreeCamera('cam', new Vector3(0, 4.2, -7.5), scene);
    this.camera.setTarget(new Vector3(0, 1.6, 10));
    this.camera.fov = 1.0;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 2600;
    this.camera.inputs.clear();

    // Sky: a painted gradient dome plus a glowing sun or moon. (Babylon's analytic
    // SkyMaterial produced invalid colors on some GPUs, which blacked out the frame.)
    const skyMat = new StandardMaterial('sky', scene);
    skyMat.emissiveTexture = skyGradient(scene, look.sky, look.stars);
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    const sky = MeshBuilder.CreateSphere('skyDome', { diameter: 4400, segments: 24, sideOrientation: Mesh.BACKSIDE }, scene);
    sky.material = skyMat;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.applyFog = false;

    // The sun (or moon) and a soft halo around it.
    const [dx, dy, dz] = look.sun.disc;
    const halo = new DynamicTexture('halo', { width: 128, height: 128 }, scene, false);
    const hc = halo.getContext() as CanvasRenderingContext2D;
    const hg = hc.createRadialGradient(64, 64, 18, 64, 64, 64);
    hg.addColorStop(0, 'rgba(255,255,255,0.45)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    hc.fillStyle = hg;
    hc.fillRect(0, 0, 128, 128);
    halo.update();
    halo.hasAlpha = true;
    for (const scale of [1, 3]) {
      const disc = MeshBuilder.CreateDisc('sunDisc', { radius: look.sun.radius * scale, tessellation: 48 }, scene);
      const m = new StandardMaterial('sunMat', scene);
      m.emissiveColor = c3(look.sun.color);
      m.disableLighting = true;
      m.backFaceCulling = false; // lookAt() turns the disc's front away from the camera
      if (scale > 1) m.opacityTexture = halo;
      disc.material = m;
      disc.position = new Vector3(dx, dy, dz).scale(scale === 1 ? 1 : 1.01);
      disc.lookAt(Vector3.Zero());
      disc.infiniteDistance = true;
      disc.applyFog = false;
      disc.isPickable = false;
    }

    // Image-based lighting gives metals and glass believable reflections.
    scene.environmentTexture = new CubeTexture('/assets/env/sky.env', scene);
    scene.environmentIntensity = look.env;

    const hemi = new HemisphericLight('fill', new Vector3(0, 1, 0), scene);
    hemi.intensity = look.hemi.intensity;
    hemi.diffuse = c3(look.hemi.sky);
    hemi.groundColor = c3(look.hemi.ground);

    this.sun = new DirectionalLight('sun', new Vector3(...look.sun.dir).normalize(), scene);
    this.sun.position = new Vector3(-20, 30, -30);
    this.sun.intensity = look.light.intensity;
    this.sun.diffuse = c3(look.light.color);

    this.shadows = new ShadowGenerator(this.quality === 'high' ? 2048 : 1024, this.sun);
    // Percentage-closer filtering softens the stair-stepped shadow edges.
    if (this.quality === 'high') {
      this.shadows.usePercentageCloserFiltering = true;
      this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    }
    this.shadows.bias = 0.002;
    this.shadows.darkness = 0.35;
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 90;

    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = look.fog.density;
    scene.fogColor = c3(look.fog.color);

    // Color grading is done inside the materials (filmic tone mapping, contrast, vignette).
    // A full post-processing pipeline made lit objects vanish on some Intel GPUs, so it isn't used.
    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = look.exposure;
    ip.contrast = look.contrast;
    if (this.quality === 'high') {
      const v = c3(look.vignette);
      ip.vignetteEnabled = true;
      ip.vignetteWeight = 1.6;
      ip.vignetteColor = new Color4(v.r, v.g, v.b, 0);
      // Glow for lit windows, coins, lamps, pumpkins and the sun.
      const glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5 });
      glow.intensity = look.glow;
    }
  }

  private async loadRunner() {
    const hero = await loadHero(this.scene);
    this.player = new TransformNode('player', this.scene);
    hero.root.parent = this.player;
    hero.meshes.forEach((m) => {
      this.shadows.addShadowCaster(m, true);
      m.receiveShadows = true;
    });
    this.runAnim = hero.anims.run;
    this.idleAnim = hero.anims.idle;
    this.jumpAnim = hero.anims.jump;
    this.slideAnim = hero.anims.slide;
    this.climbAnim = hero.anims.climb;
    // Blend between moves instead of snapping from one pose to the next.
    for (const g of [this.runAnim, this.idleAnim, this.jumpAnim, this.slideAnim, this.climbAnim]) {
      g?.targetedAnimations.forEach((t) => {
        t.animation.enableBlending = true;
        t.animation.blendingSpeed = 0.2;
      });
    }
    this.idleAnim?.start(true);
  }

  private makeObstacle(kind: ObstacleKind): Obstacle {
    const n = new TransformNode(`ob-${kind}`, this.scene);
    this.kit.buildObstacle(kind, n);
    // Collision boxes are the same in every theme, so every world plays the same.
    const [y0, y1, depth] = { unit: [0, 1.0, 0.75], pipe: [1.2, 1.7, 0.3], tank: [0, 3.7, 0.95] }[kind];
    n.setEnabled(false);
    return { node: n, kind, lane: 1, y0, y1, depth, active: false };
  }

  private buildPools() {
    for (const k of ['unit', 'pipe', 'tank'] as ObstacleKind[]) for (let i = 0; i < 18; i++) this.obstacles.push(this.makeObstacle(k));
    const coin = MeshBuilder.CreateCylinder('coin', { diameter: 0.55, height: 0.08, tessellation: 24 }, this.scene);
    coin.rotation.x = Math.PI / 2;
    coin.bakeCurrentTransformIntoVertices();
    coin.material = this.kit.mats.gold;
    coin.setEnabled(false);
    for (let i = 0; i < 80; i++) {
      const c = coin.createInstance(`coin${i}`);
      c.setEnabled(false);
      this.coinPool.push({ mesh: c, active: false });
    }
    for (let i = 0; i < 9; i++) this.buildings.push(this.makeBuilding());
  }

  private makeBuilding(): Building {
    const root = new Mesh('building', this.scene);
    root.setEnabled(false);
    return { root, start: 0, length: 0, height: 0, active: false, props: [] };
  }

  /** Builds or rebuilds one block of track at the far end. */
  private placeBuilding(b: Building, start: number, length: number, height: number) {
    b.root.getChildMeshes().forEach((m) => m.dispose());
    b.start = start;
    b.length = length;
    b.height = height;
    b.active = true;
    this.kit.dressBlock(b.root, length);
    b.root.position.set(0, height, start);
    b.root.setEnabled(true);
  }

  // ------------------------------------------------------------------ world

  private resetWorld() {
    this.buildings.forEach((b) => {
      b.active = false;
      b.root.setEnabled(false);
    });
    this.obstacles.forEach((o) => {
      o.active = false;
      o.node.setEnabled(false);
    });
    this.coinPool.forEach((c) => {
      c.active = false;
      c.mesh.setEnabled(false);
    });
    // A long first roof so the start is calm.
    this.nextBuildingZ = -12;
    let h = 0;
    for (let i = 0; i < this.buildings.length; i++) {
      const len = i === 0 ? 120 : rnd(45, 85);
      const gap = i === 0 ? 0 : rnd(3.2, 5.5);
      if (i > 0) h = this.nextHeight(h);
      this.placeBuilding(this.buildings[i], this.nextBuildingZ + gap, len, h);
      this.nextBuildingZ += gap + len;
    }
    this.speed = START_SPEED;
    this.distance = 0;
    this.coins = 0;
    this.runMs = 0;
    this.lane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.slide = 0;
    this.climb = 0;
    this.grounded = true;
    this.nextRowAt = 45;
    this.player.position.set(0, 0, 0);
    this.player.rotation.set(0, 0, 0);
  }

  /**
   * Next roof height: up to a climbable step higher, or a drop lower. Drops are
   * bigger than climbs, so the odds lean back toward 0 to stop the track
   * sinking below the scenery on long runs.
   */
  private nextHeight(prev: number) {
    const r = Math.random();
    const climb = 0.3 + Math.max(-0.2, Math.min(0.35, -prev * 0.05));
    if (r < climb) return prev + rnd(0.8, 1.5); // a ledge to climb
    if (r < climb + 0.35) return prev - rnd(1, 3.5); // a drop
    return prev + rnd(-0.4, 0.4);
  }

  private recycleBuildings() {
    for (const b of this.buildings) {
      if (b.active && b.start + b.length < -20) {
        const last = this.buildings.reduce((m, x) => (x.active && x.start + x.length > m.start + m.length ? x : m));
        const gap = rnd(3.2, 5.2 + Math.min(2, this.speed / 15));
        const len = rnd(45, 90);
        this.placeBuilding(b, last.start + last.length + gap, len, this.nextHeight(last.height));
      }
    }
  }

  /** The roof under a given z, if any. */
  private roofAt(z: number) {
    return this.buildings.find((b) => b.active && z >= b.start && z <= b.start + b.length);
  }

  private spawnRow() {
    const z = SPAWN_Z;
    const roof = this.roofAt(z);
    // Keep obstacles away from roof edges so jumps and climbs stay fair.
    if (!roof || z < roof.start + 8 || z > roof.start + roof.length - 8) return;
    const y = roof.height;
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const pattern = this.distance < 200 ? pick([0, 0, 1]) : pick([0, 1, 2, 3]);
    const place = (kind: ObstacleKind, lane: number) => {
      const o = this.obstacles.find((x) => !x.active && x.kind === kind);
      if (!o) return;
      o.active = true;
      o.lane = lane;
      o.node.position.set(LANES[lane], y, z);
      o.node.setEnabled(true);
    };
    if (pattern === 0) place(pick(['unit', 'pipe', 'tank'] as ObstacleKind[]), lanes[0]);
    else if (pattern === 1) {
      place('tank', lanes[0]);
      place(pick(['unit', 'pipe'] as ObstacleKind[]), lanes[1]);
    } else if (pattern === 2) [0, 1, 2].forEach((l) => place('unit', l));
    else [0, 1, 2].forEach((l) => place('pipe', l));
    // Coins in a free lane or arcing over a full row of units.
    const coinLane = pattern >= 2 ? pick([0, 1, 2]) : lanes[2];
    this.placeCoins(coinLane, z + (pattern === 2 ? -5 : 8), y, pattern === 2 ? 'arc' : 'line');
  }

  private placeCoins(lane: number, z: number, roofY: number, shape: 'line' | 'arc') {
    const count = shape === 'arc' ? 6 : 7;
    for (let i = 0; i < count; i++) {
      const c = this.coinPool.find((x) => !x.active);
      if (!c) return;
      const t = i / (count - 1);
      c.active = true;
      c.mesh.position.set(LANES[lane], roofY + 1 + (shape === 'arc' ? Math.sin(t * Math.PI) * 2 : 0), z + i * 2);
      c.mesh.setEnabled(true);
    }
  }

  // ------------------------------------------------------------------ input

  move(dir: -1 | 1) {
    if (this.state !== 'running') return;
    const next = Math.max(0, Math.min(2, this.lane + dir));
    if (next !== this.lane) {
      this.lane = next;
      this.audio.lane();
    }
  }

  jump() {
    if (this.state !== 'running' || !this.grounded || this.climb > 0) return;
    this.vy = JUMP_V;
    this.grounded = false;
    this.jumping = true;
    this.slide = 0;
    this.audio.jump();
  }

  duck() {
    if (this.state !== 'running') return;
    if (!this.grounded) this.vy = Math.min(this.vy, -20);
    this.slide = SLIDE_TIME;
    this.audio.slide();
  }

  start() {
    this.resetWorld();
    this.idleAnim?.stop();
    this.pose = 'none';
    this.jumping = false;
    this.setMove('run');
    this.audio.start();
    this.setState('running');
  }

  pause() {
    if (this.state !== 'running') return;
    this.moveAnim()?.pause();
    this.audio.stopMusic();
    this.setState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.moveAnim()?.play(this.pose === 'run');
    this.audio.startMusic();
    this.setState('running');
  }

  setSound(on: boolean) {
    this.audio.setEnabled(on);
  }

  focus() {
    this.canvas.focus();
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

  private setState(s: RunnerState) {
    this.state = s;
    this.cb.onState(s);
  }

  private stats(reason?: string): RunnerStats {
    const distance = Math.floor(this.distance);
    return { distance, coins: this.coins, score: distance + this.coins * 10, durationMs: Math.round(this.runMs), theme: themeIndex(this.theme.id), reason };
  }

  private gameOver(reason: string) {
    if (this.state !== 'running') return;
    this.moveAnim()?.stop();
    this.pose = 'none';
    this.shake = 0.5;
    this.audio.crash();
    this.audio.stopMusic();
    this.setState('over');
    this.cb.onGameOver(this.stats(reason));
  }

  // ------------------------------------------------------------------ loop

  private update(dt: number) {
    this.clock += dt;
    const running = this.state === 'running';
    const step = running ? this.speed * dt : this.state === 'ready' ? 4 * dt : 0;

    if (running) {
      this.runMs += dt * 1000;
      this.speed = Math.min(MAX_SPEED, this.speed + dt * 0.28);
      this.distance += step;
      if (this.runAnim && this.pose === 'run') this.runAnim.speedRatio = 0.9 + this.speed / 22;
      if (this.distance >= this.nextRowAt) {
        this.spawnRow();
        this.nextRowAt = this.distance + Math.max(16, 26 - this.speed * 0.25) + rnd(0, 8);
      }
    }

    // Move the world toward the camera.
    for (const b of this.buildings) {
      if (!b.active) continue;
      b.start -= step;
      b.root.position.z = b.start;
    }
    this.recycleBuildings();
    for (const d of this.drifters) {
      d.node.position.z -= step * d.factor;
      if (d.node.position.z < d.min) d.node.position.z += d.span;
    }

    // Runner physics.
    const targetX = LANES[this.lane];
    this.x += (targetX - this.x) * (1 - Math.exp(-dt * 13));
    const roof = this.roofAt(0.4);
    const floor = roof ? roof.height : -Infinity;
    if (this.climb > 0) {
      // Pulling up onto a higher ledge.
      this.climb -= dt;
      this.y += (this.climbTo - this.y) * (1 - Math.exp(-dt * 16));
      if (this.climb <= 0) {
        this.y = this.climbTo;
        this.grounded = true;
      }
    } else if (running || this.state === 'ready') {
      // A taller roof starting right in front of the runner: climb it or crash.
      const ahead = this.roofAt(0.9);
      if (running && ahead && roof !== ahead && ahead.height > this.y + 0.35) {
        if (ahead.height - this.y <= CLIMB_REACH) this.startClimb(ahead.height);
        else this.gameOver(this.theme.reasons.wall);
      }
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= floor) {
        if (!this.grounded && this.vy < -14) this.audio.land();
        this.jumping = false;
        this.y = floor;
        this.vy = 0;
        this.grounded = true;
      } else if (this.y > floor + 0.02) {
        this.grounded = false;
      }
      if (running && floor === -Infinity && this.y < (this.lastRoofY ?? 0) - 6) this.gameOver(this.theme.reasons.fall);
      if (roof) this.lastRoofY = roof.height;
    }
    this.slide = Math.max(0, this.slide - dt);

    // Pose: Remy's own jump, slide and climb moves when they're loaded; otherwise
    // lean back to slide and tuck in the air.
    this.player.position.set(this.x, this.y, 0);
    this.player.rotation.z = (this.x - targetX) * 0.12;
    const sliding = this.slide > 0 && this.grounded;
    if (running) this.setMove(this.climb > 0 ? 'climb' : sliding ? 'slide' : this.jumping && !this.grounded ? 'jump' : 'run');
    const posed = (this.pose === 'slide' && this.slideAnim) || (this.pose === 'jump' && this.jumpAnim) || (this.pose === 'climb' && this.climbAnim);
    const targetPitch = posed ? 0 : sliding ? -1.15 : !this.grounded && this.climb <= 0 ? 0.18 : this.climb > 0 ? -0.35 : 0;
    this.player.rotation.x += (targetPitch - this.player.rotation.x) * (1 - Math.exp(-dt * 14));
    if (this.runAnim && this.pose === 'run' && !this.grounded && this.climb <= 0) this.runAnim.speedRatio = 0.35;

    if (running) this.checkHits(dt);
    this.updateCoins(dt, step);
    this.updateDrone(dt);
    this.updateCamera(dt);
    if (running) this.cb.onHud(this.stats());
  }

  private climbTo = 0;
  private lastRoofY?: number;

  private moveAnim() {
    return { run: this.runAnim, jump: this.jumpAnim, slide: this.slideAnim, climb: this.climbAnim, none: undefined }[this.pose];
  }

  /** Switches the runner's animation; the clips blend into each other. */
  private setMove(next: 'run' | 'jump' | 'slide' | 'climb') {
    if (next === this.pose) return;
    const clip = { run: this.runAnim, jump: this.jumpAnim, slide: this.slideAnim, climb: this.climbAnim }[next];
    // Without a clip for this move, keep running and let the pose tricks show it.
    if (!clip && next !== 'run') return;
    this.moveAnim()?.stop();
    this.pose = next;
    if (!clip) return;
    if (next === 'run') clip.start(true, 0.9 + this.speed / 22);
    // Take-off to landing of the running jump, timed to the jump's air time.
    else if (next === 'jump') playClip(clip, 0.3, 1.35, (2 * JUMP_V) / -GRAVITY);
    // Drop, slide and stand back up within the slide.
    else if (next === 'slide') playClip(clip, 0.1, 1.4, SLIDE_TIME + 0.1);
    // Pulling over the ledge.
    else playClip(clip, 1.9, 3.1, this.climb);
  }

  private startClimb(height: number) {
    this.climb = this.climbAnim ? 0.42 : 0.28;
    this.climbTo = height;
    this.vy = 0;
    this.grounded = false;
    this.audio.climb();
  }

  private checkHits(dt: number) {
    const step = this.speed * dt;
    const height = this.slide > 0 && this.grounded ? 0.75 : 1.75;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const z0 = o.node.position.z;
      o.node.position.z -= step;
      if (o.node.position.z < -15) {
        o.active = false;
        o.node.setEnabled(false);
        continue;
      }
      const passing = z0 > -o.depth && o.node.position.z < o.depth;
      if (!passing || Math.abs(o.node.position.x - this.x) > 1.2) continue;
      const feet = this.y - o.node.position.y;
      if (feet < o.y1 && feet + height > o.y0) {
        this.gameOver(this.theme.reasons[o.kind]);
        return;
      }
    }
  }

  private updateCoins(dt: number, step: number) {
    for (const c of this.coinPool) {
      if (!c.active) continue;
      c.mesh.position.z -= step;
      c.mesh.rotation.y += dt * 4;
      if (c.mesh.position.z < -10) {
        c.active = false;
        c.mesh.setEnabled(false);
        continue;
      }
      if (this.state !== 'running') continue;
      const p = c.mesh.position;
      if (Math.abs(p.z) < 0.7 + step && Math.abs(p.x - this.x) < 0.9 && p.y > this.y - 0.3 && p.y < this.y + 2.1) {
        c.active = false;
        c.mesh.setEnabled(false);
        this.coins++;
        this.audio.coin();
      }
    }
    // Obstacles also drift when not running (menu), so the scene feels alive.
    if (this.state !== 'running') {
      for (const o of this.obstacles) if (o.active) o.node.position.z -= step;
    }
  }

  private updateDrone(dt: number) {
    const bob = Math.sin(this.clock * 2.2) * 0.25;
    const node = this.chaser.node;
    const target = new Vector3(this.x + 1.8, this.y + 3.2 + bob, -2.8);
    node.position = Vector3.Lerp(node.position, target, 1 - Math.exp(-dt * 3));
    node.rotation.z = (target.x - node.position.x) * -0.3;
    this.chaser.animate(dt, this.clock);
  }

  private updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 5);
    const camX = this.x * 0.55;
    const camY = this.y + 4.0;
    this.camera.position.x += (camX - this.camera.position.x) * k;
    this.camera.position.y += (camY - this.camera.position.y) * k;
    this.camera.position.z = -7.5;
    if (this.shake > 0) {
      this.camera.position.x += rnd(-1, 1) * this.shake * 0.3;
      this.camera.position.y += rnd(-1, 1) * this.shake * 0.3;
      this.shake = Math.max(0, this.shake - dt);
    }
    const speedFov = 0.95 + (this.speed - START_SPEED) * 0.012;
    this.camera.fov += (speedFov - this.camera.fov) * k;
    this.camera.setTarget(new Vector3(this.x * 0.35, this.y + 1.4, 12));
    // Keep the sun's shadow box around the runner.
    this.sun.position.set(this.x - 20, this.y + 30, -30);
  }
}
