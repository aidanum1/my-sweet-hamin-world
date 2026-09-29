// Character reference sheet rendered from the canonical in-game model: open with ?ref
import * as THREE from 'three';
import { Engine, addLights } from './core/Engine';
import { Hamin, AnimName } from './characters/Hamin';
import { Expression } from './characters/face';
import { LOOKS } from './characters/outfits';
import { mk, rbox } from './assets/geo';
import { HaminModel, loadHaminGltf } from './characters/HaminModel';

/** ?ref=icons — every drawn icon big and small, plus the same icons drawn through the canvas hook. */
async function iconGallery() {
  const { iconKeys, iconEl, preloadIconImages } = await import('./ui/icons');
  await preloadIconImages();
  const q = new URLSearchParams(location.search);
  const keys = q.get('list')?.split(',') ?? iconKeys();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#FFF6FA;padding:12px;font:700 11px Nunito,sans-serif;color:#5B4A5E;z-index:99;display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px;align-content:start';
  for (const k of keys) {
    const c = document.createElement('div');
    c.style.cssText = 'background:#fff;border-radius:10px;padding:6px 4px;text-align:center;box-shadow:0 2px 0 #f3d6e2';
    const big = iconEl(k);
    big.style.cssText = 'width:48px;height:48px;display:block;margin:0 auto 2px';
    const small = iconEl(k);
    small.style.cssText = 'width:18px;height:18px;margin-right:4px';
    const cv = document.createElement('canvas');
    cv.width = 60; cv.height = 22;
    const g = cv.getContext('2d')!;
    g.font = '800 16px Nunito, sans-serif';
    g.textBaseline = 'middle';
    g.fillStyle = '#5B4A5E';
    g.fillText(k + 'ab', 2, 11);
    const row = document.createElement('div');
    row.append(small, cv);
    c.append(big, row, document.createTextNode(' ' + [...k].map((x) => x.codePointAt(0)!.toString(16)).join(' ')));
    wrap.appendChild(c);
  }
  document.body.appendChild(wrap);
}

