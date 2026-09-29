// Small pooled visual effects for Dog Chase: power-up badges, speed lines, shield bubble & magnet aura.
import * as THREE from 'three';
import { canvasTex } from '../../assets/textures';
import type { PowerKind } from './course';

export const POWER_INFO: Record<PowerKind, { emoji: string; ring: string; dur: number; name: string; hint: string }> = {
  bone: { emoji: '🦴', ring: '#f8d57e', dur: 3.6, name: '🦴 Bone Treat!', hint: 'Bori stops to munch~' },
  magnet: { emoji: '🧲', ring: '#ff9db3', dur: 8, name: '🧲 Heart Magnet!', hint: 'Hearts fly to you~' },
  sheep: { emoji: '🐑', ring: '#8fdcbc', dur: 4.2, name: '🐑 Sheep Buddy dash!', hint: 'Hold on tight! Nothing can stop you!' },
  star: { emoji: '⭐', ring: '#86b8f0', dur: 15, name: '⭐ Star shield!', hint: 'It blocks one bump for you.' },
};

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/** Round pastel badge with a soft glow and a big emoji (sprite texture). */
export function badgeTex(kind: PowerKind) {
  const info = POWER_INFO[kind];
  return canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 36, 64, 64, 64);
    grd.addColorStop(0, info.ring + 'cc');
    grd.addColorStop(1, info.ring + '00');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    g.beginPath();
    g.arc(64, 64, 45, 0, Math.PI * 2);
    g.fillStyle = '#ffffff';
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = info.ring;
    g.stroke();
    g.beginPath();
    g.arc(50, 46, 12, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fill();
    g.font = `54px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(info.emoji, 64, 69);
  });
}

/** Anime speed lines streaking out of the vanishing point (camera-space, one instanced draw call). */
export class SpeedLines {
  mesh: THREE.InstancedMesh;
  private mat: THREE.MeshBasicMaterial;
  private n: number;
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private tmp = new THREE.Object3D();

  constructor(n = 22) {
    this.n = n;
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 2.2), this.mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.noShadow = true;
    this.mesh.renderOrder = 8;
    this.mesh.visible = false;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    for (let i = 0; i < n; i++) this.respawn(i, -4 - Math.random() * 22);
  }

  private respawn(i: number, z: number) {
    // ring around the view axis, wider than tall, leaving the centre (the road ahead) clear
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * 1.1;
    this.px[i] = Math.cos(a) * r * 1.5;
    this.py[i] = Math.sin(a) * r * 0.8;
    this.pz[i] = z;
  }

  /** k = 0..1 intensity; lines live in camera space so they always frame the view. */
  update(dt: number, k: number, speed: number, cam: THREE.Camera) {
    if (k < 0.02) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mat.opacity = 0.7 * k;
    const tmp = this.tmp;
    const v = speed * 1.4 + 10;
    cam.updateMatrixWorld();
    for (let i = 0; i < this.n; i++) {
      this.pz[i] += v * dt;
      if (this.pz[i] > -0.5) this.respawn(i, -22 - Math.random() * 6);
      tmp.position.set(this.px[i], this.py[i], this.pz[i]);
      tmp.scale.set(1, 1, 0.5 + k);
      tmp.updateMatrix();
      tmp.matrix.premultiply(cam.matrixWorld);
      this.mesh.setMatrixAt(i, tmp.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Soft star-shield bubble with a pastel rim (1 transparent draw call). Set `uniforms.uOp.value` to fade. */
export function shieldBubble() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 1 }, uT: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOp; uniform float uT; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() { float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
        vec3 inner = vec3(0.88, 0.94, 1.0); vec3 rim = mix(vec3(0.5, 0.7, 1.0), vec3(1.0, 0.55, 0.72), 0.5 + 0.5 * sin(vY * 3.0 + uT * 2.5));
        gl_FragColor = vec4(mix(inner, rim, f), (0.1 + f * 0.9) * uOp); }`,
    transparent: true,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.08, 22, 16), mat);
  m.userData.noShadow = true;
  m.renderOrder = 3;
  m.visible = false;
  return m;
}

/** Pink magnet aura ring on the ground. */
export function auraRing() {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.07, 6, 28),
    new THREE.MeshBasicMaterial({ color: 0xff9db3, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.userData.noShadow = true;
  m.visible = false;
  return m;
}
