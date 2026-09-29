import * as THREE from 'three';

export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number };

export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }

export const circle = (x: number, z: number, r: number): Collider => ({ kind: 'circle', x, z, r });
export const box = (cx: number, cz: number, w: number, d: number): Collider => ({
  kind: 'box', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2,
});

const tmpBox = new THREE.Box3();
/** Axis-aligned collider from an object's world bounding box (call before batching). */
export function boxOf(obj: THREE.Object3D, pad = 0): Collider {
  obj.updateMatrixWorld(true);
  tmpBox.setFromObject(obj);
  return { kind: 'box', minX: tmpBox.min.x - pad, maxX: tmpBox.max.x + pad, minZ: tmpBox.min.z - pad, maxZ: tmpBox.max.z + pad };
}

/** Push a circle (p.x, p.z, radius) out of colliders and keep it inside bounds. Mutates p. */
export function resolve(p: THREE.Vector3, radius: number, cols: readonly Collider[], bounds?: Bounds) {
  for (let iter = 0; iter < 2; iter++) {
    for (const c of cols) {
      if (c.kind === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z;
        const rr = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 0.0001;
          p.x = c.x + (dx / d) * rr;
          p.z = c.z + (dz / d) * rr;
        }
      } else {
        const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            p.x = cx + (dx / d) * radius;
            p.z = cz + (dz / d) * radius;
          } else {
            // centre inside box: push out the shortest way
            const l = p.x - c.minX, r = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z;
            const m = Math.min(l, r, t, b);
            if (m === l) p.x = c.minX - radius;
            else if (m === r) p.x = c.maxX + radius;
            else if (m === t) p.z = c.minZ - radius;
            else p.z = c.maxZ + radius;
          }
        }
      }
    }
  }
  if (bounds) {
    p.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, p.x));
    p.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, p.z));
  }
}