export async function startRef(engine: Engine) {
  if (new URLSearchParams(location.search).get('ref') === 'icons') return iconGallery();
  const gltf = new URLSearchParams(location.search).has('proc') ? null : await loadHaminGltf(new URLSearchParams(location.search).get('model') ?? undefined);
  const q = new URLSearchParams(location.search);
  const mode = q.get('ref') || 'turn';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfff6fa);
  const L = addLights(scene, { shadowRange: 8 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0xffe3ea, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  L.follow(new THREE.Vector3());
  engine.scene = scene;
  (window as any).__refScene = scene; // debugging handle for the reference sheet
  const cam = engine.camera;
  const list: Hamin[] = [];
  const labels: [string, THREE.Vector3][] = [];
  const add = (x: number, z: number, rotY: number, label: string, anim?: AnimName, expr?: Expression) => {
    const h = new Hamin();
    if (gltf) h.setModel(new HaminModel(gltf));
    h.root.position.set(x, 0, z);
    h.root.rotation.y = rotY;
    if (anim) h.play(anim, { loop: true });
    if (expr) h.overrideExpression(expr);
    scene.add(h.root);
    list.push(h);
    labels.push([label, new THREE.Vector3(x, -0.35, z)]);
    return h;
  };
  if (mode === 'turn') {
    add(-4.5, 0, 0, 'FRONT');
    add(-1.5, 0, Math.PI / 2, 'SIDE');
    add(1.5, 0, Math.PI, 'BACK');
    add(4.5, 0, Math.PI / 4, '3/4');
    cam.position.set(0, 1.4, 15);
    cam.lookAt(0, 1.15, 0);
    // scale guide
    for (let i = 0; i <= 4; i++) scene.add(mk(rbox(0.6, 0.02, 0.02, 0.005), 0xff9db3, [-6.6, i * 0.6, 0]));
    scene.add(mk(rbox(0.04, 2.4, 0.04, 0.01), 0xff9db3, [-6.6, 1.2, 0]));
  } else if (mode === 'hero') {
    add(-0.9, 0, 0, 'FRONT');
    add(0.9, 0, -0.6, '3/4');
    cam.position.set(0, 1.5, 5.4);
    cam.lookAt(0, 1.05, 0);
  } else if (mode === 'faceclose') {
    ((q.get('list')?.split(',') ?? ['neutral', 'blink', 'happy', 'surprised']) as Expression[]).forEach((e, i) => add(i * 1.3 - 1.95, 0, 0, e, undefined, e));
    if (q.has('one')) { list.slice(1).forEach((h) => (h.root.visible = false)); list[0].root.position.x = 0; }
    cam.position.set(0, 1.7, q.has('one') ? 2.3 : 4.2);
    cam.lookAt(0, 1.45, 0);
  } else if (mode === 'glb') {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
    const ld = new GLTFLoader();
    ld.setMeshoptDecoder(MeshoptDecoder);
    const g = (await ld.loadAsync(import.meta.env.BASE_URL + (q.get('file') ?? ''))).scene;
    const box = new THREE.Box3().setFromObject(g);
    const sz = box.getSize(new THREE.Vector3());
    const k = 6 / Math.max(sz.x, sz.y, sz.z);
    g.scale.setScalar(k);
    g.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(k)).setY(g.position.y + (sz.y * k) / 2);
    const piv = new THREE.Group();
    piv.add(g);
    scene.add(piv);
    let tris = 0;
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; tris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; } });
    labels.push([`${Math.round(tris / 1000)}k tris`, new THREE.Vector3(0, -0.6, 0)]);
    engine.onTick((dt) => (piv.rotation.y += dt * (q.has('spin') ? 0.4 : 0)));
    cam.position.set(0, 5, 10);
    cam.lookAt(0, 2.6, 0);
  } else if (mode === 'props') {
    // every landmark prop normalised to a 1.6 box, front should face the camera (+Z)
    // ?ref=props&dir=npcs|critters|props&list=a,b&cols=n&dist=d
    const { loadGlb, normalise } = await import('./assets/landmarks');
    const dir = q.get('dir') ?? 'props';
    const ids = (q.get('list') ?? 'hq_school,hq_stage,hq_train,sheep_bench,lockers,bookshelf,kitchen,cafe_table,clothes_rack,studio_desk,ticket_machine,metro_bench,cafe_stall,boat,sandcastle,bakery').split(',');
    const cols = +(q.get('cols') ?? Math.ceil(Math.sqrt(ids.length * 1.6)));
    await Promise.all(ids.map(async (id, i) => {
      const x = (i % cols) * 2.3 - ((cols - 1) * 2.3) / 2, z = Math.floor(i / cols) * -2.6;
      try {
        const m = normalise(await loadGlb(`models/${dir}/${id}.glb`), { w: 1.7, d: 1.7, h: 1.7 });
        m.position.set(x, 0, z);
        scene.add(m);
      } catch { /* missing */ }
      labels.push([id, new THREE.Vector3(x, -0.3, z + 0.9)]);
    }));
    const rows = Math.ceil(ids.length / cols);
    const back = +(q.get('dist') ?? 6 + rows * 1.2 + cols * 0.9);
    cam.position.set(0, back * 0.45, back);
    cam.lookAt(0, 0.4, -(rows - 1) * 1.3);
  } else if (mode === 'looks') {
    const { LOOK_MODELS } = await import('./characters/outfits');
    for (const [i, l] of LOOK_MODELS.entries()) {
      const src = await loadHaminGltf(l.file);
      const h = new Hamin();
      h.setModel(new HaminModel(src), true);
      const x = (i % 4) * 2.1 - 3.15, z = Math.floor(i / 4) * -2.6;
      h.root.position.set(x, 0, z);
      if (q.has('anim')) h.play(q.get('anim') as AnimName, { loop: true });
      scene.add(h.root);
      list.push(h);
      labels.push([l.name, new THREE.Vector3(x, -0.3, z)]);
    }
    cam.position.set(0, 3.4, 11.5);
    cam.lookAt(0, 0.9, -1.3);
  } else if (mode === 'face') {
    const ex: Expression[] = ['neutral', 'smile', 'happy', 'shy', 'surprised', 'scared', 'eat', 'sing', 'tired', 'wink', 'determined', 'love'];
    ex.forEach((e, i) => add((i % 6) * 1.25 - 3.1, Math.floor(i / 6) * -1.6, 0, e, undefined, e));
    cam.position.set(0, 3.2, 9.5);
    cam.lookAt(0, 1.4, -0.8);
  } else if (mode === 'outfits') {
    Object.entries(LOOKS).forEach(([, l], i) => {
      const h = add((i % 4) * 2.2 - 3.3, Math.floor(i / 4) * -2.4, 0.3, l.name);
      h.setOutfit({ top: '', bottom: '', shoes: '', head: '', face: '', extra: '', ...l.outfit } as any);
    });
    cam.position.set(0, 3.5, 12);
    cam.lookAt(0, 0.8, -1.2);
  } else if (mode === 'anims') {
    const an: AnimName[] = (q.get('list')?.split(',') as AnimName[]) ?? ['wave', 'happy', 'shy', 'surprised', 'scared', 'eat', 'dance', 'sing', 'spin', 'stumble', 'victory', 'tired', 'pose', 'sit', 'chase', 'heart'];
    an.forEach((a, i) => add((i % 8) * 1.6 - 5.6, Math.floor(i / 8) * -2.6, 0, a, a));
    cam.position.set(0, 4, 13);
    cam.lookAt(0, 0.8, -1.3);
  }
  // labels
  const lab = document.createElement('div');
  lab.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:800 13px Nunito,sans-serif;color:#364049';
  document.body.appendChild(lab);
  const title = document.createElement('div');
  title.style.cssText = 'position:fixed;left:16px;top:12px;font:900 20px Nunito,sans-serif;color:#FF7A93';
  title.textContent = `HAMIN · reference sheet · ${mode}  (?ref=turn|face|outfits|anims|looks|props)`;
  document.body.appendChild(title);
  engine.onTick((dt) => {
    for (const h of list) {
      if (!h.currentAction && mode === 'anims') continue;
      h.update(dt);
    }
    lab.innerHTML = '';
    for (const [t, p] of labels) {
      const v = p.clone().project(cam);
      const d = document.createElement('div');
      d.textContent = t;
      d.style.cssText = `position:absolute;left:${((v.x + 1) / 2) * innerWidth}px;top:${((1 - v.y) / 2) * innerHeight}px;transform:translateX(-50%)`;
      lab.appendChild(d);
    }
  });
  engine.start();
}
