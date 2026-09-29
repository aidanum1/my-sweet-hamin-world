import * as THREE from 'three';
import { mk, sphere, cone, torus } from '../assets/geo';
import { toon } from '../assets/materials';
import { P } from '../assets/palette';
import { blobShadowTex } from '../assets/textures';
import { mergeChildren } from '../npcs/NpcFactory';

/** Bori — a cream fluffy puppy with floppy ears. Harmless and playful. */
export class Dog {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  private tail: THREE.Object3D;
  private legs: THREE.Object3D[] = [];
  private earL: THREE.Object3D;
  private earR: THREE.Object3D;
  private tongue: THREE.Object3D;
  private t = 0;
  speed = 0; // running animation intensity
  mode: 'sit' | 'run' | 'idle' | 'happy' = 'idle';

  constructor(scale = 1) {
    const fur = toon(0xfff1dc);
    const furD = toon(0xf6d9b4);
    const ink = toon(P.ink);
    this.root.add(this.body);
    this.body.add(mk(sphere(0.34, 16, 12), fur, [0, 0.42, 0], [0, 0, 0], [0.9, 0.85, 1.25]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.body.add(mk(sphere(0.14, 8, 6), fur, [Math.cos(a) * 0.26, 0.5 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.3]));
    }
    for (const [x, z] of [[-0.16, 0.22], [0.16, 0.22], [-0.16, -0.22], [0.16, -0.22]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.3, z);
      leg.add(mk(sphere(0.1, 10, 8), fur, [0, -0.17, 0], [0, 0, 0], [1, 1.4, 1]));
      this.legs.push(leg);
      this.body.add(leg);
    }
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.6, -0.38);
    this.tail.add(mk(sphere(0.12, 10, 8), fur, [0, 0.1, -0.04], [0.5, 0, 0], [0.8, 1.4, 0.8]));
    this.body.add(this.tail);
    // head
    this.head.position.set(0, 0.8, 0.36);
    this.body.add(this.head);
    this.head.add(mk(sphere(0.3, 18, 14), fur, [0, 0, 0], [0, 0, 0], [1.1, 1, 1]));
    this.head.add(mk(sphere(0.15, 12, 10), toon(0xfffaf0), [0, -0.08, 0.22], [0, 0, 0], [1.1, 0.8, 0.9]));
    this.head.add(mk(sphere(0.055, 10, 8), ink, [0, -0.02, 0.35]));
    for (const sx of [-1, 1]) {
      this.head.add(mk(sphere(0.05, 10, 8), ink, [sx * 0.12, 0.07, 0.26], [0, 0, 0], [0.9, 1.15, 0.6]));
      this.head.add(mk(sphere(0.016, 6, 4), toon(0xffffff), [sx * 0.12 - 0.015, 0.1, 0.3]));
      this.head.add(mk(sphere(0.05, 8, 6), toon(P.blush), [sx * 0.2, -0.05, 0.22], [0, 0, 0], [1, 0.6, 0.4]));
    }
    this.earL = mk(sphere(0.12, 10, 8), furD, [-0.27, 0.02, 0], [0, 0, 0.5], [0.6, 1.4, 0.9]);
    this.earR = mk(sphere(0.12, 10, 8), furD, [0.27, 0.02, 0], [0, 0, -0.5], [0.6, 1.4, 0.9]);
    this.head.add(this.earL, this.earR);
    this.tongue = mk(sphere(0.05, 8, 6), toon(0xff8fa8), [0, -0.19, 0.28], [0, 0, 0], [1, 0.6, 1.2]);
    this.head.add(this.tongue);
    // tiny collar with a heart tag
    this.body.add(mk(torus(0.2, 0.035, 6, 16), toon(P.strawberry), [0, 0.66, 0.26], [Math.PI / 2 - 0.5, 0, 0]));
    this.body.add(mk(cone(0.05, 0.06, 4), toon(P.butter), [0, 0.52, 0.38], [Math.PI, 0, 0]));
    mergeChildren(this.body, new Set<THREE.Object3D>([...this.legs, this.tail, this.head]));
    mergeChildren(this.head, new Set<THREE.Object3D>([this.earL, this.earR, this.tongue]));
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    this.root.add(sh);
    this.root.scale.setScalar(scale);
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    const run = this.mode === 'run';
    const wag = this.mode === 'happy' ? 22 : run ? 16 : 9;
    this.tail.rotation.z = Math.sin(t * wag) * 0.6;
    this.tongue.visible = run || this.mode === 'happy';
    if (run) {
      const ph = t * 16;
      this.legs[0].rotation.x = Math.sin(ph) * 0.9;
      this.legs[1].rotation.x = Math.sin(ph + 0.5) * 0.9;
      this.legs[2].rotation.x = -Math.sin(ph) * 0.9;
      this.legs[3].rotation.x = -Math.sin(ph + 0.5) * 0.9;
      this.body.position.y = Math.abs(Math.sin(ph)) * 0.12;
      this.body.rotation.x = Math.sin(ph) * 0.08;
      this.earL.rotation.x = this.earR.rotation.x = Math.sin(ph) * 0.4 - 0.3;
    } else if (this.mode === 'sit') {
      this.body.rotation.x = -0.35;
      this.body.position.y = -0.05;
      for (const l of this.legs) l.rotation.x = 0;
      this.legs[2].rotation.x = this.legs[3].rotation.x = -1.2;
      this.head.rotation.z = Math.sin(t * 1.3) * 0.15;
    } else {
      this.body.rotation.x = 0;
      for (const l of this.legs) l.rotation.x = 0;
      this.body.position.y = this.mode === 'happy' ? Math.abs(Math.sin(t * 9)) * 0.2 : Math.sin(t * 3) * 0.01;
      this.head.rotation.z = Math.sin(t * 2) * 0.12;
    }
  }
}
