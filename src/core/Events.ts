type Fn = (...args: any[]) => void;

export class Emitter<E extends Record<string, any[]>> {
  private map = new Map<keyof E, Set<Fn>>();
  on<K extends keyof E>(k: K, fn: (...a: E[K]) => void) {
    let s = this.map.get(k);
    if (!s) this.map.set(k, (s = new Set()));
    s.add(fn as Fn);
    return () => s!.delete(fn as Fn);
  }
  emit<K extends keyof E>(k: K, ...a: E[K]) {
    const s = this.map.get(k);
    if (s) for (const f of [...s]) f(...a);
  }
}
