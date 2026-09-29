import * as THREE from 'three';
import { cone, cyl, mk, rbox, sphere, torus } from '../assets/geo';
import { toon } from '../assets/materials';
import { P } from '../assets/palette';
import { blobShadowTex } from '../assets/textures';
import { drawFace, Expression, FaceStyle } from '../characters/face';
import { StaticBatcher } from '../core/StaticBatcher';

/** Merge the non-animated direct mesh children of `parent` into one mesh (draw-call saver). */
export function mergeChildren(parent: THREE.Object3D, keep: Set<THREE.Object3D>) {
  const tmp = new THREE.Group();
  for (const c of [...parent.children]) if (!keep.has(c) && (c as THREE.Mesh).isMesh) tmp.add(c);
  const b = new StaticBatcher();
  b.shade = false;
  b.addObject(tmp);
  const m = b.build('npc-part');
  for (const c of [...tmp.children]) parent.add(c); // leftovers (non-batchable)
  if (m) {
    m.matrixAutoUpdate = true;
    parent.add(m);
  }
}

export type Species = 'sheep' | 'bunny' | 'hamster' | 'chick' | 'cat' | 'cloud';
export type NpcAcc = 'none' | 'apron' | 'chefHat' | 'cap' | 'bow' | 'headset' | 'scarf' | 'glasses' | 'badge' | 'sunhat';

export interface NpcLook {
  species: Species;
  color?: number; // main fur/body
  color2?: number; // accent (ears, patches)
  acc?: NpcAcc;
  accColor?: number;
  scale?: number;
}

export interface NpcRig {
  root: THREE.Group;
  body: THREE.Group; // bobs
  head: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  ears: THREE.Object3D[];
  setFace: (e: Expression) => void;
  dispose: () => void;
  height: number;
  /** Higgsfield model riding on `body` (procedural parts hidden), see npcModels.ts */
  model?: THREE.Group;
}

const NPC_FACE: FaceStyle = {
  eyeColor: '#364049', eyeGap: 38, eyeY: 138, eyeW: 11, eyeH: 15, mouthY: 172,
  brows: false, browColor: '#364049', blushColor: '#FFA7B8',
};

const DEFAULTS: Record<Species, [number, number]> = {
  sheep: [0xffffff, P.skin],
  bunny: [0xfff8f4, P.pink],
  hamster: [0xffe0b8, 0xfff6ec],
  chick: [0xffe98a, 0xffb86b],
  cat: [0xd9d4f0, 0xffffff],
  cloud: [0xf4f8ff, P.blueSoft],
};

