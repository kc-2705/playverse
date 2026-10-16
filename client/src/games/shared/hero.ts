import {
  AbstractMesh,
  Animation,
  AnimationGroup,
  LoadAssetContainerAsync,
  Matrix,
  Node,
  Quaternion,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/*
 * The player character. Players pick one of two Mixamo-rigged characters:
 *   Remy:    his own jump, slide and climb moves; walk, run and idle are
 *            borrowed from the Soldier.
 *   Soldier: his own walk, run and idle; Remy's jump, slide and climb are
 *            borrowed from Remy's move files.
 *
 * The two files share bone names but not bone axes (one was exported through
 * Blender), so copying local rotations would twist the limbs. Instead, for
 * every frame we measure how far each source bone has turned away from its
 * T-pose in model space, apply that same turn to Remy's matching bone, and
 * convert the result back to Remy's local bone space. The two models also
 * face opposite ways in their files, so turns are first rotated from the
 * donor's body frame into Remy's.
 */

export type CharacterId = 'remy' | 'soldier';
export const CHARACTERS: { id: CharacterId; name: string; blurb: string; thumb: string }[] = [
  { id: 'remy', name: 'Remy', blurb: 'T-shirt, cargo shorts and sneakers', thumb: '/covers/characters/remy.jpg' },
  { id: 'soldier', name: 'Soldier', blurb: 'Armoured runner', thumb: '/covers/characters/soldier.jpg' },
];
const PREF = 'pv.character';
/** The character the player picked last (Remy if they never picked). */
export function preferredCharacter(): CharacterId {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) ?? 'null');
    return CHARACTERS.some((c) => c.id === v) ? v : 'remy';
  } catch {
    return 'remy';
  }
}
export function setPreferredCharacter(id: CharacterId) {
  try {
    localStorage.setItem(PREF, JSON.stringify(id));
  } catch {
    /* the choice just won't be remembered */
  }
}

export interface Hero {
  /** Parent this into the scene; it's scaled to `height` and faces +z. */
  root: TransformNode;
  meshes: AbstractMesh[];
  anims: { idle?: AnimationGroup; walk?: AnimationGroup; run?: AnimationGroup; jump?: AnimationGroup; slide?: AnimationGroup; climb?: AnimationGroup };
  /** Stops all animation and holds the arms-out T-pose (used for the wingsuit). */
  setTPose(): void;
}

/*
 * Moves downloaded from Mixamo for Remy himself ("Without Skin"), so they fit
 * his skeleton directly. They aren't "In Place": the hips travel forward. The
 * game moves the world instead, so forward travel is removed, and the hips'
 * height is handled per move:
 *   clamp: never rise above running height (the game's physics does the jump),
 *   keep:  keep the animated height (the slide's low crouch),
 *   fixed: hold running height (the game lifts the player during a climb).
 */
const MOVES = {
  jump: { file: 'running-jump.glb', hips: 'clamp' },
  slide: { file: 'running-slide.glb', hips: 'keep' },
  climb: { file: 'climbing-to-top.glb', hips: 'fixed' },
} as const;
const RUN_HIPS_Y = 1.92; // Remy's hip height while running, in his model units
type HipsMode = 'clamp' | 'keep' | 'fixed';

async function loadMove(scene: Scene, key: keyof typeof MOVES, bones: Map<string, TransformNode>) {
  const { file, hips } = MOVES[key];
  const container = await LoadAssetContainerAsync(`/assets/characters/anims/${file}`, scene);
  const src = container.animationGroups[0];
  const group = new AnimationGroup(`hero-${key}`, scene);
  const restHips = bones.get('mixamorig:Hips')?.position.clone() ?? Vector3.Zero();
  for (const { animation, target } of src.targetedAnimations) {
    const bone = bones.get((target as Node).name);
    if (!bone) continue;
    const anim = animation.clone();
    if (bone.name === 'mixamorig:Hips' && anim.targetProperty === 'position') {
      anim.setKeys(
        anim.getKeys().map((k) => {
          const y = (k.value as Vector3).y;
          const ny = hips === 'keep' ? y : hips === 'clamp' ? Math.min(y, RUN_HIPS_Y) : RUN_HIPS_Y;
          return { ...k, value: new Vector3(restHips.x, ny, restHips.z) };
        }),
      );
    }
    group.addTargetedAnimation(anim, bone);
  }
  container.dispose();
  return group;
}

/** Plays part of a clip (`fromSec`–`toSec`) so that it lasts `durationSec`. */
export function playClip(group: AnimationGroup, fromSec: number, toSec: number, durationSec: number, loop = false) {
  const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 60;
  group.start(loop, (toSec - fromSec) / durationSec, fromSec * fps, toSec * fps);
  return group;
}

const REMY = '/assets/characters/Remy.glb';
const SOLDIER = '/assets/characters/Soldier.glb';

