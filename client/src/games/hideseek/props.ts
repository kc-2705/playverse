import { Color3, Mesh, MeshBuilder, PBRMaterial, Scene, Vector3 } from '@babylonjs/core';
import type { Kind } from './map';

/*
 * The four kinds of museum object. Decoys and a disguised hider use exactly
 * the same model, so the only way to spot the hider is how it behaves.
 */

export class PropFactory {
  private mats: Record<string, PBRMaterial> = {};
  private protos = new Map<Kind, Mesh>();

  constructor(private scene: Scene) {
    const pbr = (name: string, hex: string, rough: number, metal = 0) => {
      const m = new PBRMaterial(name, scene);
      m.albedoColor = Color3.FromHexString(hex);
      m.roughness = rough;
      m.metallic = metal;
      m.maxSimultaneousLights = 6;
      this.mats[name] = m;
    };
    pbr('ceramic', '#2f5d8a', 0.25);
    pbr('ceramicTrim', '#e8d9a8', 0.3, 0.6);
    pbr('marble', '#ece8e0', 0.3);
    pbr('wood', '#6b4527', 0.6);
    pbr('iron', '#22252b', 0.4, 0.8);
    pbr('terracotta', '#b5643a', 0.8);
    pbr('leaves', '#3f7a35', 0.7);
    for (const kind of ['vase', 'bust', 'bench', 'plant'] as Kind[]) {
      const m = this.build(kind);
      m.setEnabled(false);
      this.protos.set(kind, m);
    }
  }

  private build(kind: Kind): Mesh {
    const s = this.scene;
    const parts: Mesh[] = [];
    const add = (m: Mesh, mat: string) => {
      m.material = this.mats[mat];
      parts.push(m);
      return m;
    };
    if (kind === 'vase') {
      const shape = [[0, 0], [0.16, 0], [0.24, 0.12], [0.3, 0.38], [0.24, 0.62], [0.13, 0.78], [0.11, 0.9], [0.16, 0.98], [0.15, 1.0]].map(([r, y]) => new Vector3(r, y, 0));
      add(MeshBuilder.CreateLathe('vase', { shape, tessellation: 28, sideOrientation: Mesh.DOUBLESIDE }, s), 'ceramic');
      const band = add(MeshBuilder.CreateTorus('band', { diameter: 0.58, thickness: 0.035, tessellation: 28 }, s), 'ceramicTrim');
      band.position.y = 0.42;
    } else if (kind === 'bust') {
      add(MeshBuilder.CreateBox('plinth', { width: 0.5, height: 1.0, depth: 0.5 }, s), 'marble').position.y = 0.5;
      const torso = add(MeshBuilder.CreateCylinder('torso', { height: 0.4, diameterTop: 0.3, diameterBottom: 0.5, tessellation: 20 }, s), 'marble');
      torso.position.y = 1.2;
      const head = add(MeshBuilder.CreateSphere('head', { diameterX: 0.24, diameterY: 0.3, diameterZ: 0.26, segments: 14 }, s), 'marble');
      head.position.y = 1.55;
    } else if (kind === 'bench') {
      const seat = add(MeshBuilder.CreateBox('seat', { width: 1.4, height: 0.08, depth: 0.45 }, s), 'wood');
      seat.position.y = 0.46;
      for (const x of [-0.58, 0.58]) {
        const leg = add(MeshBuilder.CreateBox('leg', { width: 0.06, height: 0.42, depth: 0.4 }, s), 'iron');
        leg.position.set(x, 0.21, 0);
      }
    } else {
      const pot = add(MeshBuilder.CreateCylinder('pot', { height: 0.5, diameterTop: 0.55, diameterBottom: 0.4, tessellation: 20 }, s), 'terracotta');
      pot.position.y = 0.25;
      for (const [x, y, z, r] of [[0, 0.95, 0, 0.42], [0.18, 1.2, 0.1, 0.3], [-0.16, 1.15, -0.08, 0.32], [0, 1.4, 0, 0.24]]) {
        const leaf = add(MeshBuilder.CreateIcoSphere('leaf', { radius: r, subdivisions: 2 }, s), 'leaves');
        leaf.position.set(x, y, z);
      }
    }
    const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true)!;
    merged.name = `prop-${kind}`;
    return merged;
  }

  /** A new copy of an object (shares geometry with the original). */
  make(kind: Kind, name: string) {
    const m = this.protos.get(kind)!.clone(name)!;
    m.setEnabled(true);
    m.receiveShadows = true;
    return m;
  }
}
