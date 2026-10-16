import type { FogLayer } from './fog-layer';

/** Overlay `?debug=1` : FPS, résolution d'affichage, buckets et instances dessinés, cellules totales. */
export function installDebugOverlay(fog: FogLayer): () => void {
  const el = document.createElement('pre');
  el.dataset.testid = 'fog-debug';
  Object.assign(el.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    margin: '0',
    padding: '6px 8px',
    font: '12px/1.3 monospace',
    background: 'rgb(0 0 0 / 0.7)',
    color: '#9f9',
    zIndex: '2000',
    pointerEvents: 'none',
  });
  document.body.append(el);

  let frames = 0;
  let fps = 0;
  let last = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    frames++;
    if (now - last >= 500) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      const s = fog.stats;
      el.textContent = `fps ${fps}\nres ${s.res}\nbuckets ${s.buckets}\ninstances ${s.instances}\ncells ${s.cells}`;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    el.remove();
  };
}
