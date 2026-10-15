import * as THREE from "three";

/** Retain shadow render targets, not screenshots: they remain correct when the viewer pans/zooms. */
export function createTurnShadowCache(lights: Array<THREE.DirectionalLight | THREE.SpotLight>, capacity = 64) {
  type Frame = Array<{ light: typeof lights[number]; map: THREE.RenderTarget; matrix: THREE.Matrix4 }>;
  const frames = new Map<string, Frame>();
  let attached: Frame | undefined;
  const detach = () => {
    if (!attached) return;
    for (const entry of attached) if (entry.light.shadow.map === entry.map) entry.light.shadow.map = null;
    attached = undefined;
  };
  const release = (frame: Frame) => frame.forEach(({map}) => {map.depthTexture?.dispose(); map.dispose();});
  return {
    restore(key: string) {
      const frame = frames.get(key);
      if (!frame) { detach(); return false; }
      // Dispose the previous uncached (resting or decorated-page) shadow before attaching a cached one.
      for (const light of lights) {
        if (light.shadow.map && !attached?.some(e => e.map === light.shadow.map)) {
          light.shadow.map.depthTexture?.dispose(); light.shadow.map.dispose(); light.shadow.map = null;
        }
      }
      detach();
      for (const entry of frame) { entry.light.shadow.map = entry.map; entry.light.shadow.matrix.copy(entry.matrix); }
      attached = frame;
      frames.delete(key); frames.set(key, frame);
      return true;
    },
    save(key: string) {
      const frame = lights.filter(l => l.castShadow && l.shadow.map).map(light => ({light, map: light.shadow.map!, matrix: light.shadow.matrix.clone()}));
      if (!frame.length) return;
      frames.set(key, frame); attached = frame;
      while (frames.size > capacity) {
        const oldest = frames.keys().next().value!;
        release(frames.get(oldest)!); frames.delete(oldest);
      }
    },
    detach,
    clear() { detach(); frames.forEach(release); frames.clear(); },
  };
}

export function turnShadowKey(progress: number, direction: number, left: boolean, right: boolean) {
  // At most ~6ms of shadow displacement on a 700ms turn; page geometry itself remains continuous.
  return `${direction}:${+left}${+right}:${Math.round(progress * 60)}`;
}
