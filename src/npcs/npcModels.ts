// Higgsfield NPC models (gpt_image_2_5 concept → sam_3_3d, ≈1.25 credits each), in public/models/npcs/<id>.glb.
// Static textured meshes: the Npc class animates them with bob / hop / squash-and-stretch instead of a rig.
// They are preloaded before a scene is built (Game.goto), so an Npc can swap its procedural body synchronously.
import * as THREE from 'three';
import { loadGlb, normalise } from '../assets/landmarks';
import type { NpcRig } from './NpcFactory';
import type { NpcDef } from './npcData';

/** NPC id → model file (NPCs that share a character, like the Dress Up judge, reuse one model). */
const MODEL_OF: Record<string, string> = {
  hamssi: 'hamssi', dambi: 'dambi', momo: 'momo', nabi: 'nabi', popo: 'popo', lulu: 'lulu', mongmong: 'mongmong',
  yumi: 'yumi', piyo: 'piyo', coco: 'coco', coco_judge: 'coco', choo: 'choo', sunny: 'sunny', pado: 'pado',
};

/** Model height (hats and ears included) before look.scale; Hamin is ≈1.9 tall. */
const MODEL_H: Record<string, number> = {
  hamssi: 1.5, dambi: 1.75, momo: 1.8, nabi: 1.6, popo: 1.45, lulu: 1.35, mongmong: 1.9,
  yumi: 1.75, piyo: 1.45, coco: 1.6, choo: 1.65, sunny: 1.5, pado: 1.3,
};

/** Lift (in world units) for NPCs that stand behind something tall, e.g. the chef behind the food counter. */
const MODEL_LIFT: Record<string, number> = { mongmong: 0.32 };

/** Extra scene → NPC ids that are not in NPCS (created by the scene itself). */
const EXTRA: Record<string, string[]> = { dressing: ['coco_judge'] };

const ready = new Map<string, THREE.Group>();

/** Load the models of the given NPC ids (failures are logged; those NPCs stay procedural). */
export async function preloadNpcModels(npcIds: string[]) {
  const files = [...new Set(npcIds.map((id) => MODEL_OF[id]).filter(Boolean))];
  await Promise.all(files.map(async (f) => {
    if (ready.has(f)) return;
    try {
      ready.set(f, await loadGlb(`models/npcs/${f}.glb`));
    } catch (e) {
      console.warn('npc model failed', f, e);
    }
  }));
}

export function extraNpcIds(sceneId: string) {
  return EXTRA[sceneId] ?? [];
}

/**
 * Swap the procedural body of `rig` for the Higgsfield model (if loaded). The model rides on rig.body, so the
 * existing bob / tilt / hop code keeps working; face, arms and ears are hidden (they are baked into the model).
 */
export function applyNpcModel(rig: NpcRig, def: NpcDef): boolean {
  const file = MODEL_OF[def.id];
  const src = file ? ready.get(file) : undefined;
  if (!src) return false;
  const h = MODEL_H[file] ?? 1.6;
  const m = normalise(src, { h });
  const lift = MODEL_LIFT[def.id] ?? 0;
  m.position.y = lift;
  for (const c of rig.body.children) c.visible = false;
  rig.body.add(m);
  rig.model = m;
  rig.height = (h + lift) * (def.look.scale ?? 1);
  rig.setFace = () => {};
  rig.ears = [];
  return true;
}