type Pose = Map<string, { rot: Matrix; pos: Vector3 }>;

const depth = (n: Node) => {
  let d = 0;
  for (let p = n.parent; p; p = p.parent) d++;
  return d;
};

/** Bone transforms relative to the model root, without its scale or handedness flip. */
function capturePose(bones: TransformNode[], root: Node): Pose {
  const sorted = [...bones].sort((a, b) => depth(a) - depth(b));
  // Every node above the bones (the armature node carries a rotation and a 0.01
  // scale in some files) must be up to date first, top-down; the donor model
  // isn't in the scene, so nothing else refreshes them.
  const chain = new Set<Node>();
  for (const b of bones) for (let n: Node | null = b; n; n = n.parent) chain.add(n);
  [...chain].sort((a, b) => depth(a) - depth(b)).forEach((n) => (n as TransformNode).computeWorldMatrix?.(true));
  const invRoot = root.getWorldMatrix().clone().invert();
  const pose: Pose = new Map();
  const scale = new Vector3();
  const rot = new Quaternion();
  const pos = new Vector3();
  for (const b of sorted) {
    b.getWorldMatrix().multiplyToRef(invRoot, TMP).decompose(scale, rot, pos);
    pose.set(b.name, { rot: rotMatrix(rot.normalize()), pos: pos.clone() });
  }
  return pose;
}
const TMP = new Matrix();

/** The body's side, up and forward axes, as matrix rows, measured from a T-pose. */
function bodyFrame(pose: Pose) {
  const at = (n: string) => pose.get(`mixamorig:${n}`)!.pos;
  const side = at('RightArm').subtract(at('LeftArm')).normalize();
  const up = at('Neck').subtract(at('Hips'));
  up.subtractInPlace(side.scale(Vector3.Dot(up, side))).normalize();
  const fwd = Vector3.Cross(side, up).normalize();
  return Matrix.FromValues(side.x, side.y, side.z, 0, up.x, up.y, up.z, 0, fwd.x, fwd.y, fwd.z, 0, 0, 0, 0, 1);
}

function rotMatrix(q: Quaternion) {
  const m = new Matrix();
  Matrix.FromQuaternionToRef(q, m);
  return m;
}

/** Sets every animated bone of a clip to its value at `frame`. */
function applyFrame(group: AnimationGroup, frame: number) {
  for (const { animation, target } of group.targetedAnimations) {
    const value = animation.evaluate(Math.min(frame, animation.getHighestFrame()));
    (target as Record<string, unknown>)[animation.targetProperty] = value;
  }
}

/**
 * Copies `clip` from the donor skeleton onto the hero's. `restClip` puts the
 * donor in its T-pose (leave it out if the donor already stands in one); the
 * hero must already be in its T-pose. `hips` handles moves whose hips travel
 * forward (see MOVES); leave it out to keep the donor's hip motion.
 */
