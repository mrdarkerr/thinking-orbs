// Delegate: one dotted shell dispatches into a root and three child swarms,
// exchanges tiny packets, then reunites — the "delegating" state. The
// topology change communicates parallel sub-agent work without orbit paths.

import type { Dot, ModeDraw } from './types';
import { fibDir, makeProj, paint, radiusScale } from './core';

type Vec3 = [number, number, number];

function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

function rotateLocal([x, y, z]: Vec3, angle: number): Vec3 {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return [x * ca - y * sa, x * sa + y * ca, z];
}

function childCenter(group: number, t: number, distance: number): Vec3 {
  const angle = -Math.PI / 2 + group * (Math.PI * 2) / 3 + 0.035 * Math.sin(t * 0.4 + group);
  return [
    Math.cos(angle) * distance,
    Math.sin(angle) * distance,
    Math.sin(t * 0.46 + group * 2.1) * distance * 0.18,
  ];
}

export const drawDelegate: ModeDraw = (ctx, size, t, dark, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const parentR = size * (o.parentR ?? 0.39);
  const rootR = size * (o.rootR ?? 0.14);
  const childR = size * (o.childR ?? 0.105);
  const childDistance = size * (o.childDistance ?? 0.27);
  const count = Math.max(16, Math.round(o.swarmN ?? 112));
  const packetTrail = Math.max(1, Math.round(o.packetTrail ?? 2));
  const pt = makeProj(0.055 * Math.sin(t * 0.25), 0.22, cx, cy, 1);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const period = 4.8;
  const phase = ((t + 0.8) % period + period) % period;
  let split = 0;
  if (phase >= 0.5 && phase < 1.3) split = smoothstep((phase - 0.5) / 0.8);
  else if (phase >= 1.3 && phase < 3.4) split = 1;
  else if (phase >= 3.4 && phase < 4.2) split = 1 - smoothstep((phase - 3.4) / 0.8);

  const dots: Dot[] = [];
  const rootCount = Math.ceil(count / 4);

  for (let i = 0; i < count; i++) {
    const parentDir = fibDir(i, count);
    const parent: Vec3 = [parentDir[0] * parentR, parentDir[1] * parentR, parentDir[2] * parentR];
    const slot = i % 4;
    const localIndex = Math.floor(i / 4);
    let target: Vec3;

    if (slot === 0) {
      const local = fibDir(localIndex, rootCount);
      target = [local[0] * rootR, local[1] * rootR, local[2] * rootR];
    } else {
      const group = slot - 1;
      const groupCount = Math.max(1, Math.ceil((count - slot) / 4));
      const local = rotateLocal(fibDir(localIndex, groupCount), t * 0.42 + group * 0.7);
      const center = childCenter(group, t, childDistance);
      target = [
        center[0] + local[0] * childR,
        center[1] + local[1] * childR,
        center[2] + local[2] * childR,
      ];
    }

    const x3 = parent[0] + (target[0] - parent[0]) * split;
    const y3 = parent[1] + (target[1] - parent[1]) * split;
    const z3 = parent[2] + (target[2] - parent[2]) * split;
    const [x, y, z] = pt(x3, y3, z3);
    const zDepth = Math.min(1, Math.max(0, z / parentR / 2 + 0.5));

    dots.push({
      x,
      y,
      z,
      r: ((o.rBase ?? 0.55) + (o.rDepth ?? 1.5) * zDepth) * (1 - split * 0.08) * rs,
      white: 0.67 - 0.56 * zDepth,
      a: 0.58 + 0.42 * zDepth,
    });
  }

  // Small request/ack packets use open radial paths rather than ghost
  // circles, keeping this motion distinct from the working/orbits mode.
  if (split > 0.25) {
    for (let group = 0; group < 3; group++) {
      const center = childCenter(group, t, childDistance);
      const travel = 0.5 - 0.5 * Math.cos((t * 0.78 + group / 3) * Math.PI * 2);
      for (let trail = 0; trail < packetTrail; trail++) {
        const p = Math.min(1, Math.max(0, travel - trail * 0.1));
        const [x, y, z] = pt(center[0] * p, center[1] * p, center[2] * p);
        dots.push({
          x,
          y,
          z: z + 0.002,
          r: ((o.rActive ?? 0.9) + (packetTrail - trail - 1) * 0.12) * rs,
          white: 0.08,
          a: split * (1 - trail / (packetTrail + 1)),
        });
      }
    }
  }

  paint(ctx, dots, dark, o.rMin);
};
