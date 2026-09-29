// Higgsfield-generated models (image → 3D), optimised into public/models/**.glb.
// Landmark props: public/models/props (quick props: sam_3_3d, 1 credit; signature pieces hq_*: image_to_3d, 30 credits).
// Sheep critters: public/models/critters. NPCs: public/models/npcs (see src/npcs/npcModels.ts). All sam_3_3d.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type LandmarkId =
  | 'hq_school' | 'hq_stage' | 'hq_train' | 'hq_lighthouse'
  | 'fountain' | 'blossom_tree' | 'sheep_bench' | 'desk_set' | 'teacher_desk' | 'lockers' | 'bookshelf'
  | 'kitchen' | 'cafe_table' | 'speaker_stack' | 'clothes_rack' | 'studio_desk' | 'cozy_sofa'
  | 'ticket_machine' | 'metro_bench' | 'cafe_stall' | 'umbrella_set' | 'boat' | 'sandcastle' | 'bakery';

/** Sheep critters (face +Z): `sheep` stands on four legs (≈3.6k tris), `sheep_lo` is the same sheep at ≈1.5k tris
 *  (256² texture) for crowds and instancing, `sheep_sit` sits upright like a plush (≈4k tris), `sheep_sit_lo` is
 *  the sitting sheep at ≈1.6k tris (256²) for the stage audience. */
export type CritterId = 'sheep' | 'sheep_sit' | 'sheep_lo' | 'sheep_sit_lo';

/** Per-model yaw correction so the "front" of every model faces +Z after loading. */
const FRONT_YAW: Record<string, number> = {};

let loader: GLTFLoader | null = null;
const cache = new Map<string, Promise<THREE.Group>>();

/** Load (once) a GLB under public/, e.g. 'models/props/fountain.glb'. The result is shared: clone it. */
export function loadGlb(path: string) {
  let p = cache.get(path);
  if (!p) {
    if (!loader) {
      loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    p = loader.loadAsync(import.meta.env.BASE_URL + path).then((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.roughness = 0.72;
        mat.metalness = 0;
        // generated textures carry baked soft light; lift them slightly toward the source art
        if (mat.map) {
          mat.emissiveMap = mat.map;
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveIntensity = 0.32;
        }
        mat.userData.shared = true;
        m.geometry.userData.shared = true;
        if (mat.map) mat.map.userData.shared = true;
      });
      return g.scene;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export interface FitOpts {
  w?: number; // target width (X, after yaw fix)
  d?: number; // target depth (Z)
  h?: number; // target height (Y)
}

/** A normalised instance of a loaded model: base on y=0, centred on x/z, scaled to fit, front facing +Z. */
export function normalise(src: THREE.Object3D, fit: FitOpts, yaw = 0): THREE.Group {
  const inner = src.clone(true);
  inner.rotation.y = yaw;
  const holder = new THREE.Group();
  holder.add(inner);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const k = Math.min(fit.w ? fit.w / size.x : Infinity, fit.d ? fit.d / size.z : Infinity, fit.h ? fit.h / size.y : Infinity);
  const s = isFinite(k) ? k : 1;
  inner.scale.setScalar(s);
  inner.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    o.userData.dynamic = true;
  });
  return holder;
}

/** A normalised landmark prop instance (see normalise). */
export async function landmark(id: LandmarkId, fit: FitOpts): Promise<THREE.Group> {
  const holder = normalise(await loadGlb(`models/props/${id}.glb`), fit, FRONT_YAW[id] ?? 0);
  holder.userData.landmark = id;
  return holder;
}

/** A normalised sheep critter instance (see normalise). */
export async function critter(id: CritterId, fit: FitOpts): Promise<THREE.Group> {
  const holder = normalise(await loadGlb(`models/critters/${id}.glb`), fit, FRONT_YAW[id] ?? 0);
  holder.userData.landmark = id;
  return holder;
}

/**
 * A critter as one geometry (normalising transform baked in) + its textured material, for InstancedMesh use.
 * The geometry is new (the caller disposes it); the material is the shared cached one (userData.shared).
 */
export async function critterGeometry(id: CritterId, fit: FitOpts) {
  const holder = await critter(id, fit);
  holder.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  let material: THREE.Material | null = null;
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    // meshopt-quantised attributes (normalised int16/int8) can't hold the fitted positions: go to float first
    for (const name of ['position', 'normal']) {
      const a = g.getAttribute(name);
      if (!a || (a.array instanceof Float32Array && !a.normalized && !(a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute)) continue;
      const f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) f.set([a.getX(i), a.getY(i), a.getZ(i)], i * 3);
      g.setAttribute(name, new THREE.BufferAttribute(f, 3));
    }
    g.applyMatrix4(m.matrixWorld);
    g.userData = {}; // not shared: disposed with its owner
    geos.push(g);
    material ??= m.material as THREE.Material;
  });
  const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos)!;
  return { geometry, material: material! };
}
