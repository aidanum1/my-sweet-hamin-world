import * as THREE from 'three';

export interface Interactable {
  id: string;
  pos: THREE.Vector3; // live reference is fine (NPC position)
  radius: number;
  label: string; // shown on the ♡ button / prompt, e.g. "💬 Talk to Momo"
  height?: number; // prompt height above pos
  enabled?: () => boolean;
  onInteract: () => void | Promise<void>;
}

const tmp = new THREE.Vector3();

/** Picks the best interactable near Hamin (distance + facing). */
export function pickInteractable(list: readonly Interactable[], p: THREE.Vector3, facing: number): Interactable | null {
  let best: Interactable | null = null;
  let bestScore = Infinity;
  const fx = Math.sin(facing), fz = Math.cos(facing);
  for (const it of list) {
    if (it.enabled && !it.enabled()) continue;
    tmp.set(it.pos.x - p.x, 0, it.pos.z - p.z);
    const d = tmp.length();
    if (d > it.radius) continue;
    const dot = d > 0.01 ? (tmp.x * fx + tmp.z * fz) / d : 1;
    const score = d * (1.6 - dot * 0.6);
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}