function retarget(
  clip: AnimationGroup,
  restClip: AnimationGroup | null,
  donorBones: TransformNode[],
  donorRoot: Node,
  bones: Map<string, TransformNode>,
  heroRoot: Node,
  scene: Scene,
  hips?: HipsMode,
): AnimationGroup {
  const fps = clip.targetedAnimations[0]?.animation.framePerSecond ?? 30;
  if (restClip) applyFrame(restClip, restClip.from);
  const donorRest = capturePose(donorBones, donorRoot);
  const heroBones = [...bones.values()].sort((a, b) => depth(a) - depth(b));
  const heroRest = capturePose(heroBones, heroRoot);
  const heroRestLocal = new Map(heroBones.map((b) => [b.name, { rot: b.rotationQuaternion?.clone() ?? Quaternion.Identity(), pos: b.position.clone() }]));
  const hipsName = heroBones.find((b) => /Hips$/.test(b.name))?.name;
  const ratio = hipsName && donorRest.get(hipsName) ? heroRest.get(hipsName)!.pos.y / donorRest.get(hipsName)!.pos.y : 1;
  // Bones whose parent isn't a bone (the hips, under the armature node) need that
  // parent's model-space transform; it never animates. The Soldier's armature is
  // turned 90° and scaled to centimetres, so identity would be wrong.
  const invHeroRoot = heroRoot.getWorldMatrix().clone().invert();
  const fixedParent = new Map<string, { rot: Matrix; inv: Matrix }>();
  for (const b of heroBones) {
    if (!b.parent || bones.has(b.parent.name)) continue;
    const full = (b.parent as TransformNode).getWorldMatrix().multiply(invHeroRoot);
    const sc = new Vector3();
    const q = new Quaternion();
    full.decompose(sc, q, new Vector3());
    fixedParent.set(b.name, { rot: rotMatrix(q.normalize()), inv: full.clone().invert() });
  }
  // Maps directions in the donor's model space to the hero's: A = donorFrameᵀ × heroFrame.
  const toHero = bodyFrame(donorRest).transpose().multiply(bodyFrame(heroRest));
  const toDonor = toHero.clone().invert();

  const rotKeys = new Map<string, { frame: number; value: Quaternion }[]>();
  const posKeys: { frame: number; value: Vector3 }[] = [];
  const step = fps / 30;
  for (let f = clip.from; f <= clip.to + 1e-6; f += step) {
    applyFrame(clip, f);
    const donor = capturePose(donorBones, donorRoot);
    // New model-space rotation for each hero bone, parents first.
    const heroNow = new Map<string, Matrix>();
    for (const b of heroBones) {
      const src = donor.get(b.name);
      const srcRest = donorRest.get(b.name);
      const rest = heroRest.get(b.name)!;
      let world = rest.rot;
      if (src && srcRest) {
        // world = rest × turn, where turn is the donor bone's model-space turn away from
        // its T-pose (srcRest⁻¹ × src), re-expressed in the hero's body frame.
        const turn = srcRest.rot.clone().invert().multiply(src.rot);
        world = rest.rot.multiply(toDonor.multiply(turn).multiply(toHero));
      } else {
        // Bones the donor lacks keep their rest pose relative to their parent.
        const parentRest = b.parent && heroRest.get(b.parent.name);
        const parentNow = b.parent && heroNow.get(b.parent.name);
        if (parentRest && parentNow) world = rest.rot.multiply(parentRest.rot.clone().invert()).multiply(parentNow);
      }
      heroNow.set(b.name, world);
      const parentNow = b.parent ? heroNow.get(b.parent.name) : undefined;
      const parentRot = parentNow ?? (b.parent && heroRest.get(b.parent.name)?.rot) ?? fixedParent.get(b.name)?.rot ?? Matrix.Identity();
      const local = world.multiply(parentRot.clone().invert());
      if (!rotKeys.has(b.name)) rotKeys.set(b.name, []);
      rotKeys.get(b.name)!.push({ frame: f, value: Quaternion.FromRotationMatrix(local).normalize() });
      if (b.name === hipsName && src && srcRest) {
        // Hip bounce and sway, scaled to the hero's size.
        let d = src.pos.subtract(srcRest.pos);
        if (hips) {
          // Moves made for Remy travel forward; the game moves the world instead.
          const runDy = RUN_HIPS_Y - srcRest.pos.y;
          d = new Vector3(0, hips === 'keep' ? d.y : hips === 'clamp' ? Math.min(d.y, runDy) : runDy, 0);
        }
        const delta = Vector3.TransformNormal(d, toHero).scale(ratio);
        // Into the hips' local space (including the armature's scale, if any).
        const toLocal = fixedParent.get(b.name)?.inv ?? parentRot.clone().invert();
        posKeys.push({ frame: f, value: heroRestLocal.get(b.name)!.pos.add(Vector3.TransformNormal(delta, toLocal)) });
      }
    }
  }

  const group = new AnimationGroup(`hero-${clip.name}`, scene);
  for (const b of heroBones) {
    const keys = rotKeys.get(b.name)!;
    // Keep quaternions on the same hemisphere so interpolation doesn't spin the long way.
    for (let i = 1; i < keys.length; i++) if (Quaternion.Dot(keys[i - 1].value, keys[i].value) < 0) keys[i].value.scaleInPlace(-1);
    const a = new Animation(`${b.name}-rot`, 'rotationQuaternion', fps, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE);
    a.setKeys(keys);
    group.addTargetedAnimation(a, b);
    if (b.name === hipsName && posKeys.length) {
      const p = new Animation(`${b.name}-pos`, 'position', fps, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);
      p.setKeys(posKeys);
      group.addTargetedAnimation(p, b);
    }
  }
  group.normalize(clip.from, clip.to);
  return group;
}

