import * as THREE from 'three';
import { mk, sphere, cone, torus } from '../../assets/geo';
import { toon, vertexColorToon } from '../../assets/materials';
import { P } from '../../assets/palette';
import { blobShadowTex } from '../../assets/textures';
import { bakeGeo } from './models';

export type PupMode = 'run' | 'sit' | 'idle' | 'happy' | 'lick' | 'munch';

/**
 * Bori for the chase: same look as characters/Dog.ts, but the static parts are baked so the
 * whole puppy costs ~10 draw calls instead of ~30. Faces +Z by default.
 */
export class Pup {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  private tail = new THREE.Group();
  private legs: THREE.Group[] = [];
  private earL: THREE.Mesh;
  private earR: THREE.Mesh;
  private tongue: THREE.Mesh;
  private t = 0;
  mode: PupMode = 'idle';
  /** extra speed multiplier for the leg cycle */
  pace = 1;

  constructor(scale = 1) {
    const fur = toon(0xfff1dc);
    const furD = toon(0xf6d9b4);
    const ink = toon(P.ink);
    this.root.add(this.body);

    const bodyG = new THREE.Group();
    bodyG.add(mk(sphere(0.34, 16, 12), fur, [0, 0.42, 0], [0, 0, 0], [0.9, 0.85, 1.25]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      bodyG.add(mk(sphere(0.14, 8, 6), fur, [Math.cos(a) * 0.26, 0.5 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.3]));
    }
    bodyG.add(mk(torus(0.2, 0.035, 6, 16), toon(P.strawberry), [0, 0.66, 0.26], [Math.PI / 2 - 0.5, 0, 0]));
    bodyG.add(mk(cone(0.05, 0.06, 4), toon(P.butter), [0, 0.52, 0.38], [Math.PI, 0, 0]));
    this.body.add(new THREE.Mesh(bakeGeo(bodyG, false), vertexColorToon()));

    for (const [x, z] of [[-0.16, 0.22], [0.16, 0.22], [-0.16, -0.22], [0.16, -0.22]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.3, z);
      leg.add(mk(sphere(0.1, 10, 8), fur, [0, -0.17, 0], [0, 0, 0], [1, 1.4, 1]));
      this.legs.push(leg);
      this.body.add(leg);
    }
    this.tail.position.set(0, 0.6, -0.38);
    this.tail.add(mk(sphere(0.12, 10, 8), fur, [0, 0.1, -0.04], [0.5, 0, 0], [0.8, 1.4, 0.8]));
    this.body.add(this.tail);

    this.head.position.set(0, 0.8, 0.36);
    this.body.add(this.head);
    const headG = new THREE.Group();
    headG.add(mk(sphere(0.3, 18, 14), fur, [0, 0, 0], [0, 0, 0], [1.1, 1, 1]));
    headG.add(mk(sphere(0.15, 12, 10), toon(0xfffaf0), [0, -0.08, 0.22], [0, 0, 0], [1.1, 0.8, 0.9]));
    headG.add(mk(sphere(0.055, 10, 8), ink, [0, -0.02, 0.35]));
    for (const sx of [-1, 1]) {
      headG.add(mk(sphere(0.05, 10, 8), ink, [sx * 0.12, 0.07, 0.26], [0, 0, 0], [0.9, 1.15, 0.6]));
      headG.add(mk(sphere(0.016, 6, 4), toon(0xffffff), [sx * 0.12 - 0.015, 0.1, 0.3]));
      headG.add(mk(sphere(0.05, 8, 6), toon(P.blush), [sx * 0.2, -0.05, 0.22], [0, 0, 0], [1, 0.6, 0.4]));
    }
    this.head.add(new THREE.Mesh(bakeGeo(headG, false), vertexColorToon()));
    this.earL = mk(sphere(0.12, 10, 8), furD, [-0.27, 0.02, 0], [0, 0, 0.5], [0.6, 1.4, 0.9]);
    this.earR = mk(sphere(0.12, 10, 8), furD, [0.27, 0.02, 0], [0, 0, -0.5], [0.6, 1.4, 0.9]);
    this.head.add(this.earL, this.earR);
    this.tongue = mk(sphere(0.05, 8, 6), toon(0xff8fa8), [0, -0.19, 0.28], [0, 0, 0], [1, 0.6, 1.2]);
    this.head.add(this.tongue);
    // only body + head cast real shadows (saves ~8 shadow-pass draw calls; the blob covers the rest)
    for (const o of [...this.legs, this.tail, this.earL, this.earR, this.tongue]) o.traverse((c) => (c.userData.noShadow = true));

    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    sh.userData.noShadow = true;
    this.root.add(sh);
    this.root.scale.setScalar(scale);
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    const m = this.mode;
    const run = m === 'run';
    const wag = m === 'happy' || m === 'lick' || m === 'munch' ? 24 : run ? 16 : 9;
    this.tail.rotation.z = Math.sin(t * wag) * 0.6;
    this.tongue.visible = run || m === 'happy' || m === 'lick';
    this.head.rotation.x = 0;
    this.head.rotation.z = 0;
    this.body.rotation.z = 0;
    if (run) {
      const ph = t * 16 * this.pace;
      this.legs[0].rotation.x = Math.sin(ph) * 0.9;
      this.legs[1].rotation.x = Math.sin(ph + 0.5) * 0.9;
      this.legs[2].rotation.x = -Math.sin(ph) * 0.9;
      this.legs[3].rotation.x = -Math.sin(ph + 0.5) * 0.9;
      this.body.position.y = Math.abs(Math.sin(ph)) * 0.14;
      this.body.rotation.x = Math.sin(ph) * 0.08;
      this.earL.rotation.x = this.earR.rotation.x = Math.sin(ph) * 0.4 - 0.3;
    } else if (m === 'sit') {
      this.body.rotation.x = -0.35;
      this.body.position.y = -0.05;
      for (const l of this.legs) l.rotation.x = 0;
      this.legs[2].rotation.x = this.legs[3].rotation.x = -1.2;
      this.head.rotation.x = 0.3;
      this.head.rotation.z = Math.sin(t * 1.3) * 0.15;
    } else if (m === 'munch') {
      // sitting over a bone treat, nibbling happily
      this.body.rotation.x = -0.28;
      this.body.position.y = -0.04 + Math.abs(Math.sin(t * 5)) * 0.02;
      this.legs[0].rotation.x = this.legs[1].rotation.x = 0.35;
      this.legs[2].rotation.x = this.legs[3].rotation.x = -1.2;
      this.head.rotation.x = 0.6 + Math.abs(Math.sin(t * 11)) * 0.28;
      this.head.rotation.z = Math.sin(t * 4) * 0.12;
      this.earL.rotation.x = this.earR.rotation.x = Math.sin(t * 11) * 0.3;
    } else if (m === 'lick') {
      // up on hind legs, happy licking bobs
      this.body.rotation.x = -0.55;
      this.body.position.y = 0.05 + Math.abs(Math.sin(t * 7)) * 0.05;
      this.legs[0].rotation.x = this.legs[1].rotation.x = -0.9 + Math.sin(t * 7) * 0.3;
      this.legs[2].rotation.x = this.legs[3].rotation.x = -0.5;
      this.head.rotation.x = 0.35 + Math.sin(t * 14) * 0.25;
      this.head.rotation.z = Math.sin(t * 3) * 0.2;
      this.body.rotation.z = Math.sin(t * 7) * 0.06;
      this.earL.rotation.x = this.earR.rotation.x = Math.sin(t * 14) * 0.3;
    } else {
      this.body.rotation.x = 0;
      for (const l of this.legs) l.rotation.x = 0;
      this.body.position.y = m === 'happy' ? Math.abs(Math.sin(t * 9)) * 0.22 : Math.sin(t * 3) * 0.01;
      this.head.rotation.z = Math.sin(t * 2) * 0.12;
      this.earL.rotation.x = this.earR.rotation.x = m === 'happy' ? Math.sin(t * 9) * 0.35 : 0;
    }
  }
}
