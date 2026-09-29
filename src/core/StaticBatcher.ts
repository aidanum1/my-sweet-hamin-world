import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { vertexColorToon, VINYL_ROUGHNESS } from '../assets/materials';

/**
 * Bakes static toon meshes into ONE vertex-coloured mesh (one draw call).
 * Add whole object trees; meshes flagged `userData.dynamic` or with non-toon/textured
 * materials are left untouched and returned via `leftovers`.
 */
export class StaticBatcher {
  private parts: THREE.BufferGeometry[] = [];
  private tmpColor = new THREE.Color();
  shade = true; // subtle height gradient "fake AO"

  /** Consume an object tree. Batchable meshes are removed from it; the rest stays. */
  addObject(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const toRemove: THREE.Mesh[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as any).isInstancedMesh || mesh.userData.dynamic) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (Array.isArray(mat) || !mat.userData?.batchable || mat.map || mat.transparent || mat.roughness !== VINYL_ROUGHNESS) return;
      this.addGeometry(mesh.geometry, mat.color, mesh.matrixWorld, mat.emissive);
      toRemove.push(mesh);
    });
    for (const m of toRemove) m.removeFromParent();
  }

  addGeometry(src: THREE.BufferGeometry, color: THREE.Color, matrix: THREE.Matrix4, emissive?: THREE.Color) {
    let g = src.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.morphAttributes = {};
    if (!g.index) {
      const n = g.attributes.position.count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const pos = g.attributes.position.array as Float32Array;
    const c = this.tmpColor.copy(color);
    const em = emissive && (emissive.r + emissive.g + emissive.b) > 0 ? emissive : null;
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (this.shade) {
        const y = pos[i * 3 + 1];
        k = 0.9 + 0.1 * Math.min(1, Math.max(0, (y + 0.1) / 1.6));
      }
      cols[i * 3] = Math.min(1, c.r * k + (em ? em.r : 0));
      cols[i * 3 + 1] = Math.min(1, c.g * k + (em ? em.g : 0));
      cols[i * 3 + 2] = Math.min(1, c.b * k + (em ? em.b : 0));
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.parts.push(g);
  }

  build(name = 'static'): THREE.Mesh | null {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    if (!merged) return null;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, vertexColorToon());
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }
}