export async function loadHero(scene: Scene, opts: { character?: CharacterId; height?: number } = {}): Promise<Hero> {
  const character = opts.character ?? preferredCharacter();
  const height = opts.height ?? 1.8;
  const hero = await LoadAssetContainerAsync(character === 'remy' ? REMY : SOLDIER, scene);
  hero.addAllToScene();
  const heroRoot = hero.meshes[0];
  const bones = new Map<string, TransformNode>();
  for (const t of hero.transformNodes) if (t.name.startsWith('mixamorig:')) bones.set(t.name, t);
  for (const b of bones.values()) b.rotationQuaternion ??= Quaternion.FromEulerVector(b.rotation);
  const anims: Hero['anims'] = {};
  hero.animationGroups.forEach((g) => g.stop());

  if (character === 'remy') {
    // Walk, run and idle come from the Soldier.
    const donor = await LoadAssetContainerAsync(SOLDIER, scene);
    const donorBones = donor.transformNodes.filter((t) => t.name.startsWith('mixamorig:'));
    const rest = donor.animationGroups.find((a) => /tpose/i.test(a.name)) ?? donor.animationGroups[0];
    for (const [key, re] of [['idle', /idle/i], ['walk', /walk/i], ['run', /run/i]] as const) {
      const clip = donor.animationGroups.find((a) => re.test(a.name));
      if (clip) anims[key] = retarget(clip, rest, donorBones, donor.meshes[0], bones, heroRoot, scene);
    }
    donor.dispose();
    // His own moves fit his skeleton directly. A missing file just means the game falls back to leaning poses.
    await Promise.all(
      (Object.keys(MOVES) as (keyof typeof MOVES)[]).map((key) =>
        loadMove(scene, key, bones)
          .then((g) => (anims[key] = g))
          .catch(() => undefined),
      ),
    );
  } else {
    // The Soldier's own clips, plus Remy's moves retargeted onto him from his T-pose.
    const pick = (re: RegExp) => hero.animationGroups.find((a) => re.test(a.name));
    anims.idle = pick(/idle/i);
    anims.walk = pick(/walk/i);
    anims.run = pick(/run/i);
    const tpose = pick(/tpose/i);
    if (tpose) applyFrame(tpose, tpose.from);
    await Promise.all(
      (Object.keys(MOVES) as (keyof typeof MOVES)[]).map(async (key) => {
        try {
          const src = await LoadAssetContainerAsync(`/assets/characters/anims/${MOVES[key].file}`, scene);
          const srcBones = src.transformNodes.filter((t) => t.name.startsWith('mixamorig:'));
          anims[key] = retarget(src.animationGroups[0], null, srcBones, src.meshes[0] ?? srcBones[0].parent!, bones, heroRoot, scene, MOVES[key].hips);
          anims[key]!.name = `hero-${key}`;
          src.dispose();
        } catch {
          /* fall back to leaning poses */
        }
      }),
    );
    if (tpose) applyFrame(tpose, tpose.from);
  }

  // Remember the T-pose (the bind pose for Remy, the TPose clip for the Soldier).
  const tposeLocal = new Map([...bones.values()].map((b) => [b, { rot: b.rotationQuaternion!.clone(), pos: b.position.clone() }]));
  const groups = Object.values(anims).filter(Boolean) as AnimationGroup[];

  // Scale to a real person's height and stand on the ground.
  const node = new TransformNode('hero', scene);
  heroRoot.parent = node;
  node.rotation.y = facingAngle(heroRoot, bones);
  heroRoot.computeWorldMatrix(true);
  const { min, max } = heroRoot.getHierarchyBoundingVectors(true);
  const s = height / Math.max(0.01, max.y - min.y);
  node.scaling.setAll(s);
  node.position.y = -min.y * s;
  const holder = new TransformNode('heroHolder', scene);
  node.parent = holder;
  const meshes = hero.meshes.filter((m) => m.getTotalVertices() > 0);
  return {
    root: holder,
    meshes,
    anims,
    setTPose() {
      groups.forEach((g) => g.stop());
      for (const [b, t] of tposeLocal) {
        b.rotationQuaternion!.copyFrom(t.rot);
        b.position.copyFrom(t.pos);
      }
    },
  };
}

/**
 * How far to turn the model so it looks along +z (the way every game runs).
 * The direction from the head to the eyes is "forward"; models without eye
 * bones use the body's forward axis (side × up) instead.
 */
function facingAngle(root: Node, bones: Map<string, TransformNode>) {
  [root, ...bones.values()].sort((a, b) => depth(a) - depth(b)).forEach((n) => (n as TransformNode).computeWorldMatrix?.(true));
  const at = (n: string) => bones.get(`mixamorig:${n}`)?.getAbsolutePosition();
  const head = at('Head');
  const eyes = [at('LeftEye'), at('RightEye')].filter(Boolean) as Vector3[];
  let forward: Vector3;
  if (head && eyes.length) forward = eyes.reduce((acc, e) => acc.add(e), Vector3.Zero()).scale(1 / eyes.length).subtract(head);
  else forward = Vector3.Cross(at('RightArm')!.subtract(at('LeftArm')!), at('Neck')!.subtract(at('Hips')!)).scale(FORWARD_SIGN);
  forward.y = 0;
  let best = 0;
  let bestZ = -Infinity;
  for (let i = 0; i < 360; i++) {
    const a = (i * Math.PI) / 180;
    const z = Vector3.TransformNormal(forward, Matrix.RotationY(a)).normalize().z;
    if (z > bestZ) [best, bestZ] = [a, z];
  }
  return best;
}
/** side × up points backward or forward depending on handedness; checked against Remy's eyes. */
const FORWARD_SIGN = 1;
