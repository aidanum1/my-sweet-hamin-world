import * as THREE from 'three';
import { buildNpc, NpcRig } from './NpcFactory';
import { applyNpcModel } from './npcModels';
import { NpcDef } from './npcData';
import { dampAngle } from '../utils/math';

/** A living NPC: idles, turns toward Hamin when near, reacts. */
export class Npc {
  rig: NpcRig;
  root: THREE.Group;
  private t = Math.random() * 10;
  private baseYaw: number;
  private reactT = 0;
  private reactKind: 'hop' | 'talk' | 'none' = 'none';
  private baseScale: number;
  talking = false;

  constructor(public def: NpcDef) {
    this.rig = buildNpc(def.look);
    applyNpcModel(this.rig, def);
    this.root = this.rig.root;
    this.root.position.set(def.pos[0], 0, def.pos[1]);
    this.baseYaw = def.facing;
    this.root.rotation.y = def.facing;
    this.root.userData.npc = def.id;
    this.baseScale = this.rig.body.scale.x;
  }

  place(x: number, z: number, facing?: number) {
    this.root.position.set(x, this.root.position.y, z);
    if (facing !== undefined) {
      this.baseYaw = facing;
      this.root.rotation.y = facing;
    }
  }

  get position() {
    return this.root.position;
  }

  react(kind: 'hop' | 'talk' = 'hop') {
    this.reactKind = kind;
    this.reactT = kind === 'hop' ? 0.6 : 0.4;
    this.rig.setFace(kind === 'hop' ? 'happy' : 'smile');
  }

  update(dt: number, player: THREE.Vector3 | null) {
    this.t += dt;
    const r = this.rig;
    const t = this.t;
    let bodyY = 0, tilt = 0, armL = 0, armR = 0;
    switch (this.def.idle ?? 'bob') {
      case 'hop': bodyY = Math.max(0, Math.sin(t * 5)) * 0.08 * (Math.sin(t * 0.7) > 0.3 ? 1 : 0); break;
      case 'sway': tilt = Math.sin(t * 1.6) * 0.08; break;
      case 'float': bodyY = 0.25 + Math.sin(t * 1.8) * 0.1; break;
      case 'cook': armL = Math.sin(t * 6) * 0.4; armR = -Math.sin(t * 6) * 0.4; bodyY = Math.abs(Math.sin(t * 3)) * 0.02; break;
      case 'dance': bodyY = Math.abs(Math.sin(t * 6)) * 0.1; tilt = Math.sin(t * 3) * 0.15; armL = armR = Math.sin(t * 6) * 0.8; break;
      case 'cheer': bodyY = Math.abs(Math.sin(t * 7)) * 0.08; armR = 2 + Math.sin(t * 10) * 0.3; break;
      case 'sleep': tilt = 0.1; bodyY = Math.sin(t * 1.2) * 0.01; break;
      default: bodyY = Math.sin(t * 2.2) * 0.025; break;
    }
    if (this.reactT > 0) {
      this.reactT -= dt;
      if (this.reactKind === 'hop') bodyY += Math.sin((1 - this.reactT / 0.6) * Math.PI) * 0.35;
      else tilt += Math.sin(t * 20) * 0.05;
      if (this.reactT <= 0) r.setFace('smile');
    }
    // static Higgsfield models can't wave or blink: give them squash & stretch and a little body wiggle instead
    if (r.model) {
      let sq = 0, turn = 0;
      switch (this.def.idle ?? 'bob') {
        case 'hop': sq = bodyY > 0.005 ? 0.06 : -Math.max(0, Math.sin(t * 5 + Math.PI)) * 0.05; break;
        case 'cook': turn = Math.sin(t * 3) * 0.18; sq = Math.sin(t * 6) * 0.025; break;
        case 'dance': turn = Math.sin(t * 3) * 0.3; sq = Math.sin(t * 12) * 0.05; break;
        case 'cheer': sq = Math.sin(t * 14) * 0.06; turn = Math.sin(t * 5) * 0.12; break;
        case 'float': sq = Math.sin(t * 1.8 + 1) * 0.03; break;
        case 'sleep': sq = Math.sin(t * 1.2) * 0.03; break;
        default: sq = Math.sin(t * 2.2 + 0.8) * 0.025; break;
      }
      if (this.reactT > 0) sq += this.reactKind === 'hop' ? Math.sin((1 - this.reactT / 0.6) * Math.PI * 2) * 0.12 : Math.sin(t * 24) * 0.04;
      if (this.talking) sq += Math.sin(t * 9) * 0.025;
      const k = this.baseScale;
      r.body.scale.set(k * (1 - sq * 0.5), k * (1 + sq), k * (1 - sq * 0.5));
      r.body.rotation.y = turn;
    }
    r.body.position.y = bodyY;
    r.body.rotation.z = tilt;
    r.armL.rotation.z = armL;
    r.armR.rotation.z = -armR;
    for (let i = 0; i < r.ears.length; i++) r.ears[i].rotation.x = Math.sin(t * 2 + i) * 0.08;

    // look at player when near
    let yaw = this.baseYaw;
    if (player) {
      const dx = player.x - this.root.position.x;
      const dz = player.z - this.root.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 16 || this.talking) {
        yaw = Math.atan2(dx, dz);
        r.head.rotation.x = -0.1;
      } else r.head.rotation.x = 0;
    }
    this.root.rotation.y = dampAngle(this.root.rotation.y, yaw, 5, dt);
    // blink
    if (this.reactT <= 0 && !this.talking) {
      const b = (t % 3.7) < 0.12;
      r.setFace(b ? 'blink' : 'smile');
    }
  }

  dispose() {
    this.rig.dispose();
  }
}
