// Torus: a continuous dotted surface circulates through its own centre —
// the "reflecting" state. Material dots move poloidally while an ink seam
// travels against them, suggesting a second pass over the same thought.

import type { Dot, ModeDraw } from './types';
import { angleDelta, makeProj, paint, radiusScale } from './core';

export const drawTorus: ModeDraw = (ctx, size, t, dark, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * (o.spread ?? 0.8);
  const major = o.major ?? 0.64;
  const minor = o.minor ?? 0.36;
  const uCount = Math.max(6, Math.round(o.uCount ?? 30));
  const vCount = Math.max(3, Math.round(o.vCount ?? 9));
  const tilt = (o.tilt ?? 1.02) + 0.035 * Math.sin(t * 0.31);
  const pt = makeProj(t * 0.11, tilt, cx, cy, R);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const flow = t * (o.flow ?? 0.72);
  // At the reduced-motion frame (t=.6), the seam sits on the front-inner
  // shoulder so the torus depth and aperture both read without motion.
  const seam = 1.377 - t * (o.seamSpeed ?? 0.55);
  const dots: Dot[] = [];

  for (let ui = 0; ui < uCount; ui++) {
    for (let vi = 0; vi < vCount; vi++) {
      const u = ((ui + (vi % 2) * 0.5) / uCount) * Math.PI * 2 + t * 0.055;
      const v = (vi / vCount) * Math.PI * 2 + flow + 0.055 * Math.sin(u * 2 - t * 0.3);
      const ring = major + minor * Math.cos(v);
      const [px, py, z] = pt(ring * Math.cos(u), minor * Math.sin(v), ring * Math.sin(u));
      const depth = Math.min(1, Math.max(0, (z + 1) / 2));
      const seamDelta = angleDelta(v, seam);
      const seamBoost = Math.exp(-(seamDelta * seamDelta) / 0.13);

      dots.push({
        x: px,
        y: py,
        z,
        r:
          ((o.rBase ?? 0.6) +
            (o.rDepth ?? 1.5) * depth +
            (o.rActive ?? 0.55) * seamBoost) *
          rs,
        white: 0.69 - 0.58 * depth - 0.1 * seamBoost,
        a: 0.5 + 0.5 * depth,
      });
    }
  }

  paint(ctx, dots, dark, o.rMin);
};