/** Builds a chibi animal NPC from the shared species kit (ART_BIBLE: round, 1.6–2.2 heads). */
export function buildNpc(look: NpcLook): NpcRig {
  const [dc1, dc2] = DEFAULTS[look.species];
  const c1 = look.color ?? dc1;
  const c2 = look.color2 ?? dc2;
  const m1 = toon(c1);
  const m2 = toon(c2);
  const root = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  root.add(body);
  const ears: THREE.Object3D[] = [];
  const sp = look.species;
  const floating = sp === 'cloud';

  // face decal (128²)
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  let shown: Expression | null = null;
  const setFace = (e: Expression) => {
    if (e === shown) return;
    shown = e;
    drawFace(canvas.getContext('2d')!, e, NPC_FACE, 128);
    tex.needsUpdate = true;
  };

  const headR = sp === 'hamster' || sp === 'chick' ? 0.42 : 0.4;
  const headY = floating ? 0.95 : 1.05;
  head.position.y = headY;
  body.add(head);

  // body
  if (sp === 'sheep') {
    body.add(mk(sphere(0.36, 16, 12), m1, [0, 0.52, 0], [0, 0, 0], [1, 0.95, 0.9]));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      body.add(mk(sphere(0.17, 10, 8), m1, [Math.cos(a) * 0.3, 0.55 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.26]));
    }
  } else if (floating) {
    for (const [x, y, z, r] of [[0, 0.5, 0, 0.38], [-0.3, 0.45, 0.05, 0.25], [0.3, 0.45, 0.05, 0.25], [0, 0.35, 0.15, 0.25], [0, 0.4, -0.2, 0.26]] as const)
      body.add(mk(sphere(r, 14, 10), m1, [x, y, z]));
  } else {
    body.add(mk(sphere(0.34, 16, 12), m1, [0, 0.5, 0], [0, 0, 0], [1, 1.05, 0.92]));
    body.add(mk(sphere(0.22, 12, 10), m2, [0, 0.46, 0.17], [0, 0, 0], [1, 1.1, 0.6]));
  }
  // feet
  if (!floating) {
    const footCol = sp === 'chick' ? toon(0xffb86b) : sp === 'sheep' ? toon(P.skin) : m1;
    body.add(mk(sphere(0.12, 10, 8), footCol, [-0.15, 0.1, 0.06], [0, 0, 0], [1, 0.7, 1.3]));
    body.add(mk(sphere(0.12, 10, 8), footCol, [0.15, 0.1, 0.06], [0, 0, 0], [1, 0.7, 1.3]));
  }
  // arms (little nubs)
  const armCol = sp === 'sheep' ? toon(P.skin) : m1;
  const armL = mk(sphere(0.1, 10, 8), armCol, [-0.36, 0.5, 0.04], [0, 0, 0], [0.9, 1.3, 0.9]);
  const armR = mk(sphere(0.1, 10, 8), armCol, [0.36, 0.5, 0.04], [0, 0, 0], [0.9, 1.3, 0.9]);
  body.add(armL, armR);

  // head
  const headCol = sp === 'sheep' ? toon(P.skin) : m1;
  head.add(mk(sphere(headR, 22, 16), headCol, [0, 0, 0], [0, 0, 0], [1.05, 0.95, 1]));
  const faceGeo = new THREE.SphereGeometry(headR * 1.012, 18, 14, Math.PI / 2 - 0.85, 1.7, Math.PI / 2 - 0.7, 1.4);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.scale.set(1.05, 0.95, 1);
  face.renderOrder = 1;
  head.add(face);

  switch (sp) {
    case 'sheep': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI - Math.PI;
        head.add(mk(sphere(0.14, 10, 8), m1, [Math.cos(a) * 0.3, 0.3 + Math.sin(-a) * 0.08, -0.05 + Math.sin(a * 3) * 0.06]));
      }
      head.add(mk(sphere(0.2, 12, 10), m1, [0, 0.3, -0.18]));
      for (const sx of [-1, 1]) {
        const e = mk(sphere(0.13, 10, 8), toon(P.skin), [sx * 0.42, 0.05, 0], [0, 0, sx * -0.6], [1.3, 0.5, 0.7]);
        ears.push(e);
        head.add(e);
      }
      break;
    }
    case 'bunny':
      for (const sx of [-1, 1]) {
        const e = new THREE.Group();
        e.position.set(sx * 0.16, 0.3, -0.02);
        e.rotation.z = sx * -0.15;
        e.add(mk(sphere(0.1, 10, 8), m1, [0, 0.28, 0], [0, 0, 0], [0.9, 3, 0.6]));
        e.add(mk(sphere(0.06, 8, 6), m2, [0, 0.28, 0.04], [0, 0, 0], [0.9, 3.4, 0.4]));
        ears.push(e);
        head.add(e);
      }
      body.add(mk(sphere(0.1, 8, 6), m1, [0, 0.35, -0.32]));
      break;
    case 'hamster':
      for (const sx of [-1, 1]) {
        const e = mk(sphere(0.1, 10, 8), m1, [sx * 0.28, 0.32, -0.02], [0, 0, 0], [1, 1, 0.5]);
        e.add(mk(sphere(0.07, 8, 6), toon(P.pink), [0, 0, 0.3], [0, 0, 0], [1, 1, 0.4]));
        ears.push(e);
        head.add(e);
        head.add(mk(sphere(0.16, 10, 8), toon(c2), [sx * 0.24, -0.14, 0.22], [0, 0, 0], [1, 0.8, 0.6]));
      }
      head.add(mk(sphere(0.2, 12, 10), toon(c2), [0, 0.28, 0.1], [0, 0, 0], [1, 0.4, 1]));
      break;
    case 'chick':
      head.add(mk(cone(0.07, 0.14, 8), toon(0xffa45c), [0, -0.06, 0.42], [Math.PI / 2, 0, 0]));
      for (const a of [-0.4, 0, 0.4]) {
        const tuft = mk(sphere(0.06, 8, 6), m1, [Math.sin(a) * 0.08, 0.44, -0.02], [0, 0, a], [0.6, 1.8, 0.6]);
        ears.push(tuft);
        head.add(tuft);
      }
      for (const sx of [-1, 1]) body.add(mk(sphere(0.12, 10, 8), m1, [sx * 0.36, 0.55, -0.02], [0, 0, sx * 0.6], [0.5, 1.2, 0.9]));
      break;
    case 'cat':
      for (const sx of [-1, 1]) {
        const e = mk(cone(0.14, 0.22, 4), m1, [sx * 0.24, 0.34, 0], [0, Math.PI / 4, sx * -0.3]);
        e.add(mk(cone(0.08, 0.14, 4), toon(P.pink), [0, -0.02, 0.05], [0, 0, 0]));
        ears.push(e);
        head.add(e);
      }
      body.add(mk(torus(0.18, 0.05, 6, 12, Math.PI * 1.2), m1, [0.1, 0.4, -0.32], [0, Math.PI / 2, 0.6]));
      break;
    case 'cloud':
      for (const [x, y, z, r] of [[-0.3, 0.2, -0.05, 0.18], [0.3, 0.2, -0.05, 0.18], [0, 0.35, -0.1, 0.2], [-0.15, 0.36, 0.05, 0.14], [0.17, 0.34, 0.05, 0.14]] as const)
        head.add(mk(sphere(r, 10, 8), m1, [x, y, z]));
      break;
  }

  // accessories
  const ac = toon(look.accColor ?? P.pink);
  switch (look.acc) {
    case 'apron':
      body.add(mk(rbox(0.46, 0.4, 0.06, 0.05), ac, [0, 0.48, 0.3], [-0.1, 0, 0]));
      break;
    case 'chefHat':
      head.add(mk(cyl(0.22, 0.2, 0.18, 14), toon(0xffffff), [0, 0.42, -0.04]));
      for (const [x, z] of [[-0.12, 0], [0.12, 0], [0, 0.1], [0, -0.12]]) head.add(mk(sphere(0.15, 10, 8), toon(0xffffff), [x, 0.58, z - 0.04]));
      break;
    case 'cap':
      head.add(mk(new THREE.SphereGeometry(0.43, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), ac, [0, 0.06, 0]));
      head.add(mk(rbox(0.36, 0.03, 0.22, 0.012), ac, [0, 0.2, 0.4], [0.15, 0, 0]));
      break;
    case 'bow':
      head.add(mk(cone(0.08, 0.14, 8), ac, [0.18, 0.36, 0.12], [0, 0, Math.PI / 2]));
      head.add(mk(cone(0.08, 0.14, 8), ac, [0.32, 0.36, 0.12], [0, 0, -Math.PI / 2]));
      head.add(mk(sphere(0.04, 8, 6), toon(P.strawberry), [0.25, 0.36, 0.14]));
      break;
    case 'headset':
      head.add(mk(torus(0.43, 0.03, 6, 20, Math.PI), ac, [0, 0.02, 0]));
      head.add(mk(sphere(0.1, 10, 8), ac, [-0.43, 0, 0], [0, 0, 0], [0.6, 1, 1]));
      head.add(mk(sphere(0.1, 10, 8), ac, [0.43, 0, 0], [0, 0, 0], [0.6, 1, 1]));
      head.add(mk(sphere(0.04, 8, 6), toon(P.ink), [-0.3, -0.24, 0.3]));
      break;
    case 'scarf':
      body.add(mk(torus(0.24, 0.07, 8, 16), ac, [0, 0.8, 0], [Math.PI / 2, 0, 0]));
      body.add(mk(rbox(0.12, 0.25, 0.05, 0.03), ac, [0.12, 0.66, 0.26], [0, 0, 0.1]));
      break;
    case 'glasses':
      for (const sx of [-1, 1]) head.add(mk(torus(0.08, 0.012, 6, 16), ac, [sx * 0.13, -0.04, 0.4]));
      break;
    case 'badge':
      body.add(mk(cyl(0.07, 0.07, 0.02, 12), ac, [0.14, 0.62, 0.3], [Math.PI / 2 - 0.3, 0, 0]));
      break;
    case 'sunhat':
      head.add(mk(cyl(0.6, 0.62, 0.03, 22), ac, [0, 0.28, 0], [-0.1, 0, 0]));
      head.add(mk(new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ac, [0, 0.28, 0]));
      head.add(mk(torus(0.33, 0.03, 6, 18), toon(P.pink), [0, 0.3, 0], [Math.PI / 2, 0, 0]));
      break;
  }

  // blob shadow
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.02;
  sh.scale.setScalar(1.1);
  root.add(sh);

  mergeChildren(body, new Set<THREE.Object3D>([head, armL, armR, ...ears]));
  mergeChildren(head, new Set<THREE.Object3D>([face, ...ears]));
  const s = look.scale ?? 1;
  body.scale.setScalar(s);
  setFace('smile');
  return {
    root, body, head, armL, armR, ears, setFace, height: (headY + headR + 0.2) * s,
    dispose: () => {
      tex.dispose();
      faceMat.dispose();
      faceGeo.dispose();
      (sh.material as THREE.Material).dispose();
      sh.geometry.dispose();
    },
  };
}
