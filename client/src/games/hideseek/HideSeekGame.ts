import {
  AbstractMesh,
  AnimationGroup,
  AssetContainer,
  Color3,
  Color4,
  CubeTexture,
  DirectionalLight,
  DynamicTexture,
  Engine,
  FreeCamera,
  HemisphericLight,
  HighlightLayer,
  ImageProcessingConfiguration,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointerEventTypes,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { marbleFloor, painting, wallPanel } from '../heist/art';
import { loadHero } from '../shared/hero';
import { CELL, COLS, KIND_RADIUS, MAP, ROWS, SPAWN_CELLS, at, cellX, cellZ, decoys, solid, toCell, type Decoy, type Kind } from './map';
import type { RoomState, Tick } from './net';
import { PropFactory } from './props';

/*
 * The 3D side of Museum Hide & Seek. The server decides roles, positions at
 * the start of a round and whether a tag hits; this class draws the museum,
 * moves your own character, and smooths everyone else's movement between the
 * server's position updates.
 */

const WALL_H = 2.6;
const RADIUS = 0.32;
const SPEED = { seeker: 4.2, hider: 2.2 };
const SEND_EVERY = 1 / 15;
const TAG_REACH = 2.6;
const INTERP_DELAY = 110; // ms behind the newest update, so there's always a pair to blend between

interface Remote {
  id: string;
  name: string;
  color: string;
  person?: { node: TransformNode; anims: { idle?: AnimationGroup; walk?: AnimationGroup; cur?: AnimationGroup }; extra: { dispose(): void }[] };
  prop?: Mesh;
  propKind?: Kind;
  tag?: Mesh;
  buffer: { at: number; x: number; z: number; yaw: number; moving: boolean }[];
  x: number;
  z: number;
}
export interface Sender {
  move(msg: { x: number; z: number; yaw: number; moving: boolean; disguise?: Kind }): void;
  tag(x: number, z: number): Promise<{ ok: boolean; found?: boolean; reason?: string }>;
  serverNow(): number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const hex = (s: string) => Color3.FromHexString(s);

export class HideSeekGame {
  private engine: Engine;
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private camera!: FreeCamera;
  private shadows!: ShadowGenerator;
  private highlight!: HighlightLayer;
  private props!: PropFactory;
  private guardAssets!: AssetContainer;
  private disposed = false;

  private hero!: TransformNode;
  private heroAnims: { idle?: AnimationGroup; walk?: AnimationGroup; run?: AnimationGroup; cur?: AnimationGroup } = {};
  private myProp?: Mesh;
  private myPropKind?: Kind;
  private x = cellX(SPAWN_CELLS[0][0]);
  private z = cellZ(SPAWN_CELLS[0][1]);
  private yaw = 0;
  private input = { x: 0, z: 0 };
  private sendTimer = 0;
  private lastSent = '';

  private room: RoomState | null = null;
  private myId = '';
  private seed = 0;
  private decoyList: (Decoy & { mesh: Mesh })[] = [];
  private remotes = new Map<string, Remote>();
  private target: { x: number; z: number; mesh: Mesh } | null = null;
  private sender: Sender | null = null;
  disguise: Kind = 'vase';

  constructor(container: HTMLElement, private cb: { onProgress?: (p: number) => void; onTagResult?: (r: { ok: boolean; found?: boolean; reason?: string }) => void } = {}, private quality: 'high' | 'low' = 'high') {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Museum Hide and Seek game');
    container.appendChild(canvas);
    this.canvas = canvas;
    this.engine = new Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true }, true);
    this.engine.setHardwareScalingLevel(quality === 'high' ? 1 / Math.min(window.devicePixelRatio, 1.5) : 1.25);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.06, 0.06, 0.09, 1);
  }

  // ------------------------------------------------------------------ setup

  async load() {
    this.cb.onProgress?.(0.05);
    this.setupScene();
    this.buildMuseum();
    this.props = new PropFactory(this.scene);
    this.cb.onProgress?.(0.25);
    const [hero, guards] = await Promise.all([loadHero(this.scene), LoadAssetContainerAsync('/assets/characters/Xbot.glb', this.scene)]);
    if (this.disposed) return;
    this.hero = new TransformNode('me', this.scene);
    hero.root.parent = this.hero;
    hero.meshes.forEach((m) => {
      this.shadows.addShadowCaster(m, true);
      m.receiveShadows = true;
    });
    this.heroAnims = { ...hero.anims };
    this.play(this.heroAnims, 'idle');
    this.guardAssets = guards;
    for (const m of guards.materials) if (m instanceof PBRMaterial) m.maxSimultaneousLights = 6;
    this.cb.onProgress?.(0.9);
    this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return;
      const mesh = info.pickInfo?.pickedMesh;
      const meta = mesh?.metadata as { x?: number; z?: number } | undefined;
      if (meta?.x !== undefined && this.canTag() && Math.hypot(meta.x - this.x, meta.z! - this.z) < TAG_REACH) void this.sendTag(meta.x, meta.z!);
    });
    if (import.meta.env.DEV) Object.assign(window, { __hs: this });
    this.engine.runRenderLoop(() => {
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
    this.cb.onProgress?.(1);
  }

  private onResize = () => this.engine.resize();

  private setupScene() {
    const s = this.scene;
    this.camera = new FreeCamera('cam', new Vector3(25, 30, -10), s);
    this.camera.fov = 0.85;
    this.camera.minZ = 0.3;
    this.camera.maxZ = 300;
    this.camera.inputs.clear();
    s.environmentTexture = new CubeTexture('/assets/env/sky.env', s);
    s.environmentIntensity = 0.35;
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), s);
    hemi.intensity = 0.85;
    hemi.diffuse = hex('#fff1df');
    hemi.groundColor = hex('#3a3238');
    // Daylight from the skylights.
    const sun = new DirectionalLight('sun', new Vector3(0.35, -1, 0.45).normalize(), s);
    sun.intensity = 1.6;
    sun.diffuse = hex('#fff4e2');
    sun.position = new Vector3(0, 40, 0);
    this.shadows = new ShadowGenerator(this.quality === 'high' ? 2048 : 1024, sun);
    if (this.quality === 'high') {
      this.shadows.usePercentageCloserFiltering = true;
      this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    }
    this.shadows.bias = 0.004;
    this.shadows.darkness = 0.35;
    const ip = s.imageProcessingConfiguration;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.15;
    ip.contrast = 1.1;
    this.highlight = new HighlightLayer('tagTarget', s);
    this.highlight.outerGlow = true;
    this.highlight.innerGlow = false;
  }

  private pbr(name: string, color: string, rough: number, metal = 0) {
    const m = new PBRMaterial(name, this.scene);
    m.albedoColor = hex(color);
    m.roughness = rough;
    m.metallic = metal;
    m.maxSimultaneousLights = 6;
    return m;
  }

  private buildMuseum() {
    const s = this.scene;
    const floor = MeshBuilder.CreateGround('floor', { width: COLS * CELL, height: ROWS * CELL }, s);
    floor.position.set(((COLS - 1) * CELL) / 2, 0, ((ROWS - 1) * CELL) / 2);
    const floorMat = this.pbr('floor', '#ffffff', 0.2);
    floorMat.albedoTexture = marbleFloor(s, COLS, ROWS);
    floor.material = floorMat;
    floor.receiveShadows = true;
    floor.isPickable = false;

    const wallMat = this.pbr('wall', '#ffffff', 0.85);
    wallMat.albedoTexture = wallPanel(s);
    const walls: Mesh[] = [];
    const caps: Mesh[] = [];
    const extras: Mesh[] = [];
    const marble = this.pbr('marble', '#ece8e0', 0.3);
    const bronze = this.pbr('bronze', '#8a5a2b', 0.35, 0.85);
    const wood = this.pbr('caseWood', '#2e1f17', 0.6);
    const glass = this.pbr('glass', '#c8e0ff', 0.05);
    glass.alpha = 0.18;
    const frame = this.pbr('frame', '#c9a24a', 0.35, 0.9);
    const arts = Array.from({ length: 6 }, (_, i) => {
      const m = this.pbr(`art${i}`, '#ffffff', 0.6);
      m.albedoTexture = painting(s, i);
      return m;
    });
    let artN = 0;
    MAP.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        const x = cellX(c);
        const z = cellZ(r);
        if (ch === '#') {
          const w = MeshBuilder.CreateBox('w', { width: CELL, height: WALL_H, depth: CELL }, s);
          w.position.set(x, WALL_H / 2, z);
          walls.push(w);
          const cap = MeshBuilder.CreateBox('cap', { width: CELL + 0.02, height: 0.06, depth: CELL + 0.02 }, s);
          cap.position.set(x, WALL_H + 0.03, z);
          caps.push(cap);
          return;
        }
        if (ch === 'S') {
          const plinth = MeshBuilder.CreateBox('plinth', { width: 1.1, height: 1, depth: 1.1 }, s);
          plinth.position.set(x, 0.5, z);
          plinth.material = marble;
          const knot = MeshBuilder.CreateTorusKnot('knot', { radius: 0.32, tube: 0.1, radialSegments: 96, tubularSegments: 16, p: 2, q: 3 }, s);
          knot.position.set(x, 1.55, z);
          knot.material = bronze;
          extras.push(plinth, knot);
        } else if (ch === 'D') {
          const base = MeshBuilder.CreateBox('caseBase', { width: 1.2, height: 0.9, depth: 1.2 }, s);
          base.position.set(x, 0.45, z);
          base.material = wood;
          const g = MeshBuilder.CreateBox('caseGlass', { width: 1.1, height: 0.8, depth: 1.1 }, s);
          g.position.set(x, 1.3, z);
          g.material = glass;
          extras.push(base, g);
        }
        if (ch !== '.') return;
        // Paintings on the walls the camera can see.
        for (const [dc, dr, nx, nz] of [[0, -1, 0, -1], [1, 0, -1, 0], [-1, 0, 1, 0]] as const) {
          if (at(c + dc, r + dr) !== '#' || (c * 7 + r * 3) % (dr ? 2 : 4) !== 0) continue;
          const f = MeshBuilder.CreateBox('frame', { width: 1.32, height: 1.06, depth: 0.06 }, s);
          f.material = frame;
          f.position.set(x - nx * (CELL / 2 - 0.05), 1.55, z - nz * (CELL / 2 - 0.05));
          f.rotation.y = Math.atan2(-nx, -nz);
          const art = MeshBuilder.CreatePlane('art', { width: 1.16, height: 0.9 }, s);
          art.material = arts[artN++ % arts.length];
          art.parent = f;
          art.position.z = -0.035;
          extras.push(f, art);
        }
      }),
    );
    const wallMesh = Mesh.MergeMeshes(walls, true, true)!;
    wallMesh.material = wallMat;
    wallMesh.receiveShadows = true;
    this.shadows.addShadowCaster(wallMesh);
    const capMesh = Mesh.MergeMeshes(caps, true, true)!;
    capMesh.material = this.pbr('cap', '#1b1920', 0.9);
    for (const m of [wallMesh, capMesh, ...extras]) {
      m.isPickable = false;
      m.receiveShadows = true;
    }
  }

  // ------------------------------------------------------------------ server state

  setSender(sender: Sender) {
    this.sender = sender;
  }

  /** A new room snapshot from the server. */
  applyRoom(room: RoomState, myId: string) {
    const prev = this.room;
    this.room = room;
    this.myId = myId;
    if (room.seed !== this.seed) this.placeDecoys(room.seed);
    const me = room.players.find((p) => p.id === myId);
    // The server places everyone at the start of each round.
    const newRound = prev?.round !== room.round || (prev?.phase !== room.phase && room.phase === 'hide');
    if (me && (newRound || !prev) && (room.phase === 'hide' || (!prev && me.x))) {
      if (me.x || me.z) {
        this.x = me.x;
        this.z = me.z;
      }
    }
    if (room.phase === 'hide' && prev?.phase !== 'hide' && this.isHider()) this.disguise = me?.disguise ?? this.disguise;
    // Remove players who left for good.
    for (const [id, r] of this.remotes) {
      if (!room.players.some((p) => p.id === id && p.connected)) {
        this.removeRemote(r);
        this.remotes.delete(id);
      }
    }
    for (const p of room.players) {
      if (p.id === myId || !p.connected) continue;
      let r = this.remotes.get(p.id);
      if (!r) {
        r = { id: p.id, name: p.name, color: p.color, buffer: [], x: p.x, z: p.z };
        this.remotes.set(p.id, r);
      }
      if (newRound) r.buffer = [{ at: performance.now(), x: p.x, z: p.z, yaw: 0, moving: false }];
    }
    this.refreshAvatars();
  }

  /** Position updates from the server (about 15 a second). */
  applyTick(tick: Tick) {
    const now = performance.now();
    for (const [id, x, z, yaw, moving] of tick.players) {
      const r = this.remotes.get(id);
      if (!r) continue;
      r.buffer.push({ at: now, x, z, yaw, moving: Boolean(moving) });
      if (r.buffer.length > 20) r.buffer.shift();
    }
  }

  private role(id: string) {
    const r = this.room;
    if (!r || !['hide', 'seek', 'results'].includes(r.phase)) return 'free';
    return id === r.hiderId ? 'hider' : 'seeker';
  }

  isHider() {
    return this.role(this.myId) === 'hider';
  }

  private canMove() {
    const r = this.room;
    if (!r || !this.sender) return true;
    if (r.phase === 'hide' && !this.isHider()) return false;
    const me = r.players.find((p) => p.id === this.myId);
    return !(me && me.frozenUntil > this.sender.serverNow());
  }

  private canTag() {
    return this.room?.phase === 'seek' && this.role(this.myId) === 'seeker' && this.canMove();
  }

  private placeDecoys(seed: number) {
    this.seed = seed;
    this.decoyList.forEach((d) => d.mesh.dispose());
    this.decoyList = decoys(seed).map((d) => {
      const mesh = this.props.make(d.kind, d.id);
      mesh.position.set(d.x, 0, d.z);
      mesh.rotation.y = d.yaw;
      mesh.metadata = { x: d.x, z: d.z };
      this.shadows.addShadowCaster(mesh);
      return { ...d, mesh };
    });
  }

  /** Shows each player as a person or as their disguise, depending on the round. */
  private refreshAvatars() {
    const hiding = this.isHider();
    this.hero.setEnabled(!hiding);
    if (hiding) {
      if (this.myPropKind !== this.disguise) {
        this.myProp?.dispose();
        this.myProp = this.props.make(this.disguise, 'myDisguise');
        this.myProp.isPickable = false;
        this.shadows.addShadowCaster(this.myProp);
        this.myPropKind = this.disguise;
      }
    } else if (this.myProp) {
      this.myProp.dispose();
      this.myProp = undefined;
      this.myPropKind = undefined;
    }
    for (const r of this.remotes.values()) {
      const p = this.room?.players.find((x) => x.id === r.id);
      if (!p) continue;
      if (this.role(r.id) === 'hider') {
        if (r.person) r.person.node.setEnabled(false);
        if (r.tag) r.tag.setEnabled(false);
        if (r.propKind !== p.disguise) {
          r.prop?.dispose();
          r.prop = this.props.make(p.disguise, `hider-${r.id}`);
          r.propKind = p.disguise;
          this.shadows.addShadowCaster(r.prop);
        }
      } else {
        r.prop?.dispose();
        r.prop = undefined;
        r.propKind = undefined;
        if (!r.person) r.person = this.makePerson(r.id);
        r.person.node.setEnabled(true);
        if (!r.tag) r.tag = this.makeNameTag(p.name, p.color);
        r.tag.setEnabled(true);
      }
    }
  }

  private makePerson(id: string) {
    const entries = this.guardAssets.instantiateModelsToScene((n) => `${n}_${id}`, false, { doNotInstantiate: true });
    const node = new TransformNode(`p-${id}`, this.scene);
    const model = entries.rootNodes[0] as AbstractMesh;
    model.parent = node;
    model.rotation = new Vector3(0, Math.PI, 0);
    model.rotationQuaternion = null;
    model.getChildMeshes().forEach((m) => {
      this.shadows.addShadowCaster(m);
      m.receiveShadows = true;
      m.isPickable = false;
    });
    const groups = entries.animationGroups;
    groups.forEach((g) => g.stop());
    const anims = { idle: groups.find((g) => /idle/i.test(g.name)), walk: groups.find((g) => /walk/i.test(g.name)) };
    this.play(anims, 'idle');
    return { node, anims, extra: [...groups, ...entries.skeletons] };
  }

  private makeNameTag(name: string, color: string) {
    const tex = new DynamicTexture('tag', { width: 512, height: 128 }, this.scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D;
    c.clearRect(0, 0, 512, 128);
    c.font = 'bold 60px Manrope, system-ui, sans-serif';
    const w = Math.min(500, c.measureText(name).width + 60);
    c.fillStyle = 'rgba(10,12,26,0.78)';
    c.beginPath();
    c.roundRect(256 - w / 2, 18, w, 92, 46);
    c.fill();
    c.fillStyle = color;
    c.beginPath();
    c.arc(256 - w / 2 + 40, 64, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(name, 256 + 14, 66);
    tex.update();
    tex.hasAlpha = true;
    const mat = new StandardMaterial('tagMat', this.scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    const plane = MeshBuilder.CreatePlane('nameTag', { width: 1.6, height: 0.4 }, this.scene);
    plane.material = mat;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    return plane;
  }

  private removeRemote(r: Remote) {
    r.prop?.dispose();
    r.tag?.dispose();
    if (r.person) {
      r.person.node.dispose();
      r.person.extra.forEach((e) => e.dispose());
    }
  }

  // ------------------------------------------------------------------ controls

  setInput(x: number, z: number) {
    this.input.x = x;
    this.input.z = z;
  }

  setDisguise(kind: Kind) {
    this.disguise = kind;
    this.refreshAvatars();
    this.sendTimer = 0;
    this.lastSent = '';
  }

  /** Tags the highlighted object, if there is one. */
  tagTarget() {
    if (this.target && this.canTag()) void this.sendTag(this.target.x, this.target.z);
  }

  private async sendTag(x: number, z: number) {
    if (!this.sender) return;
    const res = await this.sender.tag(x, z);
    this.cb.onTagResult?.(res);
  }

  focus() {
    this.canvas.focus();
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
    this.canvas.remove();
  }

  // ------------------------------------------------------------------ loop

  private play(a: { idle?: AnimationGroup; walk?: AnimationGroup; run?: AnimationGroup; cur?: AnimationGroup }, name: 'idle' | 'walk' | 'run', speed = 1) {
    const next = a[name] ?? a.walk;
    if (!next) return;
    if (a.cur !== next) {
      a.cur?.stop();
      next.start(true, speed);
      a.cur = next;
    } else next.speedRatio = speed;
  }

  private blocked(x: number, z: number) {
    const [c, r] = toCell(x, z);
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (!solid(c + dc, r + dr)) continue;
        const half = (at(c + dc, r + dr) === '#' ? CELL : CELL * 0.62) / 2;
        const cx = cellX(c + dc);
        const cz = cellZ(r + dr);
        const nx = Math.max(cx - half, Math.min(x, cx + half));
        const nz = Math.max(cz - half, Math.min(z, cz + half));
        if ((x - nx) ** 2 + (z - nz) ** 2 < RADIUS * RADIUS) return true;
      }
    }
    for (const d of this.decoyList) if (Math.hypot(d.x - x, d.z - z) < KIND_RADIUS[d.kind] + RADIUS) return true;
    return false;
  }

  private update(dt: number) {
    const hiding = this.isHider();
    let moving = false;
    if (this.canMove()) {
      let { x, z } = this.input;
      const len = Math.hypot(x, z);
      if (len > 0.15) {
        x /= Math.max(1, len);
        z /= Math.max(1, len);
        const speed = (hiding ? SPEED.hider : SPEED.seeker) * Math.min(1, len);
        const nx = this.x + x * speed * dt;
        if (!this.blocked(nx, this.z)) this.x = nx;
        const nz = this.z + z * speed * dt;
        if (!this.blocked(this.x, nz)) this.z = nz;
        this.yaw += wrap(Math.atan2(x, z) - this.yaw) * (1 - Math.exp(-dt * 12));
        moving = true;
      }
    }
    this.hero.position.set(this.x, 0, this.z);
    this.hero.rotation.y = this.yaw;
    this.play(this.heroAnims, moving ? 'run' : 'idle', moving ? 1.1 : 1);
    if (this.myProp) {
      this.myProp.position.set(this.x, 0, this.z);
      this.myProp.rotation.y = this.yaw;
    }

    // Tell the server where we are, ~15 times a second (and right away after a change).
    this.sendTimer -= dt;
    if (this.sender && this.room && this.sendTimer <= 0) {
      this.sendTimer = SEND_EVERY;
      const msg = { x: Math.round(this.x * 100) / 100, z: Math.round(this.z * 100) / 100, yaw: Math.round(this.yaw * 100) / 100, moving, disguise: hiding ? this.disguise : undefined };
      const key = JSON.stringify(msg);
      if (key !== this.lastSent) {
        this.lastSent = key;
        this.sender.move(msg);
      }
    }

    this.updateRemotes();
    this.updateTarget();
    this.updateCamera(dt);
  }

  private updateRemotes() {
    const renderAt = performance.now() - INTERP_DELAY;
    for (const r of this.remotes.values()) {
      const b = r.buffer;
      if (!b.length) continue;
      let i = b.length - 1;
      while (i > 0 && b[i - 1].at > renderAt) i--;
      const a = b[Math.max(0, i - 1)];
      const c = b[i];
      const t = c.at === a.at ? 1 : Math.max(0, Math.min(1, (renderAt - a.at) / (c.at - a.at)));
      r.x = a.x + (c.x - a.x) * t;
      r.z = a.z + (c.z - a.z) * t;
      const yaw = a.yaw + wrap(c.yaw - a.yaw) * t;
      if (r.person) {
        r.person.node.position.set(r.x, 0, r.z);
        r.person.node.rotation.y = yaw;
        this.play(r.person.anims, c.moving ? 'walk' : 'idle', 1.4);
      }
      if (r.tag) r.tag.position.set(r.x, 2.25, r.z);
      if (r.prop) {
        r.prop.position.set(r.x, 0, r.z);
        r.prop.rotation.y = yaw;
        r.prop.metadata = { x: r.x, z: r.z };
      }
    }
  }

  /** Highlights the nearest object in front of a seeker that they could tag. */
  private updateTarget() {
    let best = null as { x: number; z: number; mesh: Mesh } | null;
    if (this.canTag()) {
      let bestScore = Infinity;
      const consider = (x: number, z: number, mesh: Mesh) => {
        const d = Math.hypot(x - this.x, z - this.z);
        if (d > TAG_REACH) return;
        const facing = Math.abs(wrap(Math.atan2(x - this.x, z - this.z) - this.yaw));
        const score = d + facing * 1.2;
        if (facing < 1.4 && score < bestScore) {
          bestScore = score;
          best = { x, z, mesh };
        }
      };
      for (const d of this.decoyList) consider(d.x, d.z, d.mesh);
      for (const r of this.remotes.values()) if (r.prop) consider(r.x, r.z, r.prop);
    }
    if (best?.mesh !== this.target?.mesh) {
      if (this.target) this.highlight.removeMesh(this.target.mesh);
      if (best) this.highlight.addMesh(best.mesh, hex('#ffd54a'));
    }
    this.target = best;
  }

  get hasTarget() {
    return Boolean(this.target);
  }

  private updateCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 4);
    const inLobby = !this.room || this.room.phase === 'lobby' || this.room.phase === 'final';
    const pos = inLobby ? new Vector3(this.x, 15, this.z - 10) : new Vector3(this.x, 10.5, this.z - 6.8);
    const target = new Vector3(this.x, 0.6, this.z + 0.8);
    this.camera.position = Vector3.Lerp(this.camera.position, pos, k);
    this.camTarget = this.camTarget ? Vector3.Lerp(this.camTarget, target, k) : target;
    this.camera.setTarget(this.camTarget);
  }
  private camTarget?: Vector3;
}
