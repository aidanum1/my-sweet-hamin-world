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

/**
 * First point (0..1 along a→b) where the segment enters a collider grown by `pad`, or 1 if it's clear.
 * Colliders the segment starts inside are ignored. Used to keep a close-up camera in front of props.
 */
export function segmentHit(ax: number, az: number, bx: number, bz: number, cols: readonly Collider[], pad = 0): number {
  const dx = bx - ax, dz = bz - az;
  let best = 1;
  for (const c of cols) {
    if (c.kind === 'circle') {
      const r = c.r + pad;
      const fx = ax - c.x, fz = az - c.z;
      const cc = fx * fx + fz * fz - r * r;
      if (cc <= 0) continue; // starts inside
      const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz);
      const disc = b * b - 4 * a * cc;
      if (a < 1e-9 || disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t < best) best = t;
    } else {
      const minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
      if (ax > minX && ax < maxX && az > minZ && az < maxZ) continue; // starts inside
      let t0 = 0, t1 = 1;
      for (const [p, d, lo, hi] of [[ax, dx, minX, maxX], [az, dz, minZ, maxZ]] as const) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
        let ta = (lo - p) / d, tb = (hi - p) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) { t0 = 2; break; }
      }
      if (t0 <= 1 && t0 < best) best = t0;
    }
  }
  return best;
}
