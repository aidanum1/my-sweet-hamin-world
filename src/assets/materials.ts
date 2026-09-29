import * as THREE from 'three';

// "Soft vinyl toy" material language (ART_BIBLE): smooth matte plastic lit by a soft studio
// environment map + one sun. All shared materials are flagged so scene cleanup never disposes them.

function shared<T extends THREE.Material>(m: T): T {
  m.userData.shared = true;
  m.userData.batchable = true;
  return m;
}

export const VINYL_ROUGHNESS = 0.62;

const cache = new Map<string, THREE.MeshStandardMaterial>();
/** Cached vinyl material for a colour (name kept from the original toon pipeline). */
export function toon(color: number, opts: { emissive?: number; transparent?: boolean; opacity?: number; side?: THREE.Side; rough?: number } = {}) {
  const key = `${color}|${opts.emissive ?? 0}|${opts.opacity ?? 1}|${opts.side ?? 0}|${opts.rough ?? VINYL_ROUGHNESS}`;
  let m = cache.get(key);
  if (!m) {
    m = shared(
      new THREE.MeshStandardMaterial({
        color,
        roughness: opts.rough ?? VINYL_ROUGHNESS,
        metalness: 0,
        emissive: opts.emissive ?? 0x000000,
        transparent: opts.transparent || (opts.opacity ?? 1) < 1,
        opacity: opts.opacity ?? 1,
        side: opts.side ?? THREE.FrontSide,
      }),
    );
    cache.set(key, m);
  }
  return m;
}

/** Glossy variant (candy, food glaze, lacquer). */
export const glossy = (color: number) => toon(color, { rough: 0.28 });

/** Per-object material for things whose colour/texture changes at runtime (outfits). */
export function toonUnique(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: VINYL_ROUGHNESS, metalness: 0 });
}

let vcMat: THREE.MeshStandardMaterial | null = null;
/** Material used by all merged static geometry. */
export function vertexColorToon() {
  if (!vcMat) vcMat = shared(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: VINYL_ROUGHNESS, metalness: 0 }));
  return vcMat;
}

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
export function basic(color: number, opacity = 1, additive = false) {
  const key = `${color}|${opacity}|${additive}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1 || additive,
      opacity,
      depthWrite: !(opacity < 1 || additive),
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    m.userData.shared = true;
    basicCache.set(key, m);
  }
  return m;
}

/** Legacy: kept so older code paths compile. */
export function toonRamp() {
  return null;
}
