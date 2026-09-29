// 3D bits for the ✨ Fashion Challenge: Coco the judge (+ her stool) and the pop-out runway.
import * as THREE from 'three';
import { P } from '../../assets/palette';
import { mk, rbox, cyl, sphere, torus } from '../../assets/geo';
import { Npc } from '../../npcs/Npc';
import type { NpcDef } from '../../npcs/npcData';

/** Coco the cat (same look as the front-row fan in the Stage hall) moonlighting as a stylist. */
export const COCO_JUDGE: NpcDef = {
  id: 'coco_judge', name: 'Coco', scene: 'dressing', pos: [-1.85, -1.5], facing: 0.89, role: 'Stylist', emoji: '🐱',
  look: { species: 'cat', color: 0xffe3ea, color2: 0xffffff, acc: 'bow', accColor: 0xb2d9ff },
  dialogue: [], repeat: [], idle: 'bob',
};
export const COCO_POS = new THREE.Vector3(-1.85, 0.34, -1.5);

/** Static judge corner: a round pastel stool with a tiny star scorecard stand. Add to statics. */
export function judgeCorner() {
  const g = new THREE.Group();
  g.position.set(COCO_POS.x, 0, COCO_POS.z);
  g.add(mk(cyl(0.42, 0.46, 0.26, 24), P.lavenderDeep, [0, 0.13, 0]));
  g.add(mk(cyl(0.44, 0.44, 0.06, 24), P.white, [0, 0.29, 0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(mk(sphere(0.045, 8, 6), i % 2 ? P.butter : P.pink, [Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45]));
  }
  // little stand with a star "10" paddle beside the stool
  g.add(mk(cyl(0.025, 0.025, 0.9, 8), P.metal, [-0.6, 0.45, -0.1]));
  g.add(mk(cyl(0.14, 0.16, 0.05, 14), P.metal, [-0.6, 0.025, -0.1]));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.08 : 0.18;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const sg = new THREE.ExtrudeGeometry(star, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  sg.center();
  g.add(mk(sg, P.butterDeep, [-0.6, 0.98, -0.1], [0, 0.5, 0]));
  return g;
}

export function makeCoco() {
  const npc = new Npc({ ...COCO_JUDGE, look: { ...COCO_JUDGE.look } });
  npc.root.position.copy(COCO_POS);
  return npc;
}

/**
 * Pop-out runway in front of the pedestal (hidden until the runway moment).
 * `open(k)` scales it out from the pedestal (k = 0…1).
 */
/** World z where Hamin strikes his pose (under the spotlight). */
export const RUNWAY_END_Z = 2.5;

export function buildRunway() {
  const root = new THREE.Group();
  root.position.set(0, 0, 0.9);
  const strip = new THREE.Group();
  root.add(strip);
  const len = 2.5;
  strip.add(mk(rbox(1.3, 0.32, len, 0.08), P.white, [0, 0.16, len / 2]));
  strip.add(mk(rbox(0.9, 0.04, len - 0.2, 0.02), P.pink, [0, 0.33, len / 2]));
  strip.add(mk(rbox(0.2, 0.045, len - 0.25, 0.02), P.pinkSoft, [0, 0.34, len / 2]));
  for (let i = 0; i < 7; i++) {
    const z = 0.2 + i * ((len - 0.4) / 6);
    for (const x of [-0.56, 0.56]) strip.add(mk(sphere(0.055, 8, 6), i % 2 ? P.butter : P.white, [x, 0.33, z]));
  }
  // heart at the end of the runway
  strip.add(mk(torus(0.22, 0.04, 6, 24), P.strawberry, [0, 0.35, len - 0.3], [Math.PI / 2, 0, 0]));
  // soft spotlight beam at the end of the runway (the only transparent object)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const beamGeo = new THREE.ConeGeometry(0.8, 3.6, 24, 1, true); // own geometry → disposed with the scene
  beamGeo.translate(0, 1.8, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, 0.35, len - 0.9);
  beam.userData.noShadow = true;
  beam.renderOrder = 2;
  root.add(beam);
  root.traverse((o) => (o.userData.dynamic = true));
  root.visible = false;
  let k = 0;
  return {
    root,
    /** 0 = tucked away, 1 = fully rolled out. */
    open(v: number) {
      k = v;
      root.visible = v > 0.01;
      strip.scale.set(1, Math.max(0.01, Math.min(1, v * 1.4)), Math.max(0.01, v));
      beamMat.opacity = Math.max(0, v - 0.6) * 0.16;
    },
    get k() { return k; },
  };
}
